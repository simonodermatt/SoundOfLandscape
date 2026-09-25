// audio.js - Web Audio API und Synthese

window.activeOscillators = [];
window.audioTimeouts = [];
window.audioIntervals = [];

const scales = {
    major: [2, 2, 1, 2, 2, 2, 1], minor: [2, 1, 2, 2, 1, 2, 2],
    lydian: [2, 2, 2, 1, 2, 2, 1], dorian: [2, 1, 2, 2, 2, 1, 2],
    pentatonic: [2, 2, 3, 2, 3], hirajoshi: [2, 1, 4, 1, 4]
};
window.scales = scales;

function generateScale(scaleName, octaves) {
    const intervals = scales[scaleName] || scales.major;
    let freqs = [];
    let currentFreq = 130.81; 
    
    freqs.push(currentFreq);
    
    for (let o = 0; o < octaves; o++) {
        for (let i = 0; i < intervals.length; i++) {
            currentFreq = currentFreq * Math.pow(2, intervals[i] / 12);
            freqs.push(currentFreq);
        }
    }
    return freqs;
}

window.findePunkte = function(kurve, maxAnzahl, minAbstand, sensibilitaet, typ) {
    if (!kurve || kurve.length === 0) return [];
    
    let punkte = [];
    let windowRange = Math.max(1, sensibilitaet + 2); // Etwas Puffer fürs Rauschen
    let maxY = Math.max(...kurve); 
    let minY = Math.min(...kurve);
    let span = maxY - minY || 1;

    for (let i = windowRange; i < kurve.length - windowRange; i++) {
        let isPeak = true;   // In Pixeln: Kleinster Wert ist oben (Gipfel)
        let isValley = true; // In Pixeln: Größter Wert ist unten (Tal)
        
        for (let j = 1; j <= windowRange; j++) {
            // Umgekehrt: Gipfel = kleinerer Y-Wert als Nachbarn
            if (kurve[i] > kurve[i-j] || kurve[i] > kurve[i+j]) isPeak = false;  
            // Tal = größerer Y-Wert als Nachbarn
            if (kurve[i] < kurve[i-j] || kurve[i] < kurve[i+j]) isValley = false;
        }
        
        if ((typ === 'gipfel' && isPeak) || (typ === 'tal' && isValley)) {
            // Relativhöhe umkehren, damit ein Gipfel (kleines Y) die höchste relative "Höhe" (100%) bekommt
            let hoehe = ((maxY - kurve[i]) / span) * 100;
            punkte.push({ x: i, y: kurve[i], hoehe: hoehe });
        }
    }

    // Sortierung: Höchste Gipfel zuerst, tiefste Täler zuerst
    if (typ === 'gipfel') punkte.sort((a, b) => b.hoehe - a.hoehe); 
    else punkte.sort((a, b) => a.hoehe - b.hoehe); 

    let filtered = [];
    for (let p of punkte) {
        let tooClose = false;
        for (let f of filtered) {
            if (Math.abs(p.x - f.x) < minAbstand) { tooClose = true; break; }
        }
        if (!tooClose) filtered.push(p);
        if (filtered.length >= maxAnzahl) break;
    }
    return filtered;
};

window.getAudioCtx = function() {
    if (!window.audioCtx) {
        window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        window.masterCompressor = window.audioCtx.createDynamicsCompressor();
        window.masterCompressor.threshold.setValueAtTime(-24, window.audioCtx.currentTime);
        window.masterCompressor.knee.setValueAtTime(30, window.audioCtx.currentTime);
        window.masterCompressor.ratio.setValueAtTime(12, window.audioCtx.currentTime);
        window.masterCompressor.attack.setValueAtTime(0.003, window.audioCtx.currentTime);
        window.masterCompressor.release.setValueAtTime(0.25, window.audioCtx.currentTime);

        window.masterCompressor.connect(window.audioCtx.destination);
    }
    return window.audioCtx;
};

