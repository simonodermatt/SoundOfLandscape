
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
    volume: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
    mutation: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.5" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.5" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>`
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
    
    let btnVinylMode = document.getElementById('btn-vinyl-mode');
    if (btnVinylMode) btnVinylMode.innerText = text[lang].vinyl_mode || "Vinyl";

    let btnGen = document.getElementById('btn-vinyl-generate');
    if (btnGen) btnGen.title = text[lang].vinyl_generate || "Generate";
    let btnPlay = document.getElementById('btn-vinyl-play');
    if (btnPlay) btnPlay.title = text[lang].vinyl_play || "Play";
    let btnSave = document.getElementById('btn-vinyl-save');
    if (btnSave) btnSave.title = text[lang].vinyl_save || "Save";
    let btnLoad = document.getElementById('btn-vinyl-load');
    if (btnLoad) btnLoad.title = text[lang].vinyl_load || "Load";
    let lblMutation = document.getElementById('lbl_mutation');
    if (lblMutation) lblMutation.innerText = (text[lang].vinyl_mutation || "Mutation") + ": ";
    // Update Vinyl Dropdowns
    let selVinylOctaves = document.getElementById('sel_vinyl_octaves');
    if (selVinylOctaves) {
        for (let i = 0; i < selVinylOctaves.options.length; i++) {
            let opt = selVinylOctaves.options[i];
            let key = 'oktave_' + opt.value;
            if (text[lang][key]) opt.text = text[lang][key];
        }
    }

    let selVinylScale = document.getElementById('sel_vinyl_scale');
    if (selVinylScale) {
        for (let i = 0; i < selVinylScale.options.length; i++) {
            let opt = selVinylScale.options[i];
            let key = 'scale_' + opt.value;
            if (text[lang][key]) opt.text = text[lang][key];
        }
    }

    let selVinylWave = document.getElementById('sel_vinyl_wave');
    if (selVinylWave) {
        for (let i = 0; i < selVinylWave.options.length; i++) {
            let opt = selVinylWave.options[i];
            let key = 'wave_' + opt.value;
            if (text[lang][key]) opt.text = text[lang][key];
        }
    }


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
    const t = (typeof text !== 'undefined' && text[window.currentLang]) ? text[window.currentLang] : {};

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
    let displayVal = key === 'mutation' ? parseFloat(val).toFixed(1) : (displayMult ? Math.round(val * displayMult) : val);
    let triggerDraw = ['peaks', 'valleys', 'spacing', 'sensibilitaet'].includes(key) ? `window.drawLines('${panoId}');` : '';

    let jsAction = `
        window.activeSynth['${panoId}'].${key} = ${isInt ? 'parseInt' : 'parseFloat'}(this.value);
        let dVal = ${key === 'mutation' ? 'parseFloat(this.value).toFixed(1)' : (displayMult ? 'Math.round(this.value * '+displayMult+')' : 'this.value')};
        let tooltip = document.getElementById('tt_val_${key}_${panoId}'); if(tooltip) { tooltip.innerText = dVal; }
        if (window.panoAiSequences && window.panoAiSequences['${panoId}']) {
            window.panoAiSequences['${panoId}'] = null;
            let aiBtn = document.getElementById('btn-ai-compose-${panoId}');
            if (aiBtn) {
                aiBtn.style.background = '';
                aiBtn.style.color = '';
            }
        }
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
                    <div class="synth-grid" style="grid-template-columns: 40px 20px repeat(11, 40px);">
                        ${window.buildKnob(pano.id, 'mutation', t.vinyl_mutation || 'Mutation', 0.5, 1.5, 0.1, false, null)}
                        <div class="synth-grid-spacer"></div>
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

                        <select id="sel_mode_${pano.id}" onchange="window.activeSynth['${pano.id}'].mode = this.value; if(window.panoAiSequences && window.panoAiSequences['${pano.id}']) { window.panoAiSequences['${pano.id}'] = null; let btn = document.getElementById('btn-ai-compose-${pano.id}'); if(btn){ btn.style.background=''; btn.style.color=''; } }">
                            <option value="chord" ${s.mode === 'chord' ? 'selected' : ''}>${t.mod_gleich || "Akkord"}</option>
                            <option value="lr" ${s.mode === 'lr' ? 'selected' : ''}>${t.mod_lr || "L -> R"}</option>
                            <option value="rl" ${s.mode === 'rl' ? 'selected' : ''}>${t.mod_rl || "R -> L"}</option>
                        </select>
                    </div>
                    <div class="dropdown-box">

                        <select id="sel_scale_${pano.id}" onchange="window.activeSynth['${pano.id}'].scale = this.value; if(window.panoAiSequences && window.panoAiSequences['${pano.id}']) { window.panoAiSequences['${pano.id}'] = null; let btn = document.getElementById('btn-ai-compose-${pano.id}'); if(btn){ btn.style.background=''; btn.style.color=''; } }">
                            <option value="major" ${s.scale === 'major' ? 'selected' : ''}>${t.scale_major || "Dur"}</option>
                            <option value="minor" ${s.scale === 'minor' ? 'selected' : ''}>${t.scale_minor || "Moll"}</option>
                            <option value="lydian" ${s.scale === 'lydian' ? 'selected' : ''}>${t.scale_lydian || "Lydisch"}</option>
                            <option value="dorian" ${s.scale === 'dorian' ? 'selected' : ''}>${t.scale_dorian || "Dorisch"}</option>
                            <option value="pentatonic" ${s.scale === 'pentatonic' ? 'selected' : ''}>${t.scale_pentatonic || "Pentatonik"}</option>
                            <option value="hirajoshi" ${s.scale === 'hirajoshi' ? 'selected' : ''}>${t.scale_hirajoshi || "Hirajōshi"}</option>
                        </select>
                    </div>
                    <div class="dropdown-box">

                        <select id="sel_wave_${pano.id}" onchange="window.activeSynth['${pano.id}'].wave = this.value; if(window.panoAiSequences && window.panoAiSequences['${pano.id}']) { window.panoAiSequences['${pano.id}'] = null; let btn = document.getElementById('btn-ai-compose-${pano.id}'); if(btn){ btn.style.background=''; btn.style.color=''; } }">
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
                <button class="icon-btn" id="btn-ai-compose-${pano.id}" onclick="window.aiComposePano('${pano.id}')" title="AI Compose" style="font-size: 11px; padding: 0 5px;">[ AI COMPOSE ]</button>
                <button class="icon-btn" id="btn-ai-play-${pano.id}" onclick="window.playAiPanoAudio('${pano.id}')" title="AI Play" style="font-size: 11px; padding: 0 5px;">[ AI PLAY ]</button>
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

