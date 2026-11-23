/**
 * Standalone React-free entry point for Chimera's 2D midsagittal vocal-tract
 * vector renderer (AnatomyRenderer + VoiceModel + Glow).
 * Bundled via build-anatomy.ts into dist/chimera-anatomy.js for vanilla JS usage.
 */
import { initChimera } from "./chimera-vocal-synth/src/wasm/chimera.ts";

let engineModPromise: Promise<{
    VoiceModel: typeof import("./chimera-vocal-synth/src/ui/analysis.ts").VoiceModel;
    AnatomyRenderer: typeof import("./chimera-vocal-synth/src/ui/render/anatomy.ts").AnatomyRenderer;
    Glow: typeof import("./chimera-vocal-synth/src/ui/render/vector.ts").Glow;
    NEUTRAL: typeof import("./chimera-vocal-synth/src/wasm/engine.ts").NEUTRAL;
}> | null = null;

async function loadModules(wasmSource: BufferSource | string) {
    await initChimera(wasmSource);
    if (!engineModPromise) {
        engineModPromise = (async () => {
            const [analysis, anatomy, vector, engine] = await Promise.all([
                import("./chimera-vocal-synth/src/ui/analysis.ts"),
                import("./chimera-vocal-synth/src/ui/render/anatomy.ts"),
                import("./chimera-vocal-synth/src/ui/render/vector.ts"),
                import("./chimera-vocal-synth/src/wasm/engine.ts"),
            ]);
            return {
                VoiceModel: analysis.VoiceModel,
                AnatomyRenderer: anatomy.AnatomyRenderer,
                Glow: vector.Glow,
                NEUTRAL: engine.NEUTRAL,
            };
        })();
    }
    return engineModPromise;
}

export interface AnatomyController {
    resize: () => void;
    destroy: () => void;
}

export async function mountAnatomyCanvas(
    canvas: HTMLCanvasElement,
    wasmSource: BufferSource | string,
    getState: () => {
        telemetry: any | null;
        body: { female: number; child: number };
        sampleRate: number;
        syllableLabel?: string;
    }
): Promise<AnatomyController> {
    const { VoiceModel, AnatomyRenderer, Glow, NEUTRAL } = await loadModules(wasmSource);

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D Canvas Context nicht verfügbar.");

    const renderer = new AnatomyRenderer();
    const glow = new Glow();

    let currentBody = getState().body || { female: 0.25, child: 0 };
    let currentRate = getState().sampleRate || 48000;
    let model = new VoiceModel(currentBody, currentRate);

    let w = 0;
    let h = 0;
    let dpr = 1;
    let destroyed = false;
    let rafId = 0;
    let lastNow = performance.now();
    let fTick = 0;
    let formants: number[] = [];

    const fit = () => {
        const rect = canvas.getBoundingClientRect();
        dpr = Math.min(2, window.devicePixelRatio || 1);
        w = Math.max(120, rect.width || canvas.clientWidth || 320);
        h = Math.max(120, rect.height || canvas.clientHeight || 240);
        canvas.width = Math.max(1, Math.round(w * dpr));
        canvas.height = Math.max(1, Math.round(h * dpr));
        renderer.resize(w, h);
    };

    fit();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(fit);
        ro.observe(canvas);
    }

    const loop = (now: number) => {
        if (destroyed) return;
        const dt = Math.min(0.05, (now - lastNow) / 1000);
        const elapsed = Math.min(0.5, (now - lastNow) / 1000);
        lastNow = now;

        const st = getState();
        const b = st.body || { female: 0.25, child: 0 };
        const sr = st.sampleRate || 48000;
        if (Math.abs(b.female - currentBody.female) > 0.01 || Math.abs(b.child - currentBody.child) > 0.01 || sr !== currentRate) {
            try { model.dispose(); } catch (_) {}
            currentBody = { ...b };
            currentRate = sr;
            model = new VoiceModel(currentBody, currentRate);
            formants = [];
        }

        const tele = st.telemetry || null;
        const artic = (tele && tele.t && tele.t.artic)
            ? VoiceModel.articFromArray(tele.t.artic)
            : NEUTRAL;

        renderer.face.update(tele, elapsed);

        if (w > 0 && h > 0) {
            const frame = model.frame(artic);
            if (++fTick % 4 === 0 || formants.length === 0) {
                formants = model.transfer(artic).formants;
            }

            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalCompositeOperation = "source-over";
            ctx.fillStyle = "#000000";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            const info: string[] = [];
            if (tele && tele.t && tele.t.f0 > 30) {
                info.push(`F0 ${tele.t.f0.toFixed(1)} HZ`);
            }
            if (st.syllableLabel) {
                info.push(st.syllableLabel.toUpperCase());
            }

            renderer.draw(ctx, model, frame, artic, tele, {
                pressure: true,
                particles: true,
                grid: true,
                calipers: false
            }, {
                hover: null,
                drag: null,
                dt,
                formants,
                slots: [],
                info
            });

            glow.apply(canvas, ctx, dpr);
        }

        rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return {
        resize: fit,
        destroy: () => {
            destroyed = true;
            if (rafId) cancelAnimationFrame(rafId);
            if (ro) ro.disconnect();
            try { model.dispose(); } catch (_) {}
        }
    };
}

if (typeof window !== "undefined") {
    (window as any).ChimeraAnatomy = { mountAnatomyCanvas };
}
