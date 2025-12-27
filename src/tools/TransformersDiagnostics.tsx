/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: UI.COMPONENT.TRANSFORMERSDIAGNOSTICS.MAIN
   REGION: 🟢 CORE
   VERSION: 1.0.0
   ============================================================================
   TransformersDiagnostics.tsx
   
   DISCOVERY_PIPELINE:
     MODEL=Voice>Intent>Location>Vertical>Ranking>Render;
     ROLE=support;
     INTENT_SCOPE=n/a;
     LOCATION_DEP=none;
     VERTICALS=n/a;
    /* ============================================================================
       LEEWAY HEADER — DO NOT REMOVE
       PROFILE: LEEWAY-ORDER
       TAG: UI.COMPONENT.TRANSFORMERSDIAGNOSTICS.MAIN
       REGION: 🟢 CORE
       VERSION: 1.0.0
       ============================================================================
       TransformersDiagnostics.tsx
   
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

    import { useMemo, useState } from 'react';

    export function TransformersDiagnostics() {
      const [open, setOpen] = useState(false);

      const snapshot = useMemo(() => {
        try {
          // Prefer a global cached copy set by initTransformersBoot to avoid using `require`.
          const mod: any = (globalThis as any).__xenova_transformers || null;
          const booted = !!(globalThis as any).__TRANSFORMERS_BOOTED__;
          if (!mod) return { booted, error: 'Transformers module not loaded yet (boot not run?)' };
          const tfEnv = mod?.env || {};
          return {
            BOOTED: booted,
            BASE_URL: (import.meta as any).env?.BASE_URL || '/',
            VITE_MODELS_PATH: (import.meta as any).env?.VITE_MODELS_PATH || null,
            VITE_ONNX_PATH: (import.meta as any).env?.VITE_ONNX_PATH || null,
            tfEnv_localModelPath: tfEnv.localModelPath || null,
            tfEnv_remoteModelPath: tfEnv.remoteModelPath || null,
            tfEnv_allowLocalModels: tfEnv.allowLocalModels,
            tfEnv_allowRemoteModels: tfEnv.allowRemoteModels,
            tfEnv_backends_keys: Object.keys(tfEnv.backends || {}),
            tfEnv_onnx_keys: Object.keys((tfEnv.backends || {}).onnx || {}),
            tfEnv_wasmKeys: Object.keys(((tfEnv.backends || {}).onnx || {}).wasm || {}),
            tfEnv_wasmPaths: ((tfEnv.backends || {}).onnx || {}).wasm?.wasmPaths || null,
            tfEnv_numThreads: ((tfEnv.backends || {}).onnx || {}).wasm?.numThreads || null,
          };
        } catch (e) {
          return { error: String(e) };
        }
      }, []);

      return (
        <div className="tf-diag-root">
          <button onClick={() => setOpen(v => !v)}>{open ? 'Hide' : 'Show'} Transformers Diagnostics</button>
          {open && (
            <pre className="tf-diag-pre">
              {JSON.stringify(snapshot, null, 2)}
            </pre>
          )}
        </div>
      );
    }
