/**
 * chimera-jodel-sandbox.js
 * ---------------------------------------------------------------------------
 * Entkoppelte Admin-Testkomponente (`ChimeraJodelSandbox`) für den isolierten
 * Prototyp der Chimera WASM-Jodel-Engine.
 *
 * Minimalistischer 1-Bit / Schwarz-Weiß-Stil passend zum Teenage-Engineering-Look.
 * Mountet sich eigenständig in `#chimera-jodel-sandbox-root` ohne die regulären
 * Audio-Engines (`Classic` / `Warm Paper`) oder öffentliche Seiten zu berühren.
 * ---------------------------------------------------------------------------
 */

(function(root) {
    'use strict';

    let mountedContainer = null;
    let contextProvider = null;
    let isAlphaEnabled = false;
    let isInitializing = false;
    let voiceCharValue = 0.25;     // 0.0 (tief männlich) .. 1.0 (hell weiblich)
    let jumpIntensityValue = 0.70; // 0.0 .. 1.0 (Schwelle & Sprungintervall)
    let unsubscribeTelemetry = null;

    function renderUI(container) {
        container.innerHTML = `
            <div class="mt-3 p-3 rounded border border-neutral-700 bg-black font-mono text-xs text-neutral-200 select-none">
                <!-- Header + Alpha On/Off Toggle -->
                <div class="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-neutral-800">
                    <div class="flex items-center gap-2">
                        <span class="inline-block w-2 h-2 bg-white"></span>
                        <span class="uppercase tracking-wider font-bold text-[11px] text-white">Chimera Vocal Synth [WASM · Physical Modeling]</span>
                    </div>

                    <button type="button" id="btn-chimera-alpha-toggle"
                        class="px-2.5 py-1 text-[11px] border border-neutral-500 bg-black text-neutral-300 hover:text-white hover:border-white transition-colors cursor-pointer">
                        Chimera Jodel [Alpha]: AUS
                    </button>
                </div>

                <!-- Controls (sichtbar wenn Alpha-Toggle EIN) -->
                <div id="chimera-sandbox-body" class="hidden pt-3 space-y-3">
                    <!-- Action Buttons -->
                    <div class="flex flex-wrap items-center gap-2">
                        <button type="button" id="btn-chimera-test-yodel"
                            class="px-3 py-1.5 bg-white text-black font-bold text-[11px] border border-white hover:bg-neutral-200 transition-colors cursor-pointer active:scale-[0.98]">
                            ▶ Test-Jodel abspielen
                        </button>
                        <button type="button" id="btn-chimera-skyline-yodel"
                            class="px-3 py-1.5 bg-black text-white font-semibold text-[11px] border border-neutral-400 hover:border-white hover:bg-neutral-900 transition-colors cursor-pointer active:scale-[0.98]">
                            ⛰ Berg-Kontur jodeln
                        </button>
                        <button type="button" id="btn-chimera-stop"
                            class="px-3 py-1.5 bg-black text-neutral-300 text-[11px] border border-neutral-700 hover:border-white hover:text-white transition-colors cursor-pointer active:scale-[0.98]">
                            ⏹ Stop
                        </button>
                    </div>

                    <!-- Parameter Regler -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <!-- Regler 1: Stimmcharakter -->
                        <div class="p-2.5 border border-neutral-800 bg-neutral-950 space-y-1.5">
                            <div class="flex items-center justify-between text-[11px]">
                                <span class="text-neutral-400 uppercase tracking-wide text-[10px]">Stimmcharakter</span>
                                <span id="lbl-chimera-voice-char" class="text-white font-bold">25% (Bariton)</span>
                            </div>
                            <input type="range" id="range-chimera-voice-char" min="0" max="1" step="0.01" value="${voiceCharValue}"
                                class="w-full accent-white bg-neutral-800 h-1 cursor-pointer">
                            <div class="flex justify-between text-[9px] text-neutral-500">
                                <span>Männlich (tief)</span>
                                <span>Weiblich (hell)</span>
                            </div>
                        </div>

                        <!-- Regler 2: Jodel-Sprung-Intensität -->
                        <div class="p-2.5 border border-neutral-800 bg-neutral-950 space-y-1.5">
                            <div class="flex items-center justify-between text-[11px]">
                                <span class="text-neutral-400 uppercase tracking-wide text-[10px]">Jodel-Sprung-Intensität</span>
                                <span id="lbl-chimera-jump-int" class="text-white font-bold">70%</span>
                            </div>
                            <input type="range" id="range-chimera-jump-int" min="0" max="1" step="0.05" value="${jumpIntensityValue}"
                                class="w-full accent-white bg-neutral-800 h-1 cursor-pointer">
                            <div class="flex justify-between text-[9px] text-neutral-500">
                                <span>Nur Steilwände</span>
                                <span>Häufige Registerbrüche</span>
                            </div>
                        </div>
                    </div>

                    <!-- Telemetrie & Statusleiste -->
                    <div class="px-2.5 py-2 border border-neutral-800 bg-neutral-950 flex flex-wrap items-center justify-between gap-2 text-[10px] text-neutral-400">
                        <div class="flex items-center gap-3">
                            <span id="chimera-status-text" class="text-neutral-200">Status: Bereit</span>
                            <span id="chimera-active-vowel" class="text-neutral-400">Silbe: –</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <span id="chimera-f0-readout">F0: – Hz</span>
                            <span id="chimera-cpu-readout">CPU: – %</span>
                            <span id="chimera-rate-readout">Rate: –</span>
                        </div>
                    </div>

                    <div id="chimera-error-banner" class="hidden p-2 border border-white bg-neutral-900 text-white text-[11px]"></div>
                </div>
            </div>
        `;
    }

    function updateVoiceLabel(val) {
        const el = document.getElementById('lbl-chimera-voice-char');
        if (!el) return;
        const pct = Math.round(val * 100);
        let desc = 'Neutral';
        if (pct < 20) desc = 'Bass/Bariton';
        else if (pct < 45) desc = 'Tenor/Alt';
        else if (pct < 75) desc = 'Mezzo';
        else desc = 'Sopran';
        el.innerText = `${pct}% (${desc})`;
    }

    function updateJumpLabel(val) {
        const el = document.getElementById('lbl-chimera-jump-int');
        if (!el) return;
        el.innerText = `${Math.round(val * 100)}%`;
    }

    function showError(msg) {
        const banner = document.getElementById('chimera-error-banner');
        if (!banner) return;
        if (!msg) {
            banner.classList.add('hidden');
            banner.innerText = '';
        } else {
            banner.classList.remove('hidden');
            banner.innerText = `HINWEIS: ${msg}`;
        }
    }

    function setStatus(text) {
        const el = document.getElementById('chimera-status-text');
        if (el) el.innerText = `Status: ${text}`;
    }

    function updateTelemetryDisplay(t) {
        if (!t) return;
        if (t.error) {
            showError(t.error);
            return;
        }
        const f0El = document.getElementById('chimera-f0-readout');
        const cpuEl = document.getElementById('chimera-cpu-readout');
        const rateEl = document.getElementById('chimera-rate-readout');
        if (f0El) f0El.innerText = `F0: ${t.f0Hz || 0} Hz`;
        if (cpuEl) cpuEl.innerText = `CPU: ${t.loadPct || 0}%`;
        if (rateEl) rateEl.innerText = `${Math.round((t.sampleRate || 48000) / 1000)}kHz · ~${t.latencyMs || 0}ms`;
    }

    async function handleToggleAlpha() {
        const btn = document.getElementById('btn-chimera-alpha-toggle');
        const body = document.getElementById('chimera-sandbox-body');
        if (!btn || !body || isInitializing) return;

        if (!isAlphaEnabled) {
            isInitializing = true;
            btn.innerText = 'Chimera Jodel [Alpha]: LÄDT WASM...';
            showError('');
            try {
                if (!root.ChimeraJodelBridge) {
                    throw new Error("ChimeraJodelBridge nicht geladen.");
                }
                await root.ChimeraJodelBridge.init();
                root.ChimeraJodelBridge.setVoiceCharacter(voiceCharValue);

                if (!unsubscribeTelemetry) {
                    unsubscribeTelemetry = root.ChimeraJodelBridge.onTelemetry(updateTelemetryDisplay);
                }

                isAlphaEnabled = true;
                body.classList.remove('hidden');
                btn.className = 'px-2.5 py-1 text-[11px] border border-white bg-white text-black font-bold transition-colors cursor-pointer';
                btn.innerText = 'Chimera Jodel [Alpha]: EIN';
                const status = root.ChimeraJodelBridge.getStatus();
                setStatus(`Bereit (${Math.round(status.sampleRate / 1000)} kHz Worklet)`);
            } catch (err) {
                isAlphaEnabled = false;
                body.classList.remove('hidden'); // Zeige Fehlerbanner sichtbar an
                btn.className = 'px-2.5 py-1 text-[11px] border border-neutral-500 bg-black text-neutral-300 transition-colors cursor-pointer';
                btn.innerText = 'Chimera Jodel [Alpha]: FEHLER';
                showError(err.message);
                setStatus('Nicht verfügbar');
            } finally {
                isInitializing = false;
            }
        } else {
            isAlphaEnabled = false;
            if (root.ChimeraJodelBridge) {
                await root.ChimeraJodelBridge.dispose();
            }
            if (unsubscribeTelemetry) {
                unsubscribeTelemetry();
                unsubscribeTelemetry = null;
            }
            if (contextProvider && typeof contextProvider.onClearPlayhead === 'function') {
                contextProvider.onClearPlayhead();
            }
            body.classList.add('hidden');
            btn.className = 'px-2.5 py-1 text-[11px] border border-neutral-500 bg-black text-neutral-300 hover:text-white hover:border-white transition-colors cursor-pointer';
            btn.innerText = 'Chimera Jodel [Alpha]: AUS';
            setStatus('Deaktiviert');
        }
    }

    async function handlePlayTestJodel() {
        if (!root.ChimeraJodelBridge) return;
        showError('');
        try {
            if (contextProvider && typeof contextProvider.stopOtherEngines === 'function') {
                contextProvider.stopOtherEngines();
            }
            setStatus('Spielt Smoke-Test ("Jo-dl-i-o-hi-du")...');
            await root.ChimeraJodelBridge.playTestJodel(
                {
                    voiceCharacter: voiceCharValue,
                    jumpIntensity: jumpIntensityValue
                },
                {
                    onStep: (info) => {
                        const el = document.getElementById('chimera-active-vowel');
                        if (el) el.innerText = `Silbe: ${info.label}`;
                    },
                    onComplete: () => {
                        setStatus('Bereit');
                        const el = document.getElementById('chimera-active-vowel');
                        if (el) el.innerText = 'Silbe: –';
                    }
                }
            );
        } catch (err) {
            showError(err.message);
            setStatus('Fehler');
        }
    }

    async function handlePlaySkylineJodel() {
        if (!root.ChimeraJodelBridge) return;
        showError('');

        if (!contextProvider || typeof contextProvider.getSkylineContext !== 'function') {
            showError("Keine Panorama-Konturdaten im Editor verfügbar.");
            return;
        }

        const ctxData = contextProvider.getSkylineContext();
        if (!ctxData || !ctxData.daten || !Array.isArray(ctxData.daten.kurve_y) || ctxData.daten.kurve_y.length === 0) {
            showError("Bitte zuerst ein Panorama-Bild laden oder scannen.");
            return;
        }

        try {
            if (contextProvider && typeof contextProvider.stopOtherEngines === 'function') {
                contextProvider.stopOtherEngines();
            }
            setStatus('Berechne Berg-Kontur-Jodler...');
            await root.ChimeraJodelBridge.playSkylineJodel(
                ctxData.daten,
                ctxData.synthSettings || {},
                {
                    voiceCharacter: voiceCharValue,
                    jumpIntensity: jumpIntensityValue
                },
                {
                    onStep: (info) => {
                        const el = document.getElementById('chimera-active-vowel');
                        const reg = info.isFalsetto ? 'Falsett' : 'Brust';
                        if (el) {
                            el.innerText = `/${info.vowel}/ [${reg}] · Portamento ${info.rampInMs}ms (${info.stepIndex + 1}/${info.totalSteps})`;
                        }
                        if (contextProvider && typeof contextProvider.onPlayhead === 'function' && info.point) {
                            contextProvider.onPlayhead(info.point.x);
                        }
                    },
                    onComplete: () => {
                        setStatus('Bereit');
                        const el = document.getElementById('chimera-active-vowel');
                        if (el) el.innerText = 'Silbe: –';
                        if (contextProvider && typeof contextProvider.onClearPlayhead === 'function') {
                            contextProvider.onClearPlayhead();
                        }
                    }
                }
            );
            setStatus('Spielt Berg-Kontur...');
        } catch (err) {
            showError(err.message);
            setStatus('Fehler');
        }
    }

    function handleStop() {
        if (root.ChimeraJodelBridge) {
            root.ChimeraJodelBridge.stop();
        }
        setStatus('Gestoppt');
        const el = document.getElementById('chimera-active-vowel');
        if (el) el.innerText = 'Silbe: –';
        if (contextProvider && typeof contextProvider.onClearPlayhead === 'function') {
            contextProvider.onClearPlayhead();
        }
    }

    /**
     * Mountet die Sandbox-UI in den angegebenen Container.
     * @param {string|HTMLElement} target - Element oder ID
     * @param {Object} provider - { getSkylineContext, onPlayhead, onClearPlayhead, stopOtherEngines }
     */
    function mount(target, provider) {
        const el = (typeof target === 'string') ? document.getElementById(target) : target;
        if (!el) return;

        mountedContainer = el;
        contextProvider = provider || null;
        renderUI(mountedContainer);

        const btnToggle = document.getElementById('btn-chimera-alpha-toggle');
        const btnTest = document.getElementById('btn-chimera-test-yodel');
        const btnSkyline = document.getElementById('btn-chimera-skyline-yodel');
        const btnStop = document.getElementById('btn-chimera-stop');
        const rangeVoice = document.getElementById('range-chimera-voice-char');
        const rangeJump = document.getElementById('range-chimera-jump-int');

        if (btnToggle) btnToggle.addEventListener('click', handleToggleAlpha);
        if (btnTest) btnTest.addEventListener('click', handlePlayTestJodel);
        if (btnSkyline) btnSkyline.addEventListener('click', handlePlaySkylineJodel);
        if (btnStop) btnStop.addEventListener('click', handleStop);

        if (rangeVoice) {
            rangeVoice.addEventListener('input', (e) => {
                voiceCharValue = parseFloat(e.target.value) || 0;
                updateVoiceLabel(voiceCharValue);
                if (root.ChimeraJodelBridge) {
                    root.ChimeraJodelBridge.setVoiceCharacter(voiceCharValue);
                }
            });
        }

        if (rangeJump) {
            rangeJump.addEventListener('input', (e) => {
                jumpIntensityValue = parseFloat(e.target.value) || 0;
                updateJumpLabel(jumpIntensityValue);
            });
        }

        updateVoiceLabel(voiceCharValue);
        updateJumpLabel(jumpIntensityValue);
    }

    function stopIfActive() {
        if (isAlphaEnabled && root.ChimeraJodelBridge) {
            root.ChimeraJodelBridge.stop();
            setStatus('Bereit');
        }
    }

    root.ChimeraJodelSandbox = {
        mount,
        stop: stopIfActive
    };

})(typeof window !== 'undefined' ? window : this);
