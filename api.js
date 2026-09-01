// api.js - Datenverwaltung, Netzwerk und Nutzer
window.currentLang = 'de';
window.panoramenDaten = [];
window.activeSynth = {}; 
window.panoDataCache = {}; 
window.currentPresets = []; 

function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag]));
}

function getUserId() {
    let id = localStorage.getItem('pano_user_id');
    if (!id) {
        id = 'usr_' + Math.random().toString(36).substr(2, 9) + Date.now();
        localStorage.setItem('pano_user_id', id);
    }
    return id;
}

function getUserName() { return localStorage.getItem('pano_user_name'); }

function setUserName(name) { 
    localStorage.setItem('pano_user_name', name); 
    window.updateUserNameDisplay();
}

window.updateUserNameDisplay = function() {
    let name = getUserName();
    let display = document.getElementById('user-display');
    if (display) {
        display.innerText = name ? `👤 ${name}` : "👤 Gast";
    }
};

window.changeUserName = function() {
    const t = (typeof text !== 'undefined' && text[window.currentLang]) ? text[window.currentLang] : {};
    let current = getUserName() || "";
    let newName = prompt(t.prompt_name_change || "Wie lautet dein (Spitz-)Name?", current);
    if (newName && newName.trim() !== "") {
        setUserName(newName.trim());
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
            let timeStr = "";
            
            if (p.timestamp) {
                let d = new Date(p.timestamp);
                if (!isNaN(d.getTime())) {
                    let day = d.getDate().toString().padStart(2, '0');
                    let month = (d.getMonth() + 1).toString().padStart(2, '0');
                    let hours = d.getHours().toString().padStart(2, '0');
                    let mins = d.getMinutes().toString().padStart(2, '0');
                    timeStr = ` - ${day}.${month}.${d.getFullYear()} ${hours}:${mins}`;
                }
            }

            html += `
            <div class="preset-item">
                <input type="checkbox" class="preset-cb" value="${escapeHTML(p.preset_id)}">
                <div class="preset-info">
                    <strong>${escapeHTML(p.preset_name)}</strong> 
                    <span>von ${escapeHTML(p.user_name)}${timeStr}</span>
                </div>
                ${isOwner ? `<button onclick="deletePreset('${escapeHTML(p.preset_id)}', '${escapeHTML(panoId)}')" class="del-btn" title="Löschen">🗑️</button>` : ''}
            </div>`;
        });
        container.innerHTML = html;
    } catch(e) { 
        container.innerHTML = "<div style='font-size:11px; color:red;'>Fehler beim Laden.</div>"; 
    }
};

