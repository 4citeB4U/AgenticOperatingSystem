/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: AI.ORCHESTRATION.MODEL.LOADER
   REGION: 🟢 CORE
   VERSION: 1.1.0
   ============================================================================
   LocalModelHub.ts

   Contract:
     - env.localModelPath = "<BASE_URL>/models/"
     - CORE_REGISTRY.<core>.repo = "<folder_id>"
     - VISION type 'vision_multi' routes to MultiOnnxLoader.ts
     - SmolVLM chosen when folder id contains "smolvlm"

   DISCOVERY_PIPELINE:
     Voice -> Intent -> Location -> Vertical -> Ranking -> Render

   SPDX-License-Identifier: MIT
   ============================================================================ */

import type { CoreKey } from './coreRegistry';
import { CORE_REGISTRY } from './coreRegistry';

import { loadImageFromUrl, multiOnnxLoader, smolVLMLoader } from './tools/MultiOnnxLoader';

const BASE_MODELS_URL = (() => {
  const base = (import.meta as any).env?.BASE_URL || '/';
  const normalized = String(base).endsWith('/') ? String(base) : `${base}/`;
  return `${normalized}models/`;
})();

const BASE_ORT_URL = (() => {
  const base = (import.meta as any).env?.BASE_URL || '/';
  const normalized = String(base).endsWith('/') ? String(base) : `${base}/`;
  // NOTE: runtime wasm/onnx assets are shipped under `dist/models/onnx/`.
  // Use `models/onnx/` so runtime loads from `<base>/models/onnx/`.
  return `${normalized}models/onnx/`;
})();

let _transformers: any = null;

function hardenTransformersEnv(mod: any) {
  if (!mod) return;

  const envRef: any =
    (mod.env && typeof mod.env === 'object' && mod.env !== null) ? mod.env : (mod.env = {});

  envRef.allowLocalModels = envRef.allowLocalModels ?? true;
  envRef.allowRemoteModels = envRef.allowRemoteModels ?? false;
  envRef.useBrowserCache = envRef.useBrowserCache ?? true;
  envRef.useFSCache = envRef.useFSCache ?? false;

  envRef.localModelPath = String(envRef.localModelPath ?? BASE_MODELS_URL);
  if (!envRef.localModelPath.endsWith('/')) envRef.localModelPath += '/';

  envRef.backends = (envRef.backends && typeof envRef.backends === 'object') ? envRef.backends : (envRef.backends = {});
  envRef.backends.onnx = (envRef.backends.onnx && typeof envRef.backends.onnx === 'object') ? envRef.backends.onnx : (envRef.backends.onnx = {});
  envRef.backends.onnx.wasm = (envRef.backends.onnx.wasm && typeof envRef.backends.onnx.wasm === 'object') ? envRef.backends.onnx.wasm : (envRef.backends.onnx.wasm = {});
  envRef.backends.onnx.webgpu = (envRef.backends.onnx.webgpu && typeof envRef.backends.onnx.webgpu === 'object') ? envRef.backends.onnx.webgpu : (envRef.backends.onnx.webgpu = {});
  envRef.backends.onnx.webgl = (envRef.backends.onnx.webgl && typeof envRef.backends.onnx.webgl === 'object') ? envRef.backends.onnx.webgl : (envRef.backends.onnx.webgl = {});

  if (typeof envRef.backends.onnx.logLevel !== 'string') {
    try { envRef.backends.onnx.logLevel = 'fatal'; } catch { /* ignore */ }
  }

  try {
    // Force deterministic ORT wasm path to the app's public/onnx/ folder
    envRef.backends.onnx.wasm.wasmPaths = String(envRef.backends.onnx.wasm.wasmPaths ?? BASE_ORT_URL);
    if (!String(envRef.backends.onnx.wasm.wasmPaths).endsWith('/')) envRef.backends.onnx.wasm.wasmPaths += '/';
  } catch { /* ignore */ }

  // Enforce single-threaded ORT on hosts that do not support cross-origin isolation
  // (e.g. GitHub Pages). If crossOriginIsolated and SharedArrayBuffer are available
  // we allow a small number of threads; otherwise force `numThreads = 1` and
  // disable worker proxy usage to avoid SharedArrayBuffer runtime errors.
  try {
    const ortThreadsAllowed = (): boolean => {
      try {
        const coi = typeof (globalThis as any).crossOriginIsolated !== 'undefined' && (globalThis as any).crossOriginIsolated === true;
        const sab = typeof (globalThis as any).SharedArrayBuffer !== 'undefined';
        return Boolean(coi && sab);
      } catch (e) {
        return false;
      }
    };

    const allowThreads = ortThreadsAllowed();
    const hardwareConcurrency = (typeof navigator !== 'undefined' && (navigator as any).hardwareConcurrency) || 1;
    const desiredThreads = allowThreads ? Math.max(1, Math.min(4, Number(hardwareConcurrency) || 1)) : 1;

    envRef.backends.onnx.wasm.numThreads = Number(envRef.backends.onnx.wasm.numThreads ?? desiredThreads);

    // Some ORT integrations use a `proxy` worker to host wasm. Disable proxy on
    // non-isolated origins to avoid worker/SAB issues; enable only when threads allowed.
    envRef.backends.onnx.wasm.proxy = Boolean(envRef.backends.onnx.wasm.proxy && allowThreads);

    // Helpful debug output when running locally
    try {
      console.info('[LocalModelHub] ORT wasm config', {
        wasmPaths: envRef.backends.onnx.wasm.wasmPaths,
        crossOriginIsolated: (globalThis as any).crossOriginIsolated,
        sharedArrayBuffer: typeof (globalThis as any).SharedArrayBuffer !== 'undefined',
        numThreads: envRef.backends.onnx.wasm.numThreads,
        proxy: envRef.backends.onnx.wasm.proxy,
      });
    } catch { /* ignore */ }
  } catch (e) { /* ignore */ }

  return envRef;
}

