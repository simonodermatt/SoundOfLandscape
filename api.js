// api.js - Datenverwaltung, Netzwerk und Nutzer (Supabase REST)
window.currentLang = 'de';
window.panoramenDaten = [];
window.activeSynth = {}; 
window.panoDataCache = {}; 
window.currentPresets = []; 

// Supabase Hilfsfunktionen für URL und Key
function getSupabaseUrl() {
    return (typeof SUPABASE_URL !== 'undefined') ? SUPABASE_URL : (window.SUPABASE_URL || "https://hdwbfkukcmrddrkrghiy.supabase.co");
}

function getSupabaseKey() {
    return (typeof SUPABASE_ANON_KEY !== 'undefined') ? SUPABASE_ANON_KEY : (window.SUPABASE_ANON_KEY || "sb_publishable_rUM-8j5OTgPsKH3XtbD0VQ_cCFM39SO");
}

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
        const sbUrl = getSupabaseUrl();
        const sbKey = getSupabaseKey();
        let res = await fetch(`${sbUrl}/rest/v1/presets?select=*&pano_id=eq.${encodeURIComponent(panoId)}&order=created_at.desc`, {
            method: 'GET',
            headers: {
                "apikey": sbKey,
                "Authorization": `Bearer ${sbKey}`
            }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        let presets = await res.json();
        
        // Mappe Supabase Attribute auf das bisherige Presets-Format
        window.currentPresets = presets
            .map(p => ({
                ...p,
                preset_id: p.preset_id || p.id,
                timestamp: p.timestamp || p.created_at,
                sensibilitaet: (p.sensibility !== undefined && p.sensibility !== null) ? p.sensibility : (p.sensibilitaet || 0),
                oktaven: (p.octaves !== undefined && p.octaves !== null) ? p.octaves : (p.oktaven || 3),
                gridLines: (p.grid_lines !== undefined && p.grid_lines !== null) ? p.grid_lines : (p.gridLines || 5),
                is_vinyl: (p.is_vinyl === true || p.is_vinyl === 'true' || p.is_vinyl === 'TRUE'),
                vinyl_array: p.vinyl_array || null,
                is_ai: (p.is_ai === true || p.is_ai === 'true' || p.is_ai === 'TRUE'),
                ai_sound: p.ai_sound || null
            }))
            .filter(p => String(p.pano_id) === String(panoId)); 
        
        if (window.currentPresets.length === 0) {
            container.innerHTML = "<div style='font-size:11px; color:#888;'>Noch keine Presets vorhanden.</div>";
            return;
        }

        let html = "";
        let myId = getUserId();
        
        window.currentPresets.forEach(p => {
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

            let aiBadge = (p.is_ai === true || p.is_ai === 'true' || p.is_ai === 'TRUE')
                ? '<span style="font-size:10px; margin-left:4px; padding:1px 3px; border:1px solid #aaa; border-radius:3px; color:#aaa; filter: grayscale(100%);" title="AI Generated">🤖 AI</span>'
                : '';

            html += `
            <div class="preset-item">
                <input type="checkbox" class="preset-cb" value="${escapeHTML(p.preset_id)}">
                <div class="preset-info">
                    <strong>${escapeHTML(p.preset_name || 'Ohne Namen')}${aiBadge}</strong>
                    <span>von ${escapeHTML(p.user_name || 'Unbekannt')}${timeStr}</span>
                </div>
                ${isOwner ? `<button onclick="deletePreset('${escapeHTML(p.preset_id)}', '${escapeHTML(panoId)}')" class="del-btn" title="Löschen">🗑️</button>` : ''}
            </div>`;
        });
        container.innerHTML = html;
    } catch(e) { 
        console.error("loadPresets error:", e);
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
    let p = window.currentPresets.find(pr => String(pr.preset_id) === String(presetId) || String(pr.id) === String(presetId));
    
    if (p) {
        window.activeSynth[panoId] = {
            peaks: parseInt(p.peaks) || 4, 
            valleys: parseInt(p.valleys) || 2, 
            spacing: parseInt(p.spacing) || 35,
            sensibilitaet: parseInt(p.sensibilitaet !== undefined ? p.sensibilitaet : p.sensibility) || 0,
            gridLines: parseInt(p.gridLines !== undefined ? p.gridLines : p.grid_lines) || 5, 
            mode: p.mode ? String(p.mode).trim().toLowerCase() : 'chord', 
            scale: p.scale ? String(p.scale).trim().toLowerCase() : 'lydian',
            oktaven: parseInt(p.oktaven !== undefined ? p.oktaven : p.octaves) || 3, 
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

        const sliderKeys = ['peaks', 'valleys', 'spacing', 'sensibilitaet', 'gridLines', 'oktaven', 'range', 'duration', 'echo', 'attack', 'release', 'volume'];
        sliderKeys.forEach(key => {
            let rangeInput = document.getElementById(`range_${key}_${panoId}`);
            if (rangeInput) {
                rangeInput.value = window.activeSynth[panoId][key];
                rangeInput.dispatchEvent(new Event('input'));
            }
        });

        // Load AI state
        let btnAi = document.getElementById(`btn-ai-compose-${panoId}`);
        if (p.is_ai === true || p.is_ai === 'true' || p.is_ai === 'TRUE') {
            if (p.ai_sound) {
                try {
                    window.panoAiSequences = window.panoAiSequences || {};
                    window.panoAiSequences[panoId] = JSON.parse(p.ai_sound);
                    if (btnAi) {
                        btnAi.style.background = "#FF6600";
                        btnAi.style.color = "#1a1a1a";
                        btnAi.innerHTML = "[ AI COMPOSE ]";
                    }
                } catch(e) {
                    console.error("Error parsing ai_sound", e);
                    window.panoAiSequences[panoId] = null;
                    if (btnAi) {
                        btnAi.style.background = "";
                        btnAi.style.color = "";
                    }
                }
            }
        } else {
            if (window.panoAiSequences) window.panoAiSequences[panoId] = null;
            if (btnAi) {
                btnAi.style.background = "";
                btnAi.style.color = "";
            }
        }
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

    let s = window.activeSynth[panoId] || {};
    let aiSeq = (window.panoAiSequences && window.panoAiSequences[panoId]) ? window.panoAiSequences[panoId] : null;

    let payload = {
        pano_id: String(panoId),
        preset_name: presetName,
        user_name: name,
        user_id: getUserId(),
        peaks: parseInt(s.peaks) || 4,
        valleys: parseInt(s.valleys) || 2,
        spacing: parseInt(s.spacing) || 35,
        sensibility: parseInt(s.sensibilitaet !== undefined ? s.sensibilitaet : (s.sensibility || 0)) || 0,
        grid_lines: parseInt(s.gridLines !== undefined ? s.gridLines : (s.grid_lines || 5)) || 5,
        mode: s.mode ? String(s.mode).trim().toLowerCase() : 'chord',
        scale: s.scale ? String(s.scale).trim().toLowerCase() : 'lydian',
        octaves: parseInt(s.oktaven !== undefined ? s.oktaven : (s.octaves || 3)) || 3,
        range: parseInt(s.range) || 100,
        wave: s.wave ? String(s.wave).trim().toLowerCase() : 'darkpad',
        volume: (parseFloat(s.volume) !== undefined && !isNaN(parseFloat(s.volume))) ? parseFloat(s.volume) : 0.2,
        duration: (parseFloat(s.duration) !== undefined && !isNaN(parseFloat(s.duration))) ? parseFloat(s.duration) : 5.0,
        attack: (parseFloat(s.attack) !== undefined && !isNaN(parseFloat(s.attack))) ? parseFloat(s.attack) : 1.0,
        release: (parseFloat(s.release) !== undefined && !isNaN(parseFloat(s.release))) ? parseFloat(s.release) : 2.0,
        echo: (parseFloat(s.echo) !== undefined && !isNaN(parseFloat(s.echo))) ? parseFloat(s.echo) : 0.3,
        is_vinyl: false,
        vinyl_array: null,
        is_ai: Boolean(aiSeq),
        ai_sound: aiSeq ? JSON.stringify(aiSeq) : null
    };

    let btn = document.getElementById(`save-btn-${panoId}`);
    if (btn) { btn.innerText = "⧗"; }
    
    try {
        const sbUrl = getSupabaseUrl();
        const sbKey = getSupabaseKey();
        let res = await fetch(`${sbUrl}/rest/v1/presets`, { 
            method: 'POST',
            headers: {
                "apikey": sbKey,
                "Authorization": `Bearer ${sbKey}`,
                "Content-Type": "application/json",
                "Prefer": "return=representation"
            },
            body: JSON.stringify(payload) 
        });
        
        if (!res.ok) {
            let errText = await res.text();
            throw new Error(`HTTP ${res.status}: ${errText}`);
        }
        
        let successMsg = (t.alert_saved || "Erfolg! '{preset}' wurde gespeichert.").replace('{preset}', presetName);
        alert(successMsg);
        await window.loadPresets(panoId);
    } catch(e) { 
        console.error("savePreset error:", e);
        alert(t.alert_net_error || "Netzwerkfehler beim Speichern."); 
    } finally {
        if (btn) { btn.innerText = "⚑"; }
    }
};

window.deletePreset = async function(presetId, panoId) {
    const t = (typeof text !== 'undefined' && text[window.currentLang]) ? text[window.currentLang] : {};
    if(!confirm(t.alert_delete || "Möchtest du dieses Preset wirklich löschen?")) return;
    try {
        const sbUrl = getSupabaseUrl();
        const sbKey = getSupabaseKey();
        let res = await fetch(`${sbUrl}/rest/v1/presets?id=eq.${encodeURIComponent(presetId)}&user_id=eq.${encodeURIComponent(getUserId())}`, { 
            method: 'DELETE',
            headers: {
                "apikey": sbKey,
                "Authorization": `Bearer ${sbKey}`
            }
        });
        if (!res.ok) {
            let errText = await res.text();
            throw new Error(`HTTP ${res.status}: ${errText}`);
        }
        await window.loadPresets(panoId);
    } catch(e) { 
        console.error("deletePreset error:", e);
        alert(t.alert_delete_error || "Fehler beim Löschen."); 
    }
};

function processPanoramaData(data) {
    if (!Array.isArray(data)) {
        console.error("processPanoramaData erwartet ein Array:", data);
        return;
    }

    window.panoramenDaten = data.map(p => {
        let pano = { ...p };
        // Feld-Aliase synchronisieren für lückenlose UI- und Audio-Kompatibilität
        pano.titel = pano.titel || pano.title || "";
        pano.title = pano.title || pano.titel || "";
        pano.datum = pano.datum || pano.date_added || "";
        pano.date_added = pano.date_added || pano.datum || "";
        pano.bildUrl = pano.bildUrl || pano.image_url || "";
        pano.image_url = pano.image_url || pano.bildUrl || "";
        pano.arrayUrl = pano.arrayUrl || pano.array_url || "";
        pano.array_url = pano.array_url || pano.arrayUrl || "";
        if (!pano.position && pano.lat && pano.lng) {
            pano.position = `${pano.lat}, ${pano.lng}`;
        }
        return pano;
    });

    if(window.markerClusterGroup) window.markerClusterGroup.clearLayers();

    window.panoramenDaten.forEach(pano => {
        // Leere Zeilen abfangen
        if (!pano.id) return;

        let coords = [46.8182, 8.2275];
        if (pano.lat && pano.lng && !isNaN(parseFloat(pano.lat)) && !isNaN(parseFloat(pano.lng))) {
            coords = [parseFloat(pano.lat), parseFloat(pano.lng)];
        } else if (pano.position) {
            coords = pano.position.split(',').map(c => parseFloat(c.trim()));
            if (coords.length < 2 || isNaN(coords[0]) || isNaN(coords[1])) {
                coords = [46.8182, 8.2275];
            }
        }

        const marker = L.marker(coords);
        marker.panoId = pano.id;

        marker.on('click', function() {
            window.openPanoModal(pano);
        });

        if(window.markerClusterGroup) window.markerClusterGroup.addLayer(marker);

        window.activeSynth[pano.id] = {
            peaks: parseInt(pano.peaks) || 4,
            valleys: parseInt(pano.valleys) || 2,
            spacing: parseInt(pano.spacing) || 35,
            sensibilitaet: parseInt(pano.sensibilitaet !== undefined ? pano.sensibilitaet : (pano.sensibility || 0)) || 0,
            gridLines: parseInt(pano.gridLines !== undefined ? pano.gridLines : (pano.grid_lines || 5)) || 5,
            mode: pano.mode || 'chord',
            scale: pano.scale || 'lydian',
            oktaven: parseInt(pano.oktaven !== undefined ? pano.oktaven : (pano.octaves || 3)) || 3,
            range: parseInt(pano.range) || 100,
            wave: pano.wave || 'darkpad',
            volume: parseFloat(pano.volume) || 0.2,
            duration: parseFloat(pano.duration) || 5.0,
            attack: parseFloat(pano.attack) || 1.0,
            release: parseFloat(pano.release) || 2.0,
            echo: parseFloat(pano.echo) || 0.3,
            mutation: parseFloat(pano.mutation) || 1.0
        };
    });
}

window.loadPanoramas = async function() {
    try {
        const sbUrl = getSupabaseUrl();
        const sbKey = getSupabaseKey();
        let res = await fetch(`${sbUrl}/rest/v1/panoramas?select=*&order=id.asc`, {
            method: 'GET',
            headers: {
                "apikey": sbKey,
                "Authorization": `Bearer ${sbKey}`
            }
        });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        let data = await res.json();
        processPanoramaData(data);
    } catch (err) {
        console.error("Fehler beim Abrufen der Panoramen aus Supabase:", err);
    }
};
// Alias für bestehende Aufrufer
window.ladePanoramenAusSheet = window.loadPanoramas;

window.saveVinyl = async function() {
    if (!window.vinylArray || window.vinylArray.length === 0) {
        const t = (typeof text !== 'undefined' && text[window.currentLang]) ? text[window.currentLang] : {};
        alert(t.alert_gen_vinyl_array_first || "Bitte generiere zuerst das Vinyl-Array!");
        return;
    }

    const t = (typeof text !== 'undefined' && text[window.currentLang]) ? text[window.currentLang] : {};
    let name = getUserName();

    if (!name) {
        name = prompt(t.prompt_welcome || "Willkommen! Unter welchem (Spitz-)Namen sollen deine Presets gespeichert werden?");
        if (!name) return;
        setUserName(name);
    }

    let msg = (t.prompt_preset_name || "Hallo {name}, wie soll diese Klangeinstellung heissen?").replace('{name}', name);
    let presetName = prompt(msg, "My Vinyl Record");
    if (!presetName) return;

    let compressedArray = [];
    let stepSize = 10;
    for(let i=0; i<window.vinylArray.length; i+=stepSize) {
        compressedArray.push(Math.round(window.vinylArray[i]));
    }
    let arrayString = JSON.stringify(compressedArray);

    let payload = {
        pano_id: 'vinyl_mode_id',
        preset_name: presetName,
        user_name: name,
        user_id: getUserId(),
        scale: document.getElementById('sel_vinyl_scale')?.value || 'pentatonic',
        wave: document.getElementById('sel_vinyl_wave')?.value || 'chime',
        duration: parseFloat(document.getElementById('range_vinyl_speed')?.value || 15),
        octaves: parseInt(document.getElementById('sel_vinyl_octaves')?.value) || 4,
        peaks: 0,
        valleys: 0,
        spacing: 0,
        sensibility: 0,
        grid_lines: 5,
        mode: 'chord',
        range: 0,
        volume: 0,
        attack: 0,
        release: 0,
        echo: 0,
        is_vinyl: true,
        vinyl_array: arrayString,
        is_ai: Boolean(window.vinylAiSequence),
        ai_sound: window.vinylAiSequence ? JSON.stringify(window.vinylAiSequence) : null
    };

    let btn = document.getElementById(`btn-vinyl-save`);
    if (btn) { btn.innerText = "⧗"; }

    try {
        const sbUrl = getSupabaseUrl();
        const sbKey = getSupabaseKey();
        let res = await fetch(`${sbUrl}/rest/v1/presets`, {
            method: 'POST',
            headers: {
                "apikey": sbKey,
                "Authorization": `Bearer ${sbKey}`,
                "Content-Type": "application/json",
                "Prefer": "return=representation"
            },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        let successMsg = (t.alert_saved || "Erfolg! '{preset}' wurde gespeichert.").replace('{preset}', presetName);
        alert(successMsg);
        window.loadVinylPresets();
    } catch(e) {
        console.error("saveVinyl failed:", e);
        alert(t.alert_net_error || "Netzwerkfehler beim Speichern.");
    } finally {
        if (btn) { btn.innerText = "⚑"; }
    }
};

window.loadVinylPresets = async function() {
    let container = document.getElementById(`vinyl-presets-list`);
    if(!container) return;
    container.innerHTML = "<div style='font-size:11px; color:#888;'>Lade Vinyl Records...</div>";

    try {
        const sbUrl = getSupabaseUrl();
        const sbKey = getSupabaseKey();
        let res = await fetch(`${sbUrl}/rest/v1/presets?select=*&pano_id=eq.vinyl_mode_id&order=created_at.desc`, {
            method: 'GET',
            headers: {
                "apikey": sbKey,
                "Authorization": `Bearer ${sbKey}`
            }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        let rawPresets = await res.json();

        let vinylPresets = rawPresets.map(p => ({
            ...p,
            preset_id: p.preset_id || p.id,
            timestamp: p.timestamp || p.created_at,
            oktaven: p.octaves !== undefined ? p.octaves : p.oktaven,
            is_vinyl: (p.is_vinyl === true || p.is_vinyl === 'true' || p.is_vinyl === 'TRUE'),
            vinyl_array: p.vinyl_array || null,
            is_ai: (p.is_ai === true || p.is_ai === 'true' || p.is_ai === 'TRUE'),
            ai_sound: p.ai_sound || null
        }));
        window.currentVinylPresets = vinylPresets;

        if (vinylPresets.length === 0) {
            container.innerHTML = "<div style='font-size:11px; color:#888;'>Noch keine Vinyls vorhanden.</div>";
            return;
        }

        let html = "";
        let myId = getUserId();

        vinylPresets.forEach(p => {
            let isOwner = (myId === p.user_id);
            let timeStr = "";

            if (p.timestamp) {
                let d = new Date(p.timestamp);
                if (!isNaN(d.getTime())) {
                    let day = d.getDate().toString().padStart(2, '0');
                    let month = (d.getMonth() + 1).toString().padStart(2, '0');
                    timeStr = ` - ${day}.${month}.`;
                }
            }

            let aiBadge = (p.is_ai === true || p.is_ai === 'true' || p.is_ai === 'TRUE')
                ? '<span style="font-size:10px; margin-left:4px; padding:1px 3px; border:1px solid #aaa; border-radius:3px; color:#aaa; filter: grayscale(100%);" title="AI Generated">🤖 AI</span>'
                : '';

            html += `
            <div class="preset-item" style="box-sizing: border-box; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #333; padding:4px 5px; width:100%;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <input type="radio" name="vinyl_preset_rb" class="preset-cb" value="${escapeHTML(p.preset_id)}">
                    <div class="preset-info" style="font-size:11px;">
                        <strong>${escapeHTML(p.preset_name || 'Ohne Namen')}${aiBadge}</strong>
                        <span style="color:#aaa;">von ${escapeHTML(p.user_name || 'Unbekannt')}${timeStr}</span>
                    </div>
                </div>
                ${isOwner ? `<button onclick="deleteVinylPreset('${escapeHTML(p.preset_id)}')" class="del-btn" title="Löschen" style="background:transparent; border:none; color:#ff4d4d; cursor:pointer; padding-right:10px;">🗑️</button>` : ''}
            </div>`;
        });
        container.innerHTML = html;
    } catch(e) {
        console.error("loadVinylPresets error:", e);
        container.innerHTML = "<div style='font-size:11px; color:red;'>Fehler beim Laden.</div>";
    }
};

window.loadVinyl = function() {
    const t = (typeof text !== 'undefined' && text[window.currentLang]) ? text[window.currentLang] : {};
    let checkedBox = document.querySelector(`input[name="vinyl_preset_rb"]:checked`);
    if (!checkedBox) {
        alert(t.alert_load_vinyl_preset_empty || "Bitte markiere ein Vinyl Preset zum Laden.");
        return;
    }

    let presetId = checkedBox.value;
    let p = window.currentVinylPresets.find(pr => String(pr.preset_id) === String(presetId) || String(pr.id) === String(presetId));

    if (p && p.vinyl_array) {
        try {
            let arr;
            let aiSeq = null;
            try {
                arr = typeof p.vinyl_array === 'string' ? JSON.parse(p.vinyl_array) : p.vinyl_array;
            } catch (err) {
                // Try parsing if it's somehow double stringified or malformed
                arr = JSON.parse(p.vinyl_array.replace(/'/g, '"'));
            }

            // Handle if arr is a string after parsing (double JSON encoded)
            if (typeof arr === 'string') {
                arr = JSON.parse(arr);
            }

            if (arr && !Array.isArray(arr) && arr.array) {
                // It's our packed object { array: [...], aiSequence: {...} }
                aiSeq = arr.aiSequence;
                arr = arr.array;
            }

            if (!Array.isArray(arr)) {
                throw new Error("Parsed vinyl_array is not an array");
            }

            // Re-interpolate if we compressed it
            let expandedArray = [];
            for (let i = 0; i < arr.length - 1; i++) {
                let current = arr[i];
                let next = arr[i+1];
                let steps = 10;
                for (let j = 0; j < steps; j++) {
                    expandedArray.push(current + (next - current) * (j / steps));
                }
            }
            // Add the last element to the expanded array
            if (arr.length > 0) {
                 expandedArray.push(arr[arr.length - 1]);
            }

            window.vinylArray = expandedArray;

            // Check if is_ai and ai_sound are present at the top level
            if (p.is_ai === true || p.is_ai === 'true' || p.is_ai === 'TRUE') {
                if (p.ai_sound) {
                    try {
                        window.vinylAiSequence = JSON.parse(p.ai_sound);
                    } catch(e) {
                        console.error("Error parsing ai_sound", e);
                        window.vinylAiSequence = aiSeq || null;
                    }
                } else {
                    window.vinylAiSequence = aiSeq || null;
                }
            } else {
                window.vinylAiSequence = aiSeq || null;
            }

            if (window.drawVinylCanvas) { window.drawVinylCanvas(); }

            if (p.scale) {
                let selScale = document.getElementById('sel_vinyl_scale');
                if (selScale) selScale.value = p.scale;
            }
            if (p.wave) {
                let selWave = document.getElementById('sel_vinyl_wave');
                if (selWave) selWave.value = p.wave;
            }
            if (p.duration) {
                let rngSpeed = document.getElementById('range_vinyl_speed');
                if (rngSpeed) {
                    rngSpeed.value = p.duration;
                    let tt = document.getElementById('tt_val_vinyl_speed');
                    if (tt) tt.innerText = p.duration;
                }
            }

            window.drawVinylCanvas();
            alert(t.alert_vinyl_loaded || "Vinyl geladen!");
        } catch(e) {
            console.error("Vinyl Parse Error:", e, "Raw data:", p.vinyl_array);
            alert(t.alert_vinyl_parse_error || "Fehler beim Parsen der Vinyl-Daten.");
        }
    }
};

window.deleteVinylPreset = async function(presetId) {
    const t = (typeof text !== 'undefined' && text[window.currentLang]) ? text[window.currentLang] : {};

    if(!confirm("Möchtest du dieses Vinyl wirklich löschen?")) return;
    try {
        const sbUrl = getSupabaseUrl();
        const sbKey = getSupabaseKey();
        let res = await fetch(`${sbUrl}/rest/v1/presets?id=eq.${encodeURIComponent(presetId)}&user_id=eq.${encodeURIComponent(getUserId())}`, {
            method: 'DELETE',
            headers: {
                "apikey": sbKey,
                "Authorization": `Bearer ${sbKey}`
            }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        window.loadVinylPresets();
    } catch(e) { 
        console.error("deleteVinylPreset error:", e);
        alert(t.alert_delete_error || "Fehler beim Löschen."); 
    }
};

// -----------------------------------------------------------------------------
// Supabase Realtime (WebSocket Live-Subscriptions für Presets & Panoramen)
// -----------------------------------------------------------------------------
window.initAppRealtime = function() {
    if (!window.supabase) {
        console.warn("[App Realtime] Supabase CDN Client nicht geladen.");
        return;
    }
    if (window._appRealtimeChannel) {
        return; // Verhindere doppelte Subscriptions
    }

    try {
        const sbUrl = getSupabaseUrl();
        const sbKey = getSupabaseKey();
        const client = window.supabase.createClient(sbUrl, sbKey);

        let debouncePanoTimers = {};
        let debounceVinylTimer = null;
        let debouncePanoramasTimer = null;

        window._appRealtimeChannel = client
            .channel('app-realtime-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'presets' },
                payload => {
                    console.log('[App Realtime] Preset-Event:', payload.eventType);
                    const panoId = (payload.new && payload.new.pano_id) || (payload.old && payload.old.pano_id);

                    if (panoId === 'vinyl_mode_id') {
                        if (debounceVinylTimer) clearTimeout(debounceVinylTimer);
                        debounceVinylTimer = setTimeout(() => {
                            if (typeof window.loadVinylPresets === 'function') {
                                window.loadVinylPresets();
                            }
                        }, 250);
                    } else if (panoId) {
                        const container = document.getElementById(`preset-list-${panoId}`);
                        if (container) {
                            if (debouncePanoTimers[panoId]) clearTimeout(debouncePanoTimers[panoId]);
                            debouncePanoTimers[panoId] = setTimeout(() => {
                                if (typeof window.loadPresets === 'function') {
                                    window.loadPresets(panoId);
                                }
                            }, 250);
                        }
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'panoramas' },
                payload => {
                    console.log('[App Realtime] Panorama-Event:', payload.eventType);
                    if (debouncePanoramasTimer) clearTimeout(debouncePanoramasTimer);
                    debouncePanoramasTimer = setTimeout(() => {
                        if (typeof window.loadPanoramas === 'function') {
                            window.loadPanoramas();
                        }
                    }, 300);
                }
            )
            .subscribe((status) => {
                console.log('[App Realtime] Subscription-Status:', status);
            });
    } catch(err) {
        console.error("[App Realtime] Fehler bei Initialisierung:", err);
    }
};