window.loadSelectedPreset = function(panoId) {
    let checkedBoxes = document.querySelectorAll(`#preset-list-${panoId} .preset-cb:checked`);
    const t = (typeof text !== 'undefined' && text[window.currentLang]) ? text[window.currentLang] : {};
    
    if (checkedBoxes.length === 0) {
        alert(t.alert_load_empty || "Bitte markiere ein Preset zum Laden.");
        return;
    }
    if (checkedBoxes.length > 1) {
        alert(t.alert_load_multi || "Zum Laden auf die Regler darf nur EIN Preset markiert sein.");
        return;
    }
    
    let presetId = checkedBoxes[0].value;
    let p = window.currentPresets.find(pr => String(pr.preset_id) === String(presetId));
    
    if (p) {
        window.activeSynth[panoId] = {
            peaks: parseInt(p.peaks) || 4, 
            valleys: parseInt(p.valleys) || 2, 
            spacing: parseInt(p.spacing) || 35,
            sensibilitaet: parseInt(p.sensibilitaet) || 0, 
            mode: p.mode ? String(p.mode).trim().toLowerCase() : 'chord', 
            scale: p.scale ? String(p.scale).trim().toLowerCase() : 'lydian',
            oktaven: parseInt(p.oktaven) || 3, 
            range: parseInt(p.range) || 100, 
            wave: p.wave ? String(p.wave).trim().toLowerCase() : 'darkpad',
            volume: parseFloat(p.volume) || 0.2, 
            duration: parseFloat(p.duration) || 5.0, 
            attack: parseFloat(p.attack) || 1.0, 
            release: parseFloat(p.release) || 2.0, 
            echo: parseFloat(p.echo) || 0.3
        };
        
        let modeSel = document.getElementById(`sel_mode_${panoId}`);
        if (modeSel) { 
            modeSel.value = window.activeSynth[panoId].mode; 
            modeSel.dispatchEvent(new Event('change'));
        }
        
        let scaleSel = document.getElementById(`sel_scale_${panoId}`);
        if (scaleSel) { 
            scaleSel.value = window.activeSynth[panoId].scale; 
            scaleSel.dispatchEvent(new Event('change'));
        }
        
        let waveSel = document.getElementById(`sel_wave_${panoId}`);
        if (waveSel) { 
            waveSel.value = window.activeSynth[panoId].wave; 
            waveSel.dispatchEvent(new Event('change'));
        }

        const sliderKeys = ['peaks', 'valleys', 'spacing', 'sensibilitaet', 'oktaven', 'range', 'duration', 'echo', 'attack', 'release', 'volume'];
        sliderKeys.forEach(key => {
            let rangeInput = document.getElementById(`range_${key}_${panoId}`);
            if (rangeInput) {
                rangeInput.value = window.activeSynth[panoId][key];
                rangeInput.dispatchEvent(new Event('input'));
            }
        });
    }
};

window.savePreset = async function(panoId) {
    const t = (typeof text !== 'undefined' && text[window.currentLang]) ? text[window.currentLang] : {};
    let name = getUserName();
    
    if (!name) {
        name = prompt(t.prompt_welcome || "Willkommen! Unter welchem (Spitz-)Namen sollen deine Presets gespeichert werden?");
        if (!name) return;
        setUserName(name);
    }
    
    let msg = (t.prompt_preset_name || "Hallo {name}, wie soll diese Klangeinstellung heissen?").replace('{name}', name);
    let presetName = prompt(msg);
    if (!presetName) return;

    let s = window.activeSynth[panoId];
    let payload = {
        action: "save", pano_id: panoId, preset_name: presetName,
        user_name: name, user_id: getUserId(), timestamp: new Date().toISOString(), ...s
    };

    let btn = document.getElementById(`save-btn-${panoId}`);
    if (btn) { btn.innerText = "⏳"; }
    
    try {
        await fetch(API_URL, { 
            method: 'POST', mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload) 
        });
        
        let successMsg = (t.alert_saved || "Erfolg! '{preset}' wurde gespeichert.").replace('{preset}', presetName);
        alert(successMsg);
        setTimeout(() => { loadPresets(panoId); }, 1500);
    } catch(e) { 
        alert(t.alert_net_error || "Netzwerkfehler beim Speichern."); 
    }
    if (btn) { btn.innerText = "💾"; }
};

window.deletePreset = async function(presetId, panoId) {
    const t = (typeof text !== 'undefined' && text[window.currentLang]) ? text[window.currentLang] : {};
    if(!confirm(t.alert_delete || "Möchtest du dieses Preset wirklich löschen?")) return;
    try {
        await fetch(API_URL, { 
            method: 'POST', mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: "delete", preset_id: presetId, user_id: getUserId() }) 
        });
        setTimeout(() => { loadPresets(panoId); }, 1500);
    } catch(e) { alert("Fehler beim Löschen."); }
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
            
            marker.bindPopup(() => window.getPopupHTML(pano));
            
            marker.on('popupopen', async function() {
                document.querySelectorAll('.hidden-range').forEach(input => { input.dispatchEvent(new Event('input')); });
                
                if(!window.panoDataCache[pano.id]) {
                    try {
                        let r = await fetch(pano.arrayUrl);
                        window.panoDataCache[pano.id] = await r.json();
                    } catch(e) { console.error(e); }
                }
                window.drawLines(pano.id);
                window.loadPresets(pano.id); 
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