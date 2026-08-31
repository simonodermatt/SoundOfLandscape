// engine.js - Ausgelagerte Logik für den Panorama Synthesizer

const SHEET_ID = "10pxYaSMyt5uDRjCF0DWjGEabe_a3YftdpChxYzyQJBo"; 
let currentLang = 'de';
let panoramenDaten = [];
window.activeSynth = {}; // Global für die HTML-Slider

const scales = {
    major: [2, 2, 1, 2, 2, 2, 1],
    minor: [2, 1, 2, 2, 1, 2, 2],
    lydian: [2, 2, 2, 1, 2, 2, 1],
    dorian: [2, 1, 2, 2, 2, 1, 2],
    pentatonic: [2, 2, 3, 2, 3],
    hirajoshi: [2, 1, 4, 1, 4]
};

// --- KARTEN-SETUP ---
const map = L.map('map').setView([46.8182, 8.2275], 8);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);

const markerClusterGroup = L.markerClusterGroup({ maxClusterRadius: 40, spiderfyOnMaxZoom: true });
map.addLayer(markerClusterGroup);

// Globale UI Funktionen
window.wechsleAnsicht = function(ansicht) {
    if (ansicht === 'schweiz') map.flyTo([46.8182, 8.2275], 8);
    else if (ansicht === 'europa') map.flyTo([51.0, 10.0], 4);
    else if (ansicht === 'welt') map.flyTo([20.0, 0.0], 2);
};

window.changeLanguage = function(lang) {
    currentLang = lang;
    if(typeof text === "undefined") {
        alert("Die Datei lang.js fehlt oder hat einen Fehler!");
        return;
    }
    document.getElementById('lbl-sprache').innerText = text[lang].sprache;
    document.getElementById('lbl-view').innerHTML = `<b>${text[lang].ausschnitt}</b>`;
    document.getElementById('opt-ch').innerText = text[lang].schweiz;
    document.getElementById('opt-eu').innerText = text[lang].europa;
    document.getElementById('opt-world').innerText = text[lang].welt;
    markerClusterGroup.eachLayer(layer => {
        if (layer.panoId) {
            const pano = panoramenDaten.find(p => p.id === layer.panoId);
            if (pano && layer.getPopup() && layer.isPopupOpen()) layer.setPopupContent(getPopupHTML(pano));
        }
    });
};

window.openLightbox = function(url) {
    document.getElementById('lightbox-img').src = url;
    document.getElementById('lightbox').style.display = 'flex';
};

