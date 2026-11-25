/**
 * Standalone React-free entry point for Chimera's 2D midsagittal vocal-tract
 * vector renderer (AnatomyRenderer + VoiceModel + Glow).
 * Supports both Solo view and Choir Grid view (one face per peak/valley chord voice).
 * Bundled via build-anatomy.ts into dist/chimera-anatomy.js for vanilla JS usage.
 */
import { initChimera } from "./chimera-vocal-synth/src/wasm/chimera.ts";
import type { HumanArtic } from "./chimera-vocal-synth/src/wasm/types.ts";

let engineModPromise: Promise<{
    VoiceModel: typeof import("./chimera-vocal-synth/src/ui/analysis.ts").VoiceModel;
    AnatomyRenderer: typeof import("./chimera-vocal-synth/src/ui/render/anatomy.ts").AnatomyRenderer;
    Glow: typeof import("./chimera-vocal-synth/src/ui/render/vector.ts").Glow;
    NEUTRAL: typeof import("./chimera-vocal-synth/src/wasm/engine.ts").NEUTRAL;
    VOWEL_TARGETS: typeof import("./chimera-vocal-synth/src/wasm/engine.ts").VOWEL_TARGETS;
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
                VOWEL_TARGETS: engine.VOWEL_TARGETS,
            };
        })();
    }
    return engineModPromise;
}

