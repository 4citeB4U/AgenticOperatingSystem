/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: CORE.APP.COMPONENT.MAIN
   REGION: 🟢 CORE
   VERSION: 1.0.0
   ============================================================================
   initTransformersEnv.ts
   
   DISCOVERY_PIPELINE:
     MODEL=Voice>Intent>Location>Vertical>Ranking>Render;
     ROLE=support;
     INTENT_SCOPE=n/a;
     LOCATION_DEP=none;
     VERTICALS=n/a;
     RENDER_SURFACE=in-app;
     SPEC_REF=LEEWAY.v12.DiscoveryArchitecture

   SPDX-License-Identifier: MIT
   ============================================================================ */



// Do not import @xenova/transformers at module load time to avoid eager WASM init.
// Instead, provide a lightweight global shim so code that reads the env object
// before the library is loaded does not crash. The real library is loaded by
// `initTransformersEnv()` at runtime via dynamic import.
(() => {
  try {
    const shim: any = (globalThis as any).__xenova_transformers ?? {};
    shim.env = shim.env ?? {};
    const envRef: any = shim.env;
    envRef.allowLocalModels = envRef.allowLocalModels ?? true;
    envRef.allowRemoteModels = envRef.allowRemoteModels ?? false;
    envRef.useBrowserCache = envRef.useBrowserCache ?? true;
    envRef.useFSCache = envRef.useFSCache ?? false;
    envRef.localModelPath = typeof envRef.localModelPath === 'string' ? envRef.localModelPath : '/models/';
    if (!envRef.localModelPath.endsWith('/')) envRef.localModelPath += '/';
    envRef.backends = envRef.backends ?? {};
    envRef.backends.onnx = envRef.backends.onnx ?? {};
    envRef.backends.onnx.wasm = envRef.backends.onnx.wasm ?? {};
    envRef.backends.onnx.webgpu = envRef.backends.onnx.webgpu ?? {};
    envRef.backends.onnx.webgl = envRef.backends.onnx.webgl ?? {};
    envRef.backends.onnx.wasm.wasmPaths = envRef.backends.onnx.wasm.wasmPaths ?? '/onnx/';
    envRef.backends.onnx.wasm.numThreads = envRef.backends.onnx.wasm.numThreads ?? 1;
    (envRef.backends.onnx as any).logLevel = (envRef.backends.onnx as any).logLevel ?? 'fatal';
    envRef.cache = envRef.cache ?? {};
    (globalThis as any).__xenova_transformers = shim;
    (globalThis as any).__TRANSFORMERS_BOOTED__ = false;
    console.info('[TRANSFORMERS ENV SHIM INIT]', { localModelPath: envRef.localModelPath, wasmPaths: envRef.backends.onnx.wasm.wasmPaths });
  } catch {
    /* ignore */
  }
})();

// Provide a stub process.env so libraries that check it do not crash
try { (globalThis as any).process ??= { env: {} }; } catch {}

// Asynchronous initialiser.  Call this once at application startup before any
// pipeline() calls.  It re-computes the base path using Vite’s BASE_URL and
// ensures nested objects still exist.  It returns the imported module so
// consumers can await it and then use the library immediately.
export async function initTransformersEnv() {
  const mod = await import('@xenova/transformers');
  const env: any = (mod as any).env;
  if (!env || typeof env !== 'object') {
    throw new Error('[initTransformersEnv] transformers env not available; ensure the library is the expected version and that this runs before any pipeline calls.');
  }
  // Determine base path from Vite’s BASE_URL.  If unspecified, default to '/'.
  const base = (import.meta as any).env?.BASE_URL || '/';
  const baseSlash = base.endsWith('/') ? base : base + '/';
  // Local-first deterministic configuration
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
  env.useBrowserCache = true;
  env.useFSCache = false;
  // Only set localModelPath if not already configured by sync init.
  env.localModelPath = env.localModelPath ?? `${baseSlash}models/`;
  if (typeof env.localModelPath === 'string' && !env.localModelPath.endsWith('/')) {
    env.localModelPath += '/';
  }
  env.backends ??= {};
  env.backends.onnx ??= {};
  env.backends.onnx.wasm ??= {};
  env.backends.onnx.webgpu ??= {};
  env.backends.onnx.webgl ??= {};
    // Ensure wasm paths point to published models folder and determine threading
    env.backends.onnx.wasm.wasmPaths = env.backends.onnx.wasm.wasmPaths ?? `${baseSlash}models/onnx/`;
  // Allow threads only when cross-origin isolated and SAB available; default to 1 otherwise
  const allowThreads = (typeof (globalThis as any).crossOriginIsolated !== 'undefined' && (globalThis as any).crossOriginIsolated === true)
    && typeof (globalThis as any).SharedArrayBuffer !== 'undefined';
  env.backends.onnx.wasm.numThreads ??= allowThreads ? Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1)) : 1;
  env.backends.onnx.logLevel ??= 'fatal';
  try {
    console.debug('[initTransformersEnv] final env', env);
  } catch {
    /* ignore */
  }
  return mod;
}