// --- DATEN LADEN ---
async function ladePanoramenAusSheet() {
    try {
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Panoramen`;
        const res = await fetch(url);
        if(!res.ok) throw new Error("Netzwerkfehler");
        
        panoramenDaten = parseCSV(await res.text());
        markerClusterGroup.clearLayers();

        panoramenDaten.forEach(pano => {
            const coords = pano.position ? pano.position.split(',').map(c => parseFloat(c.trim())) : [46.8182, 8.2275];
            const marker = L.marker(coords);
            marker.panoId = pano.id;
            
            marker.bindPopup(() => getPopupHTML(pano), { minWidth: 600, maxWidth: 650 });
            markerClusterGroup.addLayer(marker);

            window.activeSynth[pano.id] = {
                peaks: parseInt(pano.peaks) || 4,
                valleys: parseInt(pano.valleys) || 2,
                spacing: parseInt(pano.spacing) || 35,
                sensibilitaet: parseInt(pano.sensibilitaet) || 0,
                mode: pano.mode || 'chord',
                scale: pano.scale || 'lydian',
                oktaven: parseInt(pano.oktaven) || 3,
                range: parseInt(pano.range) || 100,
                wave: pano.wave || 'darkpad',
                volume: parseFloat(pano.volume) || 0.2,
                duration: parseFloat(pano.duration) || 5.0,
                attack: parseFloat(pano.attack) || 1.0,
                release: parseFloat(pano.release) || 2.0,
                echo: parseFloat(pano.echo) || 0.3
            };
        });
    } catch (e) { 
        console.error(e); alert("Fehler beim Laden der Google Sheet Daten:\n" + e.message);
    }
}

function parseCSV(textData) {
    const lines = textData.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(h => h.replace(/^["']|["']$/g, "").trim());
    let result = [];
    for (let i = 1; i < lines.length; i++) {
        let currentline = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        let obj = {};
        headers.forEach((h, index) => { obj[h] = currentline[index] ? currentline[index].replace(/^["']|["']$/g, "").trim() : ""; });
        result.push(obj);
    }
    return result;
}

// --- HTML GENERATOR FÜR DAS POP-UP ---
function getPopupHTML(pano) {
    const s = window.activeSynth[pano.id];
    const t = (typeof text !== 'undefined' && text[currentLang]) ? text[currentLang] : {
        grp_struktur: "Struktur", grp_klang: "Klang", vergroessern: "Vergrößern", play: "Abspielen"
    };
    
    return `
        <div class="popup-content">
            <h3>${pano.titel}</h3>
            <div style="font-size: 10px; color: #777; margin-bottom: 8px;">📅 ${pano.datum}</div>
            
            <div class="bild-container" onclick="openLightbox('${pano.bildUrl}')" title="${t.vergroessern}">
                <img src="${pano.bildUrl}" class="popup-img" />
                <canvas id="canvas_${pano.id}" class="punktOverlay"></canvas>
            </div>

            <div class="controls-container">
                <div class="control-group">
                    <h4>${t.grp_struktur || "Struktur"}</h4>
                    <label>${t.gipfel || "Gipfel:"} <b>${s.peaks}</b></label>
                    <input type="range" min="0" max="12" value="${s.peaks}" oninput="window.activeSynth['${pano.id}'].peaks = parseInt(this.value); this.previousElementSibling.querySelector('b').innerText = this.value;">
                    
                    <label>${t.taeler || "Täler:"} <b>${s.valleys}</b></label>
                    <input type="range" min="0" max="12" value="${s.valleys}" oninput="window.activeSynth['${pano.id}'].valleys = parseInt(this.value); this.previousElementSibling.querySelector('b').innerText = this.value;">
                    
                    <label>${t.abstand || "Abstand:"} <b>${s.spacing}</b>px</label>
                    <input type="range" min="10" max="150" step="5" value="${s.spacing}" oninput="window.activeSynth['${pano.id}'].spacing = parseInt(this.value); this.previousElementSibling.querySelector('b').innerText = this.value;">
                    
                    <label>${t.sensibilitaet || "Sensibilität:"} <b>${s.sensibilitaet}</b></label>
                    <input type="range" min="0" max="20" value="${s.sensibilitaet}" oninput="window.activeSynth['${pano.id}'].sensibilitaet = parseInt(this.value); this.previousElementSibling.querySelector('b').innerText = this.value;">
                
                    <label>${t.modus || "Modus:"}</label>
                    <select onchange="window.activeSynth['${pano.id}'].mode = this.value;">
                        <option value="chord" ${s.mode === 'chord' ? 'selected' : ''}>${t.mod_gleich || "Akkord"}</option>
                        <option value="lr" ${s.mode === 'lr' ? 'selected' : ''}>${t.mod_lr || "Links->Rechts"}</option>
                        <option value="rl" ${s.mode === 'rl' ? 'selected' : ''}>${t.mod_rl || "Rechts->Links"}</option>
                    </select>
                </div>

                <div class="control-group">
                    <h4>${t.grp_klang || "Klang"}</h4>
                    <label>${t.tonart || "Tonart:"}</label>
                    <select onchange="window.activeSynth['${pano.id}'].scale = this.value;">
                        <option value="major" ${s.scale === 'major' ? 'selected' : ''}>${t.scale_major || "Dur"}</option>
                        <option value="minor" ${s.scale === 'minor' ? 'selected' : ''}>${t.scale_minor || "Moll"}</option>
                        <option value="lydian" ${s.scale === 'lydian' ? 'selected' : ''}>${t.scale_lydian || "Lydisch"}</option>
                        <option value="dorian" ${s.scale === 'dorian' ? 'selected' : ''}>${t.scale_dorian || "Dorisch"}</option>
                        <option value="pentatonic" ${s.scale === 'pentatonic' ? 'selected' : ''}>${t.scale_pentatonic || "Pentatonik"}</option>
                        <option value="hirajoshi" ${s.scale === 'hirajoshi' ? 'selected' : ''}>${t.scale_hirajoshi || "Hirajōshi"}</option>
                    </select>

                    <label>${t.oktaven || "Oktaven:"} <b>${s.oktaven}</b></label>
                    <input type="range" min="1" max="6" value="${s.oktaven}" oninput="window.activeSynth['${pano.id}'].oktaven = parseInt(this.value); this.previousElementSibling.querySelector('b').innerText = this.value;">
                    
                    <label>${t.range || "Skalierung:"} <b>${s.range}</b>%</label>
                    <input type="range" min="20" max="100" step="10" value="${s.range}" oninput="window.activeSynth['${pano.id}'].range = parseInt(this.value); this.previousElementSibling.querySelector('b').innerText = this.value;">

                    <label>${t.wellenform || "Wellenform:"}</label>
                    <select onchange="window.activeSynth['${pano.id}'].wave = this.value;">
                        <option value="sine" ${s.wave === 'sine' ? 'selected' : ''}>${t.wave_sine || "Sinus"}</option>
                        <option value="triangle" ${s.wave === 'triangle' ? 'selected' : ''}>${t.wave_triangle || "Dreieck"}</option>
                        <option value="sawtooth" ${s.wave === 'sawtooth' ? 'selected' : ''}>${t.wave_sawtooth || "Sägezahn"}</option>
                        <option value="square" ${s.wave === 'square' ? 'selected' : ''}>${t.wave_square || "Rechteck"}</option>
                        <optgroup label="Complex Patches">
                            <option value="organ" ${s.wave === 'organ' ? 'selected' : ''}>${t.wave_organ || "Kirchenorgel"}</option>
                            <option value="darkpad" ${s.wave === 'darkpad' ? 'selected' : ''}>${t.wave_darkpad || "Dark Pad"}</option>
                            <option value="chime" ${s.wave === 'chime' ? 'selected' : ''}>${t.wave_chime || "Glöckchen"}</option>
                        </optgroup>
                    </select>

                    <label>${t.dauer || "Dauer:"} <b>${s.duration}</b>s</label>
                    <input type="range" min="0.5" max="15" step="0.5" value="${s.duration}" oninput="window.activeSynth['${pano.id}'].duration = parseFloat(this.value); this.previousElementSibling.querySelector('b').innerText = this.value;">
                </div>
                
                <div class="control-group">
                    <h4>Raum / Envelope</h4>
                    <label>${t.attack || "Attack:"} <b>${s.attack}</b>s</label>
                    <input type="range" min="0.1" max="5.0" step="0.1" value="${s.attack}" oninput="window.activeSynth['${pano.id}'].attack = parseFloat(this.value); this.previousElementSibling.querySelector('b').innerText = this.value;">
                    
                    <label>${t.release || "Release:"} <b>${s.release}</b>s</label>
                    <input type="range" min="0.1" max="8.0" step="0.1" value="${s.release}" oninput="window.activeSynth['${pano.id}'].release = parseFloat(this.value); this.previousElementSibling.querySelector('b').innerText = this.value;">
                    
                    <label>${t.echo || "Echo:"} <b>${Math.round(s.echo*100)}</b>%</label>
                    <input type="range" min="0" max="0.8" step="0.05" value="${s.echo}" oninput="window.activeSynth['${pano.id}'].echo = parseFloat(this.value); this.previousElementSibling.querySelector('b').innerText = Math.round(this.value*100);">

                    <label>${t.lautstaerke || "Volume:"} <b>${Math.round(s.volume*100)}</b>%</label>
                    <input type="range" min="0.05" max="0.5" step="0.05" value="${s.volume}" oninput="window.activeSynth['${pano.id}'].volume = parseFloat(this.value); this.previousElementSibling.querySelector('b').innerText = Math.round(this.value*100);">
                </div>
            </div>

            <button class="play-btn" onclick="playPanorama('${pano.id}', '${pano.arrayUrl}')">${t.play || "Abspielen"}</button>
        </div>
    `;
}

// --- AUDIO ENGINE ---
let audioCtx;

function generateScale(scaleName, octaves) {
    let baseFreq = 130.81; 
    let freqs = [baseFreq];
    let intervals = scales[scaleName] || scales['lydian'];
    for (let o = 0; o < octaves; o++) {
        for (let i = 0; i < intervals.length; i++) {
            baseFreq = baseFreq * Math.pow(2, intervals[i] / 12);
            freqs.push(baseFreq);
        }
    }
    return freqs;
}

function findePunkte(kurve, anzahl, abstand, sens, typ) {
    if (anzahl <= 0) return [];
    let kandidaten = [];
    for (let i = 5; i < kurve.length - 5; i++) {
        let val = kurve[i];
        let isPeak = typ === 'gipfel' 
            ? (val >= kurve[i-1] && val > kurve[i+1]) 
            : (val <= kurve[i-1] && val < kurve[i+1]);
        
        if (isPeak) {
            let umgebung = kurve.slice(Math.max(0, i-5), Math.min(kurve.length, i+6));
            let diff = typ === 'gipfel' ? val - Math.min(...umgebung) : Math.max(...umgebung) - val;
            if (diff >= sens) kandidaten.push({ x: i, hoehe: val, diff: diff });
        }
    }
    kandidaten.sort((a, b) => typ === 'gipfel' ? b.hoehe - a.hoehe : a.hoehe - b.hoehe);
    let gefiltert = [];
    for (let k of kandidaten) {
        if (!gefiltert.some(g => Math.abs(k.x - g.x) < abstand)) {
            gefiltert.push(k);
            if (gefiltert.length >= anzahl) break;
        }
    }
    return gefiltert;
}

window.playPanorama = async function(panoId, dateiPfad) {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); 
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    try {
        const res = await fetch(dateiPfad);
        if (!res.ok) throw new Error(`Array-Datei nicht gefunden!`);
        const daten = await res.json();
        const s = window.activeSynth[panoId];
        
        const tonleiter = generateScale(s.scale, s.oktaven);
        const topGipfel = findePunkte(daten.kurve_y, s.peaks, s.spacing, s.sensibilitaet, 'gipfel');
        const tiefeTaeler = findePunkte(daten.kurve_y, s.valleys, s.spacing, s.sensibilitaet, 'tal');
        let allePunkte = topGipfel.concat(tiefeTaeler);

        if (allePunkte.length === 0) { alert("Keine Gipfel gefunden. Sensibilität reduzieren!"); return; }

        if (s.mode === 'lr') allePunkte.sort((a, b) => a.x - b.x);
        else if (s.mode === 'rl') allePunkte.sort((a, b) => b.x - a.x);

        const canvas = document.getElementById(`canvas_${panoId}`);
        if (canvas) {
            const ctx = canvas.getContext('2d');
            canvas.width = daten.bild_breite; canvas.height = daten.bild_hoehe;
            ctx.clearRect(0, 0, canvas.width, canvas.height); 
            ctx.lineWidth = 4;
            
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
            topGipfel.forEach(p => { ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, canvas.height); ctx.stroke(); });
            
            ctx.strokeStyle = 'rgba(0, 191, 255, 0.8)';
            tiefeTaeler.forEach(p => { ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, canvas.height); ctx.stroke(); });
        }

        const delayNode = audioCtx.createDelay();
        delayNode.delayTime.value = 0.4;
        const feedbackGain = audioCtx.createGain();
        feedbackGain.gain.value = s.echo; 
        delayNode.connect(feedbackGain);
        feedbackGain.connect(delayNode);
        delayNode.connect(audioCtx.destination);

        const now = audioCtx.currentTime;

        allePunkte.forEach((punkt, indexPos) => {
            let yProzent = (punkt.hoehe / 100) * (s.range / 100);
            const freqIndex = Math.floor(yProzent * (tonleiter.length - 1));
            const freq = tonleiter[freqIndex] || 440;
            
            const masterGain = audioCtx.createGain();
            let panner = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : audioCtx.createGain();
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
            panner.connect(audioCtx.destination);
            panner.connect(delayNode);

            let oscs = [];
            if (s.wave === 'organ') {
                let o1 = audioCtx.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq / 2;
                let g1 = audioCtx.createGain(); g1.gain.value = 0.6; o1.connect(g1); g1.connect(masterGain); oscs.push(o1);
                let o2 = audioCtx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq;
                let g2 = audioCtx.createGain(); g2.gain.value = 1.0; o2.connect(g2); g2.connect(masterGain); oscs.push(o2);
                let o3 = audioCtx.createOscillator(); o3.type = 'triangle'; o3.frequency.value = freq * 2;
                let g3 = audioCtx.createGain(); g3.gain.value = 0.4; o3.connect(g3); g3.connect(masterGain); oscs.push(o3);
            } else if (s.wave === 'darkpad') {
                let osc = audioCtx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = freq;
                let filter = audioCtx.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = 2; 
                filter.frequency.setValueAtTime(300, t0); filter.frequency.linearRampToValueAtTime(1000, t1); filter.frequency.linearRampToValueAtTime(300, t3);
                osc.connect(filter); filter.connect(masterGain); oscs.push(osc);
            } else if (s.wave === 'chime') {
                let o1 = audioCtx.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq;
                let g1 = audioCtx.createGain(); g1.gain.value = 0.8; o1.connect(g1); g1.connect(masterGain); oscs.push(o1);
                let o2 = audioCtx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2.76;
                let g2 = audioCtx.createGain(); g2.gain.value = 0.4; o2.connect(g2); g2.connect(masterGain); oscs.push(o2);
            } else {
                let osc = audioCtx.createOscillator(); osc.type = s.wave; osc.frequency.value = freq;
                osc.connect(masterGain); oscs.push(osc);
            }
            oscs.forEach(o => { o.start(t0); o.stop(t3 + 0.2); });
        });
    } catch (e) { alert("Audio-Fehler: " + e.message); }
};

// Start
ladePanoramenAusSheet();