window.stopAllAudio = function() {
    if (window.activeOscillators) {
        window.activeOscillators.forEach(osc => {
            try {
                osc.stop();
                osc.disconnect();
            } catch (e) {
            }
        });
        window.activeOscillators = [];
    }

    if (window.activeAiOscillators) {
        window.activeAiOscillators.forEach(osc => {
            try {
                osc.stop();
                osc.disconnect();
            } catch (e) {}
        });
        window.activeAiOscillators = [];
    }

    if (window.vinylAudioState) {
        try {
            if (window.vinylAudioState.osc) { window.vinylAudioState.osc.stop(); window.vinylAudioState.osc.disconnect(); }
            if (window.vinylAudioState.osc2) { window.vinylAudioState.osc2.stop(); window.vinylAudioState.osc2.disconnect(); }
            if (window.vinylAudioState.noise) { window.vinylAudioState.noise.stop(); window.vinylAudioState.noise.disconnect(); }
        } catch(e) {}
    }

    if (window.audioTimeouts) {
        window.audioTimeouts.forEach(t => clearTimeout(t));
        window.audioTimeouts = [];
    }

    if (window.audioIntervals) {
        window.audioIntervals.forEach(i => clearInterval(i));
        window.audioIntervals = [];
    }

    if (typeof window.stopVinylRotation === 'function') {
        window.stopVinylRotation();
    }
};

