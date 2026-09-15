// audio.js - Web Audio API und Synthese

window.activeOscillators = [];
window.audioTimeouts = [];
window.audioIntervals = [];

const scales = {
    major: [2, 2, 1, 2, 2, 2, 1], minor: [2, 1, 2, 2, 1, 2, 2],
    lydian: [2, 2, 2, 1, 2, 2, 1], dorian: [2, 1, 2, 2, 2, 1, 2],
    pentatonic: [2, 2, 3, 2, 3], hirajoshi: [2, 1, 4, 1, 4]
};

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
                // Ignore errors if oscillator already stopped or disconnected
            }
        });
        window.activeOscillators = [];
    }

    if (window.audioTimeouts) {
        window.audioTimeouts.forEach(t => clearTimeout(t));
        window.audioTimeouts = [];
    }

    if (window.audioIntervals) {
        window.audioIntervals.forEach(i => clearInterval(i));
        window.audioIntervals = [];
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
            });
        });

        if (playedCount === 0) alert(t.alert_no_points || "Mit diesen Einstellungen wurden keine Punkte gefunden!");

    } catch (e) { alert("Audio-Fehler: " + e.message); }
};


window.playVinylAudio = async function(vinylArray) {
    if (!window.audioContext) {
        window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        window.masterCompressor = window.audioContext.createDynamicsCompressor();
        window.masterCompressor.connect(window.audioContext.destination);
    }
    window.stopAllAudio();

    let synthSettings = {
        mode: 'lr',
        scale: 'pentatonic',
        oktaven: 4,
        range: 100,
        wave: 'chime',
        volume: 0.2,
        duration: 15.0, // length of total song? We'll stream it.
        attack: 0.1,
        release: 0.5,
        echo: 0.4
    };

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

    // Determine timing
    // Total playback time e.g. 15 seconds
    let totalTime = synthSettings.duration;
    let timePerPoint = totalTime / points.length;

    const t = (typeof text !== 'undefined' && text[window.currentLang]) ? text[window.currentLang] : {};

    for (let i = 0; i < points.length; i++) {
        let p = points[i];
        let delay = i * timePerPoint;
        let index = Math.floor(p.relativeHoehe * (synthSettings.range / 100) * (baseFreqs.length - 1));
        index = Math.max(0, Math.min(index, baseFreqs.length - 1));
        let freq = baseFreqs[index];

        let panValue = -0.5 + (i / points.length);

        let tId = setTimeout(() => {
            if(window.audioContext.state === 'suspended') window.audioContext.resume();

            const osc = window.audioContext.createOscillator();
            const gain = window.audioContext.createGain();
            const panner = window.audioContext.createStereoPanner();

            panner.pan.value = panValue;

            if (synthSettings.wave === 'darkpad') {
                osc.type = 'sawtooth';
                const filter = window.audioContext.createBiquadFilter();
                filter.type = 'lowpass'; filter.frequency.value = 800;
                osc.connect(filter); filter.connect(gain);
            } else if (synthSettings.wave === 'chime') {
                osc.type = 'sine';
                const osc2 = window.audioContext.createOscillator();
                osc2.type = 'triangle'; osc2.frequency.value = freq * 2.01;
                osc2.connect(gain); osc2.start(); window.activeOscillators.push(osc2);
                osc.connect(gain);
            } else if (synthSettings.wave === 'noise') {
                const bufferSize = window.audioContext.sampleRate * 2.0;
                const buffer = window.audioContext.createBuffer(1, bufferSize, window.audioContext.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) { data[i] = Math.random() * 2 - 1; }
                const noise = window.audioContext.createBufferSource();
                noise.buffer = buffer;
                const filter = window.audioContext.createBiquadFilter();
                filter.type = 'bandpass'; filter.frequency.value = freq; filter.Q.value = 10;
                noise.connect(filter); filter.connect(gain);
                noise.start(); window.activeOscillators.push(noise);
            } else if (synthSettings.wave === 'detuned_saw') {
                osc.type = 'sawtooth';
                const osc2 = window.audioContext.createOscillator();
                osc2.type = 'sawtooth'; osc2.frequency.value = freq * 1.02;
                osc2.connect(gain); osc2.start(); window.activeOscillators.push(osc2);
                osc.connect(gain);
            } else {
                osc.type = synthSettings.wave || 'sine';
                osc.connect(gain);
            }

            osc.frequency.setValueAtTime(freq, window.audioContext.currentTime);

            gain.gain.setValueAtTime(0, window.audioContext.currentTime);
            gain.gain.linearRampToValueAtTime(synthSettings.volume, window.audioContext.currentTime + synthSettings.attack);
            gain.gain.exponentialRampToValueAtTime(0.01, window.audioContext.currentTime + synthSettings.attack + synthSettings.release);

            if (synthSettings.echo > 0) {
                const delayNode = window.audioContext.createDelay();
                delayNode.delayTime.value = synthSettings.echo;
                const feedback = window.audioContext.createGain();
                feedback.gain.value = 0.4;
                gain.connect(delayNode);
                delayNode.connect(feedback);
                feedback.connect(delayNode);
                delayNode.connect(panner);
            }

            gain.connect(panner);
            panner.connect(window.masterCompressor);

            osc.start();
            osc.stop(window.audioContext.currentTime + synthSettings.attack + synthSettings.release);
            window.activeOscillators.push(osc);
        }, delay * 1000);

        window.audioTimeouts.push(tId);
    }
};
