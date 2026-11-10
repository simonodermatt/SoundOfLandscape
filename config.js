// config.js - Supabase & Backend Konfiguration

// Supabase REST API Konfiguration
const SUPABASE_URL = "https://hdwbfkukcmrddrkrghiy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_rUM-8j5OTgPsKH3XtbD0VQ_cCFM39SO";

// Globale Bereitstellung auf window
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

// Legacy Fallbacks (für Rückwärtskompatibilität)
const API_URL = `${SUPABASE_URL}/rest/v1`;
const SHEET_ID = "10pxYaSMyt5uDRjCF0DWjGEabe_a3YftdpChxYzyQJBo"; 
const GOOGLE_API_KEY = "AIzaSyCamLxD7hZ5XEWhuXUljvnWeL_yzWy7KKQ";
