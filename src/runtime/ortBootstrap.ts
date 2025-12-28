/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: AI.ORCHESTRATION.ORT.BOOTSTRAP
   REGION: 🧠 AI
   VERSION: 1.0.0
   ============================================================================
   Single-source ORT bootstrap (ESM only).
   Prevents mixed UMD/ESM runtime and TDZ init errors.
============================================================================ */

import * as ort from 'onnxruntime-web';

export async function getOrt() {
  // Determine BASE from Vite BASE_URL so published assets are resolved correctly.
  const base = (import.meta as any).env?.BASE_URL || '/';
  const baseSlash = String(base).endsWith('/') ? base : base + '/';

  const wasmBase = `${baseSlash}models/onnx/`;

  // Cross-origin isolation + SharedArrayBuffer required for threaded wasm.
  const allowThreads = (typeof (globalThis as any).crossOriginIsolated !== 'undefined' && (globalThis as any).crossOriginIsolated === true)
    && typeof (globalThis as any).SharedArrayBuffer !== 'undefined';

  (ort as any).env.wasm.wasmPaths = wasmBase;
  (ort as any).env.wasm.numThreads = allowThreads ? Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1)) : 1;
  (ort as any).env.wasm.simd = true;
  (ort as any).env.logLevel = 'error';
  return ort;
}
