// ui.js - Karte, Canvas, Vollbild-Modal und GUI-Generierung

// CSS für das Fullscreen-Modal dynamisch einfügen
const modalStyle = document.createElement('style');
modalStyle.innerHTML = `
.pano-modal-overlay {
    position: fixed;
    top: 0; left: 0;
    width: 100vw; height: 100vh;
    background: rgba(0, 0, 0, 0.85);
    z-index: 10000;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 10px;
    box-sizing: border-box;
    overflow-y: auto;
}
.pano-modal-content {
    background: #1e1e1e;
    color: #fff;
    width: 100%;
    max-width: 800px;
    height: 95vh;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    position: relative;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    overflow-y: auto;
    padding: 20px;
    box-sizing: border-box;
}
.pano-modal-close {
    position: absolute;
    top: 15px;
    right: 20px;
    background: #ff4d4d;
    color: white;
    border: none;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    font-size: 22px;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
}
.pano-modal-content select, 
.pano-modal-content button, 
.pano-modal-content label {
    font-size: 16px !important;
}
.pano-modal-content .knob-label, 
.pano-modal-content .knob-value {
    font-size: 14px !important;
}
.pano-modal-content input[type="range"] {
    height: 25px;
}
`;
document.head.appendChild(modalStyle);

const map = L.map('map').setView([46.8182, 8.2275], 8);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
window.markerClusterGroup = L.markerClusterGroup({ maxClusterRadius: 40, spiderfyOnMaxZoom: true });
map.addLayer(window.markerClusterGroup);

window.wechsleAnsicht = function(ansicht) {
    if (ansicht === 'schweiz') map.flyTo([46.8182, 8.2275], 8);
    else if (ansicht === 'europa') map.flyTo([51.0, 10.0], 4);
    else if (ansicht === 'welt') map.flyTo([20.0, 0.0], 2);
};

window.changeLanguage = function(lang) {
    window.currentLang = lang;
    if(typeof text === "undefined") return;
    
    document.getElementById('lbl-sprache').innerText = text[lang].sprache;
    document.getElementById('lbl-view').innerText = text[lang].ausschnitt;
    document.getElementById('opt-ch').innerText = text[lang].schweiz;
    document.getElementById('opt-eu').innerText = text[lang].europa;
    document.getElementById('opt-world').innerText = text[lang].welt;
    
    // Falls ein Modal offen ist, Inhalt aktualisieren
    let activeModal = document.getElementById('active-pano-modal');
    if (activeModal && window.currentOpenPano) {
        document.getElementById('pano-modal-body-container').innerHTML = window.getPopupHTML(window.currentOpenPano);
        setTimeout(() => {
            document.querySelectorAll('.hidden-range').forEach(input => { input.dispatchEvent(new Event('input')); });
            window.drawLines(window.currentOpenPano.id);
            window.loadPresets(window.currentOpenPano.id); 
        }, 50);
    }
};

window.openLightbox = function(url) {
    document.getElementById('lightbox-img').src = url;
    document.getElementById('lightbox').style.display = 'flex';
};

window.togglePresets = function(panoId) {
    let el = document.getElementById(`preset-container-${panoId}`);
    if (el.style.display === 'none') el.style.display = 'block';
    else el.style.display = 'none';
};

window.drawLines = function(panoId) {
    const daten = window.panoDataCache[panoId];
    if(!daten) return; 
    
    const s = window.activeSynth[panoId];
    const topGipfel = window.findePunkte(daten.kurve_y, s.peaks, s.spacing, s.sensibilitaet, 'gipfel');
    const tiefeTaeler = window.findePunkte(daten.kurve_y, s.valleys, s.spacing, s.sensibilitaet, 'tal');

    const canvas = document.getElementById(`canvas_${panoId}`);
    if (canvas) {
        const ctx = canvas.getContext('2d');
        canvas.width = daten.bild_breite; 
        canvas.height = daten.bild_hoehe;
        ctx.clearRect(0, 0, canvas.width, canvas.height); 
        ctx.lineWidth = 4;
        
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
        topGipfel.forEach(p => { 
            ctx.beginPath(); 
            ctx.moveTo(p.x, 0); 
            ctx.lineTo(p.x, canvas.height); 
            ctx.stroke(); 
        });
        
        ctx.strokeStyle = 'rgba(0, 191, 255, 0.8)';
        tiefeTaeler.forEach(p => { 
            ctx.beginPath(); 
            ctx.moveTo(p.x, 0); 
            ctx.lineTo(p.x, canvas.height); 
            ctx.stroke(); 
        });
    }
};

