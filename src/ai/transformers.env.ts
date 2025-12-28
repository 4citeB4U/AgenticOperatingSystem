/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: AI.ORCHESTRATION.RUNTIME.ENV
   REGION: 🧠 AI
   VERSION: 1.1.0
   ============================================================================
   src/ai/transformersEnv.ts

   Hybrid goals:
   - Works with your existing Vite setup (base './', polyfills, shims)
   - Forces offline-local models via /models
   - Forces ORT wasm to resolve from /onnx (public/onnx -> dist/onnx)
   - Sets ORT runtime env directly (covers both direct ORT + transformers backends)
   - Avoids breaking on env shape differences across transformers versions

   DISCOVERY_PIPELINE:
     MODEL=Voice>Intent>Location>Vertical>Ranking>Render;
     ROLE=runtime;
     INTENT_SCOPE=local-inference;
     LOCATION_DEP=none;
     VERTICALS=ai;
     RENDER_SURFACE=webview;
     SPEC_REF=LEEWAY.v12.DiscoveryArchitecture
   ============================================================================ */

let _didInit = false;

export async function initTransformersEnv() {
  if (_didInit) return;
  _didInit = true;

  // 1) Configure ORT directly (covers direct ort usage + transformers backend usage)
  try {
    const ort = await import('onnxruntime-web');
    // Your copy step places wasm under /public/onnx -> /dist/onnx
    (ort as any).env.wasm.wasmPaths = '/onnx/';
    (ort as any).env.wasm.numThreads = 1; // mobile-safe default
    (ort as any).env.logLevel = 'fatal';
  } catch {
    // Non-fatal: app might not use ort directly in some routes
  }

  // 2) Configure Transformers.js env
  const transformers = await import('@xenova/transformers');

  // Zero-egress (offline-first)
  transformers.env.allowLocalModels = true;
  transformers.env.allowRemoteModels = false;
  transformers.env.useBrowserCache = true;

  // Local models directory (public/models -> dist/models)
  transformers.env.localModelPath = '/models';

  // Backend config (shape differs across versions; be defensive)
  try {
    if (transformers.env.backends?.onnx) {
      transformers.env.backends.onnx.logLevel = 'fatal';

      // Prefer setting wasmPaths if backend supports it
      if (transformers.env.backends.onnx.wasm) {
        transformers.env.backends.onnx.wasm.wasmPaths = '/onnx/';
        transformers.env.backends.onnx.wasm.numThreads = 1;
      } else {
        // Some builds don't pre-create `wasm` object; create minimally
        transformers.env.backends.onnx.wasm = { wasmPaths: '/onnx/', numThreads: 1 } as any;
      }
    }
  } catch {
    // ignore: env layouts can vary
  }
}
