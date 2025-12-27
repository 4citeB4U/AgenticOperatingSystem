/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: AI.ORCHESTRATION.VISION.MULTI_ONNX_LOADER
   REGION: 🧠 AI
   VERSION: 1.2.0
   ============================================================================
   MultiOnnxLoader.ts

   SmolVLM-256M:
     - onnx/vision_encoder.onnx
     - onnx/embed_tokens.onnx  (optional but expected)
     - onnx/decoder_model_merged.onnx
     - tokenizer + config files in same folder

   DISCOVERY_PIPELINE:
     Voice -> Intent -> Location -> Vertical -> Ranking -> Render

   SPDX-License-Identifier: MIT
   ============================================================================ */

import { getOrt } from '../runtime/ortBootstrap';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface MultiOnnxModelConfig {
  modelId: string;
  basePath: string; // URL base to the model folder, e.g. "<BASE_URL>/models/<folder>"
  files: {
    visionEncoder?: string;
    embedTokens?: string;
    decoder?: string;
  };
  device?: 'cpu' | 'wasm' | 'webgl' | 'webgpu';
}

export interface VisionModelSessions {
  visionEncoder?: any;
  embedTokens?: any;
  decoder?: any;
}

export interface VisionInferenceResult {
  text: string;
  tokens?: number[];
  embeddings?: Float32Array;
}

// -----------------------------------------------------------------------------
// Small utilities to reduce name-mismatch risk across exports
// -----------------------------------------------------------------------------

function joinUrl(base: string, path: string) {
  if (!base) return path;
  const b = String(base).endsWith('/') ? String(base).slice(0, -1) : String(base);
  const p = String(path).startsWith('/') ? String(path).slice(1) : String(path);
  return `${b}/${p}`;
}

function pickNameContaining(names: readonly string[], contains: string[], fallback?: string): string {
  const lower = names.map(n => n.toLowerCase());
  for (const c of contains) {
    const idx = lower.findIndex(n => n.includes(c));
    if (idx >= 0) return names[idx];
  }
  return fallback ?? names[0] ?? '';
}

function firstOutputTensor(outputs: Record<string, any>): any {
  const k = Object.keys(outputs)[0];
  return outputs[k];
}

function lastTokenLogits(logitsTensor: any): Float32Array {
  // Many exports return [1, seq, vocab] or [seq, vocab] or [vocab]
  const data = logitsTensor.data as Float32Array;
  const dims = logitsTensor.dims || [];

  if (dims.length === 3) {
    const [b, s, v] = dims;
    const seq = Math.max(1, s || 1);
    const vocab = Math.max(1, v || 1);
    const offset = (Math.max(0, seq - 1) * vocab);
    return data.subarray(offset, offset + vocab);
  }

  if (dims.length === 2) {
    const [s, v] = dims;
    const seq = Math.max(1, s || 1);
    const vocab = Math.max(1, v || 1);
    const offset = (Math.max(0, seq - 1) * vocab);
    return data.subarray(offset, offset + vocab);
  }

  return data;
}

// -----------------------------------------------------------------------------
// SmolVLM256MLoader – specialised loader for SmolVLM-256M
// -----------------------------------------------------------------------------

export class SmolVLM256MLoader {
  private visionSession: any = null;
  private projectorSession: any = null;
  private decoderSession: any = null;
  private tokenizer: any = null;
  private modelId = '';
  private isLoaded = false;

