// relief.js - Relief Scanner Logic

window.reliefState = 0; // 0: IDLE, 1: SELECT_START, 2: SELECT_END, 3: CONFIRM_LINE, 4: LOADING_API
let reliefStart = null;
let reliefEnd = null;
let reliefStartMarker = null;
let reliefEndMarker = null;
let reliefLine = null;
let reliefMapClickListener = null;

window.startReliefScan = function() {
    console.log("Starting Relief Scan...");

    // Clear previous state
    window.cancelReliefScan(true);

    window.reliefState = 1;

    // Update UI
    const t = (typeof text !== 'undefined' && text[window.currentLang]) ? text[window.currentLang] : text['de'];
    const banner = document.getElementById('relief-guidance-banner');
    const bannerText = document.getElementById('relief-guidance-text');
    const mapContainer = document.getElementById('map');
    const overlayMenu = document.getElementById('relief-overlay-menu');

    overlayMenu.style.display = 'none';
    banner.style.display = 'block';
    bannerText.innerText = t.guidance_start || "Startpunkt platzieren";
    mapContainer.classList.add('cursor-crosshair');

    // Disable other map interactions slightly (e.g. pointer events on other markers)
    const otherMarkers = document.querySelectorAll('.leaflet-marker-icon:not(.relief-marker-start):not(.relief-marker-end)');
    otherMarkers.forEach(m => m.style.pointerEvents = 'none');

    // Add map click listener
    if (!reliefMapClickListener) {
        reliefMapClickListener = function(e) {
            window.handleReliefMapClick(e);
        };
        if(window.map && window.map.on) { window.map.on('click', reliefMapClickListener); }
    }
};