export async function loadTransformers() {
  if (_transformers) return _transformers;

  try {
    (globalThis as any).fs = (globalThis as any).fs ?? {};
    (globalThis as any).path = (globalThis as any).path ?? {};
  } catch { /* ignore */ }

  _transformers = await import('@xenova/transformers');

  try {
    if ((_transformers as any).ONNX && typeof (_transformers as any).ONNX.env === 'object') {
      const onnxEnv = ((_transformers as any).ONNX as any).env;
      (_transformers as any).env = (_transformers as any).env || {};
      (_transformers as any).env.backends = (_transformers as any).env.backends || {};
      (_transformers as any).env.backends.onnx = (_transformers as any).env.backends.onnx || onnxEnv;
    }
  } catch { /* ignore */ }

  hardenTransformersEnv(_transformers);
  return _transformers;
}

async function preflightConfig(modelFolderId: string, mod: any) {
  const localBase = String(mod?.env?.localModelPath || BASE_MODELS_URL).replace(/\/+$/, '');
  const configUrl = `${localBase}/${modelFolderId}/config.json`;

  const resp = await fetch(configUrl);
  if (!resp.ok) {
    const body = await resp.text().then(t => t.slice(0, 200)).catch(() => '<no-body>');
    throw new Error(`Model config fetch failed: ${resp.status} ${resp.statusText} @ ${configUrl} :: ${body}`);
  }

  const txt = await resp.text();
  try { JSON.parse(txt); } catch (e: any) {
    throw new Error(`Model config JSON parse error @ ${configUrl}: ${String(e?.message || e)}`);
  }
}

class LocalModelHubClass {
  pipelines: Record<string, any> = {};
  loaders: Record<string, Promise<any> | null> = {};
  deviceType: 'webgpu' | 'wasm' | null = null;
  abortController: AbortController | null = null;

