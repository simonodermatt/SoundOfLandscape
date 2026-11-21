/**
 * yodel-engine.js
 * -------------------------------------------------------------
 * Autonome, datenbankgesteuerte Formant- & Register-Jodel-Engine (Web Audio API).
 * 
 * ARCHITEKTUR-REGELN:
 * - Reines Vanilla JavaScript (globales window.YodelEngine).
 * - KEINE fest einprogrammierten Jodel-Frequenzen, Skalen oder Schwellenwerte im Code!
 *   Alle musikalischen und synthetischen Parameter MÜSSEN aus dem 'config'-Objekt
 *   (aus der Supabase-Tabelle 'presets' mit is_yodel = true) bezogen werden.
 * - Wiederverwendbare Schnittstelle:
 *   YodelEngine.play(array, config, onStepCallback)
 *   YodelEngine.stop()
 *   YodelEngine.isPlaying()
 * -------------------------------------------------------------
 */

(function(root) {
    'use strict';

    let audioCtx = null;
    let isPlaying = false;
    let playbackTimer = null;
    let activeNodes = null;

    /**
     * Ermittelt oder initialisiert den AudioContext nach User-Geste.
     */
    function getAudioContext() {
        if (!audioCtx) {
            const AudioContextClass = root.AudioContext || root.webkitAudioContext;
            if (!AudioContextClass) {
                throw new Error("Web Audio API wird von diesem Browser nicht unterstützt.");
            }
            audioCtx = new AudioContextClass();
        }
        return audioCtx;
    }

    /**
     * Validiert das übergebene Steuerungs-Objekt.
     * Stellt sicher, dass alle benötigten musikalischen Parameter aus Supabase stammen.
     */
    function validateConfig(config) {
        if (!config || typeof config !== 'object') {
            throw new Error("YodelEngine: Kein gültiges config-Objekt übergeben.");
        }

        const requiredKeys = [
            'base_midi',
            'scale_semitones',
            'step_duration_ms',
            'jump_threshold',
            'drop_threshold',
            'register_interval',
            'glide_up_sec',
            'glide_down_sec',
            'plateau_threshold',
            'breath_mix',
            'vibrato',
            'formants'
        ];

        for (const key of requiredKeys) {
            if (config[key] === undefined || config[key] === null) {
                throw new Error(`YodelEngine: Fehlender Steuerparameter '${key}' in config. Alle musikalischen Werte müssen aus der Datenbank übergeben werden.`);
            }
        }

        if (typeof config.vibrato !== 'object' || 
            config.vibrato.rate_hz === undefined || 
            config.vibrato.depth_cents === undefined) {
            throw new Error("YodelEngine: config.vibrato muss 'rate_hz' und 'depth_cents' enthalten.");
        }

        if (!config.formants.chest || !config.formants.falsetto) {
            throw new Error("YodelEngine: config.formants muss 'chest' und 'falsetto' mit f1, f2, f3, q definieren.");
        }

        if (!Array.isArray(config.scale_semitones) || config.scale_semitones.length === 0) {
            throw new Error("YodelEngine: config.scale_semitones muss ein nicht-leeres Array von Halbton-Schritten sein.");
        }
    }

    /**
     * Bereitet das Eingabe-Array (z. B. Relief-Höhendaten) auf:
     * - Downsampling auf sinnvolle Melodieschritte (z. B. 150-200 Schritte)
     * - Normierung auf 0.0 (tiefster Punkt / Tal) bis 1.0 (höchster Punkt / Gipfel)
     * - Speichern der originalen X-Indizes für synchrone Playhead-Animation
     */
    function prepareArray(rawArray, config) {
        if (!Array.isArray(rawArray) || rawArray.length === 0) {
            throw new Error("YodelEngine: Das übergebene Daten-Array ist leer.");
        }

        const maxSteps = (config.max_steps && Number.isInteger(config.max_steps) && config.max_steps > 0)
            ? config.max_steps
            : 180;

        const originalLength = rawArray.length;
        const targetSteps = originalLength > maxSteps ? maxSteps : originalLength;

        const sampled = new Array(targetSteps);
        const originalIndices = new Array(targetSteps);

        if (originalLength === targetSteps) {
            for (let i = 0; i < targetSteps; i++) {
                sampled[i] = Number(rawArray[i]) || 0;
                originalIndices[i] = i;
            }
        } else {
            for (let i = 0; i < targetSteps; i++) {
                const origIdx = Math.round(i * (originalLength - 1) / (targetSteps - 1));
                sampled[i] = Number(rawArray[origIdx]) || 0;
                originalIndices[i] = origIdx;
            }
        }

        // Min- und Max-Werte ermitteln
        let minY = Infinity;
        let maxY = -Infinity;
        for (let i = 0; i < sampled.length; i++) {
            if (sampled[i] < minY) minY = sampled[i];
            if (sampled[i] > maxY) maxY = sampled[i];
        }
        const span = (maxY - minY) || 1;

        // Invertierung für Canvas-Koordinaten:
        // Im Canvas ist Y=0 oben (Berggipfel = höchste Frequenz) und Y=max unten (Tal = tiefste Frequenz).
        // Standardmäßig invertieren wir für Canvas-Kurven (invert_y !== false).
        const invertY = (config.invert_y !== false);

        const normalized = new Array(targetSteps);
        for (let i = 0; i < targetSteps; i++) {
            if (invertY) {
                normalized[i] = Math.max(0, Math.min(1, (maxY - sampled[i]) / span));
            } else {
                normalized[i] = Math.max(0, Math.min(1, (sampled[i] - minY) / span));
            }
        }

        return {
            normalized,
            originalIndices,
            totalSteps: targetSteps,
            originalLength
        };
    }

    /**
     * Erzeugt einen White-Noise-Buffer für den Atemluft-Anteil.
     */
    function createNoiseBuffer(ctx) {
        const bufferSize = ctx.sampleRate * 2; // 2 Sekunden Loop
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    /**
     * Baut den Web Audio Signalweg auf:
     * Sawtooth (Stimme) + Noise (Atem) -> 3 parallele Bandpass-Filter (Formanten F1, F2, F3) -> Master Gain -> Destination
     */
    function buildAudioGraph(ctx, config) {
        const now = ctx.currentTime;

        // 1. Stimmband-Quelle: Sägezahn-Oszillator
        const voiceOsc = ctx.createOscillator();
        voiceOsc.type = 'sawtooth';

        // 2. Atemluft: Weißes Rauschen
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = createNoiseBuffer(ctx);
        noiseSource.loop = true;

        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(1200, now);
        noiseFilter.Q.setValueAtTime(1.2, now);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(Number(config.breath_mix) || 0.05, now);

        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);

        // Pre-Filter Summenknoten
        const preFilterGain = ctx.createGain();
        preFilterGain.gain.setValueAtTime(0.7, now);

        voiceOsc.connect(preFilterGain);
        noiseGain.connect(preFilterGain);

        // 3. Vibrato (LFO)
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(Number(config.vibrato.rate_hz) || 5.5, now);

        const vibratoGain = ctx.createGain();
        vibratoGain.gain.setValueAtTime(0, now); // Startet zunächst auf 0

        lfo.connect(vibratoGain);
        vibratoGain.connect(voiceOsc.detune);

        // 4. Drei parallele Formant-Filter (F1, F2, F3)
        const initialFormants = config.formants.chest;
        const f1 = ctx.createBiquadFilter();
        f1.type = 'bandpass';
        f1.frequency.setValueAtTime(Number(initialFormants.f1), now);
        f1.Q.setValueAtTime(Number(initialFormants.q), now);

        const f2 = ctx.createBiquadFilter();
        f2.type = 'bandpass';
        f2.frequency.setValueAtTime(Number(initialFormants.f2), now);
        f2.Q.setValueAtTime(Number(initialFormants.q), now);

        const f3 = ctx.createBiquadFilter();
        f3.type = 'bandpass';
        f3.frequency.setValueAtTime(Number(initialFormants.f3), now);
        f3.Q.setValueAtTime(Number(initialFormants.q), now);

        preFilterGain.connect(f1);
        preFilterGain.connect(f2);
        preFilterGain.connect(f3);

        // Formant-Summierung
        const formantSum = ctx.createGain();
        formantSum.gain.setValueAtTime(0.85, now);

        f1.connect(formantSum);
        f2.connect(formantSum);
        f3.connect(formantSum);

        // Master Gain mit Click-Schutz
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(0.0001, now);
        masterGain.gain.exponentialRampToValueAtTime(0.35, now + 0.05); // Sanfter Anschlag

        formantSum.connect(masterGain);
        masterGain.connect(ctx.destination);

        // Oszillatoren starten
        voiceOsc.start(now);
        noiseSource.start(now);
        lfo.start(now);

        return {
            ctx,
            voiceOsc,
            noiseSource,
            lfo,
            vibratoGain,
            f1,
            f2,
            f3,
            masterGain,
            noiseGain
        };
    }

    /**
     * Stoppt die aktuelle Wiedergabe sauber und trennt alle Audio-Knoten.
     */
    function stop() {
        if (playbackTimer) {
            clearInterval(playbackTimer);
            playbackTimer = null;
        }

        if (activeNodes) {
            const { ctx, voiceOsc, noiseSource, lfo, masterGain } = activeNodes;
            const now = ctx.currentTime;

            try {
                // Schnelles, knacksfreies Ausblenden
                masterGain.gain.cancelScheduledValues(now);
                masterGain.gain.setValueAtTime(masterGain.gain.value, now);
                masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

                setTimeout(() => {
                    try {
                        voiceOsc.stop();
                        noiseSource.stop();
                        lfo.stop();
                        voiceOsc.disconnect();
                        noiseSource.disconnect();
                        lfo.disconnect();
                        masterGain.disconnect();
                    } catch (e) {
                        // Ignorieren falls bereits gestoppt
                    }
                }, 40);
            } catch (e) {
                // Fallback
            }

            activeNodes = null;
        }

        isPlaying = false;
    }

    /**
     * Spielt ein Daten-Array als Jodel-Melodie ab.
     * 
     * @param {number[]} array - Beliebig langes Zahlen-Array (z.B. kurve_y oder vinyl_array).
     * @param {Object} config - Steuerparameter aus der Supabase 'presets' Tabelle (is_yodel = true).
     * @param {Function} [onStepCallback] - Wird bei jedem Melodieschritt mit Playhead- und Register-Infos aufgerufen.
     *                                      Wird mit `null` aufgerufen, wenn die Wiedergabe beendet oder gestoppt ist.
     * @returns {Promise<boolean>}
     */
    async function play(array, config, onStepCallback) {
        // Vorherige Wiedergabe beenden
        stop();

        // Parameter & Array validieren
        validateConfig(config);
        const prepared = prepareArray(array, config);

        const ctx = getAudioContext();
        if (ctx.state === 'suspended') {
            await ctx.resume();
        }

        const nodes = buildAudioGraph(ctx, config);
        activeNodes = nodes;
        isPlaying = true;

        const { normalized, originalIndices, totalSteps } = prepared;
        const stepDurationMs = Number(config.step_duration_ms) || 95;
        const stepDurationSec = stepDurationMs / 1000;

        let currentStep = 0;
        let currentRegister = 'chest'; // Startet in Bruststimme

        function applyStep(stepIdx) {
            if (!isPlaying || !activeNodes) return;

            const now = ctx.currentTime;
            const val = normalized[stepIdx];
            const prevVal = (stepIdx > 0) ? normalized[stepIdx - 1] : val;
            const delta = val - prevVal;

            // 1. Relief-zu-Jodel-Logik: Registerwechsel bestimmen
            let glideSec = stepDurationSec * 0.4;

            if (delta > Number(config.jump_threshold)) {
                // Steiler Anstieg -> Wechsel ins Falsett
                currentRegister = 'falsetto';
                glideSec = Number(config.glide_up_sec);
            } else if (delta < -Number(config.drop_threshold)) {
                // Steiler Abfall -> Rückkehr in die Bruststimme
                currentRegister = 'chest';
                glideSec = Number(config.glide_down_sec);
            }

            // 2. Formant-Filter auf aktives Register anwenden
            const formants = (currentRegister === 'falsetto')
                ? config.formants.falsetto
                : config.formants.chest;

            const timeConstant = Math.max(0.002, glideSec / 3);

            nodes.f1.frequency.setTargetAtTime(Number(formants.f1), now, timeConstant);
            nodes.f1.Q.setTargetAtTime(Number(formants.q), now, timeConstant);

            nodes.f2.frequency.setTargetAtTime(Number(formants.f2), now, timeConstant);
            nodes.f2.Q.setTargetAtTime(Number(formants.q), now, timeConstant);

            nodes.f3.frequency.setTargetAtTime(Number(formants.f3), now, timeConstant);
            nodes.f3.Q.setTargetAtTime(Number(formants.q), now, timeConstant);

            // 3. Tonhöhe aus Base-MIDI und Skalen-Intervallen berechnen
            const scaleNotes = config.scale_semitones;
            const scaleIdx = Math.min(
                Math.floor(val * scaleNotes.length),
                scaleNotes.length - 1
            );
            const semitoneOffset = Number(scaleNotes[scaleIdx]) || 0;

            let midiNote = Number(config.base_midi) + semitoneOffset;

            // Im Falsett springt die Tonhöhe zusätzlich um das definierte Register-Intervall
            if (currentRegister === 'falsetto') {
                midiNote += Number(config.register_interval);
            }

            // MIDI zu Frequenz in Hz (A4 = 440 Hz)
            const freqHz = 440 * Math.pow(2, (midiNote - 69) / 12);
            nodes.voiceOsc.frequency.setTargetAtTime(freqHz, now, timeConstant);

            // 4. Vibrato auf flachen Abschnitten verstärken, sonst absenken
            if (Math.abs(delta) < Number(config.plateau_threshold)) {
                nodes.vibratoGain.gain.setTargetAtTime(Number(config.vibrato.depth_cents), now, 0.04);
            } else {
                nodes.vibratoGain.gain.setTargetAtTime(0, now, 0.04);
            }

            // 5. Callback für Playhead-Animation und UI-Anzeige
            if (typeof onStepCallback === 'function') {
                try {
                    onStepCallback({
                        stepIndex: stepIdx,
                        totalSteps: totalSteps,
                        originalIndex: originalIndices[stepIdx],
                        progress: stepIdx / (totalSteps - 1 || 1),
                        normalizedValue: val,
                        delta: delta,
                        register: currentRegister,
                        midiNote: midiNote,
                        frequencyHz: Math.round(freqHz * 10) / 10
                    });
                } catch (cbErr) {
                    console.error("YodelEngine: Fehler in onStepCallback:", cbErr);
                }
            }
        }

        // Ersten Schritt sofort ausführen
        applyStep(0);
        currentStep = 1;

        return new Promise((resolve) => {
            playbackTimer = setInterval(() => {
                if (!isPlaying) {
                    clearInterval(playbackTimer);
                    playbackTimer = null;
                    if (typeof onStepCallback === 'function') onStepCallback(null);
                    resolve(false);
                    return;
                }

                if (currentStep >= totalSteps) {
                    // Ende des Arrays erreicht -> Sauber stoppen
                    stop();
                    if (typeof onStepCallback === 'function') onStepCallback(null);
                    resolve(true);
                    return;
                }

                applyStep(currentStep);
                currentStep++;
            }, stepDurationMs);
        });
    }

    // Öffentliche Schnittstelle
    const YodelEngine = {
        play,
        stop,
        isPlaying: () => isPlaying,
        getAudioContext,
        validateConfig,
        prepareArray
    };

    root.YodelEngine = YodelEngine;

})(typeof window !== 'undefined' ? window : this);
