/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: CORE.APP.COMPONENT.MAIN
   REGION: 🟢 CORE
   VERSION: 1.0.0
   ============================================================================
   transformersBoot.ts
   
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

/**
 * One-time init. Call at app startup BEFORE any pipeline() calls.
 * Uses dynamic import to avoid importing @xenova/transformers too early
 * (importing earlier can cause the library to lock in incorrect defaults).
 */
export async function initTransformersBoot() {
  // Read Vite env safely
  const baseUrl = (import.meta as any).env?.BASE_URL || "/";
  const baseSlash = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";

  // Optional overrides from .env.local (useful for debugging / GH Pages)
  const modelsPath = (import.meta as any).env?.VITE_MODELS_PATH || (baseSlash + "models/");
  const onnxPath = (import.meta as any).env?.VITE_ONNX_PATH || (baseSlash + "onnx/");

  // Normalize trailing slash
  const modelsBase = String(modelsPath).endsWith("/") ? String(modelsPath) : String(modelsPath) + "/";
  const onnxBase = String(onnxPath).endsWith("/") ? String(onnxPath) : String(onnxPath) + "/";

  // Dynamically import the transformers module and mutate its exported env in-place
  const mod: any = await import('@xenova/transformers');
  const tfEnv = mod?.env;
  if (!tfEnv || typeof tfEnv !== 'object') throw new Error('Transformers env not available for bootstrapping');

  // Authoritative browser-only values
  tfEnv.allowLocalModels = true;
  tfEnv.allowRemoteModels = false;
  tfEnv.useBrowserCache = false;
  tfEnv.useFSCache = false;

  // Model paths
  tfEnv.localModelPath = String(tfEnv.localModelPath ?? modelsBase);
  if (!tfEnv.localModelPath.endsWith('/')) tfEnv.localModelPath += '/';

  // ONNX wasm asset base
  tfEnv.backends ??= {};
  tfEnv.backends.onnx ??= {};
  tfEnv.backends.onnx.wasm ??= {};

  tfEnv.backends.onnx.wasm.wasmPaths = String(tfEnv.backends.onnx.wasm.wasmPaths ?? onnxBase);
  tfEnv.backends.onnx.wasm.numThreads = tfEnv.backends.onnx.wasm.numThreads ?? 1;
  (tfEnv.backends.onnx as any).logLevel = (tfEnv.backends.onnx as any).logLevel ?? 'fatal';

  // Expose module globally for diagnostics (synchronous reads in UI) and mark booted
  try {
    (globalThis as any).__xenova_transformers = mod;
    (globalThis as any).__TRANSFORMERS_BOOTED__ = true;
  } catch (e) { /* ignore */ }

  console.info('[TRANSFORMERS BOOT OK]', {
    localModelPath: tfEnv.localModelPath,
    wasmPaths: tfEnv.backends.onnx.wasm.wasmPaths,
    allowRemoteModels: tfEnv.allowRemoteModels,
  });

  return {
    baseUrl,
    modelsBase: tfEnv.localModelPath,
    onnxBase: tfEnv.backends.onnx.wasm.wasmPaths,
    allowLocalModels: tfEnv.allowLocalModels,
    allowRemoteModels: tfEnv.allowRemoteModels,
    useBrowserCache: tfEnv.useBrowserCache,
    numThreads: tfEnv.backends.onnx.wasm.numThreads,
  };
}