  async detectHardware() {
    if (this.deviceType) return this.deviceType;
    if (!('gpu' in navigator)) return (this.deviceType = 'wasm');
    try {
      const adapter = await (navigator as any).gpu.requestAdapter();
      return (this.deviceType = adapter ? 'webgpu' : 'wasm');
    } catch {
      return (this.deviceType = 'wasm');
    }
  }

  private getCfg(core: string) {
    const cfg = (CORE_REGISTRY as any)[core as keyof typeof CORE_REGISTRY];
    if (!cfg) throw new Error(`Unknown core ${core}`);
    if (cfg.disabled) throw new Error(`Core ${core} disabled`);
    return cfg;
  }

  async ensureLoaded(core: string) {
    console.log(`[LocalModelHub] ensureLoaded called for core: ${core}`);
    if (this.pipelines[core]) return this.pipelines[core];
    if (this.loaders[core]) {
      console.log(`[LocalModelHub] Loader already exists for ${core}, returning existing loader`);
      return this.loaders[core];
    }

    const cfg = this.getCfg(core);
    console.log(`[LocalModelHub] Config for ${core}:`, cfg);

    if (cfg.type === 'vision_multi') {
      console.log(`[LocalModelHub] Using vision loader for ${core}`);
      return this.ensureVisionLoaded(core);
    }

    console.log(`[LocalModelHub] Loading transformers for ${core}...`);
    const mod = await loadTransformers();
    hardenTransformersEnv(mod);

    console.log(`[LocalModelHub] Detecting hardware for ${core}...`);
    const device = await this.detectHardware();
    console.log(`[LocalModelHub] Detected device: ${device}`);
    
    const pipelineFn = mod?.pipeline;
    if (!pipelineFn) throw new Error('Transformers pipeline unavailable');

    const modelFolderId = String(cfg.repo || '').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
    const fullModelPath = `${BASE_MODELS_URL}${modelFolderId}`;
    console.log(`[LocalModelHub] Model path: ${fullModelPath}`);

    const task =
      cfg.type === 'embed'
        ? 'feature-extraction'
        : (cfg.type === 'llm'
            ? 'text-generation'
            : 'image-to-text');

    console.log(`[LocalModelHub] Task: ${task}`);

    const pipelineOpts: any = { device, local_files_only: true };

    this.loaders[core] = (async () => {
      try {
        await preflightConfig(modelFolderId, mod);
        const p = await pipelineFn(task, fullModelPath, pipelineOpts);
        this.pipelines[core] = p;
        return p;
      } catch (err: any) {
        try { hardenTransformersEnv(mod); } catch { /* ignore */ }
        const p2 = await pipelineFn(task, fullModelPath, pipelineOpts);
        this.pipelines[core] = p2;
        return p2;
      }
    })();

    return this.loaders[core];
  }

  async load(core: string) {
    return this.ensureLoaded(core);
  }

  /**
   * Produce an embedding vector for `text` using the EMBED core.
   */
  async embedText(text: string): Promise<number[] | null> {
    const pipeline = await this.ensureLoaded('EMBED' as CoreKey).catch(() => null);
    if (!pipeline) return null;
    try {
      const out = typeof pipeline.call === 'function' ? await pipeline.call(text) : await (pipeline as any)(text);
      if (Array.isArray(out)) return out as number[];
      if (out && Array.isArray((out as any).data)) return (out as any).data as number[];
      if (out && Array.isArray((out as any).embedding)) return (out as any).embedding as number[];
      if (out && Array.isArray((out as any).embeddings) && Array.isArray((out as any).embeddings[0])) return (out as any).embeddings[0];
      return null;
    } catch (e) {
      console.warn('[LocalModelHub.embedText] failed', e);
      return null;
    }
  }

