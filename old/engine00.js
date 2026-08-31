// engine.js - Ausgelagerte Logik für den Panorama Synthesizer

const SHEET_ID = "10pxYaSMyt5uDRjCF0DWjGEabe_a3YftdpChxYzyQJBo"; 
const API_URL = "https://script.google.com/macros/s/AKfycbz08qUIVvAbiWibACoBOzRB9c5IDUgkylPFOGJfKvQyqItECg7WvlU9IEIQ5UBN0Sxg/exec";

let currentLang = 'de';
let panoramenDaten = [];
window.activeSynth = {}; 
window.panoDataCache = {}; 
window.currentPresets = []; 

const scales = {
    major: [2, 2, 1, 2, 2, 2, 1], minor: [2, 1, 2, 2, 1, 2, 2],
    lydian: [2, 2, 2, 1, 2, 2, 1], dorian: [2, 1, 2, 2, 2, 1, 2],
    pentatonic: [2, 2, 3, 2, 3], hirajoshi: [2, 1, 4, 1, 4]
};

const map = L.map('map').setView([46.8182, 8.2275], 8);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
const markerClusterGroup = L.markerClusterGroup({ maxClusterRadius: 40, spiderfyOnMaxZoom: true });
map.addLayer(markerClusterGroup);

window.wechsleAnsicht = function(ansicht) {
    if (ansicht === 'schweiz') map.flyTo([46.8182, 8.2275], 8);
    else if (ansicht === 'europa') map.flyTo([51.0, 10.0], 4);
    else if (ansicht === 'welt') map.flyTo([20.0, 0.0], 2);
};

window.changeLanguage = function(lang) {
    currentLang = lang;
    if(typeof text === "undefined") return;
    document.getElementById('lbl-sprache').innerText = text[lang].sprache;
    document.getElementById('lbl-view').innerText = text[lang].ausschnitt;
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

// --- BENUTZERVERWALTUNG (Soft-Login) ---
function getUserId() {
    let id = localStorage.getItem('pano_user_id');
    if (!id) {
        id = 'usr_' + Math.random().toString(36).substr(2, 9) + Date.now();
        localStorage.setItem('pano_user_id', id);
    }
    return id;
}
function getUserName() { return localStorage.getItem('pano_user_name'); }
function setUserName(name) { localStorage.setItem('pano_user_name', name); }


// --- COMMUNITY PRESETS ---
window.togglePresets = function(panoId) {
    let el = document.getElementById(`preset-container-${panoId}`);
    let arrow = document.getElementById(`preset-arrow-${panoId}`);
    if (el.style.display === 'none') {
        el.style.display = 'block';
        arrow.innerText = '▼';
    } else {
        el.style.display = 'none';
        arrow.innerText = '▶';
    }
};

window.loadPresets = async function(panoId) {
    let container = document.getElementById(`preset-list-${panoId}`);
    if(!container) return;
    container.innerHTML = "<div style='font-size:11px; color:#888;'>Lade Community Presets...</div>";
    
    try {
        let res = await fetch(`${API_URL}?pano_id=${panoId}`);
        let presets = await res.json();
        window.currentPresets = presets; 
        
        if (presets.length === 0) {
            container.innerHTML = "<div style='font-size:11px; color:#888;'>Noch keine Presets vorhanden.</div>";
            return;
        }

        let html = "";
        let myId = getUserId();
        
        presets.forEach(p => {
            let isOwner = (myId === p.user_id);
            html += `
            <div class="preset-item">
                <input type="checkbox" class="preset-cb" value="${p.preset_id}">
                <div class="preset-info">
                    <strong>${p.preset_name}</strong> 
                    <span>von ${p.user_name}</span>
                </div>
                ${isOwner ? `<button onclick="deletePreset('${p.preset_id}', '${panoId}')" class="del-btn" title="Löschen">🗑️</button>` : ''}
            </div>`;
        });
        container.innerHTML = html;
    } catch(e) { 
        container.innerHTML = "<div style='font-size:11px; color:red;'>Fehler beim Laden.</div>"; 
    }
};

window.savePreset = async function(panoId) {
    let name = getUserName();
    if (!name) {
        name = prompt("Willkommen! Unter welchem (Spitz-)Namen sollen deine Presets gespeichert werden?");
        if (!name) return;
        setUserName(name);
    }
    
    let presetName = prompt(`Hallo ${name}, wie soll diese Klangeinstellung heissen?`);
    if (!presetName) return;

    let s = window.activeSynth[panoId];
    let payload = {
        action: "save",
        pano_id: panoId,
        preset_name: presetName,
        user_name: name,
        user_id: getUserId(),
        ...s
    };

    let btn = document.getElementById(`save-btn-${panoId}`);
    let oldBtn = btn.innerText;
    btn.innerText = "⏳";
    
    try {
        // DER FIX FÜR GOOGLE: "no-cors" ignoriert die Sicherheitsblockade.
        await fetch(API_URL, { 
            method: 'POST', 
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload) 
        });
        
        alert(`Erfolg! "${presetName}" wurde gespeichert.`);
        
        // Wir geben Google 1.5 Sekunden Zeit, um die Zeile ins Sheet zu schreiben, bevor wir neu laden
        setTimeout(() => {
            loadPresets(panoId);
        }, 1500);
        
        document.getElementById(`preset-container-${panoId}`).style.display = 'block';
        document.getElementById(`preset-arrow-${panoId}`).innerText = '▼';
    } catch(e) { 
        alert("Netzwerkfehler beim Speichern."); 
    }
    btn.innerText = oldBtn;
};