window.playMultiPanorama = async function(panoId, dateiPfad, playSelectedPresets) {
    window.stopAllAudio();
    const actx = window.getAudioCtx();
    if (actx.state === 'suspended') await actx.resume();
    const t = (typeof text !== 'undefined' && text[window.currentLang]) ? text[window.currentLang] : {};

    try {
        if (!window.panoDataCache[panoId]) {
            const res = await fetch(dateiPfad);
            window.panoDataCache[panoId] = await res.json();
        }
        const daten = window.panoDataCache[panoId];
        let synthsToPlay = [];

        if (playSelectedPresets) {
            let checkedBoxes = document.querySelectorAll(`#preset-list-${panoId} .preset-cb:checked`);
            if (checkedBoxes.length === 0) { alert(t.alert_load_empty || "Bitte markiere mindestens ein Preset!"); return; }
            
            checkedBoxes.forEach(cb => {
                let p = window.currentPresets.find(pr => String(pr.preset_id) === String(cb.value));
                if(p) {
                    synthsToPlay.push({
                        peaks: parseInt(p.peaks) || 4, valleys: parseInt(p.valleys) || 2, spacing: parseInt(p.spacing) || 35,
                        sensibilitaet: parseInt(p.sensibilitaet) || 0, mode: p.mode ? String(p.mode).trim().toLowerCase() : 'chord', 
                        scale: p.scale ? String(p.scale).trim().toLowerCase() : 'lydian', oktaven: parseInt(p.oktaven) || 3, 
                        range: parseInt(p.range) || 100, wave: p.wave ? String(p.wave).trim().toLowerCase() : 'darkpad',
                        volume: parseFloat(p.volume) || 0.2, duration: parseFloat(p.duration) || 5.0, attack: parseFloat(p.attack) || 1.0, 
                        release: parseFloat(p.release) || 2.0, echo: parseFloat(p.echo) || 0.3
                    });
                }
            });
        } else {
            synthsToPlay.push(window.activeSynth[panoId]);
        }

        const delayNode = actx.createDelay();
        delayNode.delayTime.value = 0.4;
        let maxEcho = Math.max(...synthsToPlay.map(s => s.echo || 0));
        const feedbackGain = actx.createGain();
        feedbackGain.gain.value = Math.min(maxEcho, 0.85); 
        
        if (maxEcho > 0) {
            delayNode.connect(feedbackGain);
            feedbackGain.connect(delayNode);
            delayNode.connect(window.masterCompressor);
        }

        const now = actx.currentTime;
        let playedCount = 0;

        synthsToPlay.forEach((s) => {
            const tonleiter = generateScale(s.scale, s.oktaven);
            const topGipfel = window.findePunkte(daten.kurve_y, s.peaks, s.spacing, s.sensibilitaet, 'gipfel');
            const tiefeTaeler = window.findePunkte(daten.kurve_y, s.valleys, s.spacing, s.sensibilitaet, 'tal');
            let allePunkte = topGipfel.concat(tiefeTaeler);

            if (allePunkte.length === 0) return; 
            playedCount++;

            if (s.mode === 'lr') allePunkte.sort((a, b) => a.x - b.x);
            else if (s.mode === 'rl') allePunkte.sort((a, b) => b.x - a.x);

            allePunkte.forEach((punkt, indexPos) => {
                let yProzent = (punkt.hoehe / 100) * (s.range / 100);
                const freqIndex = Math.floor(yProzent * (tonleiter.length - 1));
                const freq = tonleiter[freqIndex] || 440;
                
                const masterGain = actx.createGain();
                let panner = actx.createStereoPanner ? actx.createStereoPanner() : actx.createGain();
                if(panner.pan) panner.pan.value = (punkt.x / daten.bild_breite) * 2 - 1;

                const startDelay = (s.mode === 'chord') ? 0 : (indexPos * 0.25);
                const t0 = now + startDelay + 0.1; 
                const t1 = t0 + Math.max(0.01, s.attack);
                const t2 = t1 + Math.max(0.01, s.duration); 
                const t3 = t2 + Math.max(0.01, s.release);

                masterGain.gain.value = 0; 
                masterGain.gain.setValueAtTime(0, t0); 
                masterGain.gain.linearRampToValueAtTime(s.volume, t1); 
                masterGain.gain.setValueAtTime(s.volume, t2); 
                masterGain.gain.linearRampToValueAtTime(0.0001, t3); 

                masterGain.connect(panner);
                panner.connect(window.masterCompressor);
                if (maxEcho > 0) {
                    panner.connect(delayNode);
                }

                let oscs = [];
                if (s.wave === 'organ') {
                    let o1 = actx.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq / 2;
                    let g1 = actx.createGain(); g1.gain.value = 0.6; o1.connect(g1); g1.connect(masterGain); oscs.push(o1);
                    let o2 = actx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq;
                    let g2 = actx.createGain(); g2.gain.value = 1.0; o2.connect(g2); g2.connect(masterGain); oscs.push(o2);
                    let o3 = actx.createOscillator(); o3.type = 'triangle'; o3.frequency.value = freq * 2;
                    let g3 = actx.createGain(); g3.gain.value = 0.4; o3.connect(g3); g3.connect(masterGain); oscs.push(o3);
                } else if (s.wave === 'darkpad') {
                    let osc = actx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = freq;
                    let filter = actx.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = 2; 
                    filter.frequency.setValueAtTime(300, t0); filter.frequency.linearRampToValueAtTime(1000, t1); filter.frequency.linearRampToValueAtTime(300, t3);
                    osc.connect(filter); filter.connect(masterGain); oscs.push(osc);
                } else if (s.wave === 'chime') {
                    let o1 = actx.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq;
                    let g1 = actx.createGain(); g1.gain.value = 0.8; o1.connect(g1); g1.connect(masterGain); oscs.push(o1);
                    let o2 = actx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2.76;
                    let g2 = actx.createGain(); g2.gain.value = 0.4; o2.connect(g2); g2.connect(masterGain); oscs.push(o2);
                } else if (s.wave === 'detuned_saw') {
                    let o1 = actx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = freq;
                    let g1 = actx.createGain(); g1.gain.value = 0.6; o1.connect(g1); g1.connect(masterGain); oscs.push(o1);
                    let o2 = actx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = freq * 1.015; // leichte Verstimmung
                    let g2 = actx.createGain(); g2.gain.value = 0.6; o2.connect(g2); g2.connect(masterGain); oscs.push(o2);
                } else if (s.wave === 'noise') {
                    // Generiere Rauschen
                    let bufferSize = actx.sampleRate * Math.max(0.1, (t3 - t0 + 0.2));
                    let buffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
                    let data = buffer.getChannelData(0);
                    for (let i = 0; i < bufferSize; i++) {
                        data[i] = Math.random() * 2 - 1;
                    }
                    let noiseNode = actx.createBufferSource();
                    noiseNode.buffer = buffer;

                    let filter = actx.createBiquadFilter();
                    filter.type = 'bandpass';
                    filter.frequency.value = freq; // Filter das Rauschen um die Grundfrequenz
                    filter.Q.value = 1.5;

                    noiseNode.connect(filter);
                    filter.connect(masterGain);

                    // BufferSourceNodes haben eine ähnliche API wie Oszillatoren
                    oscs.push(noiseNode);
                } else {
                    let osc = actx.createOscillator(); osc.type = s.wave; osc.frequency.value = freq;
                    osc.connect(masterGain); oscs.push(osc);
                }

                oscs.forEach(o => {
                    o.start(t0);
                    o.stop(t3 + 0.2);
                    window.activeOscillators.push(o);
                });

                // MIDI Send Logic
                if (window.midiOutput && typeof window.sendMidiNote === 'function') {
                    let midiPitch = window.freqToMidiPitch(freq);
                    let velocity = 80;

                    if (indexPos > 0) {
                        let prevPunkt = allePunkte[indexPos - 1];
                        let diff = Math.abs(punkt.y - prevPunkt.y);
                        let diffNorm = diff / (s.range || 100);
                        velocity = Math.min(127, Math.max(40, 40 + Math.round(diffNorm * 400)));
                    }

                    let delayMs = (t0 - now) * 1000;
                    let durationMs = (t3 - t0) * 1000;

                    let chInput = document.getElementById('num_midi_channel');
                    let channel = chInput ? parseInt(chInput.value) : 1;

                    window.sendMidiNote(midiPitch, velocity, durationMs, delayMs, channel);
                }
            });
        });

        if (playedCount === 0) alert(t.alert_no_points || "Mit diesen Einstellungen wurden keine Punkte gefunden!");

    } catch (e) { alert((t.alert_audio_error || "Audio-Fehler: ") + e.message); }
};


