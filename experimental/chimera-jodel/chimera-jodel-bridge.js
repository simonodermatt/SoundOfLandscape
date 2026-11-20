/**
 * chimera-jodel-bridge.js
 * ---------------------------------------------------------------------------
 * Isolierte Bridge zwischen SoundOfLandscape (Skyline Peak/Valley-Kontur)
 * und der kompilierten Rust/WASM-Engine von `jamesondh/chimera-vocal-synth`.
 *
 * Läuft als reines Vanilla JS (keine Build-Tools nötig für admin.html).
 * Benötigt einen sicheren Browser-Kontext (HTTPS oder http://localhost / 127.0.0.1)
 * für `AudioWorklet`.
 * ---------------------------------------------------------------------------
 */

(function(root) {
    'use strict';

    const BASE_PATH = 'experimental/chimera-jodel/dist';
    const WASM_URL = `${BASE_PATH}/chimera.wasm`;
    const WORKLET_URL = `${BASE_PATH}/chimera-worklet.js`;

    const FULL_RATE = 48000;
    const LIGHT_RATE = 32000;
    const OVERLOAD_THRESHOLD = 0.90;
    const WARM_UP_MS = 2000;

    const SCALES = {
        major: [0, 2, 4, 5, 7, 9, 11],
        minor: [0, 2, 3, 5, 7, 8, 10],
        lydian: [0, 2, 4, 6, 7, 9, 11],
        dorian: [0, 2, 3, 5, 7, 9, 10],
        pentatonic: [0, 2, 4, 7, 9],
        hirajoshi: [0, 2, 3, 7, 8]
    };

    const enc = new TextEncoder();
    const dec = new TextDecoder();

    let wasmModule = null;
    let mainExports = null;
    let initWasmPromise = null;

    let audioCtx = null;
    let workletNode = null;
    let masterGain = null;
    let workletReady = false;
    let currentSampleRate = FULL_RATE;
    let triedLighterRate = false;
    let builtAtMs = 0;
    let loadAtMs = 0;
    let slowLoad = 0;
    let rebuilding = false;

    let currentVoiceMorph = 0.2; // 0 = männlich (tief), 1 = weiblich (hell)
    let isPlayingState = false;
    let speakIdCounter = 0;
    let activeUiTimers = [];
    let telemetryListeners = new Set();
    let lastTelemetry = null;

    /**
     * Prüft, ob AudioWorklet im aktuellen Browser-Kontext verfügbar ist.
     */
    function checkEnvironment() {
        if (!root.isSecureContext) {
            throw new Error(
                "AudioWorklet erfordert einen sicheren Kontext (HTTPS oder http://localhost / 127.0.0.1). " +
                "Aktueller Ursprung ist unsicher (z.B. file:// oder unverschlüsseltes HTTP)."
            );
        }
        const AudioCtx = root.AudioContext || root.webkitAudioContext;
        if (!AudioCtx || !AudioCtx.prototype || !('audioWorklet' in AudioCtx.prototype)) {
            throw new Error("Dieser Browser unterstützt die Web Audio AudioWorklet-API nicht.");
        }
        return AudioCtx;
    }

    /**
     * Lädt und kompiliert `chimera.wasm` einmalig für Main-Thread-Planer & Worklet.
     */
    async function ensureWasmCompiled() {
        if (wasmModule && mainExports) return;
        if (initWasmPromise) return initWasmPromise;

        initWasmPromise = (async () => {
            const res = await fetch(WASM_URL);
            if (!res.ok) {
                throw new Error(`Konnte Chimera WASM nicht laden (${WASM_URL}: HTTP ${res.status})`);
            }
            const bytes = await res.arrayBuffer();
            const mod = await WebAssembly.compile(bytes);
            if (WebAssembly.Module.imports(mod).length > 0) {
                throw new Error("Chimera WASM darf keine externen Imports verlangen.");
            }
            const inst = await WebAssembly.instantiate(mod, {});
            wasmModule = mod;
            mainExports = inst.exports;
        })();

        initWasmPromise.catch(() => {
            initWasmPromise = null;
        });
        return initWasmPromise;
    }

    /**
     * Synchroner JSON-Aufruf an den Rust-Planer (`chimera_call`).
     */
    function callWasm(fn, args = {}) {
        if (!mainExports) {
            throw new Error("Chimera WASM noch nicht initialisiert.");
        }
        const e = mainExports;
        const payload = enc.encode(JSON.stringify({ fn, ...args }));
        const ptr = e.chimera_alloc(payload.length);
        new Uint8Array(e.memory.buffer, ptr, payload.length).set(payload);
        const status = e.chimera_call(ptr, payload.length);
        e.chimera_free(ptr, payload.length);

        const outBytes = new Uint8Array(e.memory.buffer, e.chimera_result_ptr(), e.chimera_result_len());
        const result = JSON.parse(dec.decode(outBytes));
        if (status !== 0) {
            throw new Error(`Chimera ${fn}: ${result.error || 'Unbekannter Fehler'}`);
        }
        return result;
    }

    /**
     * Startet oder baut den AudioContext + AudioWorklet bei der gewünschten Rate auf.
     */
    async function buildAudioWorklet(rate) {
        const AudioCtx = checkEnvironment();
        await ensureWasmCompiled();

        const ctx = new AudioCtx({ latencyHint: 'interactive', sampleRate: rate });
        const resumePromise = ctx.resume().catch(() => {});

        let node;
        try {
            await ctx.audioWorklet.addModule(WORKLET_URL);
            node = new AudioWorkletNode(ctx, 'chimera', {
                numberOfInputs: 0,
                numberOfOutputs: 1,
                outputChannelCount: [2],
                processorOptions: { module: wasmModule }
            });
        } catch (err) {
            try { await ctx.close(); } catch (_) {}
            throw err;
        }

        const oldCtx = audioCtx;
        if (workletNode) {
            workletNode.port.onmessage = null;
            try { workletNode.disconnect(); } catch (_) {}
        }

        const gain = ctx.createGain();
        gain.gain.value = 0.85;
        node.connect(gain);
        gain.connect(ctx.destination);

        audioCtx = ctx;
        workletNode = node;
        masterGain = gain;
        currentSampleRate = ctx.sampleRate;
        builtAtMs = loadAtMs = performance.now();
        slowLoad = 0;
        workletReady = false;

        if (oldCtx) {
            try { void oldCtx.close(); } catch (_) {}
        }

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("Chimera AudioWorklet hat nicht rechtzeitig 'ready' gemeldet."));
            }, 5000);

            node.port.onmessage = (ev) => {
                const msg = ev.data;
                if (!msg) return;

                if (msg.type === 'ready') {
                    clearTimeout(timeout);
                    workletReady = true;
                    resolve();
                } else if (msg.type === 'telemetry') {
                    handleWorkletTelemetry(msg);
                } else if (msg.type === 'error') {
                    console.error('[Chimera Worklet Error]', msg.message);
                    notifyTelemetry({ error: msg.message });
                }
            };
        });

        await Promise.race([
            resumePromise.then(() => ctx.resume()),
            new Promise(r => setTimeout(r, 1500))
        ]);

        // Aktuellen Stimmcharakter sofort setzen
        setVoiceCharacter(currentVoiceMorph);
    }

    function handleWorkletTelemetry(msg) {
        const now = performance.now();
        const dt = Math.min(0.1, (now - loadAtMs) / 1000);
        loadAtMs = now;

        if (now - builtAtMs >= WARM_UP_MS && !rebuilding) {
            const clampedLoad = Math.min(1.5, msg.load || 0);
            slowLoad += ((clampedLoad - slowLoad) * dt) / 2.0;
            if (slowLoad > OVERLOAD_THRESHOLD && currentSampleRate > LIGHT_RATE && !triedLighterRate) {
                void rebuildLighter();
            }
        }

        const baseLat = (audioCtx && audioCtx.baseLatency) ? audioCtx.baseLatency : 0;
        const outLat = (audioCtx && audioCtx.outputLatency) ? audioCtx.outputLatency : 0;
        const quantumMs = (128 / currentSampleRate) * 1000;
        const totalLatencyMs = Math.round((baseLat + outLat) * 1000 + quantumMs);

        lastTelemetry = {
            loadPct: Math.round((msg.load || 0) * 100),
            slowLoadPct: Math.round(slowLoad * 100),
            f0Hz: msg.t ? Math.round((msg.t.f0 || 0) * 10) / 10 : 0,
            outRms: msg.t ? msg.t.outRms : 0,
            activeLabels: (msg.t && msg.t.active) ? msg.t.active : [],
            sampleRate: currentSampleRate,
            latencyMs: totalLatencyMs
        };

        notifyTelemetry(lastTelemetry);
    }

    async function rebuildLighter() {
        rebuilding = triedLighterRate = true;
        try {
            await buildAudioWorklet(LIGHT_RATE);
        } catch (err) {
            console.warn('[Chimera] Fallback auf 32 kHz fehlgeschlagen:', err);
        } finally {
            rebuilding = false;
        }
    }

    function notifyTelemetry(data) {
        telemetryListeners.forEach(cb => {
            try { cb(data); } catch (_) {}
        });
    }

    /**
     * Initialisiert WASM + AudioWorklet (muss aus User-Interaktion aufgerufen werden).
     */
    async function init() {
        if (audioCtx && workletNode && workletReady) {
            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
            }
            return getStatus();
        }
        await buildAudioWorklet(FULL_RATE);
        return getStatus();
    }

    /**
     * Setzt den Stimmcharakter kontinuierlich (0.0 = tief männlich, 1.0 = hell weiblich).
     */
    function setVoiceCharacter(morph01) {
        const clamped = Math.max(0, Math.min(1, Number(morph01) || 0));
        currentVoiceMorph = clamped;
        if (workletNode && workletReady) {
            workletNode.port.postMessage({
                type: 'body',
                body: { female: clamped, child: 0 }
            });
        }
    }

    function clearUiTimers() {
        activeUiTimers.forEach(id => clearTimeout(id));
        activeUiTimers = [];
    }

    /**
     * Stoppt sofort jede laufende AudioWorklet-Sprach-/Gesangsausgabe.
     */
    function stop() {
        clearUiTimers();
        isPlayingState = false;
        if (workletNode) {
            try {
                workletNode.port.postMessage({ type: 'stopSpeech' });
                workletNode.port.postMessage({ type: 'gate', level: 0 });
            } catch (_) {}
        }
    }

    /**
     * Vollständiger Abbau (z.B. beim Deaktivieren des Alpha-Toggles).
     */
    async function dispose() {
        stop();
        if (workletNode) {
            workletNode.port.onmessage = null;
            try { workletNode.disconnect(); } catch (_) {}
            workletNode = null;
        }
        if (masterGain) {
            try { masterGain.disconnect(); } catch (_) {}
            masterGain = null;
        }
        if (audioCtx) {
            try { await audioCtx.close(); } catch (_) {}
            audioCtx = null;
        }
        workletReady = false;
    }

    /**
     * Hilfsfunktion: Erzeugt eine Chimera Syllable-Struktur aus IPA-Onset/Nucleus.
     */
    function makeSyllable(text, onsetIpas, nucleusIpa, stress = 1, wordEnd = false, phraseEnd = false) {
        return {
            text,
            onset: onsetIpas.map(ipa => ({ ipa })),
            nucleus: { ipa: nucleusIpa, stress },
            coda: [],
            wordEnd,
            phraseEnd
        };
    }

    /**
     * Post-Processing der von Chimera generierten Gesten für Jodel-Portamento & Sprung-Dynamik.
     */
    function applyPortamentoAndYodelDynamics(plan, rampTimesPerNote) {
        if (!plan || !Array.isArray(plan.gestures)) return plan;
        let f0Idx = 0;
        for (const g of plan.gestures) {
            if (g.targets && typeof g.targets.f0 === 'number') {
                const customRamp = rampTimesPerNote[Math.min(f0Idx, rampTimesPerNote.length - 1)];
                if (typeof customRamp === 'number') {
                    g.rampIn = Math.max(0.008, Math.min(0.22, customRamp));
                }
                f0Idx++;
            }
        }
        return plan;
    }

    /**
     * 1. SMOKE TEST: Klassische alpine Jodel-Phrasierung ("Jo – dl – i – o – hi – du")
     * mit Registerbrüchen (Sext-/Oktavsprung) und Vokalwechseln (dunkel O/U <-> hell I/E).
     */
    async function playTestJodel(options = {}, callbacks = {}) {
        await init();
        stop();

        const voiceChar = options.voiceCharacter !== undefined ? options.voiceCharacter : currentVoiceMorph;
        const jumpIntensity = options.jumpIntensity !== undefined ? options.jumpIntensity : 0.7;

        // Basis-MIDI gleitet organisch mit dem Stimmcharakter (ca. G3=55 männlich bis F4=65 weiblich)
        const baseMidi = Math.round(54 + voiceChar * 10);
        // Registerbruch-Sprungweite: Sexte (+9) bis Oktave (+12) je nach Intensität
        const registerJump = jumpIntensity >= 0.5 ? 12 : 9;

        const yodelPhrase = [
            {
                midi: baseMidi,
                beats: 0.65,
                ramp: 0.04,
                syl: makeSyllable('Jo', ['j'], 'o', 1, false, false),
                label: 'Jo [Brust · o]'
            },
            {
                midi: baseMidi + 4,
                beats: 0.35,
                ramp: 0.025,
                syl: makeSyllable('dl', ['d', 'l'], 'ə', 0, false, false),
                label: 'dl [Übergang]'
            },
            {
                midi: baseMidi + registerJump,
                beats: 0.70,
                ramp: 0.014, // Harter Kehlkopfschlag ins Falsett
                syl: makeSyllable('i', [], 'i', 1, false, false),
                label: `i [Falsett +${registerJump} · i]`
            },
            {
                midi: baseMidi + 2,
                beats: 0.50,
                ramp: 0.055,
                syl: makeSyllable('o', [], 'o', 0, false, false),
                label: 'o [Brust · o]'
            },
            {
                midi: baseMidi + registerJump,
                beats: 0.75,
                ramp: 0.015,
                syl: makeSyllable('hi', ['h'], 'i', 1, false, false),
                label: `hi [Falsett +${registerJump} · i]`
            },
            {
                midi: baseMidi,
                beats: 1.35,
                ramp: 0.065,
                syl: makeSyllable('du', ['d'], 'u', 1, true, true),
                label: 'du [Brust · u]'
            }
        ];

        const body = { female: voiceChar, child: 0 };
        const bpm = 128;
        const plan = callWasm('planSong', {
            notes: yodelPhrase.map(n => ({ midi: n.midi, beats: n.beats, syl: n.syl })),
            options: { body, bpm, t0: 0, vibrato: 34 }
        });

        applyPortamentoAndYodelDynamics(plan, yodelPhrase.map(n => n.ramp));

        isPlayingState = true;
        const id = ++speakIdCounter;
        workletNode.port.postMessage({
            type: 'schedule',
            gestures: plan.gestures,
            segments: plan.segments,
            end: plan.end,
            id,
            replace: true,
            lead: 0.03
        });

        // Synchronisierte Step-Callbacks für UI-Anzeige
        const beatSec = 60 / bpm;
        let tAcc = 0.03;
        yodelPhrase.forEach((step, idx) => {
            const stepDelayMs = tAcc * 1000;
            const timer = setTimeout(() => {
                if (!isPlayingState) return;
                if (typeof callbacks.onStep === 'function') {
                    callbacks.onStep({
                        stepIndex: idx,
                        totalSteps: yodelPhrase.length,
                        label: step.label,
                        midi: step.midi,
                        isFalsetto: step.midi > baseMidi + 6
                    });
                }
            }, stepDelayMs);
            activeUiTimers.push(timer);
            tAcc += step.beats * beatSec;
        });

        const totalMs = (plan.end + 0.25) * 1000;
        const endTimer = setTimeout(() => {
            isPlayingState = false;
            clearUiTimers();
            if (typeof callbacks.onComplete === 'function') {
                callbacks.onComplete();
            }
        }, totalMs);
        activeUiTimers.push(endTimer);

        return { plan, phraseLength: yodelPhrase.length, durationSec: plan.end };
    }

    /**
     * Fallback-Peak/Valley-Extraktion falls window.findePunkte nicht verfügbar ist.
     */
    function extractContourPoints(kurve, maxCount, spacing, sensibility, typ) {
        if (typeof root.findePunkte === 'function') {
            return root.findePunkte(kurve, maxCount, spacing, sensibility, typ);
        }
        if (!kurve || kurve.length === 0 || maxCount <= 0) return [];
        const win = Math.max(1, (sensibility || 0) + 2);
        const maxY = Math.max(...kurve);
        const minY = Math.min(...kurve);
        const span = (maxY - minY) || 1;
        const candidates = [];

        for (let i = win; i < kurve.length - win; i++) {
            let isPeak = true;
            let isValley = true;
            for (let j = 1; j <= win; j++) {
                if (kurve[i] > kurve[i - j] || kurve[i] > kurve[i + j]) isPeak = false;
                if (kurve[i] < kurve[i - j] || kurve[i] < kurve[i + j]) isValley = false;
            }
            if ((typ === 'gipfel' && isPeak) || (typ === 'tal' && isValley)) {
                const hoehe = ((maxY - kurve[i]) / span) * 100;
                candidates.push({ x: i, y: kurve[i], hoehe });
            }
        }
        candidates.sort((a, b) => typ === 'gipfel' ? b.hoehe - a.hoehe : a.hoehe - b.hoehe);
        const out = [];
        for (const p of candidates) {
            if (!out.some(f => Math.abs(p.x - f.x) < spacing)) {
                out.push(p);
                if (out.length >= maxCount) break;
            }
        }
        return out;
    }

    /**
     * 2. SKYLINE CONTOUR BRIDGE:
     * Wandelt die Panorama-Kontur (Peaks & Valleys) in eine Chimera-Jodel-Sequenz um.
     * - Valleys -> Brustregister, dunkle Vokale ('o' / 'u')
     * - Peaks -> Registerbruch nach oben auf der Skala, helle Vokale ('i' / 'e') + Vibrato
     * - Steilheit (|Δh| / Δx) -> Glissando-Geschwindigkeit (Portamento)
     */
    function buildSequenceFromSkyline(daten, synthSettings = {}, options = {}) {
        const kurve = daten && daten.kurve_y;
        if (!Array.isArray(kurve) || kurve.length === 0) {
            throw new Error("Keine gültigen Skyline-Konturdaten (kurve_y) geladen.");
        }

        const bildBreite = daten.bild_breite || kurve.length || 2500;
        const peaksCount = isNaN(parseInt(synthSettings.peaks, 10)) ? 4 : parseInt(synthSettings.peaks, 10);
        const valleysCount = isNaN(parseInt(synthSettings.valleys, 10)) ? 3 : parseInt(synthSettings.valleys, 10);
        const spacing = parseInt(synthSettings.spacing, 10) || 35;
        const sens = parseInt(synthSettings.sensibilitaet ?? synthSettings.sensibility, 10) || 0;
        const scaleName = (synthSettings.scale || 'pentatonic').toLowerCase();
        const octaves = Math.max(1, Math.min(3, parseInt(synthSettings.oktaven ?? synthSettings.octaves, 10) || 2));
        const mode = (synthSettings.mode || 'lr').toLowerCase();
        const totalDurationSec = Math.max(2.0, Math.min(12.0, parseFloat(synthSettings.duration) || 5.0));

        const voiceChar = options.voiceCharacter !== undefined ? options.voiceCharacter : currentVoiceMorph;
        const jumpIntensity = options.jumpIntensity !== undefined ? options.jumpIntensity : 0.7;

        const gipfel = extractContourPoints(kurve, peaksCount, spacing, sens, 'gipfel').map(p => ({ ...p, kind: 'peak' }));
        const taeler = extractContourPoints(kurve, valleysCount, spacing, sens, 'tal').map(p => ({ ...p, kind: 'valley' }));
        let points = gipfel.concat(taeler);

        if (points.length === 0) {
            throw new Error("Keine Gipfel- oder Talpunkte mit den aktuellen Einstellungen gefunden.");
        }

        if (mode === 'rl') {
            points.sort((a, b) => b.x - a.x);
        } else {
            points.sort((a, b) => a.x - b.x);
        }

        // Musikalische Skala im Brustregister-Bereich (1 Oktave Basis, damit Falsettsprung Luft nach oben hat)
        const scaleIntervals = SCALES[scaleName] || SCALES.pentatonic;
        const scaleNotes = [...scaleIntervals, 12];

        const baseMidi = Math.round(52 + voiceChar * 10); // Männlich ab E3 (52), Weiblich ab D4 (62)
        // Jodel-Sprung-Schwelle: hohe Intensität => schon kleine Höhendifferenz triggert Falsett
        const deltaThreshold = 48 - jumpIntensity * 38; // ~10% bei max, ~48% bei min
        const breakInterval = jumpIntensity >= 0.65 ? 12 : (jumpIntensity >= 0.35 ? 9 : 7);

        const maxY = Math.max(...kurve);
        const minY = Math.min(...kurve);
        const ySpan = (maxY - minY) || 1;

        const bpm = 120; // 1 beat = 0.5s
        const beatSec = 60 / bpm;
        const minNoteSec = 0.24;

        const chestVowels = ['o', 'u'];
        const falsettoVowels = ['i', 'e'];
        const chestOnsets = [['j'], ['d'], []];
        const falsettoOnsets = [['h'], [], ['l']];

        const sequence = [];

        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            const prev = i > 0 ? points[i - 1] : p;
            const next = i < points.length - 1 ? points[i + 1] : null;

            // Skalen-Rasterung im Brust-Grundbereich
            const normH = Math.max(0, Math.min(1, p.hoehe / 100));
            const scaleIdx = Math.min(scaleNotes.length - 1, Math.floor(normH * (scaleNotes.length - 1)));
            let midi = baseMidi + scaleNotes[scaleIdx];

            // Lokales Minimum (tiefste Senke) zwischen prev.x und p.x ermitteln,
            // damit ein Tal zwischen zwei Gipfeln den echten Anstieg & die Steilheit widerspiegelt.
            let localDipH = prev.hoehe;
            let localDipX = prev.x;
            if (i > 0) {
                const startX = Math.max(0, Math.min(kurve.length - 1, Math.round(Math.min(prev.x, p.x))));
                const endX = Math.max(0, Math.min(kurve.length - 1, Math.round(Math.max(prev.x, p.x))));
                for (let kx = startX; kx <= endX; kx++) {
                    const kh = ((maxY - kurve[kx]) / ySpan) * 100;
                    if (kh < localDipH) {
                        localDipH = kh;
                        localDipX = kx;
                    }
                }
            }

            const ascentH = p.hoehe - localDipH;
            const dxNorm = Math.max(0.015, Math.abs(p.x - localDipX) / bildBreite);
            const steepness = Math.abs(ascentH) / (dxNorm * 100);

            let isFalsetto = false;
            if (p.kind === 'peak' && (ascentH >= deltaThreshold || (i === 0 && normH > 0.72))) {
                isFalsetto = true;
                midi += breakInterval;
            }

            // Gesunde Stimm-Clamping-Grenze (vermeidet unnatürliches Überschlagen jenseits von E6)
            const maxMidi = Math.round(78 + voiceChar * 8);
            midi = Math.min(maxMidi, Math.max(baseMidi - 2, midi));

            // Dauer aus horizontalem Abstand zum nächsten Punkt (oder Abschluss-Haltezeit)
            const segShare = next
                ? Math.max(0.08, Math.abs(next.x - p.x) / bildBreite)
                : Math.max(0.22, 1 / Math.max(2, points.length));
            const rawSec = Math.max(minNoteSec, Math.min(1.4, segShare * totalDurationSec));
            const beats = rawSec / beatSec;

            // Steilheit steuert Glissando-/Portamento-Geschwindigkeit (rampIn)
            // Steile Kante -> harter, schneller Jodel-Umbruch (~12-22ms)
            // Sanfter Hang -> weiches Portamento (~70-140ms)
            const rampIn = Math.max(0.011, Math.min(0.15, 0.14 / (1 + steepness * 2.2)));

            const vowel = isFalsetto
                ? falsettoVowels[i % falsettoVowels.length]
                : chestVowels[i % chestVowels.length];

            const onset = (i === 0)
                ? ['j']
                : (isFalsetto
                    ? falsettoOnsets[i % falsettoOnsets.length]
                    : chestOnsets[i % chestOnsets.length]);

            const isLast = (i === points.length - 1);
            const sylText = (onset.join('') || '') + vowel;
            const syl = makeSyllable(sylText, onset, vowel, p.kind === 'peak' ? 1 : 0, isLast, isLast);

            sequence.push({
                point: p,
                midi,
                beats,
                rampIn,
                isFalsetto,
                vowel,
                steepness: Math.round(steepness * 100) / 100,
                syl,
                durationSec: rawSec
            });
        }

        return { sequence, bpm, body: { female: voiceChar, child: 0 } };
    }

    /**
     * Spielt die Skyline-Kontur direkt über die Chimera WASM-Engine ab.
     */
    async function playSkylineJodel(daten, synthSettings = {}, options = {}, callbacks = {}) {
        await init();
        stop();

        const { sequence, bpm, body } = buildSequenceFromSkyline(daten, synthSettings, options);

        const plan = callWasm('planSong', {
            notes: sequence.map(s => ({ midi: s.midi, beats: s.beats, syl: s.syl })),
            options: {
                body,
                bpm,
                t0: 0,
                vibrato: 36 // Haltetöne erhalten ab >0.3s automatisch Vibrato
            }
        });

        applyPortamentoAndYodelDynamics(plan, sequence.map(s => s.rampIn));

        isPlayingState = true;
        const id = ++speakIdCounter;
        workletNode.port.postMessage({
            type: 'schedule',
            gestures: plan.gestures,
            segments: plan.segments,
            end: plan.end,
            id,
            replace: true,
            lead: 0.03
        });

        const beatSec = 60 / bpm;
        let tAcc = 0.03;
        sequence.forEach((step, idx) => {
            const timer = setTimeout(() => {
                if (!isPlayingState) return;
                if (typeof callbacks.onStep === 'function') {
                    callbacks.onStep({
                        stepIndex: idx,
                        totalSteps: sequence.length,
                        point: step.point,
                        midi: step.midi,
                        vowel: step.vowel,
                        isFalsetto: step.isFalsetto,
                        steepness: step.steepness,
                        rampInMs: Math.round(step.rampIn * 1000)
                    });
                }
            }, tAcc * 1000);
            activeUiTimers.push(timer);
            tAcc += step.beats * beatSec;
        });

        const totalMs = (plan.end + 0.25) * 1000;
        const endTimer = setTimeout(() => {
            isPlayingState = false;
            clearUiTimers();
            if (typeof callbacks.onComplete === 'function') {
                callbacks.onComplete(sequence.length);
            }
        }, totalMs);
        activeUiTimers.push(endTimer);

        return { sequence, plan, durationSec: plan.end };
    }

    function onTelemetry(listener) {
        telemetryListeners.add(listener);
        return () => telemetryListeners.delete(listener);
    }

    function getStatus() {
        return {
            ready: Boolean(audioCtx && workletNode && workletReady),
            playing: isPlayingState,
            sampleRate: currentSampleRate,
            voiceCharacter: currentVoiceMorph,
            lastTelemetry
        };
    }

    root.ChimeraJodelBridge = {
        init,
        stop,
        dispose,
        setVoiceCharacter,
        playTestJodel,
        playSkylineJodel,
        buildSequenceFromSkyline,
        onTelemetry,
        getStatus,
        checkEnvironment
    };

})(typeof window !== 'undefined' ? window : this);