// --- VINYL MODUS ---
window.vinylArray = [];
window.isVinylGenerating = false;
window.vinylRotationInterval = null;
window.vinylRotationAngle = 0;

window.toggleVinylMode = function() {
    let menu = document.getElementById('vinyl-menu');
    if (menu.style.display === 'none' || menu.style.display === '') {
        menu.style.display = 'flex';

        let uiMenu = document.getElementById('ui-menu');
        if (uiMenu) {
            menu.style.width = uiMenu.offsetWidth + 'px';
        }

        // Setup ResizeObserver to adjust speed fader width to its container height
        if (!window.vinylFaderObserver) {
            let speedBox = document.getElementById('vinyl-speed-box');
            let rangeSpeed = document.getElementById('range_vinyl_speed');
            let mutationBox = document.getElementById('vinyl-mutation-box');
            let rangeMutation = document.getElementById('range_vinyl_mutation');
            if (speedBox && rangeSpeed) {
                window.vinylFaderObserver = new ResizeObserver(entries => {
                    for (let entry of entries) {
                        let h = entry.contentRect.height;
                        // Fader Container has some padding and icon on top, height of fader is h - roughly 60px
                        let availableHeight = h - 60;
                        if (availableHeight > 20) {
                            rangeSpeed.style.width = availableHeight + 'px';
                            if (rangeMutation) {
                                rangeMutation.style.width = availableHeight + 'px';
                            }
                        }
                    }
                });
                window.vinylFaderObserver.observe(speedBox);
                if (mutationBox) {
                    window.vinylFaderObserver.observe(mutationBox);
                }
            }
        }

        window.drawVinylCanvas();
        if (typeof window.loadVinylPresets === 'function') {
            window.loadVinylPresets();
        }
    } else {
        menu.style.display = 'none';
        if (window.vinylRotationInterval) {
            clearInterval(window.vinylRotationInterval);
            window.vinylRotationInterval = null;
        }
        if (typeof window.stopAllAudio === 'function') {
            window.stopAllAudio();
        }
    }
};

