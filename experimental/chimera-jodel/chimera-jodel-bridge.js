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

    let wasmBytesCache = null;
    let wasmModule = null;
    let mainExports = null;
    let initWasmPromise = null;

    let audioCtx = null;
    let usesSharedAudioCtx = false;
    let workletNode = null;
    let masterGain = null;
    let workletReady = false;
    let workletInitPromise = null;
    let usingFallbackEngine = false;
    let wasmFailed = false;
    let lastErrorMessage = null;
    let currentSampleRate = FULL_RATE;
    let triedLighterRate = false;
    let builtAtMs = 0;
    let loadAtMs = 0;
    let slowLoad = 0;
    let rebuilding = false;

    const FALLBACK_VOWEL_FORMANTS = {
        o: [450, 800, 2500],
        u: [320, 680, 2400],
        i: [290, 2200, 3050],
        e: [420, 1950, 2750],
        ə: [500, 1500, 2550],
        a: [730, 1180, 2550]
    };
    let activeFallbackNodes = [];
    const MAX_CHORD_WORKLET_VOICES = 4;
    let activeChoirVoices = [];
    let activeChoirFaces = [];

    let currentVoiceMorph = 0.25; // 0 = männlich (tief), 1 = weiblich (hell)
    let isPlayingState = false;
    let speakIdCounter = 0;
    let activeUiTimers = [];
    let telemetryListeners = new Set();
    let lastTelemetry = null;
    let lastRawTelemetry = null;
    let currentSyllableLabel = '';

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
        if (wasmModule && mainExports) return true;
        if (wasmFailed) return false;
        if (initWasmPromise) return initWasmPromise;

        initWasmPromise = (async () => {
            if (typeof WebAssembly === 'undefined') {
                throw new Error("WebAssembly ist in diesem Browser deaktiviert.");
            }
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
            wasmBytesCache = bytes;
            wasmModule = mod;
            mainExports = inst.exports;
            return true;
        })();

        initWasmPromise.catch((err) => {
            initWasmPromise = null;
            wasmFailed = true;
            lastErrorMessage = err && err.message ? err.message : String(err);
            console.warn('[Chimera] WASM Main-Thread Init fehlgeschlagen, aktiviere JS-Fallback:', lastErrorMessage);
        });
        try {
            return await initWasmPromise;
        } catch (_) {
            return false;
        }
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

    function getOrCreateAudioContext(requestedRate) {
        if (typeof root.getAudioCtx === 'function') {
            const shared = root.getAudioCtx();
            if (shared && shared.state !== 'closed') {
                usesSharedAudioCtx = true;
                return shared;
            }
        }
        const AudioCtx = checkEnvironment();
        usesSharedAudioCtx = false;
        if (!audioCtx || audioCtx.state === 'closed') {
            if (requestedRate) {
                try {
                    audioCtx = new AudioCtx({ latencyHint: 'interactive', sampleRate: requestedRate });
                } catch (_) {
                    audioCtx = new AudioCtx({ latencyHint: 'interactive' });
                }
            } else {
                audioCtx = new AudioCtx({ latencyHint: 'interactive' });
            }
        }
        return audioCtx;
    }

    /**
     * Erstellt/resumt den AudioContext synchron aus einer User-Interaktion heraus,
     * damit strikte Browser (z.B. Edge auf Geschäfts-Notebooks) das Gesture-Token behalten.
     */
    function unlockAudio() {
        try {
            const ctx = getOrCreateAudioContext(null);
            audioCtx = ctx;
            currentSampleRate = ctx.sampleRate || FULL_RATE;
            if (ctx.state === 'suspended') {
                ctx.resume().catch(() => {});
            }
        } catch (err) {
            lastErrorMessage = err && err.message ? err.message : String(err);
            console.warn('[Chimera] Audio-Unlock Warnung:', err);
        }
    }

    /**
     * Startet oder baut den AudioContext + AudioWorklet auf.
     * Fällt bei restriktiven Edge-/GPO-Umgebungen sauber auf den Web-Audio-Formant-Fallback zurück.
     */
    async function buildAudioWorklet(requestedRate) {
        const AudioCtx = checkEnvironment();
        const ctx = (!usesSharedAudioCtx && requestedRate && (!audioCtx || audioCtx.sampleRate !== requestedRate))
            ? (() => {
                try { return new AudioCtx({ latencyHint: 'interactive', sampleRate: requestedRate }); }
                catch (_) { return getOrCreateAudioContext(null); }
            })()
            : getOrCreateAudioContext(null);

        const resumePromise = ctx.state === 'suspended'
            ? ctx.resume().catch(() => {})
            : Promise.resolve();

        const wasmOk = await ensureWasmCompiled();
        if (!wasmOk || !wasmModule) {
            audioCtx = ctx;
            currentSampleRate = ctx.sampleRate || FULL_RATE;
            usingFallbackEngine = true;
            workletReady = true;
            return;
        }

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
            lastErrorMessage = err && err.message ? err.message : String(err);
            console.warn('[Chimera] AudioWorklet init fehlgeschlagen, nutze WebAudio-Formant-Fallback:', lastErrorMessage);
            if (!usesSharedAudioCtx && ctx !== audioCtx) {
                try { await ctx.close(); } catch (_) {}
            }
            audioCtx = ctx;
            currentSampleRate = ctx.sampleRate || FULL_RATE;
            usingFallbackEngine = true;
            workletReady = true;
            return;
        }

        const oldCtx = (!usesSharedAudioCtx && ctx !== audioCtx) ? audioCtx : null;
        if (workletNode) {
            workletNode.port.onmessage = null;
            try { workletNode.disconnect(); } catch (_) {}
        }
        if (masterGain) {
            try { masterGain.disconnect(); } catch (_) {}
        }

        const gain = ctx.createGain();
        gain.gain.value = 0.85;
        node.connect(gain);
        gain.connect((usesSharedAudioCtx && root.masterCompressor) ? root.masterCompressor : ctx.destination);

        audioCtx = ctx;
        workletNode = node;
        masterGain = gain;
        currentSampleRate = ctx.sampleRate || FULL_RATE;
        builtAtMs = loadAtMs = performance.now();
        slowLoad = 0;
        workletReady = false;
        usingFallbackEngine = false;

        if (oldCtx) {
            try { void oldCtx.close(); } catch (_) {}
        }

        node.onprocessorerror = (err) => {
            lastErrorMessage = 'AudioWorklet processorerror';
            console.error('[Chimera Processor Error -> Fallback aktiviert]', err);
            usingFallbackEngine = true;
            workletReady = true;
        };

        try {
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error("Chimera AudioWorklet hat nicht rechtzeitig 'ready' gemeldet."));
                }, 4000);

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
                        lastErrorMessage = msg.message;
                        notifyTelemetry({ error: msg.message });
                        if (!workletReady) {
                            clearTimeout(timeout);
                            reject(new Error(msg.message));
                        }
                    }
                };
                if (typeof node.port.start === 'function') {
                    node.port.start();
                }
            });
        } catch (err) {
            lastErrorMessage = err && err.message ? err.message : String(err);
            console.warn('[Chimera] Worklet ready fehlgeschlagen, aktiviere Formant-Fallback:', lastErrorMessage);
            try { node.disconnect(); } catch (_) {}
            workletNode = null;
            usingFallbackEngine = true;
            workletReady = true;
        }

        await Promise.race([
            resumePromise.then(() => ctx.state === 'suspended' ? ctx.resume().catch(() => {}) : undefined),
            new Promise(r => setTimeout(r, 1200))
        ]);

        if (ctx.state !== 'running') {
            console.warn('[Chimera Audio] AudioContext nach resume noch nicht running:', ctx.state, 'sampleRate=', ctx.sampleRate);
        }

        // Aktuellen Stimmcharakter sofort setzen
        setVoiceCharacter(currentVoiceMorph);
    }

    function handleWorkletTelemetry(msg) {
        lastRawTelemetry = msg;
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
        unlockAudio();
        if (audioCtx && workletNode && workletReady) {
            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
            }
            return getStatus();
        }
        if (!workletInitPromise) {
            workletInitPromise = buildAudioWorklet(null).finally(() => {
                workletInitPromise = null;
            });
        }
        await workletInitPromise;
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

    function stopFallbackNodes() {
        activeFallbackNodes.forEach(n => {
            try { if (typeof n.stop === 'function') n.stop(); } catch (_) {}
            try { if (typeof n.disconnect === 'function') n.disconnect(); } catch (_) {}
        });
        activeFallbackNodes = [];
    }

    function stopChoirVoices() {
        activeChoirVoices.forEach(v => {
            try {
                if (v.node) {
                    v.node.port.onmessage = null;
                    v.node.onprocessorerror = null;
                    v.node.port.postMessage({ type: 'stopSpeech' });
                    v.node.port.postMessage({ type: 'gate', level: 0 });
                    v.node.disconnect();
                }
            } catch (_) {}
            try { if (v.panner) v.panner.disconnect(); } catch (_) {}
            try { if (v.gain) v.gain.disconnect(); } catch (_) {}
        });
        activeChoirVoices = [];
        activeChoirFaces = [];
    }

    /**
     * Stoppt sofort jede laufende AudioWorklet- oder Fallback-Sprach-/Gesangsausgabe.
     */
    function stop() {
        clearUiTimers();
        isPlayingState = false;
        currentSyllableLabel = '';
        stopFallbackNodes();
        stopChoirVoices();
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
            workletNode.onprocessorerror = null;
            try { workletNode.disconnect(); } catch (_) {}
            workletNode = null;
        }
        if (masterGain) {
            try { masterGain.disconnect(); } catch (_) {}
            masterGain = null;
        }
        if (audioCtx && !usesSharedAudioCtx) {
            try { await audioCtx.close(); } catch (_) {}
        }
        if (!usesSharedAudioCtx) {
            audioCtx = null;
        }
        workletReady = false;
    }

    /**
     * Plant ausdrucksstarkes Vibrato-Jodel auf längeren Haltetönen (>= 0.45s) über das AudioWorklet.
     */
    function scheduleVibratoYodelTimers(port, notesList, bpm, jumpInt = 0.7) {
        if (!port || !Array.isArray(notesList)) return;
        const beatSec = 60 / bpm;
        let tCursor = 0.03;
        const peakVibDepth = Math.round(72 + Math.max(0, Math.min(1, jumpInt)) * 38); // 72..110 cents
        const peakVibRate = 6.2;

        notesList.forEach((step) => {
            const noteDur = (step.beats || 0.5) * beatSec;
            const tStart = tCursor;
            tCursor += noteDur;

            if (noteDur >= 0.45) {
                const startTimer = setTimeout(() => {
                    if (!isPlayingState) return;
                    try {
                        port.postMessage({ type: 'source', values: { vibratoDepth: 26, vibratoRate: 5.2 } });
                    } catch (_) {}
                }, tStart * 1000);
                const vibOnTimer = setTimeout(() => {
                    if (!isPlayingState) return;
                    try {
                        port.postMessage({ type: 'source', values: { vibratoDepth: peakVibDepth, vibratoRate: peakVibRate } });
                    } catch (_) {}
                }, (tStart + 0.14) * 1000);
                activeUiTimers.push(startTimer, vibOnTimer);
            } else {
                const flatTimer = setTimeout(() => {
                    if (!isPlayingState) return;
                    try {
                        port.postMessage({ type: 'source', values: { vibratoDepth: 22, vibratoRate: 5.0 } });
                    } catch (_) {}
                }, tStart * 1000);
                activeUiTimers.push(flatTimer);
            }
        });
    }

    /**
     * Reiner Web-Audio-Formant-Synthesizer als automatischer Fallback für Edge-/GPO-Systeme
     * sowie für zusätzliche Chor-Stimmen, inkl. Stereo-Panning und Vibrato-Jodel auf langen Tönen.
     */
    function playFallbackFormantNotes(notesList, bpm, body, startOffsetSec = 0, opts = {}) {
        const ctx = getOrCreateAudioContext(null);
        const dest = (usesSharedAudioCtx && root.masterCompressor) ? root.masterCompressor : ctx.destination;
        const beatSec = 60 / bpm;
        const femaleShift = 1.0 + ((body && body.female !== undefined ? body.female : currentVoiceMorph) * 0.22);
        const panValue = Number.isFinite(opts.panValue) ? Math.max(-1, Math.min(1, opts.panValue)) : 0;
        const gainScale = Number.isFinite(opts.gainScale) ? opts.gainScale : 1.0;
        const jumpInt = Number.isFinite(opts.jumpIntensity) ? opts.jumpIntensity : 0.7;
        const extraDelaySec = Math.max(0, Number(opts.delaySec) || 0);

        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 6.1;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 10; // Basis-Vibrato in Cents
        lfo.connect(lfoGain);
        lfoGain.connect(osc.detune);

        const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 6;
        const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 8;
        const f3 = ctx.createBiquadFilter(); f3.type = 'bandpass'; f3.Q.value = 11;
        const antiBuzzLp = ctx.createBiquadFilter(); antiBuzzLp.type = 'lowpass'; antiBuzzLp.frequency.value = 1800;
        const formSum = ctx.createGain(); formSum.gain.value = 0.55 * gainScale;
        const env = ctx.createGain();
        const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        if (panner && panner.pan) {
            panner.pan.setValueAtTime(panValue, ctx.currentTime);
        }

        osc.connect(antiBuzzLp);
        antiBuzzLp.connect(f1); antiBuzzLp.connect(f2); antiBuzzLp.connect(f3);
        f1.connect(formSum); f2.connect(formSum); f3.connect(formSum);
        formSum.connect(env);
        if (panner) {
            env.connect(panner);
            panner.connect(dest);
        } else {
            env.connect(dest);
        }

        const now = ctx.currentTime + 0.03 + extraDelaySec;
        env.gain.setValueAtTime(0.0001, now);

        let cur = 0;
        let firstSet = false;
        let totalDur = 0;

        notesList.forEach((step) => {
            const noteDur = step.beats * beatSec;
            const noteStart = cur;
            const noteEnd = cur + noteDur;
            cur = noteEnd;
            if (noteEnd <= startOffsetSec) return;

            const adjStart = now + Math.max(0, noteStart - startOffsetSec);
            const adjEnd = now + (noteEnd - startOffsetSec);
            totalDur = Math.max(totalDur, adjEnd - now);

            const freq = 440 * Math.pow(2, (step.midi - 69) / 12);
            const glide = Math.max(0.012, Math.min(0.16, step.rampIn ?? 0.04));
            const vowelKey = step.vowel || (step.syl && step.syl.nucleus && step.syl.nucleus.ipa) || 'o';
            const formants = FALLBACK_VOWEL_FORMANTS[vowelKey] || FALLBACK_VOWEL_FORMANTS.o;

            if (!firstSet) {
                osc.frequency.setValueAtTime(freq, adjStart);
                f1.frequency.setValueAtTime(formants[0] * femaleShift, adjStart);
                f2.frequency.setValueAtTime(formants[1] * femaleShift, adjStart);
                f3.frequency.setValueAtTime(formants[2] * femaleShift, adjStart);
                env.gain.linearRampToValueAtTime(0.32, adjStart + 0.03);
                firstSet = true;
            } else {
                osc.frequency.linearRampToValueAtTime(freq, adjStart + glide);
                f1.frequency.linearRampToValueAtTime(formants[0] * femaleShift, adjStart + glide);
                f2.frequency.linearRampToValueAtTime(formants[1] * femaleShift, adjStart + glide);
                f3.frequency.linearRampToValueAtTime(formants[2] * femaleShift, adjStart + glide);
                env.gain.setValueAtTime(step.isFalsetto ? 0.36 : 0.30, adjStart + 0.01);
            }

            // Vibrato-Jodel auf längeren Tönen (>= 0.45s): nach 0.14s Haltezeit kräftig aufdrehen
            const adjDur = adjEnd - adjStart;
            if (adjDur >= 0.45) {
                const vibPeak = Math.round(48 + jumpInt * 28);
                lfoGain.gain.setValueAtTime(10, adjStart);
                lfoGain.gain.linearRampToValueAtTime(vibPeak, Math.min(adjEnd - 0.05, adjStart + 0.22));
                lfoGain.gain.setValueAtTime(vibPeak, Math.max(adjStart + 0.22, adjEnd - 0.06));
                lfoGain.gain.linearRampToValueAtTime(12, adjEnd);
            } else {
                lfoGain.gain.setValueAtTime(10, adjStart);
            }
        });

        const endAt = now + totalDur + 0.08;
        env.gain.exponentialRampToValueAtTime(0.0001, Math.max(now + 0.05, endAt));
        osc.start(now);
        lfo.start(now);
        osc.stop(endAt + 0.02);
        lfo.stop(endAt + 0.02);

        activeFallbackNodes.push(osc, lfo, lfoGain, antiBuzzLp, f1, f2, f3, formSum, env);
        if (panner) activeFallbackNodes.push(panner);
        return extraDelaySec + totalDur;
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
                currentSyllableLabel = step.label || step.syl.text;
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
            currentSyllableLabel = '';
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

        const isVinyl = Boolean(options.isVinyl || daten.is_vinyl);
        const bildBreite = daten.bild_breite || kurve.length || 2500;
        const peaksCount = isNaN(parseInt(synthSettings.peaks, 10)) ? 4 : parseInt(synthSettings.peaks, 10);
        const valleysCount = isNaN(parseInt(synthSettings.valleys, 10)) ? 3 : parseInt(synthSettings.valleys, 10);
        const spacing = parseInt(synthSettings.spacing, 10) || 35;
        const sens = parseInt(synthSettings.sensibilitaet ?? synthSettings.sensibility, 10) || 0;
        const scaleName = (synthSettings.scale || 'pentatonic').toLowerCase();
        const octaves = Math.max(1, Math.min(6, parseInt(synthSettings.oktaven ?? synthSettings.octaves, 10) || 3));
        const mode = (synthSettings.mode || 'lr').toLowerCase();
        const defaultVinylDur = ((root.vinylTotalRotations || 20) / 33) * 60;
        const totalDurationSec = isVinyl
            ? Math.max(8.0, Number(options.targetDurationSec) || defaultVinylDur)
            : Math.max(2.0, Math.min(18.0, parseFloat(synthSettings.duration) || 5.0));

        const voiceChar = options.voiceCharacter !== undefined ? options.voiceCharacter : currentVoiceMorph;
        const jumpIntensity = options.jumpIntensity !== undefined ? options.jumpIntensity : 0.7;

        const maxY = Math.max(...kurve);
        const minY = Math.min(...kurve);
        const ySpan = (maxY - minY) || 1;

        let points = [];
        if (isVinyl) {
            // Für Vinyl: komplette Rillen-Kontur über alle ~20 Umdrehungen musikalisch in ~56 markante Phrasenpunkte zerlegen
            const targetSteps = Math.max(24, Math.min(64, Math.round(totalDurationSec * 1.6)));
            const segSize = kurve.length / targetSteps;
            for (let sIdx = 0; sIdx < targetSteps; sIdx++) {
                const start = Math.floor(sIdx * segSize);
                const end = Math.min(kurve.length - 1, Math.floor((sIdx + 1) * segSize));
                let pickIdx = start;
                let pickVal = kurve[start];
                // Alternierend bzw. kontrastmaximiert innerhalb des Rillenabschnitts das markanteste Hoch oder Tief wählen
                const lookForPeak = (sIdx % 2 === 0);
                for (let k = start; k <= end; k++) {
                    if ((lookForPeak && kurve[k] < pickVal) || (!lookForPeak && kurve[k] > pickVal)) {
                        pickVal = kurve[k];
                        pickIdx = k;
                    }
                }
                const hoehe = ((maxY - pickVal) / ySpan) * 100;
                points.push({
                    x: pickIdx,
                    y: pickVal,
                    hoehe,
                    kind: lookForPeak ? 'peak' : 'valley'
                });
            }
        } else {
            const gipfel = extractContourPoints(kurve, peaksCount, spacing, sens, 'gipfel').map(p => ({ ...p, kind: 'peak' }));
            const taeler = extractContourPoints(kurve, valleysCount, spacing, sens, 'tal').map(p => ({ ...p, kind: 'valley' }));
            points = gipfel.concat(taeler);

            if (points.length === 0) {
                throw new Error("Keine Gipfel- oder Talpunkte mit den aktuellen Einstellungen gefunden.");
            }

            if (mode === 'rl') {
                points.sort((a, b) => b.x - a.x);
            } else {
                points.sort((a, b) => a.x - b.x);
            }
        }

        // Musikalische Skala über die gewählte Oktavspanne (1..6 Oktaven auf singbaren Bereich gemappt)
        const intervals = SCALES[scaleName] || SCALES.pentatonic;
        const vocalSpanSemis = Math.min(28, 8 + octaves * 3);
        const scaleNotes = [0];
        let accSemi = 0;
        while (accSemi < vocalSpanSemis) {
            for (let ii = 0; ii < intervals.length && accSemi < vocalSpanSemis; ii++) {
                accSemi += intervals[ii];
                if (accSemi <= vocalSpanSemis) scaleNotes.push(accSemi);
            }
        }

        const baseMidi = Math.round(51 + voiceChar * 10); // Männlich ab Eb3 (51), Weiblich ab Db4 (61)
        // Jodel-Sprung-Schwelle: hohe Intensität => schon kleine Höhendifferenz triggert Falsett
        const deltaThreshold = 52 - jumpIntensity * 42; // ~10% bei max, ~52% bei min
        const breakInterval = jumpIntensity >= 0.72 ? 12 : (jumpIntensity >= 0.4 ? 9 : (jumpIntensity >= 0.15 ? 7 : 0));

        const bpm = 120; // 1 beat = 0.5s
        const beatSec = 60 / bpm;
        const minNoteSec = isVinyl ? 0.32 : 0.24;

        const chestVowels = ['o', 'u'];
        const falsettoVowels = ['i', 'e'];
        const chestOnsets = [['j'], ['d'], []];
        const falsettoOnsets = [['h'], [], ['l']];

        const sequence = [];

        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            const prev = i > 0 ? points[i - 1] : p;
            const next = i < points.length - 1 ? points[i + 1] : null;

            const normH = Math.max(0, Math.min(1, p.hoehe / 100));
            const scaleIdx = Math.min(scaleNotes.length - 1, Math.floor(normH * (scaleNotes.length - 1)));
            let midi = baseMidi + scaleNotes[scaleIdx];

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
            if (breakInterval > 0 && p.kind === 'peak' && (ascentH >= deltaThreshold || (i === 0 && normH > 0.72))) {
                isFalsetto = true;
                midi += breakInterval;
            }

            // Gesunde Stimm-Clamping-Grenze (vermeidet unnatürliches Überschlagen jenseits von E6)
            const maxMidi = Math.round(78 + voiceChar * 8);
            midi = Math.min(maxMidi, Math.max(baseMidi - 2, midi));

            const segShare = next
                ? Math.max(1 / (points.length * 1.8), Math.abs(next.x - p.x) / bildBreite)
                : Math.max(0.12, 1 / Math.max(2, points.length));
            const rawSec = Math.max(minNoteSec, Math.min(1.4, segShare * totalDurationSec));
            const beats = rawSec / beatSec;

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

        // Für Vinyl auf die exakte Gesamtdauer (z. B. 36.36s bei 33 RPM & 20 Umdrehungen) skalieren
        if (isVinyl && sequence.length > 0) {
            const currentTotal = sequence.reduce((sum, s) => sum + s.beats * beatSec, 0) || 1;
            const timeScale = totalDurationSec / currentTotal;
            sequence.forEach(s => {
                s.beats = Math.max(0.25, s.beats * timeScale);
                s.durationSec = s.beats * beatSec;
            });
        }

        // Im Modus 'chord' (Akkord): Mehrstimmiger Jodel-Chor (pro Punkt eine Stimme + ein Gesicht!)
        let chordVoices = null;
        if (!isVinyl && mode === 'chord') {
            const choirSlice = sequence.slice(0, 8);
            const holdSec = Math.max(0.9, totalDurationSec - 0.55);
            const leadInSec = 0.24;
            const tailSec = 0.36;

            chordVoices = choirSlice.map((step, idx) => {
                const p = step.point;
                const isPeak = (p.kind === 'peak' || step.isFalsetto);
                const spreadOffset = (idx % 2 === 0 ? -0.06 : 0.06);
                const rawFemale = isPeak
                    ? Math.min(0.98, Math.max(0.45, voiceChar + 0.25 + spreadOffset))
                    : Math.max(0.02, Math.min(0.55, voiceChar - 0.22 + spreadOffset));
                const pan = Math.max(-0.9, Math.min(0.9, ((p.x / bildBreite) * 2 - 1) * 0.9));

                const mainMidi = step.midi;
                const introMidi = Math.max(46, mainMidi - (isPeak ? 5 : 3));
                const endMidi = isPeak ? mainMidi - 2 : mainMidi;
                const introVowel = isPeak ? 'o' : 'u';
                const holdVowel = isPeak ? (idx % 2 === 0 ? 'i' : 'e') : (idx % 2 === 0 ? 'o' : 'u');
                const endVowel = 'u';

                const voiceNotes = [
                    {
                        point: p,
                        midi: introMidi,
                        beats: leadInSec / beatSec,
                        rampIn: 0.03,
                        isFalsetto: false,
                        vowel: introVowel,
                        syl: makeSyllable(isPeak ? 'ho' : 'ju', [isPeak ? 'h' : 'j'], introVowel, 0, false, false),
                        durationSec: leadInSec
                    },
                    {
                        point: p,
                        midi: mainMidi,
                        beats: holdSec / beatSec,
                        rampIn: isPeak ? 0.016 : 0.055,
                        isFalsetto: isPeak || step.isFalsetto,
                        vowel: holdVowel,
                        syl: makeSyllable((isPeak ? 'hi' : 'jo'), [isPeak ? 'h' : 'j'], holdVowel, 1, false, false),
                        durationSec: holdSec
                    },
                    {
                        point: p,
                        midi: endMidi,
                        beats: tailSec / beatSec,
                        rampIn: 0.06,
                        isFalsetto: false,
                        vowel: endVowel,
                        syl: makeSyllable('du', ['d'], endVowel, 0, true, true),
                        durationSec: tailSec
                    }
                ];

                return {
                    voiceIndex: idx,
                    point: p,
                    kind: p.kind,
                    midi: mainMidi,
                    f0Hz: Math.round(440 * Math.pow(2, (mainMidi - 69) / 12) * 10) / 10,
                    vowel: holdVowel,
                    isFalsetto: isPeak || step.isFalsetto,
                    pan,
                    body: { female: Math.round(rawFemale * 100) / 100, child: 0 },
                    syllableLabel: `/${holdVowel}/ ${isPeak ? 'FALSETT' : 'BRUST'}`,
                    notes: voiceNotes
                };
            });
        }

        return { sequence, bpm, mode, jumpIntensity, chordVoices, body: { female: voiceChar, child: 0 } };
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
                currentSyllableLabel = `/${step.vowel}/ ${step.isFalsetto ? 'FALSETT' : 'BRUST'}`;
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
            currentSyllableLabel = '';
            clearUiTimers();
            if (typeof callbacks.onComplete === 'function') {
                callbacks.onComplete(sequence.length);
            }
        }, totalMs);
        activeUiTimers.push(endTimer);

        return { sequence, plan, durationSec: plan.end };
    }

    /**
     * Einheitlicher Kontur-Adapter für:
     * 1. Detailmaske ({ bild_breite, kurve_y: number[] })
     * 2. Relief-Modus ({ is_relief: true, kurve_y_array: [{ y, rawY }] | JSON })
     * 3. Vinyl-Super-Array (number[] über alle Panoramen)
     */
    function normalizeContour(source) {
        if (!source) {
            throw new Error("Keine Konturdaten zum Normalisieren übergeben.");
        }

        // Fall A: Direktes Zahlen-Array (z.B. window.vinylArray)
        if (Array.isArray(source)) {
            if (source.length === 0) {
                throw new Error("Das übergebene Kontur-Array ist leer.");
            }
            // Sehr lange Vinyl-Arrays für musikalische Phrasierung sinnvoll komprimieren (~600-1000 Punkte)
            const maxLen = 900;
            let kurve;
            if (source.length > maxLen) {
                kurve = new Array(maxLen);
                for (let i = 0; i < maxLen; i++) {
                    const idx = Math.round(i * (source.length - 1) / (maxLen - 1));
                    kurve[i] = Number(source[idx]) || 0;
                }
            } else {
                kurve = source.map(v => Number(v) || 0);
            }
            return {
                bild_breite: kurve.length,
                bild_hoehe: 400,
                kurve_y: kurve,
                is_vinyl: true
            };
        }

        // Fall B: Relief-Scan Objekt (is_relief: true mit kurve_y_array)
        if (source.is_relief && source.kurve_y_array) {
            const rawList = (typeof source.kurve_y_array === 'string')
                ? JSON.parse(source.kurve_y_array)
                : source.kurve_y_array;
            const kurve = Array.isArray(rawList)
                ? rawList.map(pt => (typeof pt === 'object' && pt !== null) ? Number(pt.y) : Number(pt))
                : [];
            if (kurve.length === 0) {
                throw new Error("Relief-Profil enthält keine gültigen Höhendaten.");
            }
            return {
                bild_breite: kurve.length,
                bild_hoehe: 400,
                kurve_y: kurve
            };
        }

        // Fall C: Standard Panorama-Objekt ({ bild_breite, bild_hoehe, kurve_y })
        if (Array.isArray(source.kurve_y) && source.kurve_y.length > 0) {
            return {
                bild_breite: source.bild_breite || source.kurve_y.length,
                bild_hoehe: source.bild_hoehe || 1200,
                kurve_y: source.kurve_y
            };
        }

        throw new Error("Unbekanntes Konturdaten-Format.");
    }

    /**
     * Erzeugt einen speicherbaren Chimera-AI-Plan (Detailmaske, Relief oder Vinyl)
     * ohne bereits Audio abzuspielen. Lädt chimera.wasm bei Bedarf nach.
     */
    async function planFromContour(source, synthSettings = {}, options = {}) {
        const wasmOk = await ensureWasmCompiled();
        const daten = normalizeContour(source);

        // Falls Mutation (0.5..1.5) aus dem UI kommt, auf Jodel-Sprung-Intensität (0.25..0.95) mappen
        let jumpInt = options.jumpIntensity;
        if (jumpInt === undefined && synthSettings.jumpIntensity !== undefined) {
            jumpInt = Math.max(0.0, Math.min(1.0, Number(synthSettings.jumpIntensity)));
        }
        if (jumpInt === undefined && synthSettings.mutation !== undefined) {
            const m = Math.max(0.5, Math.min(1.5, Number(synthSettings.mutation) || 1.0));
            jumpInt = Math.max(0.25, Math.min(0.95, (m - 0.5) * 0.7 + 0.25));
        }
        const voiceChar = options.voiceCharacter !== undefined
            ? options.voiceCharacter
            : (synthSettings.voiceCharacter !== undefined ? synthSettings.voiceCharacter : currentVoiceMorph);

        const { sequence, bpm, mode, chordVoices, body } = buildSequenceFromSkyline(daten, synthSettings, {
            voiceCharacter: voiceChar,
            jumpIntensity: jumpInt !== undefined ? jumpInt : 0.7,
            isVinyl: Boolean(options.isVinyl || daten.is_vinyl),
            targetDurationSec: options.targetDurationSec
        });

        let totalTime = chordVoices && chordVoices.length > 0
            ? chordVoices.reduce((mx, v) => Math.max(mx, v.notes.reduce((s, n) => s + n.beats * (60 / bpm), 0)), 0)
            : sequence.reduce((sum, s) => sum + s.beats * (60 / bpm), 0);

        if (wasmOk && mainExports && (!chordVoices || chordVoices.length === 0)) {
            try {
                const plan = callWasm('planSong', {
                    notes: sequence.map(s => ({ midi: s.midi, beats: s.beats, syl: s.syl })),
                    options: {
                        body,
                        bpm,
                        t0: 0,
                        vibrato: 58
                    }
                });
                if (plan && Number.isFinite(plan.end)) {
                    totalTime = plan.end;
                }
            } catch (err) {
                console.warn('[Chimera] WASM planSong Fehler, nutze JS-Timing:', err);
            }
        }

        return {
            engine: 'chimera',
            version: 2,
            mode: mode || 'lr',
            jumpIntensity: jumpInt !== undefined ? jumpInt : 0.7,
            isVinyl: Boolean(options.isVinyl || daten.is_vinyl),
            bpm,
            body,
            totalTime,
            chordVoices,
            notes: sequence.map(s => ({
                midi: s.midi,
                beats: s.beats,
                syl: s.syl,
                rampIn: s.rampIn,
                point: s.point,
                vowel: s.vowel,
                isFalsetto: s.isFalsetto
            }))
        };
    }

    /**
     * Spielt einen mehrstimmigen Jodel-Chor im Akkord-Modus ab (pro Punkt eine Stimme + Gesicht).
     */
    async function playChordPlan(chimeraSeq, options = {}, callbacks = {}) {
        await init();
        stop();

        const voicesSpec = chimeraSeq.chordVoices;
        const effectiveBpm = (chimeraSeq.bpm || 120) * Math.max(0.25, Math.min(3.0, Number(options.speedMultiplier) || 1.0));
        const jumpInt = chimeraSeq.jumpIntensity !== undefined ? chimeraSeq.jumpIntensity : 0.7;
        const ctx = audioCtx || getOrCreateAudioContext(null);
        const dest = (usesSharedAudioCtx && root.masterCompressor) ? root.masterCompressor : ctx.destination;
        const gainPerVoice = Math.min(0.65, 0.95 / Math.sqrt(voicesSpec.length));

        activeChoirFaces = voicesSpec.map((v, idx) => ({
            voiceIndex: idx,
            telemetry: null,
            body: v.body || { female: currentVoiceMorph, child: 0 },
            sampleRate: currentSampleRate,
            syllableLabel: v.syllableLabel || `/${v.vowel || 'o'}/`,
            vowel: v.vowel || 'o',
            kind: v.kind || (v.isFalsetto ? 'peak' : 'valley'),
            f0Hz: v.f0Hz || 220,
            playing: true
        }));

        isPlayingState = true;
        currentSyllableLabel = `CHOR (${voicesSpec.length} STIMMEN)`;
        let maxEndSec = 0;

        for (let idx = 0; idx < voicesSpec.length; idx++) {
            const v = voicesSpec[idx];
            const faceObj = activeChoirFaces[idx];
            const voiceNotes = v.notes || [];
            const staggerSec = idx * 0.035;
            const voiceBody = v.body || { female: currentVoiceMorph, child: 0 };
            const useWorklet = !usingFallbackEngine && mainExports && wasmModule && workletReady && idx < MAX_CHORD_WORKLET_VOICES;

            if (useWorklet) {
                try {
                    const plan = callWasm('planSong', {
                        notes: voiceNotes.map(n => ({ midi: n.midi, beats: n.beats, syl: n.syl })),
                        options: { body: voiceBody, bpm: effectiveBpm, t0: 0, vibrato: 62 }
                    });
                    applyPortamentoAndYodelDynamics(plan, voiceNotes.map(n => n.rampIn ?? 0.04));

                    const vNode = new AudioWorkletNode(ctx, 'chimera', {
                        numberOfInputs: 0,
                        numberOfOutputs: 1,
                        outputChannelCount: [2],
                        processorOptions: { module: wasmModule }
                    });
                    const vGain = ctx.createGain();
                    vGain.gain.setValueAtTime(gainPerVoice, ctx.currentTime);
                    const vPan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
                    if (vPan && vPan.pan) {
                        vPan.pan.setValueAtTime(Math.max(-0.95, Math.min(0.95, v.pan || 0)), ctx.currentTime);
                        vNode.connect(vPan);
                        vPan.connect(vGain);
                    } else {
                        vNode.connect(vGain);
                    }
                    vGain.connect(dest);

                    let voiceScheduled = false;
                    vNode.onprocessorerror = (err) => {
                        console.warn('[Chimera Chor] Processor Error auf Stimme #' + idx, err);
                    };
                    vNode.port.onmessage = (ev) => {
                        const msg = ev.data;
                        if (!msg) return;
                        if (msg.type === 'ready') {
                            if (voiceScheduled) return;
                            voiceScheduled = true;
                            try {
                                vNode.port.postMessage({ type: 'body', body: voiceBody });
                                vNode.port.postMessage({
                                    type: 'schedule',
                                    gestures: plan.gestures,
                                    segments: plan.segments,
                                    end: plan.end,
                                    id: ++speakIdCounter,
                                    replace: true,
                                    lead: 0.03 + staggerSec
                                });
                                scheduleVibratoYodelTimers(vNode.port, voiceNotes, effectiveBpm, jumpInt);
                            } catch (_) {}
                        } else if (msg.type === 'telemetry') {
                            faceObj.telemetry = msg;
                            if (idx === 0) lastRawTelemetry = msg;
                        }
                    };
                    if (typeof vNode.port.start === 'function') vNode.port.start();
                    activeChoirVoices.push({ node: vNode, gain: vGain, panner: vPan, isScheduled: () => voiceScheduled });
                    maxEndSec = Math.max(maxEndSec, (plan.end || 3) + staggerSec);
                    continue;
                } catch (err) {
                    console.warn('[Chimera Chor] Worklet Stimme #' + idx + ' -> Fallback:', err);
                }
            }

            // Fallback oder Stimme > MAX_CHORD_WORKLET_VOICES
            const fDur = playFallbackFormantNotes(voiceNotes, effectiveBpm, voiceBody, 0, {
                panValue: v.pan || 0,
                gainScale: gainPerVoice,
                jumpIntensity: jumpInt,
                delaySec: staggerSec
            });
            maxEndSec = Math.max(maxEndSec, fDur);
        }

        // Nur falls keines der Chor-Worklets überhaupt 'ready' meldet (z. B. GPO-Blockade)
        const hadWorklet = activeChoirVoices.length > 0;
        if (hadWorklet) {
            const wd = setTimeout(() => {
                if (!isPlayingState || usingFallbackEngine) return;
                const anyReady = activeChoirVoices.some(v => v.isScheduled && v.isScheduled());
                if (!anyReady) {
                    console.warn('[Chimera Chor] Worklets haben nicht rechtzeitig ready gemeldet -> Formant-Fallback.');
                    usingFallbackEngine = true;
                    voicesSpec.forEach((v, idx) => {
                        playFallbackFormantNotes(v.notes || [], effectiveBpm, v.body, 0.35, {
                            panValue: v.pan || 0,
                            gainScale: gainPerVoice,
                            jumpIntensity: jumpInt,
                            delaySec: idx * 0.03
                        });
                    });
                }
            }, 1200);
            activeUiTimers.push(wd);
        }

        const totalMs = (Math.max(1.0, maxEndSec) + 0.35) * 1000;
        const endTimer = setTimeout(() => {
            activeChoirFaces.forEach(f => { f.playing = false; });
            isPlayingState = false;
            currentSyllableLabel = '';
            clearUiTimers();
            stopChoirVoices();
            if (typeof callbacks.onComplete === 'function') {
                callbacks.onComplete(voicesSpec.length);
            }
        }, totalMs);
        activeUiTimers.push(endTimer);

        return { plan: { end: maxEndSec }, durationSec: maxEndSec };
    }

    /**
     * Spielt ein erzeugtes oder aus Supabase geladenes Chimera-AI-Preset ab.
     * Unterstützt Chor ('chord'), L->R, R->L, Tempo-Scaling & Start-Offset.
     */
    async function playPlan(chimeraSeq, options = {}, callbacks = {}) {
        if (!chimeraSeq || chimeraSeq.engine !== 'chimera' || !Array.isArray(chimeraSeq.notes) || chimeraSeq.notes.length === 0) {
            throw new Error("Ungültige oder veraltete AI-Sequenz (kein Chimera-Format).");
        }

        if (chimeraSeq.mode === 'chord' && Array.isArray(chimeraSeq.chordVoices) && chimeraSeq.chordVoices.length > 1) {
            return await playChordPlan(chimeraSeq, options, callbacks);
        }

        await init();
        stop();

        const speedMultiplier = Math.max(0.05, Math.min(3.5, Number(options.speedMultiplier) || 1.0));
        const baseBpm = chimeraSeq.bpm || 120;
        const effectiveBpm = baseBpm * speedMultiplier;
        const body = options.body || chimeraSeq.body || { female: currentVoiceMorph, child: 0 };
        const startOffsetOriginalSec = Math.max(0, Number(options.startOffsetSec) || 0);
        const jumpInt = chimeraSeq.jumpIntensity !== undefined ? chimeraSeq.jumpIntensity : 0.7;

        setVoiceCharacter(body.female);

        // Falls wir ab einem Fortschritt (z.B. RPM-Wechsel auf Vinyl) fortsetzen, übrige Noten zuschneiden
        const baseBeatSec = 60 / baseBpm;
        let origCursor = 0;
        const activeNotes = [];
        for (const n of chimeraSeq.notes) {
            const nDurOrig = n.beats * baseBeatSec;
            const nEndOrig = origCursor + nDurOrig;
            if (nEndOrig > startOffsetOriginalSec + 0.02) {
                const remainFrac = origCursor < startOffsetOriginalSec
                    ? Math.max(0.1, (nEndOrig - startOffsetOriginalSec) / nDurOrig)
                    : 1.0;
                activeNotes.push({
                    ...n,
                    beats: n.beats * remainFrac
                });
            }
            origCursor = nEndOrig;
        }

        if (activeNotes.length === 0) {
            if (typeof callbacks.onComplete === 'function') callbacks.onComplete(0);
            return { plan: { end: 0 }, durationSec: 0 };
        }

        let plan = null;
        let durationSec = 0;

        if (!usingFallbackEngine && mainExports && workletNode && workletReady) {
            try {
                plan = callWasm('planSong', {
                    notes: activeNotes.map(n => ({ midi: n.midi, beats: n.beats, syl: n.syl })),
                    options: {
                        body,
                        bpm: effectiveBpm,
                        t0: 0,
                        vibrato: 58
                    }
                });

                applyPortamentoAndYodelDynamics(plan, activeNotes.map(n => n.rampIn ?? 0.04));

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
                scheduleVibratoYodelTimers(workletNode.port, activeNotes, effectiveBpm, jumpInt);
                durationSec = plan.end;
            } catch (err) {
                console.warn('[Chimera] Worklet schedule fehlgeschlagen, wechsle auf Formant-Fallback:', err);
                usingFallbackEngine = true;
                lastErrorMessage = err && err.message ? err.message : String(err);
            }
        }

        if (usingFallbackEngine || !plan) {
            isPlayingState = true;
            durationSec = playFallbackFormantNotes(activeNotes, effectiveBpm, body, 0, {
                jumpIntensity: jumpInt
            });
        }

        const beatSec = 60 / effectiveBpm;
        let tAcc = 0.03;
        activeNotes.forEach((step, idx) => {
            const timer = setTimeout(() => {
                if (!isPlayingState) return;
                currentSyllableLabel = `/${step.vowel || step.syl?.nucleus?.ipa || 'o'}/ ${step.isFalsetto ? 'FALSETT' : 'BRUST'}`;
                if (typeof callbacks.onStep === 'function') {
                    callbacks.onStep({
                        stepIndex: idx,
                        totalSteps: activeNotes.length,
                        point: step.point,
                        midi: step.midi,
                        vowel: step.vowel,
                        isFalsetto: step.isFalsetto
                    });
                }
            }, tAcc * 1000);
            activeUiTimers.push(timer);
            tAcc += step.beats * beatSec;
        });

        const totalMs = (durationSec + 0.25) * 1000;
        const endTimer = setTimeout(() => {
            isPlayingState = false;
            currentSyllableLabel = '';
            clearUiTimers();
            if (typeof callbacks.onComplete === 'function') {
                callbacks.onComplete(activeNotes.length);
            }
        }, totalMs);
        activeUiTimers.push(endTimer);

        return { plan: plan || { end: durationSec }, durationSec };
    }

    function onTelemetry(listener) {
        telemetryListeners.add(listener);
        return () => telemetryListeners.delete(listener);
    }

    function getStatus() {
        return {
            ready: Boolean((audioCtx && workletNode && workletReady) || usingFallbackEngine),
            playing: isPlayingState,
            sampleRate: currentSampleRate,
            voiceCharacter: currentVoiceMorph,
            engineMode: usingFallbackEngine ? 'web-audio-fallback' : 'chimera-wasm',
            lastError: lastErrorMessage,
            lastTelemetry
        };
    }

    root.ChimeraJodelBridge = {
        init,
        unlockAudio,
        stop,
        dispose,
        setVoiceCharacter,
        playTestJodel,
        playSkylineJodel,
        buildSequenceFromSkyline,
        normalizeContour,
        planFromContour,
        playPlan,
        onTelemetry,
        getStatus,
        getChoirFaces: () => (activeChoirFaces.length > 0 ? activeChoirFaces : null),
        getSampleRate: () => currentSampleRate,
        getRawTelemetry: () => lastRawTelemetry,
        getCurrentBody: () => ({ female: currentVoiceMorph, child: 0 }),
        getCurrentSyllableLabel: () => currentSyllableLabel,
        getWasmBuffer: () => wasmBytesCache,
        getWasmUrl: () => WASM_URL,
        checkEnvironment
    };

})(typeof window !== 'undefined' ? window : this);
