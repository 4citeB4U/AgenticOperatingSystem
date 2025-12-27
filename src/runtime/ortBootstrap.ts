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

let _configured = false;
let _ortModule: any = null;

export async function getOrt() {
  if (_configured && _ortModule) return _ortModule;

  // Prefer the ESM bundle we copy to `public/onnx/` to avoid UMD/TDZ issues.
  // Use absolute origin URLs to avoid Vite attempting to transform imports
  // for files placed in `/public` during dev (Vite rejects importing from /public).
  const origin = (typeof location !== 'undefined' && location.origin) ? location.origin : '';
  // Order: ort.all.mjs (complete ESM bundle) first, then ort.mjs, then wasm-specific mjs
  const candidates = [
    `${origin}/onnx/ort.all.mjs`,
    `${origin}/onnx/ort.mjs`,
    `${origin}/onnx/ort.wasm.mjs`,
    `${origin}/onnx/ort.min.mjs`,
  ];

  for (const c of candidates) {
    try {
      // In browser: attempt to load via an injected module script so Vite does
      // not try to transform /public paths during dev. Create an inline
      // module that imports the ESM bundle and writes it to window.__ORT_MODULE__.
      if (typeof document !== 'undefined' && typeof window !== 'undefined') {
        // clear previous markers
        delete (window as any).__ORT_MODULE__;
        delete (window as any).__ORT_MODULE_ERR__;

        const src = c;
        const content = `import * as __m from "${src}"; window.__ORT_MODULE__ = __m;`;
        const script = document.createElement('script');
        script.type = 'module';
        script.textContent = content;
        document.head.appendChild(script);

        // wait for module to set window.__ORT_MODULE__ (or error)
        const mod = await new Promise<any>((resolve, reject) => {
          const start = Date.now();
          const timeout = 8000;
          (function check() {
            if ((window as any).__ORT_MODULE__) return resolve((window as any).__ORT_MODULE__);
            if ((window as any).__ORT_MODULE_ERR__) return reject((window as any).__ORT_MODULE_ERR__);
            if (Date.now() - start > timeout) return reject(new Error('Timeout loading ORT module'));
            setTimeout(check, 50);
          })();
        }).catch((e) => null);

        if (mod) {
          console.info('[ortBootstrap] loaded ESM ORT from', c);
          _ortModule = mod?.default ?? mod;
          break;
        }
        // otherwise try next candidate
      } else {
        // non-browser contexts: try dynamic import
        // @ts-ignore
        const m = await import(/* @vite-ignore */ c);
        _ortModule = m?.default ?? m;
        break;
      }
    } catch (e) {
      // try next
    }
  }

  // If running in browser and no public ESM bundle loaded, fail fast to avoid
  // pulling in the package's UMD/legacy bundles which can register global
  // adapters and produce runtime errors like `registerBackend`.
  if (!_ortModule) {
    // In browser: fail fast if no ESM bundle found
    if (typeof document !== 'undefined' && typeof window !== 'undefined') {
      console.error('[ortBootstrap] No ESM ORT bundle found in /public/onnx. Aborting to avoid loading legacy UMD bundles.');
      throw new Error('No ESM ORT bundle found in /public/onnx. Ensure `ort.all.mjs` or `ort.mjs` exists and is reachable.');
    }
    // In Node (for tests/tools): allow fallback
    try {
      const pkg: any = await import('onnxruntime-web');
      _ortModule = pkg;
    } catch (e) {
      throw new Error('Failed to load onnxruntime-web (package import failed)');
    }
  }

  try {
    if (_ortModule?.env?.wasm) {
      _ortModule.env.wasm.wasmPaths = '/onnx/';
      _ortModule.env.wasm.numThreads = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
      _ortModule.env.wasm.simd = true;
    }
    if (_ortModule?.env) {
      _ortModule.env.logLevel = 'error';
    }
  } catch (e) {
    // ignore non-fatal
  }

  _configured = true;
  return _ortModule;
}