window.generateVinyl = async function() {
    if (window.isVinylGenerating) return;
    window.isVinylGenerating = true;
    window.vinylArray = [];
    window.vinylProgress = 0;

    let btnGen = document.getElementById('btn-vinyl-generate');
    let originalText = btnGen.innerHTML;
    btnGen.innerHTML = "⧖";

    // Scratching animation
    window.vinylRotationInterval = setInterval(() => {
        window.vinylRotationAngle += 15;
        let canvas = document.getElementById('vinyl-canvas');
        if (canvas) {
            canvas.style.transform = `rotate(${window.vinylRotationAngle}deg)`;
        }
    }, 50);

    // Randomize panoramas
    let shuffledPanos = [...window.panoramenDaten].sort(() => Math.random() - 0.5);

    for (let i = 0; i < shuffledPanos.length; i++) {
        let pano = shuffledPanos[i];
        if (!pano || !pano.id || !pano.arrayUrl) continue;

        if (!window.panoDataCache[pano.id]) {
            try {
                let res = await fetch(pano.arrayUrl);
                window.panoDataCache[pano.id] = await res.json();
            } catch(e) {
                console.error("Error fetching data for", pano.id);
            }
        }

        if (window.panoDataCache[pano.id] && window.panoDataCache[pano.id].kurve_y) {
            // Append data
            // Use concat or loop to avoid RangeError: Maximum call stack size exceeded with spread operator
            window.vinylArray = window.vinylArray.concat(window.panoDataCache[pano.id].kurve_y);
        }
    }

    clearInterval(window.vinylRotationInterval);
    window.vinylRotationInterval = null;
    let canvas = document.getElementById('vinyl-canvas');
    if (canvas) {
        canvas.style.transform = `rotate(0deg)`;
    }

    btnGen.innerHTML = originalText;
    window.isVinylGenerating = false;
    window.vinylAiSequence = null; // Reset AI sequence on new generation
    window.drawVinylCanvas();
};

window.panoAiSequences = {};

