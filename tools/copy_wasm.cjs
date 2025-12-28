/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: TOOLS.NODE.ORT_WASM.COPY
   REGION: 🟣 MCP
   VERSION: 1.0.0

   Purpose:
   - Copies ONNX Runtime Web WASM binaries into /public/onnx/
   - Optional: copies Transformers.js WASM if present into /public/transformers/
   - Keeps your Vite/Capacitor builds deterministic + offline-friendly

   DISCOVERY_PIPELINE:
     Voice → Intent → Location → Vertical → Ranking → Render
   ============================================================================ */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

// ORT (onnxruntime-web) WASM source - try common install locations
const ortCandidates = [
  path.resolve(ROOT, "node_modules", "onnxruntime-web", "dist"),
  path.resolve(ROOT, "node_modules", "onnxruntime-web", "lib"),
  path.resolve(ROOT, "node_modules", "onnxruntime-web", "lib", "wasm"),
  path.resolve(ROOT, "node_modules", "onnxruntime-web", "dist", "wasm"),
];
let ortSrcDir = null;
for (const c of ortCandidates) {
  if (fs.existsSync(c)) {
    ortSrcDir = c;
    break;
  }
}
// ORT destination served statically
const ortDestDir = path.resolve(ROOT, "public", "onnx");

// Optional Transformers.js WASM (varies by version/build)
const xfmSrcCandidates = [
  path.resolve(ROOT, "node_modules", "@xenova", "transformers", "dist"),
  path.resolve(ROOT, "node_modules", "@xenova", "transformers", "dist", "wasm"),
  path.resolve(ROOT, "node_modules", "@xenova", "transformers", "dist", "ort"),
];
const xfmDestDir = path.resolve(ROOT, "public", "transformers");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyByExt(srcDir, destDir, exts) {
  if (!fs.existsSync(srcDir)) return { copied: 0, reason: `Missing: ${srcDir}` };

  ensureDir(destDir);

  const files = fs
    .readdirSync(srcDir)
    .filter((f) => exts.some((ext) => f.toLowerCase().endsWith(ext)));

  let copied = 0;
  for (const file of files) {
    const s = path.join(srcDir, file);
    const d = path.join(destDir, file);
    try {
      fs.copyFileSync(s, d);
      console.log(`[copy] ${path.relative(ROOT, s)} -> ${path.relative(ROOT, d)}`);
      copied += 1;
    } catch (err) {
      console.warn(`[copy] SKIP (error) ${path.relative(ROOT, s)} -> ${path.relative(ROOT, d)} : ${err.message}`);
    }
  }

  return { copied };
}

console.log("=== LEEWAY: Copy WASM Assets ===");

// 1) Copy ORT wasm
if (!ortSrcDir) {
  console.error("ORT source dir not found. Tried:", ortCandidates.join(', '));
  process.exit(1);
}
ensureDir(ortDestDir);

// Copy only .wasm and .mjs for ORT (ESM-only)
const ortResWasm = copyByExt(ortSrcDir, ortDestDir, [".wasm"]);
const ortResMjs  = copyByExt(ortSrcDir, ortDestDir, [".mjs"]);

// Remove all .js/.min.js from public/onnx (legacy/UMD cleanup)
const removeLegacyJs = (dir) => {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file.endsWith(".js") || file.endsWith(".min.js")) {
      const fpath = path.join(dir, file);
      try {
        fs.unlinkSync(fpath);
        console.log(`[clean] Removed legacy JS: ${path.relative(ROOT, fpath)}`);
      } catch (err) {
        console.warn(`[clean] Failed to remove: ${path.relative(ROOT, fpath)} : ${err.message}`);
      }
    }
  }
};
removeLegacyJs(ortDestDir);

if (ortResWasm.copied === 0) {
  console.warn("No ORT .wasm files found in", ortSrcDir);
}

console.log(
  `[ort] wasm=${ortResWasm.copied} mjs=${ortResMjs.copied} (no .js copied)`
);

// 2) Best-effort copy Transformers artifacts (if any)
let picked = null;
for (const cand of xfmSrcCandidates) {
  if (fs.existsSync(cand)) {
    picked = cand;
    break;
  }
}

if (picked) {
  const x1 = copyByExt(picked, xfmDestDir, [".wasm"]);
  const x2 = copyByExt(picked, xfmDestDir, [".json"]);
  console.log(`[xfm] src=${path.relative(ROOT, picked)} wasm=${x1.copied} json=${x2.copied}`);
} else {
  console.log("[xfm] No @xenova/transformers dist wasm directory found (ok).");
}

console.log("=== Done ===");
