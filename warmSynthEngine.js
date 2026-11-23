/**
 * warmSynthEngine.js
 * ---------------------------------------------------------------------------
 * Experimentelle "Warm Paper Synth" Web-Audio-Engine (Test-Engine für Admin).
 * Inspiriert von der warmen, perkussiven Klangcharakteristik von playmusictheory.net.
 *
 * ARCHITEKTUR & FEATURES:
 * - Reines Vanilla JS (globales window.WarmSynthEngine), keine externen Audio-Libraries.
 * - Oszillator-Layering pro Note:
 *     1) Sine-Oszillator (100 % Pegel) für ein sauberes, warmes Fundament
 *     2) Triangle-Oszillator (ca. 25 % Pegel, +4 Cents verstimmt) für organische Obertöne
 * - Tiefpassfilterung (BiquadFilterNode lowpass, ~1100 Hz / dynamisch, Q = 1.2)
 * - Klickfreie perkussive ADSR-Hüllkurve (linearer Attack >= 15ms, exponentielles Ausklingen)
 * - Subtiler Feedback-Delay-Raum (0.18s / 0.2 Feedback, gemischt mit Echo-Regler)
 * - Natürlicher Groove durch +18ms Swing-Offset auf jede zweite Note
 * - Sauberes Voice-Management mit automatischem stop() & disconnect() gegen Memory-Leaks
 * ---------------------------------------------------------------------------
 */