  async init(modelPath: string, modelId: string, device: 'webgpu' | 'wasm' = 'wasm'): Promise<void> {
    if (this.isLoaded) return;

    this.modelId = modelId;
    console.debug('[SmolVLM] init', { modelId, modelPath, device });

    try {
      // Cast execution provider to any to avoid strict typing mismatches across ort typings
      const ort = await getOrt();
      const ep: any = device === 'webgpu' ? 'webgpu' : 'wasm';

      const sessionOptions: any = {
        executionProviders: [ep],
        graphOptimizationLevel: 'all',
        executionMode: 'sequential',
        enableCpuMemArena: true,
        enableMemPattern: true,
      };

      this.visionSession = await (ort.InferenceSession.create)(
        joinUrl(modelPath, 'onnx/vision_encoder.onnx'),
        sessionOptions
      );

      try {
        this.projectorSession = await (ort.InferenceSession.create)(
          joinUrl(modelPath, 'onnx/embed_tokens.onnx'),
          sessionOptions
        );
      } catch {
        console.warn('[SmolVLM] embed_tokens.onnx missing; continuing without projector');
      }

      this.decoderSession = await (ort.InferenceSession.create)(
        joinUrl(modelPath, 'onnx/decoder_model_merged.onnx'),
        sessionOptions
      );

      // Dynamically import tokenizer to avoid eager @xenova/transformers initialization
      const mod: any = await import('@xenova/transformers');
      const AutoTokenizer = mod.AutoTokenizer ?? (mod as any).default?.AutoTokenizer;
      if (!AutoTokenizer) throw new Error('AutoTokenizer not available from @xenova/transformers');
      this.tokenizer = await AutoTokenizer.from_pretrained(modelPath, { local_files_only: true });

      this.isLoaded = true;
      console.debug('[SmolVLM] loaded ✓');
    } catch (err: any) {
      console.error('[SmolVLM] init failed', err);
      throw new Error(`SmolVLM init failed: ${err?.message || err}`);
    }
  }

  async generate(
    imageData: Float32Array,
    imageShape: number[],
    prompt: string,
    options: { maxNewTokens?: number; temperature?: number; topP?: number } = {}
  ): Promise<string> {
    if (!this.isLoaded) throw new Error('SmolVLM not loaded — call init() first');

    const { maxNewTokens = 80, temperature = 0.7, topP = 0.9 } = options;

    const imageFeatures = await this._encodeImage(imageData, imageShape);
    const imageEmbeds = this.projectorSession ? await this._projectFeatures(imageFeatures) : imageFeatures;

    // Tokenize prompt: support both encode() returning ids and tokenizer(prompt).input_ids style.
    const inputIds: number[] = (() => {
      try {
        const ids = this.tokenizer.encode(prompt);
        if (Array.isArray(ids)) return ids.map(Number);
      } catch { /* ignore */ }
      try {
        const out = this.tokenizer(prompt);
        const ids = out?.input_ids;
        if (Array.isArray(ids)) return ids.map(Number);
      } catch { /* ignore */ }
      return [];
    })();

    const tokens = await this._generateTokens(inputIds, imageEmbeds, maxNewTokens, temperature, topP);

    try {
      return String(this.tokenizer.decode(tokens, { skip_special_tokens: true }));
    } catch {
      return String(tokens.join(' '));
    }
  }

  async dispose(): Promise<void> {
    try { if (this.visionSession && (this.visionSession as any).release) await (this.visionSession as any).release(); } catch { /* ignore */ }
    try { if (this.projectorSession && (this.projectorSession as any).release) await (this.projectorSession as any).release(); } catch { /* ignore */ }
    try { if (this.decoderSession && (this.decoderSession as any).release) await (this.decoderSession as any).release(); } catch { /* ignore */ }

    this.visionSession = null;
    this.projectorSession = null;
    this.decoderSession = null;
    this.tokenizer = null;
    this.isLoaded = false;
  }

  // Internal helpers ---------------------------------------------------------

  private async _encodeImage(data: Float32Array, shape: number[]): Promise<any> {
    const session = this.visionSession!;
    const inName = pickNameContaining(session.inputNames, ['pixel_values', 'pixels', 'image'], 'pixel_values');
    const ort = await getOrt();
    const tensor = new (ort.Tensor)('float32', data, shape);
    const outputs = await session.run({ [inName]: tensor });

    const outKey =
      Object.keys(outputs).find(k => k.toLowerCase().includes('last_hidden_state')) ||
      Object.keys(outputs)[0];

    return outputs[outKey];
  }

  private async _projectFeatures(features: any): Promise<any> {
    const session = this.projectorSession!;
    const inName = pickNameContaining(session.inputNames, ['image_features', 'features'], 'image_features');

    const outputs = await session.run({ [inName]: features });
    return firstOutputTensor(outputs);
  }

