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

    // 8. Dynamisches Formular (Modal) für Neu & Bearbeiten
    function openRecordModal(mode, record = null) {
        modalMode = mode;
        editingRecord = record;

        const cfg = TABLE_CONFIG[currentTable];
        const pk = cfg.pk;

        modalIcon.innerText = (mode === 'create') ? '➕' : '✏️';
        modalTitle.innerText = (mode === 'create') ? `${cfg.title}: Neuen Eintrag erstellen` : `${cfg.title}: Eintrag bearbeiten`;

        // Baue Formularfelder dynamisch für ALLE Spalten auf
        let html = '';
        currentColumns.forEach(col => {
            const isPk = (col === pk);
            const rawVal = record ? record[col] : '';
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

            // Textarea für lange Werte (JSON, Arrays, Kommentare, vinyl_array, ai_sound)
            const isLongText = (col.includes('comment') || col.includes('json') || col.includes('array') || col.includes('url') || col === 'vinyl_array' || col === 'ai_sound');
            const isReadonlyPk = (mode === 'edit' && isPk);

            html += `
            <div class="${isLongText ? 'md:col-span-2' : ''} space-y-1">
                <div class="flex items-center justify-between">
                    <label class="block text-xs font-mono font-medium text-neutral-300 capitalize">
                        <span>${escapeHTML(col)}</span>
                        ${isPk ? '<span class="text-brand-orange ml-1 text-[10px]">(Primary Key)</span>' : ''}
                    </label>
                    ${isReadonlyPk ? '<span class="text-[10px] text-neutral-500 font-mono">Nicht veränderbar</span>' : ''}
                </div>`;

            if (isLongText) {
                html += `
                <textarea name="${escapeHTML(col)}" rows="3" placeholder="${escapeHTML(col)}" class="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-orange font-mono" ${isReadonlyPk ? 'readonly disabled' : ''}>${escapeHTML(valStr)}</textarea>`;
            } else {
                html += `
                <input type="text" name="${escapeHTML(col)}" value="${escapeHTML(valStr)}" class="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-orange font-mono ${isReadonlyPk ? 'bg-neutral-900 cursor-not-allowed opacity-60' : ''}" ${isReadonlyPk ? 'readonly' : ''} placeholder="${isPk && mode === 'create' ? '(Optional bei auto-generated ID)' : ''}">`;
            }

            html += `</div>`;
        });

        formFieldsContainer.innerHTML = html;
        modalEditRecord.classList.remove('hidden');
    }

    function closeRecordModal() {
        modalEditRecord.classList.add('hidden');
        editingRecord = null;
        formEditRecord.reset();
    }

    // Formular-Absenden (INSERT / UPDATE)
    async function handleFormSubmit(e) {
        e.preventDefault();
        btnSaveModal.disabled = true;
        btnSaveModal.innerText = 'Speichere...';

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

            const raw = formData.get(col);
            if (raw !== null && raw !== undefined) {
                const trimmed = raw.trim();
                // Leere Strings bei 'id' beim Neuanlegen weglassen, falls DB ein Default hat (z. B. UUID oder Serial)
                if (modalMode === 'create' && col === pk && trimmed === '') {
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
            console.error("Speicherfehler:", err);
            showToast(`Fehler: ${err.message}`, 'error');
        } finally {
            btnSaveModal.disabled = false;
            btnSaveModal.innerText = 'Speichern';
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
            await supabase.auth.signOut();
        });
        btnDashboardLogout.addEventListener('click', async () => {
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