window.aiComposePano = async function(panoId) {
    let btnAi = document.getElementById(`btn-ai-compose-${panoId}`);
    if (!btnAi || window.isAiComposing) return;

    const daten = window.panoDataCache[panoId];
    const s = window.activeSynth[panoId];
    if (!daten || !s) {
        alert(t.alert_data_not_found || "Daten nicht gefunden.");
        return;
    }

    const topGipfel = window.findePunkte(daten.kurve_y, s.peaks, s.spacing, s.sensibilitaet, 'gipfel');
    const tiefeTaeler = window.findePunkte(daten.kurve_y, s.valleys, s.spacing, s.sensibilitaet, 'tal');
    let allePunkte = topGipfel.concat(tiefeTaeler);

    if (allePunkte.length === 0) {
        alert(t.alert_no_points_adj || "Keine Punkte gefunden. Bitte Einstellungen anpassen.");
        return;
    }

    if (s.mode === 'lr') allePunkte.sort((a, b) => a.x - b.x);
    else if (s.mode === 'rl') allePunkte.sort((a, b) => b.x - a.x);
    else allePunkte.sort((a, b) => a.x - b.x); // Default sort by x

    window.panoAiSequences[panoId] = null;

    window.isAiComposing = true;
    let originalText = btnAi.innerHTML;
    let originalStyle = btnAi.getAttribute('style') || '';
    btnAi.disabled = true;

    let blinkState = false;
    let blinkInterval = setInterval(() => {
        blinkState = !blinkState;
        btnAi.innerHTML = blinkState ? "[ * PROCESSING... ]" : "[ PROCESSING... ]";
        btnAi.style.background = blinkState ? "#FF6600" : "#1a1a1a";
        btnAi.style.color = blinkState ? "#1a1a1a" : "#FF6600";
    }, 500);

    try {
        if (!window.music_rnn) {
            window.music_rnn = new mm.MusicRNN('https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/basic_rnn');
            await window.music_rnn.initialize();
        }

        // Limit to 16 points for seed
        let seedPoints = allePunkte.slice(0, 16);

        // Find min/max height for mapping
        let minVal = Math.min(...seedPoints.map(p => p.hoehe));
        let maxVal = Math.max(...seedPoints.map(p => p.hoehe));
        let range = maxVal - minVal;
        if (range === 0) range = 1;

        // Magenta strictly requires notes between 48 and 83. We generate safely in this range.
        const SAFE_MIN = 48;
        const SAFE_MAX = 83;

        let seedSequence = {
            notes: [],
            totalTime: 0,
            quantizationInfo: { stepsPerQuarter: 4 } // 1 step = 1/16th note
        };

        const stepDuration = 0.25;

        // Create seed within SAFE range
        for (let i = 0; i < seedPoints.length; i++) {
            let normalized = (seedPoints[i].hoehe - minVal) / range;
            let rawMidi = SAFE_MIN + (normalized * (SAFE_MAX - SAFE_MIN));
            seedSequence.notes.push({
                pitch: Math.round(rawMidi), // Unquantized for Magenta, but in safe range
                quantizedStartStep: i,
                quantizedEndStep: i + 1,
                startTime: i * stepDuration,
                endTime: (i + 1) * stepDuration,
                velocity: 80
            });
        }
        seedSequence.totalQuantizedSteps = seedPoints.length;

        // Generate melody (64 steps) via Magenta
        let mutationPano = s.mutation !== undefined ? s.mutation : 1.0;
        let generatedSequence = await window.music_rnn.continueSequence(seedSequence, 64, mutationPano);

        // Now map the final combined sequence back to the user's requested scale/octaves
        let scaleName = s.scale || 'lydian';
        let octaves = s.oktaven || 3;
        let intervals = window.scales && window.scales[scaleName] ? window.scales[scaleName] : [2, 2, 1, 2, 2, 2, 1];

        let allowedNotes = [];
        let baseNote = 48;
        let currentNote = baseNote;
        allowedNotes.push(currentNote);
        for (let o = 0; o < octaves; o++) {
            for (let i = 0; i < intervals.length; i++) {
                currentNote += intervals[i];
                allowedNotes.push(currentNote);
            }
        }

        function snapToScale(midiNote) {
            if (allowedNotes.length === 0) return midiNote;
            return allowedNotes.reduce((prev, curr) =>
                Math.abs(curr - midiNote) < Math.abs(prev - midiNote) ? curr : prev
            );
        }

        let mergedNotes = [];
        let allRawNotes = seedSequence.notes.concat(generatedSequence.notes);

        for (let i = 0; i < allRawNotes.length; i++) {
            let note = allRawNotes[i];
            let normalized = (note.pitch - SAFE_MIN) / (SAFE_MAX - SAFE_MIN);
            normalized = Math.max(0, Math.min(1, normalized));
            let targetRawMidi = allowedNotes[0] + (normalized * (allowedNotes[allowedNotes.length-1] - allowedNotes[0]));

            let isGenerated = i >= seedSequence.notes.length;
            let startStep = isGenerated ? seedSequence.totalQuantizedSteps + note.quantizedStartStep : note.quantizedStartStep;
            let endStep = isGenerated ? seedSequence.totalQuantizedSteps + note.quantizedEndStep : note.quantizedEndStep;

            let velocity = 80;
            if (i > 0) {
                let prevRawPoint = null;
                let currRawPoint = null;

                // If it's a seed point, we can compare original heights exactly.
                if (!isGenerated) {
                   prevRawPoint = seedPoints[i-1].hoehe;
                   currRawPoint = seedPoints[i].hoehe;
                } else {
                   // If it's generated, we compare the generated pitches mapped back relative to the range.
                   // A simple approximation is just using the pitch diff, which is what the reviewer suggests we do for all notes but we can be even more precise.
                   // However, for generated notes, we don't have a "height", just a pitch. So we compare the pitches.
                   let prevPitch = allRawNotes[i-1].pitch;
                   let diff = Math.abs(note.pitch - prevPitch);
                   let diffNorm = diff / (SAFE_MAX - SAFE_MIN);
                   velocity = Math.min(127, Math.max(40, 40 + Math.round(diffNorm * 400)));
                   if (diffNorm < 0.05) continue;
                }

                if (prevRawPoint !== null && currRawPoint !== null) {
                    let diff = Math.abs(currRawPoint - prevRawPoint);
                    let diffNorm = diff / (range || 1);
                    velocity = Math.min(127, Math.max(40, 40 + Math.round(diffNorm * 400)));
                    if (diffNorm < 0.05) continue;
                }
            }

            mergedNotes.push({
                pitch: snapToScale(Math.round(targetRawMidi)),
                startTime: startStep * stepDuration,
                endTime: endStep * stepDuration,
                velocity: velocity
            });
        }

        window.panoAiSequences[panoId] = {
            notes: mergedNotes,
            totalTime: (seedSequence.totalQuantizedSteps + 64) * stepDuration,
            stepDuration: stepDuration
        };

        // Success state
        btnAi.style.background = "#FF6600";
        btnAi.style.color = "#1a1a1a";
        btnAi.innerHTML = "[ AI COMPOSE ]";
        btnAi.disabled = false;

    } catch (e) {
        console.error("Fehler bei AI Generierung:", e);
        alert(t.alert_ai_error || "Fehler bei der AI Generierung.");

        // Reset to original on error
        btnAi.innerHTML = originalText;
        btnAi.setAttribute('style', originalStyle);
        btnAi.disabled = false;
    } finally {
        clearInterval(blinkInterval);
        window.isAiComposing = false;
    }
};