  private async _generateTokens(
    inputIds: number[],
    imageEmbeds: any,
    maxNewTokens: number,
    temperature: number,
    topP: number
  ): Promise<number[]> {
    const session = this.decoderSession!;
    const idsName = pickNameContaining(session.inputNames, ['input_ids', 'ids'], 'input_ids');
    const imgName = pickNameContaining(session.inputNames, ['image_embeds', 'image', 'vision'], 'image_embeds');

    const eos = Number(this.tokenizer?.eos_token_id ?? 2);

    const generated: number[] = [...inputIds];
    let past: Record<string, any> | null = null;

    for (let step = 0; step < maxNewTokens; step++) {
      const last = generated.length ? generated[generated.length - 1] : eos;

      const ort = await getOrt();
      const idsTensor = new (ort.Tensor)(
        'int64',
        new BigInt64Array([BigInt(last)]),
        [1, 1]
      );

      const feeds: Record<string, any> = {
        [idsName]: idsTensor,
      };

      if (step === 0 && imgName) {
        feeds[imgName] = imageEmbeds;
      }

      // If the export supports kv-cache, try to pass it through.
      if (past) {
        for (const k of Object.keys(past)) feeds[k] = past[k];
      }

      const outputs = await session.run(feeds);

      // logits
      const logitsKey =
        Object.keys(outputs).find(k => k.toLowerCase().includes('logits')) || Object.keys(outputs)[0];
      const logitsTensor = outputs[logitsKey];
      const logits = lastTokenLogits(logitsTensor);

      const next = this._sample(logits, temperature, topP);
      generated.push(next);

      if (next === eos) break;

      // cache update (best-effort)
      const presentKeys = Object.keys(outputs).filter(k => k.toLowerCase().includes('present') || k.toLowerCase().includes('past'));
      if (presentKeys.length) {
        past = {};
        for (const k of presentKeys) past[k] = outputs[k];
      }
    }

    return generated;
  }