  /**
   * Simple chat wrapper using the QWEN core. `messages` is an array of {role,text}.
   */
  async chat(messages: Array<{ role?: string; text: string }>, context?: string): Promise<string> {
    const pipeline = await this.ensureLoaded('QWEN' as CoreKey);
    const promptBody = (context ? context + '\n\n' : '') + messages.map(m => `${m.role || 'user'}: ${m.text}`).join('\n');
    try {
      const out = typeof pipeline.call === 'function' ? await pipeline.call(promptBody) : await (pipeline as any)(promptBody);
      if (typeof out === 'string') return out;
      if (out && typeof (out as any).text === 'string') return (out as any).text;
      if (Array.isArray(out) && typeof out[0] === 'string') return out[0];
      return JSON.stringify(out);
    } catch (e: any) {
      console.error('[LocalModelHub.chat] error', e);
      throw e;
    }
  }

  /**
   * Ask the local model to produce a UI action plan. Attempts to parse JSON output,
   * but falls back to a simple text-thought if parsing fails.
   */
  async planUiAction(goal: string, uiState: any, context?: string): Promise<{ thought: string; actions: any[] }> {
    const prompt = `Plan a sequence of UI actions to accomplish the goal: ${goal}\n\nUI_STATE:\n${JSON.stringify(uiState)}\n\nReturn valid JSON: {"thought":"...","actions":[{"type":"click","targetId":"...","text":"...","summary":"..."}]}`;
    const raw = await this.chat([{ role: 'system', text: 'You are an assistant that plans UI actions.' }, { role: 'user', text: prompt }], context).catch((e) => String(e?.message || ''));
    try {
      const parsed = JSON.parse(raw);
      return { thought: String(parsed.thought || ''), actions: Array.isArray(parsed.actions) ? parsed.actions : [] };
    } catch {
      return { thought: String(raw).slice(0, 1000), actions: [] };
    }
  }

  cancel() {
    try {
      if (this.abortController) this.abortController.abort();
    } catch { /* ignore */ }
    this.abortController = null;
    // Best-effort: clear pending loaders
    try {
      for (const k of Object.keys(this.loaders)) this.loaders[k] = null;
    } catch { /* ignore */ }
  }

  async runVision(imageUrl: string): Promise<string> {
    const pipeline = await this.ensureLoaded('VISION' as CoreKey);
    const result = await pipeline.call(imageUrl);
    if (typeof result === 'string') return result;
    if (result && typeof result.text === 'string') return result.text;
    return JSON.stringify(result);
  }

  private async ensureVisionLoaded(core: string) {
    if (this.pipelines[core]) return this.pipelines[core];
    if (this.loaders[core]) return this.loaders[core];

    const cfg = this.getCfg(core);
    const device = await this.detectHardware();

    const modelFolderId = String(cfg.repo || '').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
    const basePathUrl = `${BASE_MODELS_URL}${modelFolderId}`;
    const useSmol = modelFolderId.toLowerCase().includes('smolvlm');

    this.loaders[core] = (async () => {
      if (useSmol) {
        await smolVLMLoader.init(basePathUrl, core, device);
        const visionPipeline = {
          async call(imageUrl: string, prompt: string = 'Describe this image.') {
            const img = await loadImageFromUrl(imageUrl);
            const text = await smolVLMLoader.generate(
              img.data,
              img.shape,
              prompt,
              { maxNewTokens: 120, temperature: 0.7, topP: 0.9 }
            );
            return { text };
          },
        };
        this.pipelines[core] = visionPipeline;
        return visionPipeline;
      }

      await multiOnnxLoader.loadModel({
        modelId: core,
        basePath: basePathUrl,
        files: {
          visionEncoder: 'onnx/vision_encoder.onnx',
          embedTokens: 'onnx/embed_tokens.onnx',
          decoder: 'onnx/decoder_model_merged.onnx',
        },
        device: device === 'webgpu' ? 'webgpu' : 'wasm',
      });

      const visionPipeline = {
        async call(imageUrl: string) {
          const img = await loadImageFromUrl(imageUrl);
          return await multiOnnxLoader.runVisionInference(core, img.data, img.shape, 50);
        },
      };

      this.pipelines[core] = visionPipeline;
      return visionPipeline;
    })();

    return this.loaders[core];
  }
}

export const LocalModelHub = new LocalModelHubClass();
export default LocalModelHub;
