// admin.js - Logik für das Panorama Synthesizer Admin-Dashboard

(function() {
    'use strict';

    // 1. Supabase Client Initialisierung
    const supabaseUrl = window.SUPABASE_URL || (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : "https://hdwbfkukcmrddrkrghiy.supabase.co");
    const supabaseAnonKey = window.SUPABASE_ANON_KEY || (typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : "sb_publishable_rUM-8j5OTgPsKH3XtbD0VQ_cCFM39SO");

    if (!window.supabase) {
        console.error("Supabase CDN Client wurde nicht geladen.");
        alert("Fehler: Supabase Client konnte nicht geladen werden.");
        return;
    }

    const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

    // 2. Tabellen-Metadaten & Konfiguration
    const TABLE_CONFIG = {
        admin_users: {
            title: "Benutzerverwaltung",
            desc: "Autorisierte Administratoren und Zugriffsrollen verwalten.",
            pk: "id",
            icon: "👥",
            superadminOnly: true,
            fallbackColumns: ['id', 'email', 'role', 'username']
        },
        panoramas: {
            title: "Panoramen",
            desc: "Panorama-Datensätze, Bildpfade und Standard-Synthesizer-Parameter.",
            pk: "id",
            icon: "🏔️",
            superadminOnly: false,
            fallbackColumns: ['id', 'title', 'date_added', 'lat', 'lng', 'image_url', 'array_url', 'comment', 'peaks', 'valleys', 'spacing', 'mode', 'scale', 'wave', 'volume', 'duration']
        },
        presets: {
            title: "Presets",
            desc: "Von Nutzern erstellte und gespeicherte Sound-Presets.",
            pk: "id",
            icon: "🎛️",
            superadminOnly: false,
            fallbackColumns: ['id', 'pano_id', 'preset_name', 'user_name', 'user_id', 'created_at', 'peaks', 'valleys', 'spacing', 'mode', 'scale', 'wave', 'volume', 'duration', 'is_vinyl', 'vinyl_array', 'is_ai', 'ai_sound']
        },
        translations: {
            title: "Übersetzungen",
            desc: "Mehrsprachige UI-Texte bearbeiten und erweitern.",
            pk: "key_name",
            icon: "🌐",
            superadminOnly: true,
            fallbackColumns: ['key_name', 'de', 'fr', 'it', 'en', 'uk', 'ru', 'es']
        }
    };

    // State
    let currentAdminUser = null;
    let currentUserRole = 'normal'; // 'normal' | 'superadmin'
    let currentTable = 'panoramas';
    let currentRecords = [];
    let currentColumns = [];
    let modalMode = 'create'; // 'create' | 'edit'
    let editingRecord = null;
    let deletingRecord = null;
    let i18nTexts = {};
    let realtimeChannel = null;
    let realtimeDebounceTimer = null;

    // Panorama Builder State (Leaflet Map, Horizon Scanner & Interaktives Zeichnen)
    let adminLeafletMap = null;
    let adminMapMarker = null;
    let adminLoadedImage = null;
    let isProcessingImage = false;
    let currentPanoramaCurveY = null; // Aktuell bearbeitetes Relief-Array im State [y0, y1, ...]
    let currentPanoramaWidth = 0;
    let currentPanoramaHeight = 0;
    let isDrawingRelief = false;
    let lastDrawCoord = null;

    // DOM-Elemente
    const viewLoading = document.getElementById('view-loading');
    const viewLogin = document.getElementById('view-login');
    const viewAccessDenied = document.getElementById('view-access-denied');
    const viewDashboard = document.getElementById('view-dashboard');

    const btnLoginGoogle = document.getElementById('btn-login-google');
    const btnDeniedLogout = document.getElementById('btn-denied-logout');
    const btnDashboardLogout = document.getElementById('btn-dashboard-logout');
    const deniedUserEmail = document.getElementById('denied-user-email');

    const navUserEmail = document.getElementById('nav-user-email');
    const navUserRole = document.getElementById('nav-user-role');
    const sidebarNav = document.getElementById('sidebar-nav');
    const sidebarEndpointInfo = document.getElementById('sidebar-endpoint-info');

    const currentTableTitle = document.getElementById('current-table-title');
    const currentTableDesc = document.getElementById('current-table-desc');
    const recordCountBadge = document.getElementById('record-count-badge');
    const inputSearch = document.getElementById('input-search');
    const btnRefreshTable = document.getElementById('btn-refresh-table');
    const btnAddRecord = document.getElementById('btn-add-record');

    const tableLoadingOverlay = document.getElementById('table-loading-overlay');
    const dynamicTableHead = document.getElementById('dynamic-table-head');
    const dynamicTableBody = document.getElementById('dynamic-table-body');
    const tableEmptyState = document.getElementById('table-empty-state');

    // Modals
    const modalEditRecord = document.getElementById('modal-edit-record');
    const modalIcon = document.getElementById('modal-icon');
    const modalTitle = document.getElementById('modal-title');
    const formEditRecord = document.getElementById('form-edit-record');
    const formFieldsContainer = document.getElementById('form-fields-container');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnCancelModal = document.getElementById('btn-cancel-modal');
    const btnSaveModal = document.getElementById('btn-save-modal');

    // Panorama Builder Panel DOM
    const sectionPanoramaBuilder = document.getElementById('section-panorama-builder');
    const mapCoordsDisplay = document.getElementById('map-coords-display');
    const adminMapContainer = document.getElementById('admin-map-container');
    const inputPanoramaFile = document.getElementById('input-panorama-file');
    const uploadStatusBadge = document.getElementById('upload-status-badge');
    const btnRescanRelief = document.getElementById('btn-rescan-relief');
    const scanFeedbackInfo = document.getElementById('scan-feedback-info');
    const scanCanvasWrapper = document.getElementById('scan-canvas-wrapper');
    const adminScanCanvas = document.getElementById('admin-scan-canvas');

    const modalDeleteConfirm = document.getElementById('modal-delete-confirm');
    const deleteRecordPreview = document.getElementById('delete-record-preview');
    const btnCancelDelete = document.getElementById('btn-cancel-delete');
    const btnConfirmDelete = document.getElementById('btn-confirm-delete');

    // 3. UI-Hilfsfunktionen: Views umschalten
    function showView(view) {
        viewLoading.classList.add('hidden');
        viewLogin.classList.add('hidden');
        viewAccessDenied.classList.add('hidden');
        viewDashboard.classList.add('hidden');

        if (view === 'loading') viewLoading.classList.remove('hidden');
        else if (view === 'login') viewLogin.classList.remove('hidden');
        else if (view === 'denied') viewAccessDenied.classList.remove('hidden');
        else if (view === 'dashboard') viewDashboard.classList.remove('hidden');
    }

    // Toast Notifications
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-xl text-xs font-medium transition-all duration-300 transform translate-y-2 opacity-0 border ${
            type === 'success' 
                ? 'bg-neutral-900 border-emerald-500/50 text-emerald-300' 
                : type === 'error'
                ? 'bg-neutral-900 border-red-500/50 text-red-300'
                : 'bg-neutral-900 border-neutral-700 text-neutral-200'
        }`;

        const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
        toast.innerHTML = `<span class="font-bold">${icon}</span><span>${escapeHTML(message)}</span>`;

        container.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.classList.remove('translate-y-2', 'opacity-0');
        });

        // Auto remove
        setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-y-2');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    function escapeHTML(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // 4. Dynamische Übersetzungen aus 'translations'-Tabelle laden
    async function loadI18nTexts() {
        try {
            const userLang = (navigator.language || 'de').slice(0, 2).toLowerCase();
            const { data, error } = await supabase.from('translations').select('*');
            if (error) throw error;

            if (data && Array.isArray(data)) {
                data.forEach(row => {
                    if (row.key_name) {
                        i18nTexts[row.key_name] = row[userLang] || row['de'] || row['en'] || row.key_name;
                    }
                });
            }
        } catch (err) {
            console.warn("Konnte Übersetzungen nicht aus Supabase laden, nutze Defaults:", err);
        }
    }

    // 5. Authentifizierung & Rollenprüfung
    async function initAuth() {
        showView('loading');
        await loadI18nTexts();

        if (sidebarEndpointInfo) {
            try {
                const u = new URL(supabaseUrl);
                sidebarEndpointInfo.innerText = u.host;
            } catch(e) {}
        }

        // Aktuelle Session abrufen
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session || !session.user) {
            showView('login');
        } else {
            await handleUserSession(session.user);
        }

        // Auf Login/Logout-Events lauschen
        supabase.auth.onAuthStateChange(async (event, newSession) => {
            if (event === 'SIGNED_IN' && newSession) {
                await handleUserSession(newSession.user);
            } else if (event === 'SIGNED_OUT') {
                if (realtimeChannel) {
                    try { supabase.removeChannel(realtimeChannel); } catch(e) {}
                    realtimeChannel = null;
                }
                currentAdminUser = null;
                currentUserRole = 'normal';
                showView('login');
            }
        });
    }

    async function handleUserSession(user) {
        const userEmail = (user.email || '').toLowerCase().trim();

        try {
            // Prüfe, ob die E-Mail in der Tabelle 'admin_users' hinterlegt ist
            const { data: adminData, error } = await supabase
                .from('admin_users')
                .select('*')
                .eq('email', userEmail)
                .maybeSingle();

            if (error) {
                console.error("Fehler beim Prüfen der admin_users:", error);
                throw error;
            }

            if (!adminData) {
                // Nicht in admin_users -> Zugriff verweigern
                deniedUserEmail.innerText = userEmail;
                showView('denied');
                return;
            }

            // User autorisiert
            currentAdminUser = adminData;
            currentUserRole = (adminData.role || 'normal').toLowerCase();

            setupDashboardHeader(userEmail, currentUserRole);
            setupSidebarNavigation(currentUserRole);

            showView('dashboard');
            showToast(`Willkommen, ${adminData.username || userEmail}!`);

            // Realtime-Abonnement initialisieren
            setupRealtimeSubscription();

            // Starte mit der ersten erlaubten Tabelle
            const initialTable = (currentUserRole === 'superadmin') ? 'panoramas' : 'panoramas';
            switchTable(initialTable);

        } catch (err) {
            console.error("Auth-Prüfung fehlgeschlagen:", err);
            deniedUserEmail.innerText = userEmail || 'Unbekannt';
            showView('denied');
        }
    }

    function setupDashboardHeader(email, role) {
        if (navUserEmail) navUserEmail.innerText = email;
        if (navUserRole) {
            navUserRole.innerText = role;
            if (role === 'superadmin') {
                navUserRole.className = 'text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold bg-purple-950/70 text-purple-400 border border-purple-800';
            } else {
                navUserRole.className = 'text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold bg-blue-950/70 text-blue-400 border border-blue-800';
            }
        }
    }

    function setupSidebarNavigation(role) {
        const navItems = sidebarNav.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            const table = item.getAttribute('data-table');
            const cfg = TABLE_CONFIG[table];
            if (!cfg) return;

            // Rollenprüfung: SuperAdmin-exklusive Tabellen für normale Admins ausblenden
            if (cfg.superadminOnly && role !== 'superadmin') {
                item.classList.add('hidden');
            } else {
                item.classList.remove('hidden');
            }
        });
    }

    // 6. Tabellen-Verwaltung & Umschalten
    async function switchTable(tableName) {
        if (!TABLE_CONFIG[tableName]) return;

        // Sicherheitscheck Rolle
        if (TABLE_CONFIG[tableName].superadminOnly && currentUserRole !== 'superadmin') {
            showToast("Zugriff verweigert: Nur für Superadmins.", "error");
            return;
        }

        currentTable = tableName;
        const cfg = TABLE_CONFIG[tableName];

        // Sidebar Active State
        sidebarNav.querySelectorAll('.nav-item').forEach(btn => {
            if (btn.getAttribute('data-table') === tableName) {
                btn.className = 'nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors bg-brand-orange text-neutral-950 shadow-sm';
            } else {
                btn.className = 'nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-neutral-400 hover:text-white hover:bg-neutral-800';
            }
        });

        // Titel und Beschreibung
        currentTableTitle.innerText = cfg.title;
        currentTableDesc.innerText = cfg.desc;
        if (inputSearch) inputSearch.value = '';

        await loadTableData();
    }

    // 6a. Realtime WebSocket-Subscriptions
    function setupRealtimeSubscription() {
        if (realtimeChannel) {
            try { supabase.removeChannel(realtimeChannel); } catch(e) {}
            realtimeChannel = null;
        }

        realtimeChannel = supabase
            .channel('admin-db-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'panoramas' },
                payload => handleRealtimeChange('panoramas', payload)
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'presets' },
                payload => handleRealtimeChange('presets', payload)
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'translations' },
                payload => handleRealtimeChange('translations', payload)
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'admin_users' },
                payload => handleRealtimeChange('admin_users', payload)
            )
            .subscribe((status) => {
                console.log('[Admin Realtime] Subscription-Status:', status);
            });
    }

    function handleRealtimeChange(table, payload) {
        console.log(`[Admin Realtime] Event '${payload.eventType}' für Tabelle '${table}' empfangen`);

        // Nur aktualisieren, wenn der Admin aktuell diese Tabelle geöffnet hat
        if (currentTable === table) {
            if (realtimeDebounceTimer) clearTimeout(realtimeDebounceTimer);
            realtimeDebounceTimer = setTimeout(() => {
                loadTableData();
                const tableTitle = TABLE_CONFIG[table] ? TABLE_CONFIG[table].title : table;
                showToast(`Live-Update: ${tableTitle} (${payload.eventType})`, 'info');
            }, 300);
        }
    }

    async function loadTableData() {
        tableLoadingOverlay.classList.remove('hidden');
        tableEmptyState.classList.add('hidden');

        try {
            const cfg = TABLE_CONFIG[currentTable];
            const { data, error } = await supabase
                .from(currentTable)
                .select('*')
                .order(cfg.pk, { ascending: true });

            if (error) throw error;

            currentRecords = data || [];
            recordCountBadge.innerText = `${currentRecords.length} Einträge`;

            // Dynamische Spaltenerkennung: Extrahiert alle existierenden und neu hinzugekommenen Spalten
            currentColumns = discoverColumns(currentRecords, currentTable);

            renderTableHeader(currentColumns);
            renderTableBody(currentRecords);

        } catch (err) {
            console.error(`Fehler beim Laden von ${currentTable}:`, err);
            showToast(`Fehler beim Laden: ${err.message}`, 'error');
            dynamicTableHead.innerHTML = '';
            dynamicTableBody.innerHTML = '';
            tableEmptyState.classList.remove('hidden');
        } finally {
            tableLoadingOverlay.classList.add('hidden');
        }
    }

    // Automatische dynamische Erkennung aller Spalten
    function discoverColumns(records, tableName) {
        const cfg = TABLE_CONFIG[tableName];
        const keysSet = new Set();

        // Fallback-Spalten als Grundgerüst initialisieren
        if (cfg && cfg.fallbackColumns) {
            cfg.fallbackColumns.forEach(k => keysSet.add(k));
        }

        // Alle weiteren aus den Datensätzen dynamisch hinzufügen
        if (records && records.length > 0) {
            records.forEach(row => {
                Object.keys(row).forEach(k => keysSet.add(k));
            });
        }

        const cols = Array.from(keysSet);
        const pk = cfg ? cfg.pk : 'id';

        // Primärschlüssel immer an die erste Stelle sortieren
        if (cols.includes(pk)) {
            return [pk, ...cols.filter(c => c !== pk)];
        }
        return cols;
    }

    // 7. Tabellen-Rendering
    function renderTableHeader(columns) {
        let html = '<tr>';
        columns.forEach(col => {
            const isPk = (col === TABLE_CONFIG[currentTable].pk);
            html += `<th scope="col" class="px-4 py-3 font-mono ${isPk ? 'text-brand-orange font-bold' : ''}">${escapeHTML(col)}</th>`;
        });
        html += '<th scope="col" class="px-4 py-3 text-right sticky right-0 bg-neutral-900 border-b border-neutral-800">Aktionen</th>';
        html += '</tr>';
        dynamicTableHead.innerHTML = html;
    }

    function renderTableBody(records) {
        if (!records || records.length === 0) {
            dynamicTableBody.innerHTML = '';
            tableEmptyState.classList.remove('hidden');
            return;
        }

        tableEmptyState.classList.add('hidden');
        const pk = TABLE_CONFIG[currentTable].pk;

        let html = '';
        records.forEach((row, idx) => {
            const pkVal = row[pk];
            html += `<tr class="hover:bg-neutral-800/40 transition-colors group">`;

            currentColumns.forEach(col => {
                const isPk = (col === pk);
                const rawVal = row[col];
                let displayVal = rawVal;
                const isBool = (typeof rawVal === 'boolean' || col === 'is_vinyl' || col === 'is_ai');

                if (rawVal === null || rawVal === undefined) {
                    displayVal = '<span class="text-neutral-600 font-mono text-[10px]">NULL</span>';
                } else if (isBool) {
                    const isTrue = (rawVal === true || rawVal === 'true' || rawVal === 'TRUE' || rawVal === 1 || rawVal === '1');
                    displayVal = isTrue 
                        ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/70 text-emerald-400 border border-emerald-800/50">✓ Ja</span>' 
                        : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-neutral-900 text-neutral-400 border border-neutral-800">✕ Nein</span>';
                } else if (typeof rawVal === 'object') {
                    displayVal = escapeHTML(JSON.stringify(rawVal));
                } else {
                    displayVal = escapeHTML(String(rawVal));
                }

                // Truncate overly long values
                const fullStr = (typeof rawVal === 'object') ? JSON.stringify(rawVal) : String(rawVal ?? '');
                const isLong = fullStr.length > 55;
                const shortText = (isBool || rawVal === null || rawVal === undefined) 
                    ? displayVal 
                    : (isLong ? escapeHTML(fullStr.slice(0, 50)) + '…' : displayVal);

                html += `<td class="px-4 py-2.5 max-w-xs truncate ${isPk ? 'font-mono text-brand-orange font-medium' : ''}" title="${escapeHTML(fullStr)}">${shortText}</td>`;
            });

            // Action Buttons
            html += `
            <td class="px-4 py-2.5 text-right whitespace-nowrap sticky right-0 bg-neutral-950 group-hover:bg-neutral-900/90 transition-colors border-l border-neutral-800/40">
                <div class="inline-flex items-center gap-1.5">
                    <button type="button" data-action="edit" data-idx="${idx}" class="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors" title="Bearbeiten">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button type="button" data-action="delete" data-idx="${idx}" class="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-950/40 rounded transition-colors" title="Löschen">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                </div>
            </td>`;

            html += `</tr>`;
        });

        dynamicTableBody.innerHTML = html;
    }

    // Echtzeit-Suche
    function handleSearch() {
        const q = (inputSearch.value || '').toLowerCase().trim();
        if (!q) {
            renderTableBody(currentRecords);
            recordCountBadge.innerText = `${currentRecords.length} Einträge`;
            return;
        }

        const filtered = currentRecords.filter(row => {
            return Object.values(row).some(val => {
                if (val === null || val === undefined) return false;
                return String(val).toLowerCase().includes(q);
            });
        });

        recordCountBadge.innerText = `${filtered.length} / ${currentRecords.length} Einträge`;
        renderTableBody(filtered);
    }

    // ==============================================================
    // LEAFLET MAP & HORIZON SCANNER FUNKTIONEN (PANORAMA BUILDER)
    // ==============================================================

    // Initialisiert oder aktualisiert die Leaflet-Karte im Admin-Modal
    function initAdminMap(initialLat, initialLng) {
        if (adminLeafletMap) {
            try { adminLeafletMap.remove(); } catch(e) {}
            adminLeafletMap = null;
            adminMapMarker = null;
        }

        // Standard: Schweiz-Zentrierung [46.8182, 8.2275], Zoom 8
        let center = [46.8182, 8.2275];
        let zoom = 8;
        const validLat = (initialLat !== null && initialLat !== undefined && initialLat !== '' && !isNaN(Number(initialLat)));
        const validLng = (initialLng !== null && initialLng !== undefined && initialLng !== '' && !isNaN(Number(initialLng)));

        if (validLat && validLng) {
            center = [Number(initialLat), Number(initialLng)];
            zoom = 12;
        }

        try {
            adminLeafletMap = L.map('admin-map-container', {
                zoomControl: true,
                scrollWheelZoom: true
            }).setView(center, zoom);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap'
            }).addTo(adminLeafletMap);

            if (validLat && validLng) {
                adminMapMarker = L.marker(center).addTo(adminLeafletMap);
                if (mapCoordsDisplay) {
                    mapCoordsDisplay.innerText = `${Number(initialLat).toFixed(5)}, ${Number(initialLng).toFixed(5)}`;
                }
            } else if (mapCoordsDisplay) {
                mapCoordsDisplay.innerText = "Keine Koordinate gewählt";
            }

            // Klick auf die Karte platziert/verschiebt den Marker und befüllt lat & lng
            adminLeafletMap.on('click', (e) => {
                const lat = Number(e.latlng.lat).toFixed(6);
                const lng = Number(e.latlng.lng).toFixed(6);

                if (adminMapMarker) {
                    adminMapMarker.setLatLng(e.latlng);
                } else {
                    adminMapMarker = L.marker(e.latlng).addTo(adminLeafletMap);
                }

                const latInput = formEditRecord.querySelector('input[name="lat"]');
                const lngInput = formEditRecord.querySelector('input[name="lng"]');
                if (latInput) latInput.value = lat;
                if (lngInput) lngInput.value = lng;
                if (mapCoordsDisplay) {
                    mapCoordsDisplay.innerText = `${lat}, ${lng}`;
                }
                checkPanoramaFormReadiness();
            });

            // Wichtig: Leaflet Map neu berechnen, sobald Modal sichtbar ist
            setTimeout(() => {
                if (adminLeafletMap) {
                    adminLeafletMap.invalidateSize();
                }
            }, 250);
            setTimeout(() => {
                if (adminLeafletMap) {
                    adminLeafletMap.invalidateSize();
                }
            }, 600);

        } catch (err) {
            console.error("Fehler bei Leaflet-Initialisierung:", err);
        }
    }

    // Bereinigt die Leaflet-Karte und Bildressourcen beim Schließen des Modals
    function cleanupAdminMap() {
        if (adminLeafletMap) {
            try { adminLeafletMap.remove(); } catch(e) {}
            adminLeafletMap = null;
            adminMapMarker = null;
        }
        adminLoadedImage = null;
        currentPanoramaCurveY = null;
        currentPanoramaWidth = 0;
        currentPanoramaHeight = 0;
        isDrawingRelief = false;
        lastDrawCoord = null;
        isProcessingImage = false;
        if (inputPanoramaFile) inputPanoramaFile.value = '';
        if (uploadStatusBadge) uploadStatusBadge.classList.add('hidden');
        if (scanCanvasWrapper) scanCanvasWrapper.classList.add('hidden');
        if (btnRescanRelief) btnRescanRelief.classList.add('hidden');
        if (scanFeedbackInfo) scanFeedbackInfo.innerText = '';
        if (mapCoordsDisplay) mapCoordsDisplay.innerText = 'Keine Koordinate gewählt';
    }

    // Relief- & Horizont-Scanner (autoScanRelief) nach bewährter Python-Backend Logik
    // 1. Iteriert über jede Spalte X
    // 2. In der Y-Schleife (von oben nach unten): Berechnet die Helligkeit des Pixels (Y) und eines Pixels (Y + 10)
    // 3. Bedingung: lum1 > 100 && (lum1 - lum2) > 30 -> foundY = y; break;
    // 4. Keine Kante gefunden: Y-Wert der vorherigen Spalte (X - 1) übernehmen (bzw. height/2 bei X=0)
    // 5. GLÄTTUNG (Moving Average): Durchschnitt aus 5 linken und 5 rechten Nachbarn
    function autoScanRelief(ctx, width, height) {
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        const step = 10;
        const rawCurveY = new Array(width);

        // 1. Iteriere über jede Spalte X
        for (let x = 0; x < width; x++) {
            let foundY = null;

            // 2. In der Y-Schleife (von oben nach unten)
            for (let y = 0; y < height - step; y++) {
                const idx1 = (y * width + x) * 4;
                const r1 = data[idx1];
                const g1 = data[idx1 + 1];
                const b1 = data[idx1 + 2];
                const lum1 = 0.299 * r1 + 0.587 * g1 + 0.114 * b1;

                const idx2 = ((y + step) * width + x) * 4;
                const r2 = data[idx2];
                const g2 = data[idx2 + 1];
                const b2 = data[idx2 + 2];
                const lum2 = 0.299 * r2 + 0.587 * g2 + 0.114 * b2;

                // 3. Bedingung für Kante: Oberer Pixel sehr hell (Himmel/Sonne), unterer signifikant dunkler (Berg)
                if (lum1 > 100 && (lum1 - lum2) > 30) {
                    foundY = y;
                    break;
                }
            }

            // 4. Wenn in der gesamten Spalte keine Kante gefunden wurde:
            // Setze Y nicht auf 0, sondern übernehme den Y-Wert der vorherigen Spalte (X - 1)
            if (foundY === null) {
                foundY = (x > 0) ? rawCurveY[x - 1] : Math.floor(height / 2);
            }

            rawCurveY[x] = foundY;
        }

        // 5. GLÄTTUNG (MOVING AVERAGE):
        // Berechne für jeden Punkt den Durchschnittswert aus seinen 5 linken und 5 rechten Nachbarn
        const smoothedCurveY = new Array(width);
        const windowRadius = 5; // 5 linke und 5 rechte Nachbarn
        for (let x = 0; x < width; x++) {
            let sum = 0;
            let count = 0;
            for (let w = -windowRadius; w <= windowRadius; w++) {
                const nx = x + w;
                if (nx >= 0 && nx < width) {
                    sum += rawCurveY[nx];
                    count++;
                }
            }
            smoothedCurveY[x] = Math.round(sum / count);
        }

        return smoothedCurveY;
    }

    // Alias für volle Rückwärtskompatibilität
    const scanSkylineRelief = autoScanRelief;

    // Zeichnet das Bild und die gut sichtbare, dicke rote Horizontlinie auf den Vorschau-Canvas
    function drawReliefOverlay(canvas, img, width, height, curveY) {
        if (!canvas) return;
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
        const ctx = canvas.getContext('2d');

        // Basis-Bild zeichnen
        ctx.drawImage(img, 0, 0, width, height);

        if (!curveY || curveY.length !== width) return;

        // Halbtransparenter Schatten unterhalb der Silhouette
        ctx.beginPath();
        ctx.moveTo(0, curveY[0]);
        for (let x = 1; x < width; x++) {
            ctx.lineTo(x, curveY[x]);
        }
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 0, 51, 0.12)';
        ctx.fill();

        // Leuchtende, dicke rote Horizontlinie (Interaktiv korrigierbar)
        ctx.beginPath();
        ctx.moveTo(0, curveY[0]);
        for (let x = 1; x < width; x++) {
            ctx.lineTo(x, curveY[x]);
        }
        ctx.strokeStyle = '#FF0033'; // Signalrot für beste Sichtbarkeit
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = 'rgba(255, 0, 51, 0.6)';
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // Ermittelt die Pixel-Koordinaten auf dem Canvas aus Mouse-/Touch-Events
    function getCanvasCoords(e, canvas) {
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;

        let clientX, clientY;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            clientX = e.changedTouches[0].clientX;
            clientY = e.changedTouches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const rawX = (clientX - rect.left) * scaleX;
        const rawY = (clientY - rect.top) * scaleY;

        const x = Math.max(0, Math.min(canvas.width - 1, Math.round(rawX)));
        const y = Math.max(0, Math.min(canvas.height - 1, Math.round(rawY)));

        return { x, y };
    }

    // Interaktives Zeichnen: Start bei MouseDown oder TouchStart
    function handleReliefDrawStart(e) {
        if (!adminLoadedImage || !currentPanoramaCurveY || !adminScanCanvas) return;
        if (e.type === 'touchstart' && e.cancelable) {
            e.preventDefault();
        }
        isDrawingRelief = true;
        const pt = getCanvasCoords(e, adminScanCanvas);
        if (!pt) return;

        lastDrawCoord = pt;
        currentPanoramaCurveY[pt.x] = pt.y;

        drawReliefOverlay(adminScanCanvas, adminLoadedImage, currentPanoramaWidth, currentPanoramaHeight, currentPanoramaCurveY);
    }

    // Interaktives Zeichnen: Maus-/Touchbewegung überschreibt Horizontpunkte in Echtzeit mit linearer Interpolation
    function handleReliefDrawMove(e) {
        if (!isDrawingRelief || !adminLoadedImage || !currentPanoramaCurveY || !adminScanCanvas) return;
        if (e.cancelable) e.preventDefault();

        const pt = getCanvasCoords(e, adminScanCanvas);
        if (!pt) return;

        if (lastDrawCoord) {
            const x1 = lastDrawCoord.x;
            const y1 = lastDrawCoord.y;
            const x2 = pt.x;
            const y2 = pt.y;

            const minX = Math.min(x1, x2);
            const maxX = Math.max(x1, x2);

            for (let x = minX; x <= maxX; x++) {
                let interpY = y2;
                if (x2 !== x1) {
                    const t = (x - x1) / (x2 - x1);
                    interpY = Math.round(y1 + t * (y2 - y1));
                }
                currentPanoramaCurveY[x] = Math.max(0, Math.min(currentPanoramaHeight - 1, interpY));
            }
        } else {
            currentPanoramaCurveY[pt.x] = pt.y;
        }

        lastDrawCoord = pt;
        drawReliefOverlay(adminScanCanvas, adminLoadedImage, currentPanoramaWidth, currentPanoramaHeight, currentPanoramaCurveY);
    }

    // Interaktives Zeichnen beenden
    function handleReliefDrawEnd() {
        if (isDrawingRelief) {
            isDrawingRelief = false;
            lastDrawCoord = null;
        }
    }

    // Verarbeitet Bildauswahl: Resizing, Skyline-Scan und Supabase Storage Upload
    async function handlePanoramaFileSelect(file) {
        if (!file) return;

        isProcessingImage = true;
        checkPanoramaFormReadiness();

        if (uploadStatusBadge) {
            uploadStatusBadge.classList.remove('hidden');
            uploadStatusBadge.className = 'text-[11px] font-mono px-2 py-0.5 rounded border bg-blue-950/70 text-blue-400 border-blue-800/60 animate-pulse';
            uploadStatusBadge.innerText = 'Verarbeite Bild & skaliere...';
        }
        if (btnRescanRelief) btnRescanRelief.classList.add('hidden');
        if (scanFeedbackInfo) scanFeedbackInfo.innerText = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;

        const reader = new FileReader();
        reader.onerror = () => {
            isProcessingImage = false;
            if (uploadStatusBadge) {
                uploadStatusBadge.className = 'text-[11px] font-mono px-2 py-0.5 rounded border bg-red-950 text-red-400 border-red-800';
                uploadStatusBadge.innerText = '✕ Lesefehler der Datei';
            }
            showToast('Fehler beim Lesen der Datei', 'error');
            checkPanoramaFormReadiness();
        };

        reader.onload = (e) => {
            const img = new Image();
            img.onerror = () => {
                isProcessingImage = false;
                if (uploadStatusBadge) {
                    uploadStatusBadge.className = 'text-[11px] font-mono px-2 py-0.5 rounded border bg-red-950 text-red-400 border-red-800';
                    uploadStatusBadge.innerText = '✕ Ungültiges Bildformat';
                }
                showToast('Das Bild konnte nicht geladen werden', 'error');
                checkPanoramaFormReadiness();
            };

            img.onload = async () => {
                adminLoadedImage = img;

                // Clientseitiges Skalieren auf maximal 2500px Breite
                const MAX_WIDTH = 2500;
                let targetW = img.naturalWidth || img.width;
                let targetH = img.naturalHeight || img.height;
                if (targetW > MAX_WIDTH) {
                    const ratio = MAX_WIDTH / targetW;
                    targetW = MAX_WIDTH;
                    targetH = Math.round(targetH * ratio);
                }

                // Offscreen Canvas für das saubere JPEG und die Skyline-Analyse
                const offscreenCanvas = document.createElement('canvas');
                offscreenCanvas.width = targetW;
                offscreenCanvas.height = targetH;
                const offCtx = offscreenCanvas.getContext('2d');
                offCtx.drawImage(img, 0, 0, targetW, targetH);

                // Relief / Skyline scannen
                if (uploadStatusBadge) uploadStatusBadge.innerText = 'Scanne Relief-Linie...';
                const curveY = autoScanRelief(offCtx, targetW, targetH);

                // Relief-State aktualisieren
                currentPanoramaCurveY = curveY;
                currentPanoramaWidth = targetW;
                currentPanoramaHeight = targetH;

                // Vorschau auf dem UI-Canvas zeichnen mit dicker roter Linie
                if (scanCanvasWrapper) scanCanvasWrapper.classList.remove('hidden');
                drawReliefOverlay(adminScanCanvas, img, targetW, targetH, currentPanoramaCurveY);
                if (btnRescanRelief) btnRescanRelief.classList.remove('hidden');

                // Hinweistext im Formularfeld (JSON.stringify erfolgt erst beim Speichern)
                const arrayUrlInput = formEditRecord.querySelector('textarea[name="array_url"], input[name="array_url"]');
                if (arrayUrlInput) {
                    arrayUrlInput.value = `[Relief im State aktiv: ${curveY.length} Datenpunkte. Wird beim Speichern automatisch als JSON gespeichert.]`;
                }

                if (scanFeedbackInfo) {
                    scanFeedbackInfo.innerText = `${targetW}×${targetH}px | ${curveY.length} Punkte (Zeichne mit Maus/Touch für Korrekturen)`;
                }

                // Sauberes verkleinertes Bild in Supabase Storage Bucket 'panorama-images' hochladen
                if (uploadStatusBadge) {
                    uploadStatusBadge.innerText = 'Lade in Supabase Storage hoch...';
                    uploadStatusBadge.className = 'text-[11px] font-mono px-2 py-0.5 rounded border bg-amber-950/70 text-amber-400 border-amber-800/60 animate-pulse';
                }

                offscreenCanvas.toBlob(async (blob) => {
                    if (!blob) {
                        isProcessingImage = false;
                        if (uploadStatusBadge) {
                            uploadStatusBadge.className = 'text-[11px] font-mono px-2 py-0.5 rounded border bg-red-950 text-red-400 border-red-800';
                            uploadStatusBadge.innerText = '✕ Fehler beim Erstellen des Bild-Blobs';
                        }
                        showToast('Fehler bei Bild-Komprimierung', 'error');
                        checkPanoramaFormReadiness();
                        return;
                    }

                    try {
                        const cleanExt = (file.name.split('.').pop() || 'jpg').toLowerCase();
                        const safeBase = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
                        const fileName = `${Date.now()}_${safeBase}.${cleanExt === 'jpeg' ? 'jpg' : cleanExt}`;
                        const filePath = `public/${fileName}`;

                        const { data: uploadData, error: uploadError } = await supabase.storage
                            .from('panorama-images')
                            .upload(filePath, blob, {
                                contentType: 'image/jpeg',
                                upsert: true
                            });

                        if (uploadError) throw uploadError;

                        const { data: urlData } = supabase.storage
                            .from('panorama-images')
                            .getPublicUrl(filePath);

                        const publicUrl = urlData.publicUrl;
                        const imageUrlInput = formEditRecord.querySelector('textarea[name="image_url"], input[name="image_url"]');
                        if (imageUrlInput) {
                            imageUrlInput.value = publicUrl;
                        }

                        if (uploadStatusBadge) {
                            uploadStatusBadge.innerText = '✓ Bild hochgeladen & Horizont gescannt';
                            uploadStatusBadge.className = 'text-[11px] font-mono px-2 py-0.5 rounded border bg-emerald-950/80 text-emerald-400 border-emerald-800';
                        }
                        showToast('Bild erfolgreich gespeichert und gescannt!');

                    } catch (err) {
                        console.error("Storage Upload Fehler:", err);
                        if (uploadStatusBadge) {
                            uploadStatusBadge.innerText = `✕ Upload-Fehler: ${err.message}`;
                            uploadStatusBadge.className = 'text-[11px] font-mono px-2 py-0.5 rounded border bg-red-950 text-red-400 border-red-800';
                        }
                        showToast(`Upload-Fehler: ${err.message}`, 'error');
                    } finally {
                        isProcessingImage = false;
                        checkPanoramaFormReadiness();
                    }
                }, 'image/jpeg', 0.88);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // Erneuter Scan des aktuell geladenen Bildes
    function handleRescanRelief() {
        if (!adminLoadedImage) {
            showToast('Kein Bild zum Scannen vorhanden', 'warning');
            return;
        }

        const MAX_WIDTH = 2500;
        let targetW = adminLoadedImage.naturalWidth || adminLoadedImage.width;
        let targetH = adminLoadedImage.naturalHeight || adminLoadedImage.height;
        if (targetW > MAX_WIDTH) {
            const ratio = MAX_WIDTH / targetW;
            targetW = MAX_WIDTH;
            targetH = Math.round(targetH * ratio);
        }

        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = targetW;
        offscreenCanvas.height = targetH;
        const offCtx = offscreenCanvas.getContext('2d');
        offCtx.drawImage(adminLoadedImage, 0, 0, targetW, targetH);

        const curveY = autoScanRelief(offCtx, targetW, targetH);
        currentPanoramaCurveY = curveY;
        currentPanoramaWidth = targetW;
        currentPanoramaHeight = targetH;

        drawReliefOverlay(adminScanCanvas, adminLoadedImage, targetW, targetH, currentPanoramaCurveY);

        const arrayUrlInput = formEditRecord.querySelector('textarea[name="array_url"], input[name="array_url"]');
        if (arrayUrlInput) {
            arrayUrlInput.value = `[Relief neu berechnet: ${curveY.length} Datenpunkte. Wird beim Speichern automatisch als JSON gespeichert.]`;
        }

        if (scanFeedbackInfo) {
            scanFeedbackInfo.innerText = `${targetW}×${targetH}px | ${curveY.length} Datenpunkte neu berechnet`;
        }

        showToast('Horizont neu berechnet! Zeichne im Canvas für manuelle Korrekturen.');
        checkPanoramaFormReadiness();
    }

    // Lädt ein bestehendes Panoramabild in den Canvas zur visuellen Kontrolle und Bearbeitung
    function loadExistingPanoramaPreview(imageUrl, arrayUrl) {
        if (!imageUrl) return;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            adminLoadedImage = img;
            currentPanoramaWidth = img.naturalWidth || img.width;
            currentPanoramaHeight = img.naturalHeight || img.height;
            currentPanoramaCurveY = null;

            if (arrayUrl) {
                try {
                    const parsed = (typeof arrayUrl === 'string') ? JSON.parse(arrayUrl) : arrayUrl;
                    if (parsed && Array.isArray(parsed.kurve_y)) {
                        currentPanoramaCurveY = [...parsed.kurve_y];
                        if (parsed.bild_breite) currentPanoramaWidth = parsed.bild_breite;
                        if (parsed.bild_hoehe) currentPanoramaHeight = parsed.bild_hoehe;
                    }
                } catch(e) {}
            }
            if (scanCanvasWrapper) scanCanvasWrapper.classList.remove('hidden');
            if (btnRescanRelief) btnRescanRelief.classList.remove('hidden');
            drawReliefOverlay(adminScanCanvas, img, currentPanoramaWidth, currentPanoramaHeight, currentPanoramaCurveY);
            if (scanFeedbackInfo) {
                scanFeedbackInfo.innerText = `${currentPanoramaWidth}×${currentPanoramaHeight}px | Bereit für interaktive Korrekturen`;
            }
        };
        img.onerror = () => {
            console.warn("Konnte bestehendes Bild nicht im Canvas laden:", imageUrl);
        };
        img.src = imageUrl;
    }

    // Standardwerte für neue Panoramen
    const PANORAMA_FIELD_DEFAULTS = {
        peaks: 4,
        valleys: 2,
        spacing: 35,
        sensibility: 0,
        mode: 'chord',
        scale: 'lydian',
        octaves: 3,
        range: 100,
        wave: 'darkpad',
        volume: 0.2,
        duration: 5.0,
        attack: 1.0,
        release: 2.0,
        echo: 0.3,
        grid_lines: 5
    };

    // Ermittelt die nächste freie numerische Panorama-ID
    function getNextPanoramaId() {
        let maxId = 0;
        if (currentRecords && currentRecords.length > 0) {
            currentRecords.forEach(r => {
                const num = parseInt(r.id, 10);
                if (!isNaN(num) && num > maxId) {
                    maxId = num;
                }
            });
        }
        return String(maxId > 0 ? maxId + 1 : 1);
    }

    // Formatiert das heutige Datum im Format DD.MM.YYYY
    function getFormattedCurrentDate() {
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yyyy = now.getFullYear();
        return `${dd}.${mm}.${yyyy}`;
    }

    // Prüft, ob das Panorama-Formular speicherbereit ist
    function checkPanoramaFormReadiness() {
        if (currentTable !== 'panoramas') {
            btnSaveModal.disabled = false;
            btnSaveModal.classList.remove('opacity-50', 'cursor-not-allowed');
            btnSaveModal.title = 'Speichern';
            return true;
        }

        if (modalMode === 'edit') {
            btnSaveModal.disabled = false;
            btnSaveModal.classList.remove('opacity-50', 'cursor-not-allowed');
            btnSaveModal.title = 'Speichern';
            return true;
        }

        // Im Neuanlage-Modus: Bild-URL muss vorhanden sein und Relief-Array im State (oder im Feld)
        const imgInput = formEditRecord.querySelector('[name="image_url"]');
        const imgVal = (imgInput ? imgInput.value : '').trim();
        const hasRelief = (currentPanoramaCurveY && currentPanoramaCurveY.length > 0) ||
                          Boolean((formEditRecord.querySelector('[name="array_url"]')?.value || '').trim());
        const titleInput = formEditRecord.querySelector('[name="title"]');
        const titleVal = (titleInput ? titleInput.value : '').trim();

        if (isProcessingImage || !imgVal || !hasRelief || !titleVal) {
            btnSaveModal.disabled = true;
            btnSaveModal.classList.add('opacity-50', 'cursor-not-allowed');
            if (isProcessingImage) {
                btnSaveModal.title = 'Bild wird verarbeitet...';
            } else if (!imgVal || !hasRelief) {
                btnSaveModal.title = 'Bitte lade zuerst ein Bild hoch und scanne die Horizontlinie';
            } else if (!titleVal) {
                btnSaveModal.title = 'Bitte gib einen Titel für das Panorama ein';
            }
            return false;
        } else {
            btnSaveModal.disabled = false;
            btnSaveModal.classList.remove('opacity-50', 'cursor-not-allowed');
            btnSaveModal.title = 'Panorama speichern';
            return true;
        }
    }

    // 8. Dynamisches Formular (Modal) für Neu & Bearbeiten
    function openRecordModal(mode, record = null) {
        modalMode = mode;
        editingRecord = record;

        const cfg = TABLE_CONFIG[currentTable];
        const pk = cfg.pk;

        modalIcon.innerText = (mode === 'create') ? '➕' : '✏️';
        modalTitle.innerText = (mode === 'create') ? `${cfg.title}: Neuen Eintrag erstellen` : `${cfg.title}: Eintrag bearbeiten`;

        // 1. Panorama Builder Panel ein- oder ausblenden
        if (currentTable === 'panoramas') {
            if (sectionPanoramaBuilder) sectionPanoramaBuilder.classList.remove('hidden');
            initAdminMap(record ? record.lat : null, record ? record.lng : null);

            if (record && record.image_url) {
                if (uploadStatusBadge) {
                    uploadStatusBadge.classList.remove('hidden');
                    uploadStatusBadge.className = 'text-[11px] font-mono px-2 py-0.5 rounded border bg-neutral-800 text-neutral-300 border-neutral-700';
                    uploadStatusBadge.innerText = 'Bestehendes Bild verknüpft';
                }
                if (scanFeedbackInfo) scanFeedbackInfo.innerText = record.image_url;
                loadExistingPanoramaPreview(record.image_url, record.array_url);
            } else {
                if (uploadStatusBadge) uploadStatusBadge.classList.add('hidden');
                if (scanCanvasWrapper) scanCanvasWrapper.classList.add('hidden');
                if (btnRescanRelief) btnRescanRelief.classList.add('hidden');
                if (scanFeedbackInfo) scanFeedbackInfo.innerText = '';
            }
        } else {
            if (sectionPanoramaBuilder) sectionPanoramaBuilder.classList.add('hidden');
            cleanupAdminMap();
        }

        // 2. Baue Formularfelder dynamisch für ALLE Spalten auf
        let html = '';
        currentColumns.forEach(col => {
            const isPk = (col === pk);
            let rawVal = record ? record[col] : '';

            // Vorbelegung für Neuanlage bei Panoramas
            if (mode === 'create' && currentTable === 'panoramas') {
                if (col === 'id') {
                    rawVal = getNextPanoramaId();
                } else if (col === 'date_added') {
                    rawVal = getFormattedCurrentDate();
                } else if (PANORAMA_FIELD_DEFAULTS[col] !== undefined && (rawVal === '' || rawVal === null || rawVal === undefined)) {
                    rawVal = PANORAMA_FIELD_DEFAULTS[col];
                }
            }

            const valStr = (rawVal !== null && rawVal !== undefined) ? String(rawVal) : '';

            // Spezielle Behandlungen für Rollen-Dropdown
            if (currentTable === 'admin_users' && col === 'role') {
                html += `
                <div class="space-y-1">
                    <label class="block text-xs font-mono font-medium text-neutral-300 capitalize">${escapeHTML(col)}</label>
                    <select name="${escapeHTML(col)}" class="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-orange">
                        <option value="normal" ${valStr === 'normal' ? 'selected' : ''}>normal</option>
                        <option value="superadmin" ${valStr === 'superadmin' ? 'selected' : ''}>superadmin</option>
                    </select>
                </div>`;
                return;
            }

            // Checkbox für Booleans (is_vinyl, is_ai oder typeof boolean)
            const isBoolCol = (col === 'is_vinyl' || col === 'is_ai' || typeof rawVal === 'boolean');
            if (isBoolCol) {
                const isChecked = (rawVal === true || rawVal === 'true' || rawVal === 'TRUE' || rawVal === 1 || rawVal === '1');
                html += `
                <div class="space-y-1">
                    <label class="block text-xs font-mono font-medium text-neutral-300 capitalize">${escapeHTML(col)}</label>
                    <label class="flex items-center gap-2.5 cursor-pointer bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2.5 hover:border-neutral-500 transition-colors">
                        <input type="checkbox" name="${escapeHTML(col)}" id="input_${escapeHTML(col)}" class="w-4 h-4 rounded accent-orange-500 bg-neutral-900 border-neutral-600 focus:ring-brand-orange focus:ring-offset-neutral-900 cursor-pointer" ${isChecked ? 'checked' : ''}>
                        <span class="text-xs font-mono text-neutral-200 select-none">${escapeHTML(col)} aktivieren</span>
                    </label>
                </div>`;
                return;
            }

            // Spezifische Behandlung für Panoramas: lat, lng, image_url, array_url sind READONLY
            const isPanoAutoCol = (currentTable === 'panoramas' && ['lat', 'lng', 'image_url', 'array_url'].includes(col));
            if (isPanoAutoCol) {
                let badgeText = 'Automatisch befüllt';
                if (col === 'lat' || col === 'lng') badgeText = '📍 Via Karte (readonly)';
                else if (col === 'image_url') badgeText = '📷 Via Upload (readonly)';
                else if (col === 'array_url') badgeText = '⛰️ Via Relief-Scan (readonly)';

                const isLong = (col === 'image_url' || col === 'array_url');
                html += `
                <div class="${isLong ? 'md:col-span-2' : ''} space-y-1">
                    <div class="flex items-center justify-between">
                        <label class="block text-xs font-mono font-medium text-neutral-300 capitalize">
                            <span>${escapeHTML(col)}</span>
                        </label>
                        <span class="text-[10px] text-brand-orange font-mono font-medium">${badgeText}</span>
                    </div>`;

                if (isLong) {
                    html += `
                    <textarea name="${escapeHTML(col)}" rows="2" readonly class="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-300 font-mono cursor-not-allowed select-all" placeholder="${col} wird automatisch befüllt...">${escapeHTML(valStr)}</textarea>`;
                } else {
                    html += `
                    <input type="text" name="${escapeHTML(col)}" value="${escapeHTML(valStr)}" readonly class="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-300 font-mono cursor-not-allowed select-all" placeholder="${col} wird per Karte gesetzt...">`;
                }

                html += `</div>`;
                return;
            }

            // Textarea für lange Werte (JSON, Arrays, Kommentare, vinyl_array, ai_sound)
            const isLongText = (col.includes('comment') || col.includes('json') || col.includes('array') || col.includes('url') || col === 'vinyl_array' || col === 'ai_sound');
            const isReadonlyPk = (mode === 'edit' && isPk);

            let pkBadge = '';
            if (isPk) {
                if (currentTable === 'panoramas' && mode === 'create') {
                    pkBadge = '<span class="text-brand-orange ml-1 text-[10px]">(Primary Key - Auto-ID)</span>';
                } else {
                    pkBadge = '<span class="text-brand-orange ml-1 text-[10px]">(Primary Key)</span>';
                }
            }

            let placeholderText = '';
            if (isPk && mode === 'create') {
                if (currentTable === 'panoramas') {
                    placeholderText = `Auto-ID (z. B. ${valStr || getNextPanoramaId()})`;
                } else if (currentTable === 'translations') {
                    placeholderText = 'Eindeutiger Schlüssel (z. B. button_play)';
                } else {
                    placeholderText = '(Optional bei auto-generated UUID)';
                }
            } else {
                placeholderText = col;
            }

            html += `
            <div class="${isLongText ? 'md:col-span-2' : ''} space-y-1">
                <div class="flex items-center justify-between">
                    <label class="block text-xs font-mono font-medium text-neutral-300 capitalize">
                        <span>${escapeHTML(col)}</span>
                        ${pkBadge}
                    </label>
                    ${isReadonlyPk ? '<span class="text-[10px] text-neutral-500 font-mono">Nicht veränderbar</span>' : ''}
                </div>`;

            if (isLongText) {
                html += `
                <textarea name="${escapeHTML(col)}" rows="3" placeholder="${escapeHTML(placeholderText)}" class="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-orange font-mono" ${isReadonlyPk ? 'readonly disabled' : ''}>${escapeHTML(valStr)}</textarea>`;
            } else {
                html += `
                <input type="text" name="${escapeHTML(col)}" value="${escapeHTML(valStr)}" class="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-orange font-mono ${isReadonlyPk ? 'bg-neutral-900 cursor-not-allowed opacity-60' : ''}" ${isReadonlyPk ? 'readonly' : ''} placeholder="${escapeHTML(placeholderText)}">`;
            }

            html += `</div>`;
        });

        formFieldsContainer.innerHTML = html;
        modalEditRecord.classList.remove('hidden');
        checkPanoramaFormReadiness();
    }

    function closeRecordModal() {
        cleanupAdminMap();
        modalEditRecord.classList.add('hidden');
        editingRecord = null;
        formEditRecord.reset();
    }

    // Formular-Absenden (INSERT / UPDATE)
    async function handleFormSubmit(e) {
        e.preventDefault();

        const cfg = TABLE_CONFIG[currentTable];
        const pk = cfg.pk;
        const formData = new FormData(formEditRecord);
        const payload = {};

        currentColumns.forEach(col => {
            const inputEl = formEditRecord.elements[col] || formEditRecord.querySelector(`[name="${col}"]`);

            // Checkbox-Behandlung: explizit als echter Boolean (true / false)
            if (inputEl && inputEl.type === 'checkbox') {
                payload[col] = Boolean(inputEl.checked);
                return;
            }

            const raw = inputEl ? inputEl.value : formData.get(col);
            if (raw !== null && raw !== undefined) {
                const trimmed = String(raw).trim();
                
                // Leere Strings bei 'id' beim Neuanlegen:
                // Bei Tabellen mit auto-generierter UUID (presets, admin_users) weglassen -> Postgres vergibt UUID
                // Bei Panoramas gibt es KEIN DB-Default -> hier auto-generierte ID zuweisen!
                if (modalMode === 'create' && col === pk && trimmed === '') {
                    if (currentTable === 'panoramas') {
                        payload[pk] = getNextPanoramaId();
                    }
                    return;
                }

                // Typkonvertierung: Leere Strings als null übergeben
                if (trimmed === '') {
                    payload[col] = null;
                } else if (!isNaN(Number(trimmed)) && !col.includes('url') && !col.includes('date') && !col.includes('id') && !col.includes('key') && !col.includes('array') && !col.includes('sound') && !col.includes('name') && !col.includes('title')) {
                    payload[col] = Number(trimmed);
                } else {
                    payload[col] = trimmed;
                }
            } else {
                payload[col] = null;
            }
        });

        // Spezifische Pflichtfeld-Prüfungen & Ergänzungen für Panoramas
        if (currentTable === 'panoramas') {
            if (modalMode === 'create') {
                // Sicherstellen, dass ID gesetzt ist (falls Feld gelöscht wurde)
                if (!payload.id || String(payload.id).trim() === '') {
                    payload.id = getNextPanoramaId();
                }
                // Datum setzen falls leer
                if (!payload.date_added || String(payload.date_added).trim() === '') {
                    payload.date_added = getFormattedCurrentDate();
                }
                // Standardwerte für Synthesizer-Parameter setzen falls null
                Object.keys(PANORAMA_FIELD_DEFAULTS).forEach(param => {
                    if (payload[param] === null || payload[param] === undefined) {
                        payload[param] = PANORAMA_FIELD_DEFAULTS[param];
                    }
                });
            }

            // Validierung: Titel ist Pflichtfeld (NOT NULL in Supabase)
            const titleVal = (payload.title !== null && payload.title !== undefined) ? String(payload.title).trim() : '';
            if (!titleVal) {
                showToast('Bitte gib einen Titel für das Panorama ein.', 'error');
                const titleInput = formEditRecord.querySelector('[name="title"]');
                if (titleInput) {
                    titleInput.focus();
                    titleInput.classList.add('border-red-500');
                    setTimeout(() => titleInput.classList.remove('border-red-500'), 3000);
                }
                checkPanoramaFormReadiness();
                return;
            }
        }

        // Validierung für Translations: key_name ist Pflichtfeld
        if (currentTable === 'translations' && modalMode === 'create') {
            const keyVal = (payload.key_name !== null && payload.key_name !== undefined) ? String(payload.key_name).trim() : '';
            if (!keyVal) {
                showToast('Bitte gib einen eindeutigen "key_name" ein.', 'error');
                const keyInput = formEditRecord.querySelector('[name="key_name"]');
                if (keyInput) {
                    keyInput.focus();
                    keyInput.classList.add('border-red-500');
                    setTimeout(() => keyInput.classList.remove('border-red-500'), 3000);
                }
                return;
            }
        }

        // 4. Anforderung: JSON.stringify() für 'array_url' erfolgt erst jetzt beim finalen Speichern aus dem State-Array!
        if (currentTable === 'panoramas' && currentPanoramaCurveY && currentPanoramaCurveY.length > 0) {
            const reliefPayload = {
                bild_breite: currentPanoramaWidth || (adminScanCanvas ? adminScanCanvas.width : 2500),
                bild_hoehe: currentPanoramaHeight || (adminScanCanvas ? adminScanCanvas.height : 400),
                kurve_y: currentPanoramaCurveY
            };
            const jsonStr = JSON.stringify(reliefPayload);
            payload['array_url'] = jsonStr;
            const arrayUrlInput = formEditRecord.querySelector('textarea[name="array_url"], input[name="array_url"]');
            if (arrayUrlInput) {
                arrayUrlInput.value = jsonStr;
            }
        }

        // Zusätzliche Validierung für Panoramen beim Neuanlegen
        if (currentTable === 'panoramas' && modalMode === 'create') {
            const imgInput = formEditRecord.querySelector('[name="image_url"]');
            const imgVal = (imgInput ? imgInput.value : '').trim();
            const hasArray = Boolean(payload['array_url'] || (formEditRecord.querySelector('[name="array_url"]')?.value || '').trim());

            if (!imgVal || !hasArray) {
                showToast('Bitte lade zuerst ein Bild hoch und scanne das Horizont-Relief.', 'error');
                checkPanoramaFormReadiness();
                return;
            }
        }

        btnSaveModal.disabled = true;
        btnSaveModal.innerText = 'Speichere...';

        try {
            if (modalMode === 'create') {
                const { error } = await supabase.from(currentTable).insert(payload);
                if (error) throw error;
                showToast("Eintrag erfolgreich hinzugefügt!");
            } else {
                const pkVal = editingRecord[pk];
                // Primary Key nicht im Payload mit-updaten
                delete payload[pk];
                const { error } = await supabase.from(currentTable).update(payload).eq(pk, pkVal);
                if (error) throw error;
                showToast("Eintrag erfolgreich aktualisiert!");
            }

            closeRecordModal();
            await loadTableData();

        } catch (err) {
            console.error("Speicherfehler Details:", {
                message: err.message,
                details: err.details,
                hint: err.hint,
                code: err.code,
                payload
            });
            const errMsg = err.details || err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
            showToast(`Fehler beim Speichern: ${errMsg}`, 'error');
        } finally {
            btnSaveModal.disabled = false;
            btnSaveModal.innerText = 'Speichern';
            checkPanoramaFormReadiness();
        }
    }

    // 9. Löschen (DELETE)
    function openDeleteModal(record) {
        deletingRecord = record;
        const pk = TABLE_CONFIG[currentTable].pk;
        const pkVal = record[pk];
        deleteRecordPreview.innerText = `${TABLE_CONFIG[currentTable].title} #${pkVal}`;
        modalDeleteConfirm.classList.remove('hidden');
    }

    function closeDeleteModal() {
        modalDeleteConfirm.classList.add('hidden');
        deletingRecord = null;
    }

    async function handleConfirmDelete() {
        if (!deletingRecord) return;
        btnConfirmDelete.disabled = true;
        btnConfirmDelete.innerText = 'Lösche...';

        const pk = TABLE_CONFIG[currentTable].pk;
        const pkVal = deletingRecord[pk];

        try {
            const { error } = await supabase
                .from(currentTable)
                .delete()
                .eq(pk, pkVal);

            if (error) throw error;

            showToast("Eintrag erfolgreich gelöscht!");
            closeDeleteModal();
            await loadTableData();

        } catch (err) {
            console.error("Löschfehler:", err);
            showToast(`Löschen fehlgeschlagen: ${err.message}`, 'error');
        } finally {
            btnConfirmDelete.disabled = false;
            btnConfirmDelete.innerText = 'Ja, löschen';
        }
    }

    // 10. Event Listener Setup
    function setupEventListeners() {
        // Login mit Google
        btnLoginGoogle.addEventListener('click', async () => {
            try {
                btnLoginGoogle.disabled = true;
                btnLoginGoogle.innerHTML = '<span>Verbinde mit Google...</span>';
                const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: window.location.origin + window.location.pathname
                    }
                });
                if (error) throw error;
            } catch (err) {
                console.error("Google Login Fehler:", err);
                showToast(`Login-Fehler: ${err.message}`, 'error');
                btnLoginGoogle.disabled = false;
                btnLoginGoogle.innerHTML = '<span>Login mit Google</span>';
            }
        });

        // Logout Buttons
        btnDeniedLogout.addEventListener('click', async () => {
            if (realtimeChannel) {
                try { supabase.removeChannel(realtimeChannel); } catch(e) {}
                realtimeChannel = null;
            }
            await supabase.auth.signOut();
        });
        btnDashboardLogout.addEventListener('click', async () => {
            if (realtimeChannel) {
                try { supabase.removeChannel(realtimeChannel); } catch(e) {}
                realtimeChannel = null;
            }
            await supabase.auth.signOut();
        });

        // Sidebar Navigation Klicks
        sidebarNav.addEventListener('click', (e) => {
            const btn = e.target.closest('.nav-item');
            if (!btn) return;
            const targetTable = btn.getAttribute('data-table');
            if (targetTable && targetTable !== currentTable) {
                switchTable(targetTable);
            }
        });

        // Suche
        inputSearch.addEventListener('input', handleSearch);

        // Aktualisieren
        btnRefreshTable.addEventListener('click', () => {
            loadTableData();
        });

        // Neu Hinzufügen
        btnAddRecord.addEventListener('click', () => {
            openRecordModal('create');
        });

        // Modal Schließen
        btnCloseModal.addEventListener('click', closeRecordModal);
        btnCancelModal.addEventListener('click', closeRecordModal);
        modalEditRecord.addEventListener('click', (e) => {
            if (e.target === modalEditRecord) closeRecordModal();
        });

        // Formular Absenden
        formEditRecord.addEventListener('submit', handleFormSubmit);

        // Formular-Eingaben überwachen zur Freischaltung des Speichern-Buttons
        formEditRecord.addEventListener('input', checkPanoramaFormReadiness);

        // Panorama Upload & Horizon-Rescan Event Listener
        if (inputPanoramaFile) {
            inputPanoramaFile.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (file) handlePanoramaFileSelect(file);
            });
        }
        if (btnRescanRelief) {
            btnRescanRelief.addEventListener('click', handleRescanRelief);
        }

        // Canvas Interaktive Korrektur (Mouse & Touch Listener)
        if (adminScanCanvas) {
            // Maus-Events
            adminScanCanvas.addEventListener('mousedown', handleReliefDrawStart);
            adminScanCanvas.addEventListener('mousemove', handleReliefDrawMove);
            adminScanCanvas.addEventListener('mouseup', handleReliefDrawEnd);
            adminScanCanvas.addEventListener('mouseleave', handleReliefDrawEnd);

            // Touch-Events für mobile Geräte / Touchscreens
            adminScanCanvas.addEventListener('touchstart', handleReliefDrawStart, { passive: false });
            adminScanCanvas.addEventListener('touchmove', handleReliefDrawMove, { passive: false });
            adminScanCanvas.addEventListener('touchend', handleReliefDrawEnd);
            adminScanCanvas.addEventListener('touchcancel', handleReliefDrawEnd);
        }
        window.addEventListener('mouseup', handleReliefDrawEnd);

        // Aktionen in der Tabelle (Delegation für Edit / Delete)
        dynamicTableBody.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            const action = btn.getAttribute('data-action');
            const idx = parseInt(btn.getAttribute('data-idx'), 10);
            const record = currentRecords[idx];
            if (!record) return;

            if (action === 'edit') {
                openRecordModal('edit', record);
            } else if (action === 'delete') {
                openDeleteModal(record);
            }
        });

        // Delete Modal Schließen & Bestätigen
        btnCancelDelete.addEventListener('click', closeDeleteModal);
        modalDeleteConfirm.addEventListener('click', (e) => {
            if (e.target === modalDeleteConfirm) closeDeleteModal();
        });
        btnConfirmDelete.addEventListener('click', handleConfirmDelete);

        // ESC-Taste schließt aktive Modals
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeRecordModal();
                closeDeleteModal();
            }
        });
    }

    // 11. Initialer Start
    document.addEventListener('DOMContentLoaded', () => {
        setupEventListeners();
        initAuth();
    });

})();