window.aiComposeVinyl = async function() {
    const t = (typeof text !== 'undefined' && text[window.currentLang]) ? text[window.currentLang] : {};

    let btnAi = document.getElementById('btn-ai-compose');
    if (!btnAi || window.isAiComposing) return;

    window.vinylAiSequence = null; // Clear previous AI sequence to allow new generation
    window.vinylProgress = 0;

    if (!window.vinylArray || window.vinylArray.length < 16) {
        alert(t.alert_gen_vinyl_array_data || "Bitte generiere zuerst ein Vinyl-Array mit ausreichend Daten (mind. 16 Punkte)!");
        return;
    }

    window.isAiComposing = true;
    let originalText = btnAi.innerHTML;
    let originalStyle = btnAi.getAttribute('style') || '';
    btnAi.disabled = true;

    // Blinking effect
    let blinkState = false;
    let blinkInterval = setInterval(() => {
        blinkState = !blinkState;
        btnAi.innerHTML = blinkState ? "[ * PROCESSING... ]" : "[ PROCESSING... ]";
        btnAi.style.background = blinkState ? "#FF6600" : "#1a1a1a";
        btnAi.style.color = blinkState ? "#1a1a1a" : "#FF6600";
    }, 500);

    try {
        if (!window.music_rnn) {
            window.music_rnn = new mm.MusicRNN('https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/basic_rnn');
            await window.music_rnn.initialize();
        }

        // 1. Get seed data (first 16 points)
        let seedPoints = window.vinylArray.slice(0, 16);

        // 2. Find min/max for mapping
        let minVal = Math.min(...seedPoints);
        let maxVal = Math.max(...seedPoints);
        let range = maxVal - minVal;
        if (range === 0) range = 1;

        // Magenta strictly requires notes between 48 and 83. We generate safely in this range.
        const SAFE_MIN = 48;
        const SAFE_MAX = 83;

        let seedSequence = {
            notes: [],
            totalTime: 0,
            quantizationInfo: { stepsPerQuarter: 4 } // 1 step = 1/16th note
        };

        const stepDuration = 0.25; // 0.25 seconds per note

        for (let i = 0; i < seedPoints.length; i++) {
            let normalized = (seedPoints[i] - minVal) / range;
            let rawMidi = SAFE_MIN + (normalized * (SAFE_MAX - SAFE_MIN));
            seedSequence.notes.push({
                pitch: Math.round(rawMidi),
                quantizedStartStep: i,
                quantizedEndStep: i + 1,
                startTime: i * stepDuration,
                endTime: (i + 1) * stepDuration,
                velocity: 80
            });
        }
        seedSequence.totalQuantizedSteps = seedPoints.length;

        // 4. Generate melody (64 steps) via Magenta
        let mutationVal = document.getElementById('range_vinyl_mutation') ? parseFloat(document.getElementById('range_vinyl_mutation').value) : 1.0;
        let generatedSequence = await window.music_rnn.continueSequence(seedSequence, 64, mutationVal);

        // Now map the final combined sequence back to the user's requested scale/octaves
        let scaleName = document.getElementById('sel_vinyl_scale')?.value || 'pentatonic';
        let octaves = parseInt(document.getElementById('sel_vinyl_octaves')?.value) || 4;
        let intervals = window.scales && window.scales[scaleName] ? window.scales[scaleName] : [2, 2, 1, 2, 2, 2, 1];

        let allowedNotes = [];
        let baseNote = 48;
        let currentNote = baseNote;

        allowedNotes.push(currentNote);
        for (let o = 0; o < octaves; o++) {
            for (let i = 0; i < intervals.length; i++) {
                currentNote += intervals[i];
                allowedNotes.push(currentNote);
            }
        }

        function snapToScale(midiNote) {
            if (allowedNotes.length === 0) return midiNote;
            return allowedNotes.reduce((prev, curr) =>
                Math.abs(curr - midiNote) < Math.abs(prev - midiNote) ? curr : prev
            );
        }

        let mergedNotes = [];
        let allRawNotes = seedSequence.notes.concat(generatedSequence.notes);

        for (let i = 0; i < allRawNotes.length; i++) {
            let note = allRawNotes[i];
            let normalized = (note.pitch - SAFE_MIN) / (SAFE_MAX - SAFE_MIN);
            normalized = Math.max(0, Math.min(1, normalized));
            let targetRawMidi = allowedNotes[0] + (normalized * (allowedNotes[allowedNotes.length-1] - allowedNotes[0]));

            let isGenerated = i >= seedSequence.notes.length;
            let startStep = isGenerated ? seedSequence.totalQuantizedSteps + note.quantizedStartStep : note.quantizedStartStep;
            let endStep = isGenerated ? seedSequence.totalQuantizedSteps + note.quantizedEndStep : note.quantizedEndStep;

            let velocity = 80;
            if (i > 0) {
                let prevRawPoint = null;
                let currRawPoint = null;

                if (!isGenerated) {
                   prevRawPoint = seedPoints[i-1];
                   currRawPoint = seedPoints[i];
                } else {
                   let prevPitch = allRawNotes[i-1].pitch;
                   let diff = Math.abs(note.pitch - prevPitch);
                   let diffNorm = diff / (SAFE_MAX - SAFE_MIN);
                   velocity = Math.min(127, Math.max(40, 40 + Math.round(diffNorm * 400)));
                   if (diffNorm < 0.02) continue;
                }

                if (prevRawPoint !== null && currRawPoint !== null) {
                    let diff = Math.abs(currRawPoint - prevRawPoint);
                    let diffNorm = diff / (range || 1);
                    velocity = Math.min(127, Math.max(40, 40 + Math.round(diffNorm * 400)));
                    if (diffNorm < 0.02) continue;
                }
            }

            mergedNotes.push({
                pitch: snapToScale(Math.round(targetRawMidi)),
                startTime: startStep * stepDuration,
                endTime: endStep * stepDuration,
                velocity: velocity
            });
        }

        window.vinylAiSequence = {
            notes: mergedNotes,
            totalTime: (seedSequence.totalQuantizedSteps + 64) * stepDuration,
            stepDuration: stepDuration
        };

    } catch (e) {
        console.error("Fehler bei AI Generierung:", e);
        alert(t.alert_ai_error || "Fehler bei der AI Generierung.");
    } finally {
        clearInterval(blinkInterval);
        if (window.vinylAiSequence) {
            btnAi.style.background = "#FF6600";
            btnAi.style.color = "#1a1a1a";
            btnAi.innerHTML = "[ AI COMPOSE ]";
        } else {
            btnAi.innerHTML = originalText;
            btnAi.setAttribute('style', originalStyle);
        }
        btnAi.disabled = false;
        window.isAiComposing = false;
    }
}