export interface AnatomyFaceInput {
    telemetry?: any | null;
    body?: { female: number; child: number };
    sampleRate?: number;
    syllableLabel?: string;
    vowel?: string;
    playing?: boolean;
    kind?: string;
    f0Hz?: number;
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
        faces?: AnatomyFaceInput[];
    }
): Promise<AnatomyController> {
    const { VoiceModel, AnatomyRenderer, Glow, NEUTRAL, VOWEL_TARGETS } = await loadModules(wasmSource);

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D Canvas Context nicht verfügbar.");

    const glow = new Glow();

    type FaceSlot = {
        renderer: InstanceType<typeof AnatomyRenderer>;
        model: InstanceType<typeof VoiceModel>;
        body: { female: number; child: number };
        sampleRate: number;
        fTick: number;
        formants: number[];
        lastCellW: number;
        lastCellH: number;
    };

    const slots: FaceSlot[] = [];

    function createSlot(body: { female: number; child: number }, sampleRate: number): FaceSlot {
        return {
            renderer: new AnatomyRenderer(),
            model: new VoiceModel(body, sampleRate),
            body: { ...body },
            sampleRate,
            fTick: 0,
            formants: [],
            lastCellW: 0,
            lastCellH: 0,
        };
    }

    function ensureSlotCount(count: number, defaultBody: { female: number; child: number }, defaultRate: number) {
        while (slots.length < count) {
            slots.push(createSlot(defaultBody, defaultRate));
        }
        while (slots.length > count) {
            const removed = slots.pop();
            if (removed) {
                try { removed.model.dispose(); } catch (_) {}
            }
        }
    }

    let w = 0;
    let h = 0;
    let dpr = 1;
    let destroyed = false;
    let rafId = 0;
    let lastNow = performance.now();

    const fit = () => {
        const rect = canvas.getBoundingClientRect();
        dpr = Math.min(2, window.devicePixelRatio || 1);
        w = Math.max(120, rect.width || canvas.clientWidth || 320);
        h = Math.max(120, rect.height || canvas.clientHeight || 240);
        canvas.width = Math.max(1, Math.round(w * dpr));
        canvas.height = Math.max(1, Math.round(h * dpr));
        for (const s of slots) {
            s.lastCellW = 0;
            s.lastCellH = 0;
        }
    };

    fit();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(fit);
        ro.observe(canvas);
    }

    function buildPoseArtic(face: AnatomyFaceInput, nowSec: number, idx: number): HumanArtic {
        if (face.telemetry && face.telemetry.t && face.telemetry.t.artic) {
            return VoiceModel.articFromArray(face.telemetry.t.artic);
        }
        const vKey = face.vowel && VOWEL_TARGETS && VOWEL_TARGETS.male && VOWEL_TARGETS.male[face.vowel]
            ? face.vowel
            : (face.kind === "peak" ? "i" : "o");
        const target = VOWEL_TARGETS?.male?.[vKey]?.artic;
        if (!target) return NEUTRAL;
        const vib = face.playing ? Math.sin(nowSec * 38 + idx * 1.7) * 0.08 : 0;
        return {
            ...NEUTRAL,
            ...target,
            jaw: Math.max(0, (target.jaw ?? NEUTRAL.jaw) + vib * 0.4),
            larynx: (target.larynx ?? NEUTRAL.larynx) + vib,
        };
    }

    const loop = (now: number) => {
        if (destroyed) return;
        const dt = Math.min(0.05, (now - lastNow) / 1000);
        const elapsed = Math.min(0.5, (now - lastNow) / 1000);
        lastNow = now;

        const st = getState() || { telemetry: null, body: { female: 0.25, child: 0 }, sampleRate: 48000 };
        const defaultBody = st.body || { female: 0.25, child: 0 };
        const defaultRate = st.sampleRate || 48000;

        const faceList: AnatomyFaceInput[] = (Array.isArray(st.faces) && st.faces.length > 0)
            ? st.faces.slice(0, 8)
            : [{
                telemetry: st.telemetry || null,
                body: defaultBody,
                sampleRate: defaultRate,
                syllableLabel: st.syllableLabel,
            }];

        ensureSlotCount(faceList.length, defaultBody, defaultRate);

        if (w > 0 && h > 0) {
            const n = faceList.length;
            const cols = n <= 1 ? 1 : (n <= 4 ? 2 : (n <= 6 ? 3 : 4));
            const rows = Math.ceil(n / cols);
            const cellW = w / cols;
            const cellH = h / rows;

            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalCompositeOperation = "source-over";
            ctx.fillStyle = "#000000";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const nowSec = now / 1000;

            for (let i = 0; i < n; i++) {
                const face = faceList[i];
                const slot = slots[i];
                const b = face.body || defaultBody;
                const sr = face.sampleRate || defaultRate;

                if (
                    Math.abs(b.female - slot.body.female) > 0.01 ||
                    Math.abs(b.child - slot.body.child) > 0.01 ||
                    sr !== slot.sampleRate
                ) {
                    try { slot.model.dispose(); } catch (_) {}
                    slot.body = { ...b };
                    slot.sampleRate = sr;
                    slot.model = new VoiceModel(slot.body, slot.sampleRate);
                    slot.formants = [];
                }

                if (Math.abs(slot.lastCellW - cellW) > 0.5 || Math.abs(slot.lastCellH - cellH) > 0.5) {
                    slot.renderer.resize(cellW, cellH);
                    slot.lastCellW = cellW;
                    slot.lastCellH = cellH;
                }

                const rawTele = face.telemetry || null;
                const tele = (rawTele && rawTele.t && Array.isArray(rawTele.t.pressureRms)) ? rawTele : null;
                const artic = buildPoseArtic({ ...face, telemetry: rawTele }, nowSec, i);
                slot.renderer.face.update(tele, elapsed);

                const frame = slot.model.frame(artic);
                if (++slot.fTick % 4 === 0 || slot.formants.length === 0) {
                    slot.formants = slot.model.transfer(artic).formants;
                }

                const col = i % cols;
                const row = Math.floor(i / cols);
                const xOff = col * cellW;
                const yOff = row * cellH;

                const info: string[] = [];
                const f0Val = (tele && tele.t && tele.t.f0 > 30) ? tele.t.f0 : (face.f0Hz || 0);
                if (f0Val > 30) {
                    info.push(n > 1 ? `#${i + 1} ${Math.round(f0Val)}HZ` : `F0 ${f0Val.toFixed(1)} HZ`);
                } else if (n > 1) {
                    info.push(`#${i + 1}`);
                }
                if (face.syllableLabel) {
                    info.push(face.syllableLabel.toUpperCase());
                }

                ctx.save();
                ctx.setTransform(dpr, 0, 0, dpr, xOff * dpr, yOff * dpr);
                ctx.beginPath();
                ctx.rect(0, 0, cellW, cellH);
                ctx.clip();

                slot.renderer.draw(
                    ctx,
                    slot.model,
                    frame,
                    artic,
                    tele,
                    {
                        pressure: true,
                        particles: n <= 4,
                        grid: n <= 2,
                        calipers: false,
                    },
                    {
                        hover: null,
                        drag: null,
                        dt,
                        formants: slot.formants,
                        slots: [],
                        info,
                    }
                );

                if (n > 1) {
                    ctx.strokeStyle = face.playing ? "rgba(255, 102, 0, 0.5)" : "rgba(255, 255, 255, 0.14)";
                    ctx.lineWidth = 1;
                    ctx.strokeRect(0.5, 0.5, cellW - 1, cellH - 1);
                }

                ctx.restore();
            }

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
            while (slots.length > 0) {
                const s = slots.pop();
                if (s) {
                    try { s.model.dispose(); } catch (_) {}
                }
            }
        }
    };
}

if (typeof window !== "undefined") {
    (window as any).ChimeraAnatomy = { mountAnatomyCanvas };
}
