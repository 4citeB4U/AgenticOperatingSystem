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
  // Set ORT environment for browser
  (ort as any).env.wasm.wasmPaths = '/onnx/';
  (ort as any).env.wasm.numThreads = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
  (ort as any).env.wasm.simd = true;
  (ort as any).env.logLevel = 'error';
  return ort;
}
