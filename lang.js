// lang.js - Mehrsprachigkeit für den Panorama Synthesizer (Supabase REST)

// Globales text-Objekt für synchrone Kompatibilität in der gesamten App
window.text = {
    de: {},
    fr: {},
    it: {},
    en: {},
    uk: {},
    ru: {},
    es: {}
};
var text = window.text;

// Supabase Konfiguration (wird primär aus config.js bezogen)
const SB_URL = (typeof SUPABASE_URL !== 'undefined') ? SUPABASE_URL : "https://hdwbfkukcmrddrkrghiy.supabase.co";
const SB_KEY = (typeof SUPABASE_ANON_KEY !== 'undefined') ? SUPABASE_ANON_KEY : "sb_publishable_rUM-8j5OTgPsKH3XtbD0VQ_cCFM39SO";

/**
 * Lädt alle Übersetzungen asynchron aus der Supabase REST API
 * und mappt sie in die Struktur text[lang][key_name].
 */
window.loadTranslations = async function() {
    try {
        const url = `${SB_URL}/rest/v1/translations?select=*`;
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                "apikey": SB_KEY,
                "Authorization": `Bearer ${SB_KEY}`
            }
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const rows = await res.json();
        const supportedLangs = ['de', 'fr', 'it', 'en', 'uk', 'ru', 'es'];

        supportedLangs.forEach(lang => {
            if (!window.text[lang]) {
                window.text[lang] = {};
            }
        });

        rows.forEach(row => {
            const key = row.key_name;
            if (!key) return;

            supportedLangs.forEach(lang => {
                if (row[lang] !== undefined && row[lang] !== null) {
                    window.text[lang][key] = row[lang];
                }
            });
        });

        // Falls die UI bereits initialisiert wurde, Sprachelemente aktualisieren
        if (typeof window.changeLanguage === 'function') {
            window.changeLanguage(window.currentLang || 'de');
        }

        return window.text;
    } catch (err) {
        console.error("Fehler beim Laden der Übersetzungen aus Supabase:", err);
        return window.text;
    }
};

// Asynchrones Laden direkt beim Skript-Parsing anstoßen
window.translationsPromise = window.loadTranslations();
