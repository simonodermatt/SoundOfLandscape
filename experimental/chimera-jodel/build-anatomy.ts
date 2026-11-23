import path from "path";

const res = await Bun.build({
    entrypoints: [path.resolve("experimental/chimera-jodel/anatomy-entry.ts")],
    outdir: path.resolve("experimental/chimera-jodel/dist"),
    naming: "chimera-anatomy.js",
    target: "browser",
    format: "iife",
    minify: true,
    plugins: [
        {
            name: "stub-wasm-url",
            setup(build) {
                build.onResolve({ filter: /\.wasm\?url$/ }, (args) => ({
                    path: args.path,
                    namespace: "wasm-url-stub",
                }));
                build.onLoad({ filter: /.*/, namespace: "wasm-url-stub" }, () => ({
                    contents: `export default "experimental/chimera-jodel/dist/chimera.wasm";`,
                    loader: "js",
                }));
            },
        },
    ],
});

if (!res.success) {
    console.error("Build failed:", res.logs);
    process.exit(1);
}
console.log("Built chimera-anatomy.js:", res.outputs.map(o => `${path.basename(o.path)} (${(o.size / 1024).toFixed(1)} KB)`));
