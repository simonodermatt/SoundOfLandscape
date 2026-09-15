
const synthIcons = {
    peaks: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M12 3l7 12H5z"/><path d="M12 18V8"/><path d="M9 11l3-3 3 3"/></svg>`,
    valleys: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M12 21L5 9h14z"/><path d="M12 6v10"/><path d="M9 13l3 3 3-3"/></svg>`,
    spacing: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M21 12H3"/><path d="M18 9l3 3-3 3"/><path d="M6 9l-3 3 3 3"/></svg>`,
    sensibilitaet: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
    oktaven: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M12 20V4"/><path d="M8 8l4-4 4 4"/><path d="M8 16l4 4 4-4"/></svg>`,
    range: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M3 21h4v-4h4v-4h4v-4h4V5"/></svg>`,
    duration: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M10 2h4"/></svg>`,
    echo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>`,
    attack: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M3 20h6l12-14"/></svg>`,
    release: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M3 6h6l12 14"/></svg>`,
    volume: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`
};

// ui.js - Karte, Canvas, Vollbild-Modal und angepasste UI

// CSS für das Modal, skalierte Bilder und 50% größere Drehknöpfe
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
    padding: 15px;
    box-sizing: border-box;
}
.pano-modal-content {
    background: #1e1e1e;
    color: #fff;
    width: fit-content;
    max-width: 96vw;
    max-height: 96vh;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    position: relative;
    box-shadow: 0 10px 30px rgba(0,0,0,0.6);
    padding: 25px 20px 20px 20px;
    box-sizing: border-box;
    overflow: hidden;
}
.pano-modal-close {
    position: absolute;
    top: 15px;
    right: 20px;
    background: #ff4d4d;
    color: white;
    border: none;
    border-radius: 50%;
    width: 42px;
    height: 42px;
    font-size: 22px;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 20;
}
#pano-modal-body-container {
    overflow-y: auto;
    flex: 1;
    padding-right: 5px;
}

/* Bild-Container mit exakter Ausrichtung für Canvas & Bild */
.bild-container {
    position: relative;
    cursor: pointer;
    width: 100%;
    background: #111;
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
    max-height: 300px;
    border: 1px solid #333;
}
.popup-img {
    width: 100%;
    height: auto;
    max-height: 300px;
    object-fit: contain;
    display: block;
}
.punktOverlay {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    object-fit: contain;
    pointer-events: none;
}

/* Dropdowns & Buttons */
.dropdown-row {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin: 12px 0;
}
.dropdown-box {
    flex: 1;
    min-width: 140px;
    display: flex;
    flex-direction: column;
}
.dropdown-box label {
    font-size: 13px;
    color: #bbb;
    margin-bottom: 4px;
}
.dropdown-box select {
    padding: 8px;
    background: #333;
    color: #fff;
    border: 1px solid #555;
    border-radius: 6px;
    font-size: 15px;
}
.presets-section {
    background: #252525;
    padding: 12px;
    border-radius: 8px;
    margin-top: 15px;
    border: 1px solid #333;
}
.preset-list-container {
    max-height: 160px;
    overflow-y: auto;
    margin-top: 8px;
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
    
    let activeModal = document.getElementById('active-pano-modal');
    if (activeModal && window.currentOpenPano) {
        document.getElementById('pano-modal-body-container').innerHTML = window.getPopupHTML(window.currentOpenPano);
        setTimeout(() => {
            document.querySelectorAll('.te-fader').forEach(input => { input.dispatchEvent(new Event('input')); });
            window.drawLines(window.currentOpenPano.id);
            window.loadPresets(window.currentOpenPano.id); 
        }, 50);
    }
};

window.openLightbox = function(url) {
    document.getElementById('lightbox-img').src = url;
    document.getElementById('lightbox').style.display = 'flex';
};

window.openMapOverlay = function(panoId, url) {
    const overlay = document.getElementById('map-overlay-fullscreen');
    const content = document.getElementById('map-overlay-content');
    const origContainer = document.getElementById(`bild-container-${panoId}`);

    if (origContainer) {
        // Clone the container to show it full map size
        const cloned = origContainer.cloneNode(true);
        cloned.id = `bild-container-${panoId}-fullscreen`;
        // Ensure click doesn't re-trigger
        cloned.onclick = null;
        cloned.style.cursor = 'default';

        // We need to redraw the canvas on the cloned container
        content.innerHTML = '';
        content.appendChild(cloned);
        overlay.style.display = 'flex';

        // Redraw canvas in full resolution
        setTimeout(() => {
            // Re-draw onto the cloned canvas by faking a drawLines call
            const clonedCanvas = cloned.querySelector('canvas');
            if (clonedCanvas) {
                clonedCanvas.id = `canvas_${panoId}_fullscreen`;
                // Briefly override the id reference in drawLines to draw to fullscreen canvas
                const origDrawLines = window.drawLines;
                const tempCanvasId = `canvas_${panoId}_fullscreen`;

                // Helper to draw to the fullscreen canvas
                const daten = window.panoDataCache[panoId];
                if(daten) {
                    const s = window.activeSynth[panoId];
                    const topGipfel = window.findePunkte(daten.kurve_y, s.peaks, s.spacing, s.sensibilitaet, 'gipfel');
                    const tiefeTaeler = window.findePunkte(daten.kurve_y, s.valleys, s.spacing, s.sensibilitaet, 'tal');

                    const ctx = clonedCanvas.getContext('2d');
                    clonedCanvas.width = daten.bild_breite;
                    clonedCanvas.height = daten.bild_hoehe;
                    ctx.clearRect(0, 0, clonedCanvas.width, clonedCanvas.height);
                    ctx.lineWidth = Math.max(4, Math.round(daten.bild_breite / 600));

                    const isRaster = cloned.classList.contains('raster-mode');

                    if (isRaster && daten.kurve_y && daten.kurve_y.length > 0) {
                        ctx.beginPath();
                        ctx.moveTo(0, daten.kurve_y[0]);
                        for(let i=1; i<daten.kurve_y.length; i++) {
                            ctx.lineTo(i, daten.kurve_y[i]);
                        }
                        ctx.strokeStyle = '#1a1a1a';
                        ctx.stroke();
                    }

                    ctx.strokeStyle = 'rgba(255, 215, 0, 0.9)';
                    if (isRaster) {
                        ctx.fillStyle = 'rgba(255, 215, 0, 0.9)';
                    }
                    topGipfel.forEach(p => {
                        ctx.beginPath();
                        ctx.moveTo(p.x, 0);
                        ctx.lineTo(p.x, clonedCanvas.height);
                        ctx.stroke();
                        if (isRaster) {
                            ctx.beginPath();
                            ctx.arc(p.x, p.y, ctx.lineWidth * 2, 0, 2 * Math.PI);
                            ctx.fill();
                        }
                    });

                    ctx.strokeStyle = 'rgba(0, 191, 255, 0.9)';
                    if (isRaster) {
                        ctx.fillStyle = 'rgba(0, 191, 255, 0.9)';
                    }
                    tiefeTaeler.forEach(p => {
                        ctx.beginPath();
                        ctx.moveTo(p.x, 0);
                        ctx.lineTo(p.x, clonedCanvas.height);
                        ctx.stroke();
                        if (isRaster) {
                            ctx.beginPath();
                            ctx.arc(p.x, p.y, ctx.lineWidth * 2, 0, 2 * Math.PI);
                            ctx.fill();
                        }
                    });
                }
            }
        }, 50);

        // Hide modal
        let modal = document.getElementById('active-pano-modal');
        if (modal) modal.style.display = 'none';
    }
};

window.closeMapOverlay = function() {
    const overlay = document.getElementById('map-overlay-fullscreen');
    const content = document.getElementById('map-overlay-content');

    overlay.style.display = 'none';
    content.innerHTML = '';

    // Show modal again
    let modal = document.getElementById('active-pano-modal');
    if (modal) modal.style.display = 'flex';
};

window.toggleViewMode = function(panoId, isRaster) {
    const img = document.getElementById(`popup-img-${panoId}`);
    const container = document.getElementById(`bild-container-${panoId}`);
    if (!img || !container) return;

    if (isRaster) {
        img.style.opacity = '0';
        container.classList.add('raster-mode');
    } else {
        img.style.opacity = '1';
        container.classList.remove('raster-mode');
    }
    // Redraw lines to handle the curve drawing logic depending on the mode
    window.drawLines(panoId);
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
        // Exakte Original-Dimensionen des Bildes für das Canvas setzen
        canvas.width = daten.bild_breite; 
        canvas.height = daten.bild_hoehe;
        ctx.clearRect(0, 0, canvas.width, canvas.height); 
        ctx.lineWidth = Math.max(4, Math.round(daten.bild_breite / 600)); // Dynamische Linienstärke
        
        const container = document.getElementById(`bild-container-${panoId}`);
        const isRaster = container && container.classList.contains('raster-mode');

        if (isRaster && daten.kurve_y && daten.kurve_y.length > 0) {
            ctx.beginPath();
            ctx.moveTo(0, daten.kurve_y[0]);
            for(let i=1; i<daten.kurve_y.length; i++) {
                ctx.lineTo(i, daten.kurve_y[i]);
            }
            ctx.strokeStyle = '#1a1a1a';
            ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(255, 215, 0, 0.9)';
        if (isRaster) {
            ctx.fillStyle = 'rgba(255, 215, 0, 0.9)';
        }
        topGipfel.forEach(p => { 
            ctx.beginPath(); 
            ctx.moveTo(p.x, 0); 
            ctx.lineTo(p.x, canvas.height); 
            ctx.stroke(); 
            if (isRaster) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, ctx.lineWidth * 2, 0, 2 * Math.PI);
                ctx.fill();
            }
        });
        
        ctx.strokeStyle = 'rgba(0, 191, 255, 0.9)';
        if (isRaster) {
            ctx.fillStyle = 'rgba(0, 191, 255, 0.9)';
        }
        tiefeTaeler.forEach(p => { 
            ctx.beginPath(); 
            ctx.moveTo(p.x, 0); 
            ctx.lineTo(p.x, canvas.height); 
            ctx.stroke(); 
            if (isRaster) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, ctx.lineWidth * 2, 0, 2 * Math.PI);
                ctx.fill();
            }
        });
    }
};

window.buildKnob = function(panoId, key, label, min, max, step, isInt, displayMult, unit = "") {
    let val = (window.activeSynth && window.activeSynth[panoId] && window.activeSynth[panoId][key]) !== undefined ? window.activeSynth[panoId][key] : min;
    let valId = `val_${key}_${panoId}`;
    let triggerDraw = ['peaks', 'valleys', 'spacing', 'sensibilitaet'].includes(key) ? `window.drawLines('${panoId}');` : '';
    let displayVal = displayMult ? Math.round(val * displayMult) : val;
    let jsAction = `
        window.activeSynth['${panoId}'].${key} = ${isInt ? 'parseInt' : 'parseFloat'}(this.value);
        let dVal = ${displayMult ? 'Math.round(this.value * '+displayMult+')' : 'this.value'};
        let tooltip = document.getElementById('tt_val_${key}_${panoId}'); if(tooltip) { tooltip.innerText = dVal; }
        ${triggerDraw}
    `.replace(/\n/g, '').replace(/\s+/g, ' ');
    
    let icon = synthIcons[key] || '';

    return `
    <div class="fader-box te-tooltip-container">
        <div class="te-tooltip" id="tt_${key}_${panoId}"><span class="tt-label">${label}: </span><span id="tt_val_${key}_${panoId}">${displayVal}</span><span class="tt-unit">${unit}</span></div>
        <div class="fader-icon-container">
            ${icon}
        </div>
        <div class="fader-container">
            <input type="range" id="range_${key}_${panoId}" class="te-fader" min="${min}" max="${max}" step="${step}" value="${val}" oninput="${jsAction}">
        </div>
    </div>`;
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
            <div id="pano-modal-body-container">
                ${window.getPopupHTML(pano)}
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    setTimeout(async () => {
        document.querySelectorAll('.te-fader').forEach(input => { input.dispatchEvent(new Event('input')); });

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
    const s = window.activeSynth && window.activeSynth[pano.id] ? window.activeSynth[pano.id] : { mode: 'chord', scale: 'lydian', waveform: 'sine' };
    const t = (typeof text !== 'undefined' && text[window.currentLang]) ? text[window.currentLang] : {};
    
    return `
        <div class="popup-content">
            <div class="popup-header">
                <h3 style="margin: 0 0 5px 0; font-size: 18px;">${pano.titel}</h3>
            </div>
            <div style="font-size: 13px; color: #aaa; margin-bottom: 10px;">📅 ${pano.datum} | 📷 ${pano.kamera || 'Unbekannt'}</div>
            
            <div id="bild-container-${pano.id}" class="bild-container" onclick="window.openMapOverlay('${pano.id}', '${pano.bildUrl}')" title="${t.vergroessern || 'Vergrößern (Vollbild)'}">
                <img id="popup-img-${pano.id}" src="${pano.bildUrl}" class="popup-img" />
                <canvas id="canvas_${pano.id}" class="punktOverlay"></canvas>
            </div>

            <div class="view-toggle-container">
                <label class="te-switch">
                    <input type="checkbox" id="view-toggle-${pano.id}" onchange="window.toggleViewMode('${pano.id}', this.checked)">
                    <span class="te-slider"></span>
                </label>
                <span class="te-switch-label" id="lbl-view-toggle-${pano.id}">${t.raster_view || 'Raster'}</span>
            </div>


            <div class="synth-layout-container">
                <div class="synth-layout-left">
                    <div class="synth-grid">
                        ${window.buildKnob(pano.id, 'peaks', t.gipfel || 'Gipfel', 0, 12, 1, true, null)}
                        ${window.buildKnob(pano.id, 'valleys', t.taeler || 'Täler', 0, 12, 1, true, null)}
                        ${window.buildKnob(pano.id, 'spacing', t.abstand || 'Abstand', 10, 150, 5, true, null, 'px')}
                        ${window.buildKnob(pano.id, 'sensibilitaet', t.sensibilitaet || 'Sensib.', 0, 30, 1, true, null)}

                        ${window.buildKnob(pano.id, 'oktaven', t.oktaven || 'Oktaven', 1, 6, 1, true, null)}
                        ${window.buildKnob(pano.id, 'range', t.range || 'Scale', 20, 100, 5, true, null, '%')}
                        ${window.buildKnob(pano.id, 'duration', t.dauer || 'Dauer', 0.5, 15, 0.5, false, null, 's')}

                        ${window.buildKnob(pano.id, 'attack', t.attack || 'Attack', 0.1, 5.0, 0.1, false, null, 's')}
                        ${window.buildKnob(pano.id, 'release', t.release || 'Release', 0.1, 8.0, 0.1, false, null, 's')}
                        ${window.buildKnob(pano.id, 'echo', t.echo || 'Echo', 0, 0.8, 0.05, false, 100, '%')}
                        ${window.buildKnob(pano.id, 'volume', t.lautstaerke || 'Vol', 0.05, 0.5, 0.05, false, 100, '%')}
                    </div>
                </div>
                <div class="synth-layout-right">
                    <div class="dropdown-box">

                        <select id="sel_mode_${pano.id}" onchange="window.activeSynth['${pano.id}'].mode = this.value;">
                            <option value="chord" ${s.mode === 'chord' ? 'selected' : ''}>${t.mod_gleich || "Akkord"}</option>
                            <option value="lr" ${s.mode === 'lr' ? 'selected' : ''}>${t.mod_lr || "L -> R"}</option>
                            <option value="rl" ${s.mode === 'rl' ? 'selected' : ''}>${t.mod_rl || "R -> L"}</option>
                        </select>
                    </div>
                    <div class="dropdown-box">

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

                        <select id="sel_wave_${pano.id}" onchange="window.activeSynth['${pano.id}'].wave = this.value;">
                            <option value="sine" ${s.wave === 'sine' ? 'selected' : ''}>${t.wave_sine || "Sinus"}</option>
                            <option value="triangle" ${s.wave === 'triangle' ? 'selected' : ''}>${t.wave_triangle || "Dreieck"}</option>
                            <option value="sawtooth" ${s.wave === 'sawtooth' ? 'selected' : ''}>${t.wave_sawtooth || "Sägezahn"}</option>
                            <option value="square" ${s.wave === 'square' ? 'selected' : ''}>${t.wave_square || "Rechteck"}</option>
                            <option value="organ" ${s.wave === 'organ' ? 'selected' : ''}>${t.wave_organ || "Orgel"}</option>
                            <option value="darkpad" ${s.wave === 'darkpad' ? 'selected' : ''}>${t.wave_darkpad || "Dark Pad"}</option>
                            <option value="chime" ${s.wave === 'chime' ? 'selected' : ''}>${t.wave_chime || "Glöckchen"}</option>
                            <option value="detuned_saw" ${s.wave === 'detuned_saw' ? 'selected' : ''}>${t.wave_detuned_saw || "Verstimmte Säge"}</option>
                            <option value="noise" ${s.wave === 'noise' ? 'selected' : ''}>${t.wave_noise || "Rauschen"}</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="action-btn-row">
                <button class="icon-btn" title="${t.hint_play_current || 'Play'}" onclick="window.playMultiPanorama('${pano.id}', '${pano.arrayUrl}', false)">▶</button>
                <button class="icon-btn" title="${t.hint_play_sel || 'Play Selection'}" onclick="window.playMultiPanorama('${pano.id}', '${pano.arrayUrl}', true)">♫</button>
                <button class="icon-btn" title="${t.hint_load_sel || 'Load Preset'}" onclick="window.loadSelectedPreset('${pano.id}')">⇪</button>
                <button class="icon-btn" id="save-btn-${pano.id}" title="${t.hint_save || 'Save'}" onclick="window.savePreset('${pano.id}')">⚑</button>
            </div>

            <div class="presets-section">
                <div class="preset-header" style="font-weight:bold; margin-bottom:5px; font-size:14px;">Community Presets</div>
                <div id="preset-container-${pano.id}" class="preset-list-container">
                    <div id="preset-list-${pano.id}"></div>
                </div>
            </div>
        </div>
    `;
};
// --- START SETUP ---
document.addEventListener("DOMContentLoaded", () => {
    // 1. Benutzernamen oben rechts initialisieren
    if (typeof window.updateUserNameDisplay === 'function') {
        window.updateUserNameDisplay();
    }
    
    // 2. Daten vom Google Sheet via Web-App abrufen und Karte füllen
    if (typeof window.ladePanoramenAusSheet === 'function') {
        window.ladePanoramenAusSheet();
    }
});