(function(root) {
    'use strict';

    /**
     * Feintuning-Konfiguration (direkt über WarmSynthEngine.CONFIG anpassbar)
     */
    const CONFIG = {
        // Oszillator-Layering
        sineMix: 1.0,               // Pegel Oszillator 1 (Sine)
        triangleMix: 0.25,          // Pegel Oszillator 2 (Triangle, ca. 25 %)
        triangleDetuneCents: 4,     // Leichte Verstimmung (+3 bis +5 Cents)

        // Lowpass-Filterung
        lowpassCutoffHz: 1100,      // Basis-Cutoff (~1100 Hz)
        lowpassDynamicTrack: 0.45,  // 0 = fest bei lowpassCutoffHz; >0 = dynamisch an Tonhöhe gekoppelt
        lowpassQ: 1.2,              // Filter-Güte (Q = 1.2)

        // Perkussive ADSR-Hüllkurve
        minAttackSec: 0.015,        // Minimum 15ms gegen Knacken
        defaultAttackSec: 0.018,    // Standard-Attack wenn kein Reglerwert gesetzt
        attackScale: 0.045,         // Skaliert den Classic-Pad-Attack-Wert in perkussive Anschlagszeiten
        defaultReleaseSec: 1.4,     // Standard-Ausklingzeit
        releaseScale: 0.75,         // Skaliert den Release-Regler für Marimba/Kalimba-Ausklang

        // Raum & Groove
        delayTimeSec: 0.18,         // Verzögerungszeit (ca. 0.18s)
        delayFeedback: 0.2,         // Feedback-Anteil (ca. 0.2)
        delayLowpassHz: 1800,       // Warme Höhendämpfung in der Feedback-Schleife
        swingEnabled: true,         // Swing-Offset im Test-Modus aktivieren
        swingOffsetMs: 18           // +18ms Verschiebung auf jede zweite Note
    };

    const FALLBACK_SCALES = {
        major: [2, 2, 1, 2, 2, 2, 1],
        minor: [2, 1, 2, 2, 1, 2, 2],
        lydian: [2, 2, 2, 1, 2, 2, 1],
        dorian: [2, 1, 2, 2, 2, 1, 2],
        pentatonic: [2, 2, 3, 2, 3],
        hirajoshi: [2, 1, 4, 1, 4]
    };

    let localAudioCtx = null;
    let isPlayingState = false;
    const activeVoices = new Set();
    const activeTimers = new Set();
    let currentSessionBuses = null;

    /**
     * Nutzt den gemeinsamen AudioContext (falls audio.js geladen ist) oder erstellt einen eigenen.
     */
    function getAudioContext() {
        if (typeof root.getAudioCtx === 'function') {
            return root.getAudioCtx();
        }
        if (!localAudioCtx) {
            const AudioCtx = root.AudioContext || root.webkitAudioContext;
            if (!AudioCtx) {
                throw new Error("Web Audio API wird von diesem Browser nicht unterstützt.");
            }
            localAudioCtx = new AudioCtx();
        }
        return localAudioCtx;
    }

    function generateScaleFrequencies(scaleName, octaves) {
        const scaleTable = root.scales || FALLBACK_SCALES;
        const intervals = scaleTable[scaleName] || scaleTable.major;
        const freqs = [130.81];
        let currentFreq = 130.81;

        const octCount = Math.max(1, parseInt(octaves, 10) || 3);
        for (let o = 0; o < octCount; o++) {
            for (let i = 0; i < intervals.length; i++) {
                currentFreq = currentFreq * Math.pow(2, intervals[i] / 12);
                freqs.push(currentFreq);
            }
        }
        return freqs;
    }

    /**
     * Erzeugt und verwaltet eine einzelne Warm-Paper-Note mit automatischem Voice-Cleanup.
     */
    function scheduleVoice(ctx, masterBus, delaySend, params) {
        const {
            freq,
            panValue,
            t0,
            attackSec,
            decaySec,
            peakGain,
            cfg
        } = params;

        const t1 = t0 + attackSec;
        const tEnd = t1 + decaySec;

        // 1. Oszillator 1: Sine (100% Fundament)
        const osc1 = ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(freq, t0);

        const gain1 = ctx.createGain();
        gain1.gain.setValueAtTime(cfg.sineMix, t0);

        // 2. Oszillator 2: Triangle (~25% Pegel, leicht verstimmt +4 Cents)
        const osc2 = ctx.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(freq, t0);
        osc2.detune.setValueAtTime(cfg.triangleDetuneCents, t0);

        const gain2 = ctx.createGain();
        gain2.gain.setValueAtTime(cfg.triangleMix, t0);

        // 3. Tiefpassfilter (entfernt digitale Schärfe)
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.setValueAtTime(cfg.lowpassQ, t0);

        let cutoff = cfg.lowpassCutoffHz;
        if (cfg.lowpassDynamicTrack > 0) {
            cutoff = Math.max(
                450,
                Math.min(3500, cfg.lowpassCutoffHz + (freq - 261.63) * cfg.lowpassDynamicTrack)
            );
        }
        filter.frequency.setValueAtTime(cutoff, t0);

        // 4. Klickfreie ADSR-Hüllkurve (linear Attack -> exponentieller Ausklang)
        const envGain = ctx.createGain();
        envGain.gain.setValueAtTime(0.0001, t0);
        envGain.gain.linearRampToValueAtTime(peakGain, t1);
        envGain.gain.setValueAtTime(peakGain, t1);
        envGain.gain.exponentialRampToValueAtTime(0.0001, tEnd);

        // 5. Stereo-Panorama
        const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
        if (panner.pan) {
            const clampedPan = Math.max(-1, Math.min(1, panValue));
            panner.pan.setValueAtTime(clampedPan, t0);
        }

        // Verkabelung
        osc1.connect(gain1);
        osc2.connect(gain2);
        gain1.connect(filter);
        gain2.connect(filter);
        filter.connect(envGain);
        envGain.connect(panner);
        panner.connect(masterBus);

        if (delaySend) {
            panner.connect(delaySend);
        }

        // Voice-Tracking & automatisches disconnect() nach Release
        const voiceRecord = {
            oscillators: [osc1, osc2],
            nodes: [osc1, osc2, gain1, gain2, filter, envGain, panner],
            cleaned: false,
            cleanupTimer: null
        };

        function cleanupVoice() {
            if (voiceRecord.cleaned) return;
            voiceRecord.cleaned = true;
            if (voiceRecord.cleanupTimer) {
                clearTimeout(voiceRecord.cleanupTimer);
                activeTimers.delete(voiceRecord.cleanupTimer);
                voiceRecord.cleanupTimer = null;
            }
            voiceRecord.nodes.forEach(node => {
                try {
                    node.disconnect();
                } catch (e) {
                    // Bereits getrennt
                }
            });
            activeVoices.delete(voiceRecord);
        }

        const stopAt = tEnd + 0.05;
        osc1.onended = cleanupVoice;

        osc1.start(t0);
        osc2.start(t0);
        osc1.stop(stopAt);
        osc2.stop(stopAt);

        const cleanupDelayMs = Math.max(150, (stopAt - ctx.currentTime) * 1000 + 120);
        voiceRecord.cleanupTimer = setTimeout(cleanupVoice, cleanupDelayMs);
        activeTimers.add(voiceRecord.cleanupTimer);
        activeVoices.add(voiceRecord);

        return stopAt;
    }

    /**
     * Erzeugt den Master-Bus und den optionalen warmen Feedback-Delay-Zweig.
     */
    function createSessionBuses(ctx, echo, cfg) {
        const now = ctx.currentTime;
        const destination = root.masterCompressor || ctx.destination;
        const masterBus = ctx.createGain();
        masterBus.gain.setValueAtTime(1.0, now);
        masterBus.connect(destination);

        const sessionNodes = [masterBus];
        let delaySend = null;

        if (echo > 0 || cfg.delayFeedback > 0) {
            const delayNode = ctx.createDelay(1.0);
            delayNode.delayTime.setValueAtTime(cfg.delayTimeSec, now);

            const delayFilter = ctx.createBiquadFilter();
            delayFilter.type = 'lowpass';
            delayFilter.frequency.setValueAtTime(cfg.delayLowpassHz, now);

            const feedbackGain = ctx.createGain();
            const feedbackAmt = Math.min(0.65, cfg.delayFeedback + echo * 0.15);
            feedbackGain.gain.setValueAtTime(feedbackAmt, now);

            delaySend = ctx.createGain();
            delaySend.gain.setValueAtTime(Math.max(0.08, echo * 0.55), now);

            const delayWetGain = ctx.createGain();
            delayWetGain.gain.setValueAtTime(0.65, now);

            delaySend.connect(delayNode);
            delayNode.connect(delayFilter);
            delayFilter.connect(feedbackGain);
            feedbackGain.connect(delayNode);
            delayFilter.connect(delayWetGain);
            delayWetGain.connect(masterBus);

            sessionNodes.push(delaySend, delayNode, delayFilter, feedbackGain, delayWetGain);
        }

        const bus = { ctx, masterBus, delaySend, nodes: sessionNodes };
        currentSessionBuses = bus;
        return bus;
    }

    let vinylSchedulerTimer = null;
    let vinylSession = null;

    /**
     * Bereinigt die globalen Delay-/Master-Busse einer Wiedergabe-Session.
     */
    function cleanupSessionBuses() {
        if (!currentSessionBuses) return;
        const buses = currentSessionBuses;
        currentSessionBuses = null;

        buses.nodes.forEach(node => {
            try {
                node.disconnect();
            } catch (e) {
                // Ignorieren
            }
        });
    }

    /**
     * Stoppt alle laufenden Stimmen, Timer und trennt alle Audio-Nodes sauber.
     */
    function stop() {
        isPlayingState = false;
        if (vinylSchedulerTimer) {
            clearInterval(vinylSchedulerTimer);
            vinylSchedulerTimer = null;
        }
        vinylSession = null;

        activeTimers.forEach(timerId => {
            clearTimeout(timerId);
        });
        activeTimers.clear();

        if (activeVoices.size > 0) {
            const ctx = localAudioCtx || root.audioCtx;
            const now = ctx ? ctx.currentTime : 0;

            activeVoices.forEach(voice => {
                if (voice.cleanupTimer) {
                    clearTimeout(voice.cleanupTimer);
                    voice.cleanupTimer = null;
                }
                voice.oscillators.forEach(osc => {
                    try {
                        osc.onended = null;
                        osc.stop(now);
                    } catch (e) {
                        // Bereits gestoppt
                    }
                });
                voice.nodes.forEach(node => {
                    try {
                        node.disconnect();
                    } catch (e) {
                        // Bereits getrennt
                    }
                });
                voice.cleaned = true;
            });
            activeVoices.clear();
        }

        if (currentSessionBuses && currentSessionBuses.masterBus && currentSessionBuses.ctx) {
            const { ctx, masterBus } = currentSessionBuses;
            const now = ctx.currentTime;
            try {
                masterBus.gain.cancelScheduledValues(now);
                masterBus.gain.setValueAtTime(masterBus.gain.value, now);
                masterBus.gain.linearRampToValueAtTime(0.0001, now + 0.02);
            } catch (e) {}

            const busRef = currentSessionBuses;
            currentSessionBuses = null;
            setTimeout(() => {
                busRef.nodes.forEach(node => {
                    try { node.disconnect(); } catch (e) {}
                });
            }, 30);
        }
    }

    /**
     * Spielt ein Panorama-Relief-Datenobjekt mit der "Warm Paper"-Synthese ab.
     *
     * @param {Object} daten - { bild_breite, bild_hoehe, kurve_y: number[] }
     * @param {Object} synthSettings - Parameter aus dem Formular / Preset
     * @param {Object} [callbacks] - Optional: { onStep(info), onComplete(playedCount) }
     * @param {Object} [overrideConfig] - Optionale Überschreibungen der Engine-CONFIG
     * @returns {Promise<{playedCount: number}>}
     */
    async function play(daten, synthSettings, callbacks = {}, overrideConfig = null) {
        if (!callbacks.skipStop) {
            stop();
        }

        if (!daten || !Array.isArray(daten.kurve_y) || daten.kurve_y.length === 0) {
            throw new Error("Keine gültigen Reliefdaten (kurve_y) vorhanden.");
        }

        const ctx = typeof root.unlockAudioSynchronously === 'function'
            ? root.unlockAudioSynchronously(synthSettings ? synthSettings.volume : undefined)
            : getAudioContext();
        if (ctx.state === 'suspended') {
            await ctx.resume();
        }

        const cfg = overrideConfig ? { ...CONFIG, ...overrideConfig } : { ...CONFIG };
        const s = synthSettings || {};

        const peaks = parseInt(s.peaks, 10);
        const valleys = parseInt(s.valleys, 10);
        const spacing = parseInt(s.spacing, 10) || 35;
        const sensibilitaet = parseInt(s.sensibilitaet !== undefined ? s.sensibilitaet : s.sensibility, 10) || 0;
        const mode = (s.mode ? String(s.mode).trim().toLowerCase() : 'chord');
        const scale = (s.scale ? String(s.scale).trim().toLowerCase() : 'lydian');
        const oktaven = parseInt(s.oktaven !== undefined ? s.oktaven : s.octaves, 10) || 3;
        const range = parseInt(s.range, 10) || 100;
        const volume = Math.max(0.02, Math.min(0.8, parseFloat(s.volume) || 0.25));
        const duration = Math.max(0.5, parseFloat(s.duration) || 5.0);
        const echo = Math.max(0, Math.min(1.0, parseFloat(s.echo) || 0.3));

        // Attack (Minimum 15ms gegen Knacken, gekoppelt an den Attack-Regler)
        const hasExplicitAttack = (s.attack !== null && s.attack !== undefined && s.attack !== '');
        const rawAttack = hasExplicitAttack ? parseFloat(s.attack) : cfg.defaultAttackSec;
        const attackSec = Math.max(
            cfg.minAttackSec,
            (hasExplicitAttack ? rawAttack * cfg.attackScale : rawAttack)
        );

        // Release / Ausklingzeit
        const hasExplicitRelease = (s.release !== null && s.release !== undefined && s.release !== '');
        const rawRelease = hasExplicitRelease ? parseFloat(s.release) : cfg.defaultReleaseSec;
        const decaySec = Math.max(0.18, (hasExplicitRelease ? rawRelease * cfg.releaseScale : rawRelease));

        if (typeof root.findePunkte !== 'function') {
            throw new Error("findePunkte() nicht verfügbar. Bitte audio.js einbinden.");
        }

        const topGipfel = root.findePunkte(daten.kurve_y, isNaN(peaks) ? 4 : peaks, spacing, sensibilitaet, 'gipfel');
        const tiefeTaeler = root.findePunkte(daten.kurve_y, isNaN(valleys) ? 2 : valleys, spacing, sensibilitaet, 'tal');
        const allePunkte = topGipfel.concat(tiefeTaeler);

        if (allePunkte.length === 0) {
            if (typeof callbacks.onComplete === 'function') callbacks.onComplete(0);
            return { playedCount: 0 };
        }

        if (mode === 'rl') {
            allePunkte.sort((a, b) => b.x - a.x);
        } else {
            allePunkte.sort((a, b) => a.x - b.x);
        }

        const tonleiter = generateScaleFrequencies(scale, oktaven);
        const bildBreite = daten.bild_breite || daten.kurve_y.length || 2500;
        const now = ctx.currentTime;

        const bus = (callbacks.skipStop && currentSessionBuses)
            ? currentSessionBuses
            : createSessionBuses(ctx, echo, cfg);
        const { masterBus, delaySend } = bus;

        isPlayingState = true;
        let maxStopTime = now;

        // Bei Akkord-Modus Pegel leicht auf Stimmenzahl verteilen, um Übersteuerung zu vermeiden
        const voicePeakGain = (mode === 'chord' && allePunkte.length > 1)
            ? Math.max(0.04, volume / Math.sqrt(allePunkte.length))
            : volume;

        allePunkte.forEach((punkt, indexPos) => {
            const yProzent = (punkt.hoehe / 100) * (range / 100);
            const freqIndex = Math.max(0, Math.min(tonleiter.length - 1, Math.floor(yProzent * (tonleiter.length - 1))));
            const freq = tonleiter[freqIndex] || 440;

            let startDelay = 0;
            if (mode === 'lr') {
                startDelay = (punkt.x / bildBreite) * duration;
            } else if (mode === 'rl') {
                startDelay = (1 - (punkt.x / bildBreite)) * duration;
            }

            // Optionaler Swing-Offset: jede zweite Note um +18ms verschieben
            const swingSec = (cfg.swingEnabled && (indexPos % 2 === 1))
                ? (cfg.swingOffsetMs / 1000)
                : 0;

            const t0 = now + startDelay + 0.04 + swingSec;
            const panValue = (punkt.x / bildBreite) * 2 - 1;

            const stopAt = scheduleVoice(ctx, masterBus, delaySend, {
                freq,
                panValue,
                t0,
                attackSec,
                decaySec,
                peakGain: voicePeakGain,
                cfg
            });

            if (stopAt > maxStopTime) maxStopTime = stopAt;

            // Optionales UI-Step-Feedback synchron zur Note
            if (typeof callbacks.onStep === 'function') {
                const stepDelayMs = Math.max(0, (t0 - now) * 1000);
                const stepTimer = setTimeout(() => {
                    activeTimers.delete(stepTimer);
                    if (!isPlayingState) return;
                    callbacks.onStep({
                        stepIndex: indexPos,
                        totalSteps: allePunkte.length,
                        punkt,
                        frequencyHz: Math.round(freq * 10) / 10
                    });
                }, stepDelayMs);
                activeTimers.add(stepTimer);
            }
        });

        // Abschluss-Timer inkl. Echo-Ausklang für sauberes Bus-Cleanup
        const echoTailSec = (echo > 0) ? (cfg.delayTimeSec * 4) : 0.1;
        const totalCleanupMs = Math.max(200, ((maxStopTime + echoTailSec) - now) * 1000);

        const endTimer = setTimeout(() => {
            activeTimers.delete(endTimer);
            if (!isPlayingState) return;
            isPlayingState = false;
            cleanupSessionBuses();
            if (typeof callbacks.onComplete === 'function') {
                callbacks.onComplete(allePunkte.length);
            }
        }, totalCleanupMs);
        activeTimers.add(endTimer);

        return { playedCount: allePunkte.length };
    }

    /**
     * Spielt das Vinyl-Super-Array perkussiv im "Warm Paper"-Charakter ab.
     * Nutzt einen Lookahead-Scheduler für minimalen Speicherverbrauch bei langen Loops
     * und unterstützt dynamische RPM-Tempowechsel.
     */
    async function playVinyl(vinylArray, synthSettings = {}, options = {}) {
        stop();

        if (!Array.isArray(vinylArray) || vinylArray.length === 0) return;

        const ctx = typeof root.unlockAudioSynchronously === 'function'
            ? root.unlockAudioSynchronously(synthSettings ? synthSettings.volume : undefined)
            : getAudioContext();
        if (ctx.state === 'suspended') {
            await ctx.resume();
        }

        const cfg = { ...CONFIG };
        const stepSize = 30;
        const smoothArray = [];
        for (let i = 0; i < vinylArray.length; i += stepSize) {
            smoothArray.push(vinylArray[i]);
        }
        if (smoothArray.length === 0) return;

        const maxY = Math.max(...smoothArray);
        const minY = Math.min(...smoothArray);
        const span = (maxY - minY) || 1;
        const points = smoothArray.map((y, idx) => ({
            relativeHoehe: 1.0 - ((y - minY) / span),
            x: idx
        }));

        const baseFreqs = generateScaleFrequencies(synthSettings.scale || 'pentatonic', synthSettings.oktaven || 4);
        const rangePct = (parseInt(synthSettings.range, 10) || 100) / 100;
        const volume = Math.max(0.02, Math.min(0.6, parseFloat(synthSettings.volume) || 0.2));
        const echo = Math.max(0, Math.min(1.0, parseFloat(synthSettings.echo) || 0.35));

        const rpm = parseFloat(options.rpm) || 33;
        const getVinylDuration = typeof options.getVinylDuration === 'function'
            ? options.getVinylDuration
            : (r) => (20 / r) * 60;

        const progress = Math.max(0, Math.min(0.99, Number(root.vinylProgress) || 0));
        const startIdx = Math.floor(progress * points.length);

        const { masterBus, delaySend } = createSessionBuses(ctx, echo, cfg);
        isPlayingState = true;

        const totalTime = getVinylDuration(rpm);
        const stepIntervalSec = totalTime / Math.max(1, points.length);
        // Für Vinyl sanftere Note-Density (~max 8-12 Anschläge/Sek.) durch Sub-Sampling falls extrem dicht
        const stride = Math.max(1, Math.round(0.11 / Math.max(0.005, stepIntervalSec)));

        vinylSession = {
            ctx,
            cfg,
            masterBus,
            delaySend,
            points,
            baseFreqs,
            rangePct,
            volume,
            getVinylDuration,
            rpm,
            stride,
            nextIndex: startIdx,
            nextNoteTime: ctx.currentTime + 0.04,
            noteCounter: 0,
            onComplete: options.onComplete
        };

        const lookaheadSec = 0.25;

        function tickVinylScheduler() {
            if (!isPlayingState || !vinylSession) return;
            const vs = vinylSession;
            const now = vs.ctx.currentTime;
            const totalDurationSec = vs.getVinylDuration(vs.rpm);
            const dtPerIndex = totalDurationSec / Math.max(1, vs.points.length);
            const noteStepSec = dtPerIndex * vs.stride;

            while (vs.nextIndex < vs.points.length && vs.nextNoteTime < now + lookaheadSec) {
                const p = vs.points[vs.nextIndex];
                const idx = Math.max(
                    0,
                    Math.min(vs.baseFreqs.length - 1, Math.floor(p.relativeHoehe * vs.rangePct * (vs.baseFreqs.length - 1)))
                );
                const freq = vs.baseFreqs[idx] || 440;
                const panValue = -0.5 + (vs.nextIndex / vs.points.length);

                const swingSec = (vs.cfg.swingEnabled && (vs.noteCounter % 2 === 1))
                    ? (vs.cfg.swingOffsetMs / 1000)
                    : 0;

                const t0 = Math.max(now + 0.005, vs.nextNoteTime + swingSec);
                const attackSec = vs.cfg.minAttackSec;
                const decaySec = Math.max(0.22, Math.min(1.1, noteStepSec * 2.8));

                scheduleVoice(vs.ctx, vs.masterBus, vs.delaySend, {
                    freq,
                    panValue,
                    t0,
                    attackSec,
                    decaySec,
                    peakGain: vs.volume,
                    cfg: vs.cfg
                });

                vs.nextIndex += vs.stride;
                vs.nextNoteTime += noteStepSec;
                vs.noteCounter++;
            }

            if (vs.nextIndex >= vs.points.length) {
                clearInterval(vinylSchedulerTimer);
                vinylSchedulerTimer = null;
                const remainingMs = Math.max(200, (vs.nextNoteTime - now + 0.8) * 1000);
                const endTimer = setTimeout(() => {
                    activeTimers.delete(endTimer);
                    if (!isPlayingState) return;
                    const cb = vs.onComplete;
                    stop();
                    if (typeof cb === 'function') cb();
                }, remainingMs);
                activeTimers.add(endTimer);
            }
        }

        tickVinylScheduler();
        vinylSchedulerTimer = setInterval(tickVinylScheduler, 75);
    }

    function updateVinylSpeed(newRPM) {
        if (vinylSession && isPlayingState) {
            const parsed = parseFloat(newRPM);
            if (!isNaN(parsed) && parsed > 0) {
                vinylSession.rpm = parsed;
            }
        }
    }

    function setConfig(partial) {
        if (partial && typeof partial === 'object') {
            Object.assign(CONFIG, partial);
        }
        return { ...CONFIG };
    }

    function getConfig() {
        return { ...CONFIG };
    }

    root.WarmSynthEngine = {
        CONFIG,
        play,
        playVinyl,
        updateVinylSpeed,
        stop,
        isPlaying: () => isPlayingState,
        setConfig,
        getConfig
    };

})(typeof window !== 'undefined' ? window : this);