window.drawVinylCanvas = function() {
    let canvas = document.getElementById('vinyl-canvas');
    if (!canvas) return;
    let ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw record base
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, 2 * Math.PI);
    ctx.fillStyle = '#222';
    ctx.fill();

    // Draw record label
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 6, 0, 2 * Math.PI);
    ctx.fillStyle = '#1e1e1e';
    ctx.fill();
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw center hole
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#000';
    ctx.fill();

    if (window.vinylArray && window.vinylArray.length > 0) {
        let cx = canvas.width / 2;
        let cy = canvas.height / 2;
        let maxRadius = (canvas.width / 2) - 10;
        let minRadius = (canvas.width / 6) + 10;

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 0.5;

        // Spiral drawing logic
        let totalPoints = window.vinylArray.length;
        let rotations = 20; // Number of spirals

        // Find min/max for normalization (safe for large arrays)
        let maxY = -Infinity;
        let minY = Infinity;
        for (let i = 0; i < window.vinylArray.length; i++) {
            let val = window.vinylArray[i];
            if (val > maxY) maxY = val;
            if (val < minY) minY = val;
        }
        let rangeY = maxY - minY || 1;

        for (let i = 0; i < totalPoints; i++) {
            let progress = i / totalPoints;
            let currentRadius = maxRadius - (progress * (maxRadius - minRadius));
            let angle = progress * rotations * 2 * Math.PI;

            // Add slight variation based on data
            let normalizedY = (window.vinylArray[i] - minY) / rangeY;
            let variation = (normalizedY - 0.5) * 4; // +/- 2px variation
            currentRadius += variation;

            let x = cx + currentRadius * Math.cos(angle);
            let y = cy + currentRadius * Math.sin(angle);

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
    }
};

window.vinylIsPlaying = false;
    window.isPlayingAiVinyl = false;
window.vinylDotAnimationReq = null;
window.vinylStartTime = null;
window.vinylProgress = 0;
window.vinylTotalRotations = 20;