window.playAiPanoAudio = async function(panoId) {
    if (!window.panoAiSequences || !window.panoAiSequences[panoId]) {
        alert(t.alert_gen_ai_comp_first || "Bitte generiere zuerst eine AI Komposition.");
        return;
    }

    window.stopAllAudio();
    const actx = window.getAudioCtx();
    if (actx.state === 'suspended') await actx.resume();

    const sequence = window.panoAiSequences[panoId];
    const synthSettings = window.activeSynth[panoId];

    let startTime = actx.currentTime;

    const globalGain = actx.createGain();
    globalGain.gain.value = synthSettings.volume;
    globalGain.connect(window.masterCompressor);

    // Apply delay based on settings
    let maxEcho = synthSettings.echo || 0;
    const delayNode = actx.createDelay();
    delayNode.delayTime.value = 0.4;
    const feedbackGain = actx.createGain();
    feedbackGain.gain.value = Math.min(maxEcho, 0.85);
    if (maxEcho > 0) {
        delayNode.connect(feedbackGain);
        feedbackGain.connect(delayNode);
        delayNode.connect(window.masterCompressor);
        globalGain.connect(delayNode);
    }

    sequence.notes.forEach(note => {
        const osc = actx.createOscillator();
        const freq = 440 * Math.pow(2, (note.pitch - 69) / 12);
        osc.frequency.value = freq;

        let filter = null;
        let osc2 = null;
        let noise = null;

        if (synthSettings.wave === 'darkpad') {
            osc.type = 'sawtooth';
        } else if (synthSettings.wave === 'chime') {
            osc.type = 'sine';
            osc2 = actx.createOscillator();
            osc2.type = 'triangle';
            osc2.frequency.value = freq * 2;
        } else if (synthSettings.wave === 'noise') {
            const bufferSize = actx.sampleRate * 2.0;
            const buffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let j = 0; j < bufferSize; j++) { data[j] = Math.random() * 2 - 1; }
            noise = actx.createBufferSource();
            noise.buffer = buffer;
            noise.loop = true;
            filter = actx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.Q.value = 10;
            filter.frequency.value = freq;
            noise.connect(filter);
        } else if (synthSettings.wave === 'detuned_saw') {
            osc.type = 'sawtooth';
            osc2 = actx.createOscillator();
            osc2.type = 'sawtooth';
            osc2.frequency.value = freq * 1.01;
        } else {
            osc.type = synthSettings.wave;
        }

        const noteGain = actx.createGain();
        let noteStartTime = startTime + note.startTime;
        let noteEndTime = startTime + note.endTime;

        let attack = synthSettings.attack || 0.1;
        let release = synthSettings.release || 0.1;

        // Ensure attack and release are reasonable for the note length to avoid popping
        let maxAttack = (noteEndTime - noteStartTime) / 2;
        attack = Math.min(attack, maxAttack);

        noteGain.gain.setValueAtTime(0, noteStartTime);
        noteGain.gain.linearRampToValueAtTime(1.0, noteStartTime + attack);
        noteGain.gain.setValueAtTime(1.0, noteEndTime);
        noteGain.gain.exponentialRampToValueAtTime(0.01, noteEndTime + release);

        if (noise) {
            filter.connect(noteGain);
            window.activeOscillators.push(noise);
        } else {
            osc.connect(noteGain);
        }
        if (osc2) {
            osc2.connect(noteGain);
            window.activeOscillators.push(osc2);
        }

        noteGain.connect(globalGain);

        if (noise) {
            noise.start(noteStartTime);
            noise.stop(noteEndTime + release + 0.1);
            window.activeOscillators.push(noise);
        } else {
            osc.start(noteStartTime);
            osc.stop(noteEndTime + release + 0.1);
            window.activeOscillators.push(osc);
        }

        // MIDI Send Logic
        if (window.midiOutput && typeof window.sendMidiNote === 'function') {
            let midiPitch = note.pitch;
            let midiVelocity = note.velocity || 100;

            let delayMs = (noteStartTime - startTime) * 1000;
            let durationMs = (noteEndTime - noteStartTime + release) * 1000;

            let chInput = document.getElementById('num_midi_channel');
            let channel = chInput ? parseInt(chInput.value) : 1;

            window.sendMidiNote(midiPitch, midiVelocity, durationMs, delayMs, channel);
        }
    });
};