window.deletePreset = async function(presetId, panoId) {
    if(!confirm("Möchtest du dieses Preset wirklich löschen?")) return;
    try {
        await fetch(API_URL, { 
            method: 'POST', 
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: "delete", preset_id: presetId, user_id: getUserId() }) 
        });
        setTimeout(() => { loadPresets(panoId); }, 1500);
    } catch(e) { alert("Fehler beim Löschen."); }
};


// --- INITIALISIERUNG & KNOBS ---
window.updateKnob = function(input, visualId) {
    let min = parseFloat(input.min) || 0; let max = parseFloat(input.max) || 100;
    let val = parseFloat(input.value);
    let percent = (val - min) / (max - min);
    let degrees = -135 + (percent * 270); 
    let vis = document.getElementById(visualId);
    if(vis) vis.style.transform = `rotate(${degrees}deg)`;
};

async function ladePanoramenAusSheet() {
    try {
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Panoramen`;
        const res = await fetch(url);
        panoramenDaten = parseCSV(await res.text());
        markerClusterGroup.clearLayers();

        panoramenDaten.forEach(pano => {
            const coords = pano.position ? pano.position.split(',').map(c => parseFloat(c.trim())) : [46.8182, 8.2275];
            const marker = L.marker(coords);
            marker.panoId = pano.id;
            
            marker.bindPopup(() => getPopupHTML(pano));
            
            marker.on('popupopen', async function() {
                document.querySelectorAll('.hidden-range').forEach(input => { input.dispatchEvent(new Event('input')); });
                
                if(!window.panoDataCache[pano.id]) {
                    try {
                        let r = await fetch(pano.arrayUrl);
                        window.panoDataCache[pano.id] = await r.json();
                    } catch(e) { console.error(e); }
                }
                drawLines(pano.id);
                loadPresets(pano.id); 
            });

            markerClusterGroup.addLayer(marker);

            window.activeSynth[pano.id] = {
                peaks: parseInt(pano.peaks) || 4, valleys: parseInt(pano.valleys) || 2, spacing: parseInt(pano.spacing) || 35,
                sensibilitaet: parseInt(pano.sensibilitaet) || 0, mode: pano.mode || 'chord', scale: pano.scale || 'lydian',
                oktaven: parseInt(pano.oktaven) || 3, range: parseInt(pano.range) || 100, wave: pano.wave || 'darkpad',
                volume: parseFloat(pano.volume) || 0.2, duration: parseFloat(pano.duration) || 5.0, attack: parseFloat(pano.attack) || 1.0,
                release: parseFloat(pano.release) || 2.0, echo: parseFloat(pano.echo) || 0.3
            };
        });
    } catch (e) { console.error(e); }
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

window.drawLines = function(panoId) {
    const daten = window.panoDataCache[panoId];
    if(!daten) return; 
    
    const s = window.activeSynth[panoId];
    const topGipfel = findePunkte(daten.kurve_y, s.peaks, s.spacing, s.sensibilitaet, 'gipfel');
    const tiefeTaeler = findePunkte(daten.kurve_y, s.valleys, s.spacing, s.sensibilitaet, 'tal');

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
};

function buildKnob(panoId, key, label, min, max, step, isInt, displayMult, unit = "") {
    let val = window.activeSynth[panoId][key];
    let visId = `vis_${key}_${panoId}`; let valId = `val_${key}_${panoId}`;
    let triggerDraw = ['peaks', 'valleys', 'spacing', 'sensibilitaet'].includes(key) ? `drawLines('${panoId}');` : '';
    let jsAction = `updateKnob(this, '${visId}'); window.activeSynth['${panoId}'].${key} = ${isInt ? 'parseInt' : 'parseFloat'}(this.value); document.getElementById('${valId}').innerText = ${displayMult ? 'Math.round(this.value * '+displayMult+')' : 'this.value'} + '${unit}'; ${triggerDraw}`;
    
    return `
    <div class="knob-box">
        <div class="knob-label">${label}</div>
        <div class="knob-container">
            <div class="knob-visual" id="${visId}"><div class="knob-indicator"></div></div>
            <input type="range" class="hidden-range" min="${min}" max="${max}" step="${step}" value="${val}" oninput="${jsAction}">
        </div>
        <div class="knob-value" id="${valId}">${displayMult ? Math.round(val * displayMult) : val}${unit}</div>
    </div>`;
}

function getPopupHTML(pano) {
    const s = window.activeSynth[pano.id];
    const t = (typeof text !== 'undefined' && text[currentLang]) ? text[currentLang] : {};
    
    return `
        <div class="popup-content">
            <div class="popup-header">
                <h3>${pano.titel}</h3>
                <button id="save-btn-${pano.id}" class="save-btn" onclick="savePreset('${pano.id}')" title="Als Preset speichern">💾</button>
            </div>
            <div style="font-size: 10px; color: #777; margin-bottom: 8px;">📅 ${pano.datum}</div>
            
            <div class="bild-container" onclick="openLightbox('${pano.bildUrl}')" title="${t.vergroessern}">
                <img src="${pano.bildUrl}" class="popup-img" />
                <canvas id="canvas_${pano.id}" class="punktOverlay"></canvas>
            </div>

            <div class="dropdown-row">
                <div class="dropdown-box">
                    <label>${t.modus || "Modus"}</label>
                    <select onchange="window.activeSynth['${pano.id}'].mode = this.value;">
                        <option value="chord" ${s.mode === 'chord' ? 'selected' : ''}>${t.mod_gleich || "Akkord"}</option>
                        <option value="lr" ${s.mode === 'lr' ? 'selected' : ''}>${t.mod_lr || "L -> R"}</option>
                        <option value="rl" ${s.mode === 'rl' ? 'selected' : ''}>${t.mod_rl || "R -> L"}</option>
                    </select>
                </div>
                <div class="dropdown-box">
                    <label>${t.tonart || "Tonart"}</label>
                    <select onchange="window.activeSynth['${pano.id}'].scale = this.value;">
                        <option value="major" ${s.scale === 'major' ? 'selected' : ''}>${t.scale_major || "Dur"}</option>
                        <option value="minor" ${s.scale === 'minor' ? 'selected' : ''}>${t.scale_minor || "Moll"}</option>
                        <option value="lydian" ${s.scale === 'lydian' ? 'selected' : ''}>${t.scale_lydian || "Lydisch"}</option>
                        <option value="dorian" ${s.scale === 'dorian' ? 'selected' : ''}>${t.scale_dorian || "Dorisch"}</option>
                        <option value="pentatonic" ${s.scale === 'pentatonic' ? 'selected' : ''}>${t.scale_pentatonic || "Pentatonik"}</option>
                        <option value="hirajoshi" ${s.scale === 'hirajoshi' ? 'selected' : ''}>${t.scale_hirajoshi || "Hirajōshi"}</option>
                    </select>
                </div>
                <div class="dropdown-box">
                    <label>${t.wellenform || "Patch"}</label>
                    <select onchange="window.activeSynth['${pano.id}'].wave = this.value;">
                        <option value="sine" ${s.wave === 'sine' ? 'selected' : ''}>${t.wave_sine || "Sinus"}</option>
                        <option value="triangle" ${s.wave === 'triangle' ? 'selected' : ''}>${t.wave_triangle || "Dreieck"}</option>
                        <option value="sawtooth" ${s.wave === 'sawtooth' ? 'selected' : ''}>${t.wave_sawtooth || "Sägezahn"}</option>
                        <option value="square" ${s.wave === 'square' ? 'selected' : ''}>${t.wave_square || "Rechteck"}</option>
                        <option value="organ" ${s.wave === 'organ' ? 'selected' : ''}>${t.wave_organ || "Orgel"}</option>
                        <option value="darkpad" ${s.wave === 'darkpad' ? 'selected' : ''}>${t.wave_darkpad || "Dark Pad"}</option>
                        <option value="chime" ${s.wave === 'chime' ? 'selected' : ''}>${t.wave_chime || "Glöckchen"}</option>
                    </select>
                </div>
            </div>

            <div class="synth-grid">
                ${buildKnob(pano.id, 'peaks', t.gipfel || 'Gipfel', 0, 12, 1, true, null)}
                ${buildKnob(pano.id, 'valleys', t.taeler || 'Täler', 0, 12, 1, true, null)}
                ${buildKnob(pano.id, 'spacing', t.abstand || 'Abstand', 10, 150, 5, true, null, 'px')}
                ${buildKnob(pano.id, 'sensibilitaet', t.sensibilitaet || 'Sensib.', 0, 30, 1, true, null)}
                
                ${buildKnob(pano.id, 'oktaven', t.oktaven || 'Oktaven', 1, 6, 1, true, null)}
                ${buildKnob(pano.id, 'range', t.range || 'Scale', 20, 100, 5, true, null, '%')}
                ${buildKnob(pano.id, 'duration', t.dauer || 'Dauer', 0.5, 15, 0.5, false, null, 's')}
                ${buildKnob(pano.id, 'echo', t.echo || 'Echo', 0, 0.8, 0.05, false, 100, '%')}

                ${buildKnob(pano.id, 'attack', t.attack || 'Attack', 0.1, 5.0, 0.1, false, null, 's')}
                ${buildKnob(pano.id, 'release', t.release || 'Release', 0.1, 8.0, 0.1, false, null, 's')}
                ${buildKnob(pano.id, 'volume', t.lautstaerke || 'Vol', 0.05, 0.5, 0.05, false, 100, '%')}
            </div>

            <button class="play-btn" onclick="playMultiPanorama('${pano.id}', '${pano.arrayUrl}', false)">Aktuelle Einstellung Abspielen</button>

            <div class="presets-section">
                <div class="preset-header" onclick="togglePresets('${pano.id}')">
                    <span id="preset-arrow-${pano.id}">▶</span> Community Presets
                </div>
                <div id="preset-container-${pano.id}" style="display:none; margin-top:8px;">
                    <div id="preset-list-${pano.id}"></div>
                    <button class="play-btn multi-play-btn" onclick="playMultiPanorama('${pano.id}', '${pano.arrayUrl}', true)">✓ Markierte Zusammen Abspielen</button>
                </div>
            </div>
        </div>
    `;
}

// --- MULTI-PLAY AUDIO ENGINE ---
window.getAudioCtx = function() {
    if (!window.audioCtx) { window.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    return window.audioCtx;
};

window.playMultiPanorama = async function(panoId, dateiPfad, playSelectedPresets) {
    const actx = window.getAudioCtx();
    if (actx.state === 'suspended') await actx.resume();

    try {
        if (!window.panoDataCache[panoId]) {
            const res = await fetch(dateiPfad);
            window.panoDataCache[panoId] = await res.json();
        }
        const daten = window.panoDataCache[panoId];
        let synthsToPlay = [];

        if (playSelectedPresets) {
            let checkedBoxes = document.querySelectorAll(`#preset-list-${panoId} .preset-cb:checked`);
            if (checkedBoxes.length === 0) { alert("Bitte markiere mindestens ein Preset!"); return; }
            
            checkedBoxes.forEach(cb => {
                let p = window.currentPresets.find(pr => pr.preset_id === cb.value);
                if(p) {
                    synthsToPlay.push({
                        peaks: parseInt(p.peaks), valleys: parseInt(p.valleys), spacing: parseInt(p.spacing),
                        sensibilitaet: parseInt(p.sensibilitaet), mode: p.mode, scale: p.scale,
                        oktaven: parseInt(p.oktaven), range: parseInt(p.range), wave: p.wave,
                        volume: parseFloat(p.volume), duration: parseFloat(p.duration), 
                        attack: parseFloat(p.attack), release: parseFloat(p.release), echo: parseFloat(p.echo)
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
        feedbackGain.gain.value = maxEcho; 
        
        delayNode.connect(feedbackGain);
        feedbackGain.connect(delayNode);
        delayNode.connect(actx.destination);

        const now = actx.currentTime;
        let playedCount = 0;

        synthsToPlay.forEach((s) => {
            const tonleiter = generateScale(s.scale, s.oktaven);
            const topGipfel = findePunkte(daten.kurve_y, s.peaks, s.spacing, s.sensibilitaet, 'gipfel');
            const tiefeTaeler = findePunkte(daten.kurve_y, s.valleys, s.spacing, s.sensibilitaet, 'tal');
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
                panner.connect(actx.destination);
                panner.connect(delayNode);

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
                } else {
                    let osc = actx.createOscillator(); osc.type = s.wave; osc.frequency.value = freq;
                    osc.connect(masterGain); oscs.push(osc);
                }
                oscs.forEach(o => { o.start(t0); o.stop(t3 + 0.2); });
            });
        });

        if (playedCount === 0) alert("Mit diesen Einstellungen wurden keine Punkte gefunden!");

    } catch (e) { alert("Audio-Fehler: " + e.message); }
};

ladePanoramenAusSheet();