window.handleReliefMapClick = function(e) {
    if (window.reliefState === 1) {
        // SELECT_START
        reliefStart = e.latlng;

        // Add start marker
        const startIcon = L.divIcon({
            className: 'relief-marker-start',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
        reliefStartMarker = L.marker(reliefStart, { icon: startIcon });
        try { reliefStartMarker.addTo(window.map); } catch(e) {}

        // Transition to state 2
        window.reliefState = 2;

        // Update UI
        const t = (typeof text !== 'undefined' && text[window.currentLang]) ? text[window.currentLang] : text['de'];
        const bannerText = document.getElementById('relief-guidance-text');
        bannerText.innerText = t.guidance_end || "Zielpunkt setzen";

    } else if (window.reliefState === 2) {
        // SELECT_END
        reliefEnd = e.latlng;

        // Add end marker
        const endIcon = L.divIcon({
            className: 'relief-marker-end',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
        reliefEndMarker = L.marker(reliefEnd, { icon: endIcon });
        try { reliefEndMarker.addTo(window.map); } catch(e) {}

        // Draw polyline
        reliefLine = L.polyline([reliefStart, reliefEnd], {
            color: '#FF6600',
            weight: 4,
            className: 'relief-polyline'
        });
        try { reliefLine.addTo(window.map); } catch(e) {}

        // Remove map click listener
        if (reliefMapClickListener) {
            if(window.map && window.map.off) { window.map.off('click', reliefMapClickListener); }
            reliefMapClickListener = null;
        }

        // Transition to state 3
        window.reliefState = 3;

        // Update UI
        const banner = document.getElementById('relief-guidance-banner');
        const overlayMenu = document.getElementById('relief-overlay-menu');
        const mapContainer = document.getElementById('map');

        banner.style.display = 'none';
        mapContainer.classList.remove('cursor-crosshair');

        // Restore marker pointer events
        const otherMarkers = document.querySelectorAll('.leaflet-marker-icon');
        otherMarkers.forEach(m => m.style.pointerEvents = 'auto');

        // Setup overlay menu texts
        const t = (typeof text !== 'undefined' && text[window.currentLang]) ? text[window.currentLang] : text['de'];
        document.getElementById('btn-relief-query').innerText = t.btn_relief_query || "Relief abfragen";
        document.getElementById('btn-relief-reselect').innerText = t.btn_relief_reselect || "Neu selektieren";
        document.getElementById('btn-relief-cancel').innerText = t.btn_relief_cancel || "Abbrechen";

        // Show overlay menu
        overlayMenu.style.display = 'flex';
    }
}

window.cancelReliefScan = function(internal = false) {
    window.reliefState = 0;

    // Hide UI
    document.getElementById('relief-guidance-banner').style.display = 'none';
    document.getElementById('relief-overlay-menu').style.display = 'none';
    document.getElementById('map').classList.remove('cursor-crosshair');

    // Reset button text just in case
    const t = (typeof text !== 'undefined' && text[window.currentLang]) ? text[window.currentLang] : text['de'];
    document.getElementById('btn-relief-query').innerText = t.btn_relief_query || "Relief abfragen";

    // Remove markers and line
    if (reliefStartMarker && window.map) window.map.removeLayer(reliefStartMarker);
    if (reliefEndMarker && window.map) window.map.removeLayer(reliefEndMarker);
    if (reliefLine && window.map) window.map.removeLayer(reliefLine);

    reliefStart = null;
    reliefEnd = null;
    reliefStartMarker = null;
    reliefEndMarker = null;
    reliefLine = null;

    // Remove map click listener
    if (reliefMapClickListener && window.map) {
        if(window.map && window.map.off) { window.map.off('click', reliefMapClickListener); }
        reliefMapClickListener = null;
    }

    // Restore marker pointer events
    const otherMarkers = document.querySelectorAll('.leaflet-marker-icon');
    otherMarkers.forEach(m => m.style.pointerEvents = 'auto');

    if (!internal) {
        console.log("Relief Scan cancelled.");
    }
};

window.confirmReliefLine = function() {
    if (window.reliefState !== 3 || !reliefStart || !reliefEnd) return;

    window.reliefState = 4;

    // Update UI (Loading)
    const t = (typeof text !== 'undefined' && text[window.currentLang]) ? text[window.currentLang] : text['de'];
    const queryBtn = document.getElementById('btn-relief-query');
    queryBtn.innerText = t.relief_loading || "[ * ANALYSIERE... ]";

    // API Call
    // https://api3.geo.admin.ch/rest/services/profile.json?geom={"type":"LineString","coordinates":[[lon1,lat1],[lon2,lat2]]}&sr=4326&nb_points=300

    const lon1 = reliefStart.lng;
    const lat1 = reliefStart.lat;
    const lon2 = reliefEnd.lng;
    const lat2 = reliefEnd.lat;

    const geom = JSON.stringify({
        type: "LineString",
        coordinates: [[lon1, lat1], [lon2, lat2]]
    });

    const url = `https://api3.geo.admin.ch/rest/services/profile.json?geom=${encodeURIComponent(geom)}&sr=4326&nb_points=300`;

    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error("API Network response was not ok");
            return response.json();
        })
        .then(data => {
            console.log("Relief API Success:", data);

            // Transform Swisstopo data to the format expected by the app (array of {x, y})
            // Swisstopo profile.json returns an array of objects: { alts: { COMB: ... }, dist: ... }
            let profileArray = [];

            if (data && Array.isArray(data)) {
                // Swisstopo array format
                data.forEach(pt => {
                   if (pt.alts && typeof pt.alts.COMB !== 'undefined') {
                       profileArray.push({ y: pt.alts.COMB });
                   }
                });
            }

            if (profileArray.length === 0) {
                 throw new Error("No elevation data found in API response.");
            }

            // Normalize data to fit typical canvas height expectations or standard audio bounds
            // For now just pass the raw Y values, the UI/Audio logic usually normalizes it
            let yVals = profileArray.map(p => p.y);
            let minY = Math.min(...yVals);
            let maxY = Math.max(...yVals);

            let normalizedArray = profileArray.map(p => {
               // Normalizing typical height between 0 and a fixed height e.g., 400
               // (maxY - p.y) handles the inversion (0 is top in canvas)
               let h = maxY - minY;
               let norm = h === 0 ? 0 : (maxY - p.y) / h * 400;
               return { y: norm, rawY: p.y };
            });

            // Clean up state
            document.getElementById('relief-overlay-menu').style.display = 'none';
            window.reliefState = 0;

            // Create a fake panorama preset object
            const fakePano = {
                id: 'relief_' + Date.now(),
                titel: 'Relief Scan',
                datum: new Date().toLocaleDateString(),
                lat: (lat1 + lat2) / 2,
                lng: (lon1 + lon2) / 2,
                is_relief: true,
                // We'll store the data somewhere accessible, e.g., in a global cache
                kurve_y_array: JSON.stringify(normalizedArray)
            };

            // Add to cache
            if (!window.panoDataCache) {
                 window.panoDataCache = {};
            }
            window.panoDataCache[fakePano.id] = fakePano;

            // We set it as the active pano and open modal
            // Need to make sure openPanoModal works with this
            // We use a custom flag 'is_relief' to draw oscilloscope instead of image
            window.activePanoId = fakePano.id;

            if (window.openPanoModal) {
                 window.openPanoModal(fakePano);
            }

        })
        .catch(error => {
            console.error("Relief API Error:", error);
            alert("Fehler bei der Relief-Abfrage: " + error.message);
            // Reset button text
            queryBtn.innerText = t.btn_relief_query || "Relief abfragen";
            window.reliefState = 3;
        });
};

// Expose texts to lang script loading dynamically
document.addEventListener("DOMContentLoaded", function() {
    const t = (typeof text !== 'undefined' && text[window.currentLang]) ? text[window.currentLang] : {};
    const scanBtn = document.getElementById('btn-relief-scan');
    if(scanBtn && t.btn_relief_scan) {
        scanBtn.innerText = t.btn_relief_scan;
    }
});