window.playVinylAudio = async function(vinylArray) {
    if (typeof window.stopAllAudio === 'function') {
        window.stopAllAudio();
    }
    const actx = window.getAudioCtx();

    let synthSettings = {
        mode: 'lr',
        scale: document.getElementById('sel_vinyl_scale')?.value || 'pentatonic',
        oktaven: parseInt(document.getElementById('sel_vinyl_octaves')?.value) || 4,
        range: 100,
        wave: document.getElementById('sel_vinyl_wave')?.value || 'chime',
        volume: 0.2,
        duration: parseFloat(document.getElementById('range_vinyl_speed')?.value || 15),
        attack: 0.1,
        release: 0.5,
        echo: 0.4
    };

    if(actx.state === 'suspended') await actx.resume();

    // Check if we have an AI generated sequence AND we are playing it via playAiVinyl
    if (window.vinylAiSequence && window.isPlayingAiVinyl) {
        window.vinylAudioState = {
            isAi: true,
            actx: actx,
            synthSettings: synthSettings,
            getVinylDuration: (currentRpm) => { return window.vinylAiSequence.totalTime / (currentRpm / 33.0); },
            stopTimeoutId: null
        };
        let rpm = parseFloat(document.getElementById('range_vinyl_speed')?.value || 33);
        window.scheduleAiVinylAudioEvents(rpm, actx.currentTime);
        return;
    }

    let baseFreqs = generateScale(synthSettings.scale, synthSettings.oktaven);

    // Smooth the array heavily so it's not crazy noisy for every pixel
    let stepSize = 30; // Read a value every N pixels
    let smoothArray = [];
    for (let i = 0; i < vinylArray.length; i += stepSize) {
        smoothArray.push(vinylArray[i]);
    }

    if (smoothArray.length === 0) return;

    let maxY = Math.max(...smoothArray);
    let minY = Math.min(...smoothArray);
    let span = maxY - minY || 1;

    let points = smoothArray.map((y, idx) => {
        let h = 1.0 - ((y - minY) / span); // Invert Y
        return { relativeHoehe: h, x: idx };
    });

    // Total playback time based on current RPM and 20 rotations
    let rpm = parseFloat(document.getElementById('range_vinyl_speed')?.value || 33);
    let getVinylDuration = (currentRpm) => {
        let totalRotations = (typeof window.vinylTotalRotations !== 'undefined') ? window.vinylTotalRotations : 20;
        return (totalRotations / currentRpm) * 60;
    };
    let totalTime = getVinylDuration(rpm);

    const t = (typeof text !== 'undefined' && text[window.currentLang]) ? text[window.currentLang] : {};

    if(actx.state === 'suspended') await actx.resume();
    let startTime = actx.currentTime;

    const osc = actx.createOscillator();
    const gain = actx.createGain();
    const panner = actx.createStereoPanner();
    let filter = null;
    let osc2 = null;
    let noise = null;

    if (synthSettings.wave === 'darkpad') {
        osc.type = 'sawtooth';
        filter = actx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 800;
        osc.connect(filter); filter.connect(gain);
    } else if (synthSettings.wave === 'chime') {
        osc.type = 'sine';
        osc2 = actx.createOscillator();
        osc2.type = 'triangle';
        osc2.connect(gain);
        window.activeOscillators.push(osc2);
        osc.connect(gain);
    } else if (synthSettings.wave === 'noise') {
        const bufferSize = actx.sampleRate * 2.0;
        const buffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let j = 0; j < bufferSize; j++) { data[j] = Math.random() * 2 - 1; }
        noise = actx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;
        filter = actx.createBiquadFilter();
        filter.type = 'bandpass'; filter.Q.value = 10;
        noise.connect(filter); filter.connect(gain);
        window.activeOscillators.push(noise);
    } else if (synthSettings.wave === 'detuned_saw') {
        osc.type = 'sawtooth';
        osc2 = actx.createOscillator();
        osc2.type = 'sawtooth';
        osc2.connect(gain);
        window.activeOscillators.push(osc2);
        osc.connect(gain);
    } else {
        osc.type = synthSettings.wave || 'sine';
        osc.connect(gain);
    }

    if (synthSettings.echo > 0) {
        const delayNode = actx.createDelay();
        delayNode.delayTime.value = synthSettings.echo;
        const feedback = actx.createGain();
        feedback.gain.value = 0.4;
        gain.connect(delayNode);
        delayNode.connect(feedback);
        feedback.connect(delayNode);
        delayNode.connect(panner);
    } else {
        gain.connect(panner);
    }

    panner.connect(window.masterCompressor);

    // Store state for dynamic speed updates
    window.vinylAudioState = {
        actx,
        gain,
        osc,
        osc2,
        noise,
        filter,
        panner,
        synthSettings,
        baseFreqs,
        points,
        startTime,
        getVinylDuration,
        stopTimeoutId: null
    };

    window.scheduleVinylAudioEvents(rpm, startTime);

    // Initial values
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(synthSettings.volume, startTime + 0.1);

    osc.start(startTime);
    window.activeOscillators.push(osc);

    if (osc2) {
        osc2.start(startTime);
    }
    if (noise) {
        noise.start(startTime);
    }
};