window.buildKnob = function(panoId, key, label, min, max, step, isInt, displayMult, unit = "") {
    let val = window.activeSynth[panoId][key];
    let visId = `vis_${key}_${panoId}`; let valId = `val_${key}_${panoId}`;
    let triggerDraw = ['peaks', 'valleys', 'spacing', 'sensibilitaet'].includes(key) ? `window.drawLines('${panoId}');` : '';
    let jsAction = `window.updateKnob(this, '${visId}'); window.activeSynth['${panoId}'].${key} = ${isInt ? 'parseInt' : 'parseFloat'}(this.value); document.getElementById('${valId}').innerText = ${displayMult ? 'Math.round(this.value * '+displayMult+')' : 'this.value'} + '${unit}'; ${triggerDraw}`;
    
    return `
    <div class="knob-box">
        <div class="knob-label">${label}</div>
        <div class="knob-container">
            <div class="knob-visual" id="${visId}"><div class="knob-indicator"></div></div>
            <input type="range" id="range_${key}_${panoId}" class="hidden-range" min="${min}" max="${max}" step="${step}" value="${val}" oninput="${jsAction}">
        </div>
        <div class="knob-value" id="${valId}">${displayMult ? Math.round(val * displayMult) : val}${unit}</div>
    </div>`;
};

window.updateKnob = function(input, visualId) {
    let min = parseFloat(input.min) || 0; let max = parseFloat(input.max) || 100;
    let val = parseFloat(input.value);
    let percent = (val - min) / (max - min);
    let degrees = -135 + (percent * 270); 
    let vis = document.getElementById(visualId);
    if(vis) vis.style.transform = `rotate(${degrees}deg)`;
};