window.startVinylDotAnimation = function() {
    let overlayCanvas = document.getElementById('vinyl-overlay-canvas');
    if (!overlayCanvas) return;
    let ctx = overlayCanvas.getContext('2d');

    if (window.vinylDotAnimationReq) {
        cancelAnimationFrame(window.vinylDotAnimationReq);
    }
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);


    let totalPoints = window.vinylArray.length;

    // Duration in ms based on 20 rotations and current RPM (or AI generated sequence time).
    let getDuration = () => {
        let rpm = parseFloat(document.getElementById('range_vinyl_speed')?.value || 33);
        if (window.vinylAiSequence) {
            let speedMultiplier = rpm / 33.0;
            return (window.vinylAiSequence.totalTime / speedMultiplier) * 1000;
        }
        return (window.vinylTotalRotations / rpm) * 60 * 1000;
    };

    // We already have max/min and rotations from drawVinylCanvas logic
    let rotations = window.vinylTotalRotations;
    let maxRadius = (overlayCanvas.width / 2) - 10;
    let minRadius = (overlayCanvas.width / 6) + 10;
    let cx = overlayCanvas.width / 2;
    let cy = overlayCanvas.height / 2;

    let maxY = -Infinity;
    let minY = Infinity;
    for (let i = 0; i < window.vinylArray.length; i++) {
        let val = window.vinylArray[i];
        if (val > maxY) maxY = val;
        if (val < minY) minY = val;
    }
    let rangeY = maxY - minY || 1;

    window.vinylStartTime = performance.now();
    let lastTime = window.vinylStartTime;

    // Reset progress only if we've reached the end
    if (window.vinylProgress >= 1.0) {
        window.vinylProgress = 0;
    }

    function drawDot(time) {
        ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

        let duration = getDuration();
        let delta = time - lastTime;
        lastTime = time;

        if (window.vinylIsPlaying) {
            window.vinylProgress += delta / duration;
        }

        let progress = Math.min(window.vinylProgress, 1.0);

        if (progress < 1.0 && window.vinylIsPlaying) {
            let index = Math.floor(progress * totalPoints);
            if (index >= totalPoints) index = totalPoints - 1;

            let currentRadius = maxRadius - (progress * (maxRadius - minRadius));
            let angle = progress * rotations * 2 * Math.PI;

            // Reapply rotation from the spinning vinyl base to keep the dot synced on the groove
            // BUT wait, the base canvas spins.
            // So if we draw the dot here on the static overlay, we just need to place it
            // where the needle WOULD be if it wasn't spinning, then add the global vinylRotationAngle.
            let globalAngleRad = (window.vinylRotationAngle || 0) * (Math.PI / 180);

            let normalizedY = (window.vinylArray[index] - minY) / rangeY;
            let variation = (normalizedY - 0.5) * 4;
            currentRadius += variation;

            let totalAngle = angle + globalAngleRad;
            let x = cx + currentRadius * Math.cos(totalAngle);
            let y = cy + currentRadius * Math.sin(totalAngle);

            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fillStyle = '#FF6600'; // Orange Needle Point
            ctx.fill();

            window.vinylDotAnimationReq = requestAnimationFrame(drawDot);
        } else {
            if (!window.vinylIsPlaying && progress < 1.0) {
                let index = Math.floor(progress * totalPoints);
                if (index >= totalPoints) index = totalPoints - 1;
                let currentRadius = maxRadius - (progress * (maxRadius - minRadius));
                let angle = progress * rotations * 2 * Math.PI;
                let globalAngleRad = (window.vinylRotationAngle || 0) * (Math.PI / 180);
                let normalizedY = (window.vinylArray && window.vinylArray.length > 0 ? (window.vinylArray[index] - minY) / rangeY : 0.5);
                let variation = (normalizedY - 0.5) * 4;
                currentRadius += variation;
                let totalAngle = angle + globalAngleRad;
                let x = cx + currentRadius * Math.cos(totalAngle);
                let y = cy + currentRadius * Math.sin(totalAngle);
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, 2 * Math.PI);
                ctx.fillStyle = '#FF6600';
                ctx.fill();
                window.vinylDotAnimationReq = requestAnimationFrame(drawDot);
            } else {
                ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
                if (progress >= 1.0) {
                    window.stopVinylRotation();
                }
            }
        }
    }

    window.vinylDotAnimationReq = requestAnimationFrame(drawDot);
};

window.updateVinylSpeed = function(newRPM) {
    if (window.vinylIsPlaying && typeof window.updateVinylAudioSpeed === 'function') {
        window.updateVinylAudioSpeed(parseFloat(newRPM));
    }
};