window.scheduleVinylAudioEvents = function(rpm, scheduleFromTime) {
    let state = window.vinylAudioState;
    if (!state || state.isAi) return;

    let actx = state.actx;
    let totalTime = state.getVinylDuration(rpm);
    let timePerPoint = totalTime / state.points.length;
    let now = actx.currentTime;

    // We only schedule points that occur after the current time
    // If scheduleFromTime is specified, we use that as the base time for calculating delays.
    let baseTime = state.startTime;

    // Cancel all previously scheduled values from 'now' onwards
    state.panner.pan.cancelScheduledValues(now);
    if (state.filter) state.filter.frequency.cancelScheduledValues(now);
    state.osc.frequency.cancelScheduledValues(now);
    if (state.osc2) state.osc2.frequency.cancelScheduledValues(now);
    state.gain.gain.cancelScheduledValues(now);

    // We only want to update the timeout if it exists
    if (state.stopTimeoutId) {
        clearTimeout(state.stopTimeoutId);
    }

    // How much time has passed since start relative to the NEW total time?
    // Actually, it's easier to just calculate the current progress from UI and start from there,
    // but we can also just compute absolute times for all points and only apply the ones in the future.
    let progress = (typeof window.vinylProgress !== 'undefined') ? window.vinylProgress : 0;
    let startIndex = Math.floor(progress * state.points.length);

    // Base time for the remainder of the track
    let remainderTime = totalTime * (1.0 - progress);

    for (let i = startIndex; i < state.points.length; i++) {
        let p = state.points[i];
        // Calculate delay relative to the start of the remainder
        let remainingPoints = state.points.length - startIndex;
        let delayFromNow = ((i - startIndex) / remainingPoints) * remainderTime;

        let index = Math.floor(p.relativeHoehe * (state.synthSettings.range / 100) * (state.baseFreqs.length - 1));
        index = Math.max(0, Math.min(index, state.baseFreqs.length - 1));
        let freq = state.baseFreqs[index];

        let panValue = -0.5 + (i / state.points.length);
        let noteStartTime = now + delayFromNow;

        state.panner.pan.setValueAtTime(panValue, noteStartTime);

        if (state.synthSettings.wave === 'noise' && state.filter) {
            state.filter.frequency.setValueAtTime(freq, noteStartTime);
        } else {
            state.osc.frequency.setValueAtTime(freq, noteStartTime);
            if (state.osc2 && state.synthSettings.wave === 'chime') {
                state.osc2.frequency.setValueAtTime(freq * 2.01, noteStartTime);
            } else if (state.osc2 && state.synthSettings.wave === 'detuned_saw') {
                state.osc2.frequency.setValueAtTime(freq * 1.02, noteStartTime);
            }
        }

        // MIDI Send Logic
        if (window.midiOutput && typeof window.sendMidiNote === 'function') {
            let midiPitch = window.freqToMidiPitch(freq);
            let midiVelocity = 80;

            if (i > 0) {
                let prevP = state.points[i - 1];
                let diff = Math.abs(p.relativeHoehe - prevP.relativeHoehe);
                // relativeHoehe is 0.0 to 1.0, diff will be 0.0 to 1.0
                midiVelocity = Math.min(127, Math.max(40, 40 + Math.round(diff * 400)));
            }

            // Calculate note duration (time until next note, or small gap)
            let noteDurationMs = (timePerPoint * 1000) * 0.9;
            let delayMs = delayFromNow * 1000;

            let chInput = document.getElementById('num_midi_channel');
            let channel = chInput ? parseInt(chInput.value) : 1;

            window.sendMidiNote(midiPitch, midiVelocity, noteDurationMs, delayMs, channel);
        }
    }

    // Fade out at the end
    let endTime = now + remainderTime;
    state.gain.gain.setValueAtTime(state.synthSettings.volume, Math.max(now, endTime - 0.5));
    state.gain.gain.linearRampToValueAtTime(0.01, endTime);

    try {
        state.osc.stop(endTime);
        if (state.osc2) state.osc2.stop(endTime);
        if (state.noise) state.noise.stop(endTime);
    } catch(e) {
        // May throw if already stopped
    }

    // Automatically stop rotation when audio finishes
    state.stopTimeoutId = setTimeout(() => {
        if (typeof window.stopVinylRotation === 'function') {
            window.stopVinylRotation();
        }
    }, remainderTime * 1000);
    window.audioTimeouts.push(state.stopTimeoutId);
};