  private _sample(logits: Float32Array, temperature: number, topP: number): number {
    const t = Math.max(1e-6, Number(temperature || 1));
    const scaled = Array.from(logits).map(l => l / t);

    let max = -Infinity;
    for (const v of scaled) if (v > max) max = v;

    const exp = scaled.map(l => Math.exp(l - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    const probs = exp.map(e => e / (sum || 1));

    const sorted = probs.map((p, i) => ({ p, i })).sort((a, b) => b.p - a.p);

    let cum = 0;
    const topIdx: number[] = [];
    for (const item of sorted) {
      cum += item.p;
      topIdx.push(item.i);
      if (cum >= topP) break;
    }

    const topProbs = topIdx.map(i => probs[i]);
    const sumTop = topProbs.reduce((a, b) => a + b, 0) || 1;
    const norm = topProbs.map(p => p / sumTop);

    let r = Math.random();
    for (let j = 0; j < norm.length; j++) {
      r -= norm[j];
      if (r <= 0) return topIdx[j];
    }
    return topIdx[0];
  }
}

export const smolVLMLoader = new SmolVLM256MLoader();

// -----------------------------------------------------------------------------
// Generic MultiOnnxLoader – for other multi-graph models
// -----------------------------------------------------------------------------

class MultiOnnxLoaderInternal {
  private sessions: Map<string, VisionModelSessions> = new Map();
  private loadingPromises: Map<string, Promise<VisionModelSessions>> = new Map();

  async loadModel(config: MultiOnnxModelConfig): Promise<VisionModelSessions> {
    const { modelId } = config;
    if (this.sessions.has(modelId)) return this.sessions.get(modelId)!;
    if (this.loadingPromises.has(modelId)) return this.loadingPromises.get(modelId)!;

    const p = this._loadModelInternal(config);
    this.loadingPromises.set(modelId, p);

    try {
      const sessions = await p;
      this.sessions.set(modelId, sessions);
      return sessions;
    } finally {
      this.loadingPromises.delete(modelId);
    }
  }

  private async _loadModelInternal(config: MultiOnnxModelConfig): Promise<VisionModelSessions> {
    const { basePath, files, device = 'wasm' } = config;

    const ep: any =
      device === 'webgpu' ? 'webgpu' :
      device === 'webgl' ? 'webgl' :
      'wasm';

    const opts: any = {
      executionProviders: [ep],
      graphOptimizationLevel: 'all',
      executionMode: 'sequential',
      enableCpuMemArena: true,
      enableMemPattern: true,
    };

    const sessions: VisionModelSessions = {};
    const ort = await getOrt();
    if (files.visionEncoder) sessions.visionEncoder = await (ort.InferenceSession.create)(joinUrl(basePath, files.visionEncoder), opts);
    if (files.embedTokens) sessions.embedTokens = await (ort.InferenceSession.create)(joinUrl(basePath, files.embedTokens), opts);
    if (files.decoder) sessions.decoder = await (ort.InferenceSession.create)(joinUrl(basePath, files.decoder), opts);

    return sessions;
  }

  async runVisionInference(
    modelId: string,
    imageData: Float32Array | Uint8Array,
    imageShape: number[],
    maxTokens: number = 50
  ): Promise<VisionInferenceResult> {
    const sessions = this.sessions.get(modelId);
    if (!sessions) throw new Error(`Model ${modelId} not loaded`);
    if (!sessions.visionEncoder || !sessions.decoder) throw new Error(`Model ${modelId} missing sessions`);

    const embeddings = await this._encodeImage(sessions.visionEncoder, imageData, imageShape);
    const tokens = await this._generateTokens(sessions.decoder, embeddings, maxTokens);

    return { text: `[Generated ${tokens.length} tokens]`, tokens, embeddings };
  }

  private async _encodeImage(
    session: any,
    imageData: Float32Array | Uint8Array,
    shape: number[]
  ): Promise<Float32Array> {
    const inName = pickNameContaining((session as any).inputNames, ['pixel_values', 'pixels', 'image'], 'pixel_values');
    const ort = await getOrt();
    const tensor = new (ort.Tensor)('float32', imageData as any, shape);
    const results = await session.run({ [inName]: tensor });

    const out = firstOutputTensor(results);
    return out.data as Float32Array;
  }

  private async _generateTokens(
    session: any,
    embeddings: Float32Array,
    maxTokens: number
  ): Promise<number[]> {
    const tokens: number[] = [];
    const inName = pickNameContaining(session.inputNames, ['inputs_embeds', 'embeds'], 'inputs_embeds');

    let current = embeddings;
    for (let i = 0; i < maxTokens; i++) {
      const ort = await getOrt();
      const tensor = new (ort.Tensor)('float32', current, [1, current.length]);
      const results = await session.run({ [inName]: tensor });

      const logitsKey = Object.keys(results).find(k => k.toLowerCase().includes('logits')) || Object.keys(results)[0];
      const logits = results[logitsKey].data as Float32Array;

      const next = this._argmax(logits);
      tokens.push(next);
      if (next === 2) break;

      current = logits;
    }

    return tokens;
  }

  private _argmax(array: Float32Array | number[]): number {
    let maxIdx = 0;
    let maxVal = array[0];
    for (let i = 1; i < array.length; i++) {
      if (array[i] > maxVal) { maxVal = array[i]; maxIdx = i; }
    }
    return maxIdx;
  }
}

export const multiOnnxLoader = new MultiOnnxLoaderInternal();

// -----------------------------------------------------------------------------
// Image preprocessing helper
// -----------------------------------------------------------------------------

export interface ImageData {
  data: Float32Array;
  shape: number[];
}

export async function loadImageFromUrl(url: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const size = 224;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable');

        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size);
        const pixels = imageData.data;

        const floatData = new Float32Array(3 * size * size);
        for (let i = 0; i < size * size; i++) {
          floatData[i] = pixels[i * 4] / 255.0;                 // R
          floatData[size * size + i] = pixels[i * 4 + 1] / 255.0; // G
          floatData[2 * size * size + i] = pixels[i * 4 + 2] / 255.0; // B
        }

        resolve({ data: floatData, shape: [1, 3, size, size] });
      } catch (err: any) {
        reject(new Error(`Image processing failed: ${err?.message || err}`));
      }
    };

    img.onerror = () => reject(new Error(`Failed to load image at ${url}`));
    img.src = url;
  });
}
