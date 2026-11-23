#!/usr/bin/env bash
# Rebuilds the isolated Chimera WASM binary and AudioWorklet bundle from source.
# Prerequisites: rustc + cargo with wasm32-unknown-unknown target, and bun.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UPSTREAM_DIR="$SCRIPT_DIR/chimera-vocal-synth"
DIST_DIR="$SCRIPT_DIR/dist"

export PATH="$HOME/.cargo/bin:$HOME/.bun/bin:$PATH"

if [ ! -d "$UPSTREAM_DIR" ]; then
    echo "Cloning jamesondh/chimera-vocal-synth..."
    git clone --depth 1 https://github.com/jamesondh/chimera-vocal-synth.git "$UPSTREAM_DIR"
fi

echo "Building chimera-wasm (wasm32-unknown-unknown release)..."
(cd "$UPSTREAM_DIR" && cargo build -p chimera-wasm --release --target wasm32-unknown-unknown)

mkdir -p "$DIST_DIR"
cp "$UPSTREAM_DIR/target/wasm32-unknown-unknown/release/chimera_wasm.wasm" "$DIST_DIR/chimera.wasm"

echo "Bundling AudioWorklet processor..."
bun build "$UPSTREAM_DIR/src/worklet/processor.ts" \
    --outfile "$DIST_DIR/chimera-worklet.js" \
    --target browser \
    --format esm

echo "Bundling React-free Anatomy Renderer..."
bun run "$SCRIPT_DIR/build-anatomy.ts"

echo "Done:"
ls -lh "$DIST_DIR/chimera.wasm" "$DIST_DIR/chimera-worklet.js" "$DIST_DIR/chimera-anatomy.js"