window.updateVinylAudioSpeed = function(newRPM) {
    if (window.vinylAudioState) {
        if (window.vinylAudioState.isAi) {
            window.scheduleAiVinylAudioEvents(newRPM, window.vinylAudioState.actx.currentTime);
        } else {
            window.scheduleVinylAudioEvents(newRPM, window.vinylAudioState.actx.currentTime);
        }
    }
};

window.scheduleAiVinylAudioEvents = function(rpm, startTime) {
    let state = window.vinylAudioState;
    if (!state || !state.isAi || !window.vinylAiSequence) return;

    let actx = state.actx;
    let speedMultiplier = rpm / 33.0; // 33 RPM is standard speed 1.0

    // Total original time
    let totalOriginalTime = window.vinylAiSequence.totalTime;
    let totalAdjustedTime = totalOriginalTime / speedMultiplier;

    // Stop previous scheduled notes if we are rescheduling (e.g. speed change)
    if (state.stopTimeoutId) {
        clearTimeout(state.stopTimeoutId);
    }

    // Since we create NEW oscillators for AI sequence notes every time, we need to clear old ones
    // if we are updating speed on the fly.
    // We will do a mini stopAllAudio just for AI notes.
    if (window.activeAiOscillators) {
        window.activeAiOscillators.forEach(osc => {
            try { osc.stop(); osc.disconnect(); } catch (e) {}
        });
    }
    window.activeAiOscillators = [];

    // Calculate current progress
    let progress = (typeof window.vinylProgress !== 'undefined') ? window.vinylProgress : 0;

    // Time passed in the ORIGINAL timeline
    let originalTimePassed = progress * totalOriginalTime;

    let remainderAdjustedTime = (totalOriginalTime - originalTimePassed) / speedMultiplier;

    // We recreate global gain for the remaining sequence
    if (state.globalGain) {
        try { state.globalGain.disconnect(); } catch(e){}
    }
    state.globalGain = actx.createGain();
    state.globalGain.gain.value = state.synthSettings.volume;
    state.globalGain.connect(window.masterCompressor);

    window.vinylAiSequence.notes.forEach(note => {
        // Skip notes that have already ENDED in the original timeline
        if (note.endTime <= originalTimePassed) return;

        // If a note has started but not ended, we adjust its start time to NOW.
        let isPlayingNow = note.startTime <= originalTimePassed && note.endTime > originalTimePassed;

        // Original time remaining for this note to start
        let originalDelay = isPlayingNow ? 0 : (note.startTime - originalTimePassed);
        let adjustedDelay = originalDelay / speedMultiplier;

        let adjustedStartTime = startTime + adjustedDelay;

        // Duration of the note remaining
        let originalNoteDuration = note.endTime - (isPlayingNow ? originalTimePassed : note.startTime);
        let adjustedNoteDuration = originalNoteDuration / speedMultiplier;
        let adjustedEndTime = adjustedStartTime + adjustedNoteDuration;

        const osc = actx.createOscillator();
        const freq = 440 * Math.pow(2, (note.pitch - 69) / 12);
        osc.frequency.value = freq;

        let filter = null;
        let osc2 = null;
        let noise = null;

        if (state.synthSettings.wave === 'darkpad') {
            osc.type = 'sawtooth';
        } else if (state.synthSettings.wave === 'chime') {
            osc.type = 'sine';
            osc2 = actx.createOscillator();
            osc2.type = 'triangle';
            osc2.frequency.value = freq * 2;
        } else if (state.synthSettings.wave === 'noise') {
            const bufferSize = actx.sampleRate * 2.0;
            const buffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let j = 0; j < bufferSize; j++) { data[j] = Math.random() * 2 - 1; }
            noise = actx.createBufferSource();
            noise.buffer = buffer;
            noise.loop = true;
            filter = actx.createBiquadFilter();
            filter.type = 'bandpass'; filter.Q.value = 10;
            filter.frequency.value = freq;
            noise.connect(filter);
        } else if (state.synthSettings.wave === 'detuned_saw') {
            osc.type = 'sawtooth';
            osc2 = actx.createOscillator();
            osc2.type = 'sawtooth';
            osc2.frequency.value = freq * 1.01;
        } else {
            osc.type = state.synthSettings.wave;
        }

        const noteGain = actx.createGain();

        noteGain.gain.setValueAtTime(0, adjustedStartTime);
        noteGain.gain.linearRampToValueAtTime(1.0, adjustedStartTime + 0.02);
        noteGain.gain.exponentialRampToValueAtTime(0.01, adjustedEndTime);

        if (noise) {
            filter.connect(noteGain);
            window.activeAiOscillators.push(noise);
            window.activeOscillators.push(noise); // keep in global for hard stop
        } else {
            osc.connect(noteGain);
        }
        if (osc2) {
            osc2.connect(noteGain);
            window.activeAiOscillators.push(osc2);
            window.activeOscillators.push(osc2);
        }

        noteGain.connect(state.globalGain);

        if (noise) {
            noise.start(adjustedStartTime);
            noise.stop(adjustedEndTime + 0.1);
        } else {
            osc.start(adjustedStartTime);
            osc.stop(adjustedEndTime + 0.1);
            window.activeAiOscillators.push(osc);
            window.activeOscillators.push(osc);
        }

        // MIDI Send Logic
        if (window.midiOutput && typeof window.sendMidiNote === 'function') {
            let midiPitch = note.pitch;
            let midiVelocity = note.velocity || 100;

            let delayMs = adjustedDelay * 1000;
            let durationMs = adjustedNoteDuration * 1000;

            let chInput = document.getElementById('num_midi_channel');
            let channel = chInput ? parseInt(chInput.value) : 1;

            window.sendMidiNote(midiPitch, midiVelocity, durationMs, delayMs, channel);
        }
    });

    state.stopTimeoutId = setTimeout(() => {
        if (typeof window.stopVinylRotation === 'function') {
            window.stopVinylRotation();
        }
    }, remainderAdjustedTime * 1000);
    window.audioTimeouts.push(state.stopTimeoutId);
};