window.openPanoModal = async function(pano) {
    window.currentOpenPano = pano;
    let existing = document.getElementById('active-pano-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'active-pano-modal';
    overlay.className = 'pano-modal-overlay';

    overlay.innerHTML = `
        <div class="pano-modal-content">
            <button class="pano-modal-close" onclick="closePanoModal()">✕</button>
            <div id="pano-modal-body-container" style="flex:1; display:flex; flex-direction:column; overflow-y:auto; padding-right:5px;">
                ${window.getPopupHTML(pano)}
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    setTimeout(async () => {
        document.querySelectorAll('.hidden-range').forEach(input => { input.dispatchEvent(new Event('input')); });
        
        if(!window.panoDataCache[pano.id]) {
            try {
                let r = await fetch(pano.arrayUrl);
                window.panoDataCache[pano.id] = await r.json();
            } catch(e) { console.error(e); }
        }
        window.drawLines(pano.id);
        window.loadPresets(pano.id); 
    }, 50);
};

window.closePanoModal = function() {
    window.currentOpenPano = null;
    let existing = document.getElementById('active-pano-modal');
    if (existing) existing.remove();
};

window.getPopupHTML = function(pano) {
    const s = window.activeSynth[pano.id];
    const t = (typeof text !== 'undefined' && text[window.currentLang]) ? text[window.currentLang] : {};
    
    return `
        <div class="popup-content">
            <div class="popup-header">
                <h3>${pano.titel}</h3>
            </div>
            <div style="font-size: 12px; color: #888; margin-bottom: 8px;">📅 ${pano.datum} | 📷 ${pano.kamera || 'Unbekannt'}</div>
            
            <div class="bild-container" onclick="window.openLightbox('${pano.bildUrl}')" title="${t.vergroessern || 'Vergrößern'}">
                <img src="${pano.bildUrl}" class="popup-img" />
                <canvas id="canvas_${pano.id}" class="punktOverlay"></canvas>
            </div>

            <div class="dropdown-row">
                <div class="dropdown-box">
                    <label>${t.modus || "Modus"}</label>
                    <select id="sel_mode_${pano.id}" onchange="window.activeSynth['${pano.id}'].mode = this.value;">
                        <option value="chord" ${s.mode === 'chord' ? 'selected' : ''}>${t.mod_gleich || "Akkord"}</option>
                        <option value="lr" ${s.mode === 'lr' ? 'selected' : ''}>${t.mod_lr || "L -> R"}</option>
                        <option value="rl" ${s.mode === 'rl' ? 'selected' : ''}>${t.mod_rl || "R -> L"}</option>
                    </select>
                </div>
                <div class="dropdown-box">
                    <label>${t.tonart || "Tonart"}</label>
                    <select id="sel_scale_${pano.id}" onchange="window.activeSynth['${pano.id}'].scale = this.value;">
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
                    <select id="sel_wave_${pano.id}" onchange="window.activeSynth['${pano.id}'].wave = this.value;">
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
                ${window.buildKnob(pano.id, 'peaks', t.gipfel || 'Gipfel', 0, 12, 1, true, null)}
                ${window.buildKnob(pano.id, 'valleys', t.taeler || 'Täler', 0, 12, 1, true, null)}
                ${window.buildKnob(pano.id, 'spacing', t.abstand || 'Abstand', 10, 150, 5, true, null, 'px')}
                ${window.buildKnob(pano.id, 'sensibilitaet', t.sensibilitaet || 'Sensib.', 0, 30, 1, true, null)}
                
                ${window.buildKnob(pano.id, 'oktaven', t.oktaven || 'Oktaven', 1, 6, 1, true, null)}
                ${window.buildKnob(pano.id, 'range', t.range || 'Scale', 20, 100, 5, true, null, '%')}
                ${window.buildKnob(pano.id, 'duration', t.dauer || 'Dauer', 0.5, 15, 0.5, false, null, 's')}
                ${window.buildKnob(pano.id, 'echo', t.echo || 'Echo', 0, 0.8, 0.05, false, 100, '%')}

                ${window.buildKnob(pano.id, 'attack', t.attack || 'Attack', 0.1, 5.0, 0.1, false, null, 's')}
                ${window.buildKnob(pano.id, 'release', t.release || 'Release', 0.1, 8.0, 0.1, false, null, 's')}
                ${window.buildKnob(pano.id, 'volume', t.lautstaerke || 'Vol', 0.05, 0.5, 0.05, false, 100, '%')}
            </div>

            <div class="action-btn-row">
                <button class="icon-btn" title="${t.hint_play_current || 'Play'}" onclick="window.playMultiPanorama('${pano.id}', '${pano.arrayUrl}', false)">▶️</button>
                <button class="icon-btn" title="${t.hint_play_sel || 'Play Selection'}" onclick="window.playMultiPanorama('${pano.id}', '${pano.arrayUrl}', true)">🎶</button>
                <button class="icon-btn" title="${t.hint_load_sel || 'Load Preset'}" onclick="window.loadSelectedPreset('${pano.id}')">📂</button>
                <button class="icon-btn" id="save-btn-${pano.id}" title="${t.hint_save || 'Save'}" onclick="window.savePreset('${pano.id}')">💾</button>
            </div>

            <div class="presets-section">
                <div class="preset-header">Community Presets</div>
                <div id="preset-container-${pano.id}" class="preset-list-container">
                    <div id="preset-list-${pano.id}"></div>
                </div>
            </div>
        </div>
    `;
};

window.ladePanoramenAusSheet = async function() {
    try {
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Panoramen`;
        const res = await fetch(url);
        window.panoramenDaten = parseCSV(await res.text());
        if(window.markerClusterGroup) window.markerClusterGroup.clearLayers();

        window.panoramenDaten.forEach(pano => {
            const coords = pano.position ? pano.position.split(',').map(c => parseFloat(c.trim())) : [46.8182, 8.2275];
            const marker = L.marker(coords);
            marker.panoId = pano.id;
            
            marker.on('click', function() {
                window.openPanoModal(pano);
            });

            if(window.markerClusterGroup) window.markerClusterGroup.addLayer(marker);

            window.activeSynth[pano.id] = {
                peaks: parseInt(pano.peaks) || 4, valleys: parseInt(pano.valleys) || 2, spacing: parseInt(pano.spacing) || 35,
                sensibilitaet: parseInt(pano.sensibilitaet) || 0, mode: pano.mode || 'chord', scale: pano.scale || 'lydian',
                oktaven: parseInt(pano.oktaven) || 3, range: parseInt(pano.range) || 100, wave: pano.wave || 'darkpad',
                volume: parseFloat(pano.volume) || 0.2, duration: parseFloat(pano.duration) || 5.0, attack: parseFloat(pano.attack) || 1.0,
                release: parseFloat(pano.release) || 2.0, echo: parseFloat(pano.echo) || 0.3
            };
        });
    } catch (e) { console.error(e); }
};

// Start Setup
window.ladePanoramenAusSheet();
document.addEventListener("DOMContentLoaded", () => {
    window.updateUserNameDisplay();
});