window.stopVinylRotation = function() {
    if (window.vinylRotationInterval) {
        clearInterval(window.vinylRotationInterval);
        window.vinylRotationInterval = null;
    }
    if (window.vinylDotAnimationReq) {
        cancelAnimationFrame(window.vinylDotAnimationReq);
        window.vinylDotAnimationReq = null;
    }
    let overlayCanvas = document.getElementById('vinyl-overlay-canvas');
    if (overlayCanvas) overlayCanvas.getContext('2d').clearRect(0,0,overlayCanvas.width,overlayCanvas.height);

    let btnPlay = document.getElementById('btn-vinyl-play');
    if (btnPlay) {
        btnPlay.style.background = '';
        btnPlay.style.color = '';
    }
    let btnAiPlay = document.getElementById('btn-ai-play');
    if (btnAiPlay) {
        btnAiPlay.style.background = '';
        btnAiPlay.style.color = '';
    }
    window.vinylIsPlaying = false;
    window.isPlayingAiVinyl = false;
};



window.playAiVinyl = function() {
    const t = (typeof text !== 'undefined' && text[window.currentLang]) ? text[window.currentLang] : {};

    if (!window.vinylAiSequence) {
        alert(t.alert_gen_ai_seq_first || "Bitte generiere zuerst eine AI Sequenz!");
        return;
    }

    let btnAiPlay = document.getElementById('btn-ai-play');

    if (window.vinylIsPlaying) {
        window.stopVinylRotation();
        if (typeof window.stopAllAudio === 'function') {
            window.stopAllAudio();
        }
        if (btnAiPlay) {
            btnAiPlay.style.background = '';
            btnAiPlay.style.color = '';
        }
        return;
    }

    window.vinylIsPlaying = true;
    window.isPlayingAiVinyl = true; // Flag for audio.js
    if (btnAiPlay) {
        btnAiPlay.style.background = '#FF6600';
        btnAiPlay.style.color = '#1a1a1a';
    }

    if (typeof window.playVinylAudio === 'function') {
        window.playVinylAudio(window.vinylArray);
    }

    let canvas = document.getElementById('vinyl-canvas');
    if (canvas) {
        let angle = window.vinylRotationAngle || 0;
        if (window.vinylRotationInterval) clearInterval(window.vinylRotationInterval);
        window.vinylRotationLastTime = performance.now();
        window.vinylRotationInterval = setInterval(() => {
            let rpm = parseFloat(document.getElementById('range_vinyl_speed')?.value || 33);
            let now = performance.now();
            let delta = now - window.vinylRotationLastTime;
            window.vinylRotationLastTime = now;
            let degPerMs = (rpm * 360) / 60000;
            angle += degPerMs * delta;
            window.vinylRotationAngle = angle;
            canvas.style.transform = `rotate(${angle}deg)`;
        }, 30);
    }

    window.startVinylDotAnimation();
};

window.playVinyl = function() {
    const t = (typeof text !== 'undefined' && text[window.currentLang]) ? text[window.currentLang] : {};

    if (!window.vinylArray || window.vinylArray.length === 0) {
        alert(t.alert_gen_vinyl_array_first || "Bitte generiere zuerst das Vinyl-Array!");
        return;
    }

    let btnPlay = document.getElementById('btn-vinyl-play');

    if (window.vinylIsPlaying) {
        window.stopVinylRotation();
        if (typeof window.stopAllAudio === 'function') {
            window.stopAllAudio();
        }
        return;
    }

    window.vinylIsPlaying = true;
    window.isPlayingAiVinyl = false;
    if (btnPlay) {
        btnPlay.style.background = '#FF6600';
        btnPlay.style.color = '#1a1a1a';
    }

    if (typeof window.playVinylAudio === 'function') {
        window.playVinylAudio(window.vinylArray);
    }

    let canvas = document.getElementById('vinyl-canvas');
    if (canvas) {
        let angle = window.vinylRotationAngle || 0;
        if (window.vinylRotationInterval) clearInterval(window.vinylRotationInterval);
        window.vinylRotationLastTime = performance.now();
        window.vinylRotationInterval = setInterval(() => {
            let rpm = parseFloat(document.getElementById('range_vinyl_speed')?.value || 33);
            let now = performance.now();
            let delta = now - window.vinylRotationLastTime;
            window.vinylRotationLastTime = now;

            // Degrees per ms: (RPM * 360) / 60000
            let degPerMs = (rpm * 360) / 60000;
            angle += degPerMs * delta;
            window.vinylRotationAngle = angle;
            canvas.style.transform = `rotate(${angle}deg)`;
        }, 30);
    }

    window.startVinylDotAnimation();
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