/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: AI.ORCHESTRATION.MODEL.REGISTRY
   REGION: 🟢 CORE
   VERSION: 1.1.0
   ============================================================================
   modelRegistry.ts

   Purpose:
     - Single source of truth for local model folder names under /public/models
     - Helpers that resolve URLs using Vite BASE_URL
     - Keeps HF repo ids separate from local folder ids

   DISCOVERY_PIPELINE:
     Voice -> Intent -> Location -> Vertical -> Ranking -> Render

   SPDX-License-Identifier: MIT
   ============================================================================ */

export type ModelEntry = {
  hubRepo: string;      // HF repo id (download/metadata)
  localFolder: string;  // EXACT folder name under /public/models/<localFolder>/
  notes?: string;
};

/**
 * CONTRACT:
 * - localFolder MUST match the directory name in: public/models/<localFolder>
 * - localFolder is folder-id only (NO "/models/" prefix)
 */
export const MODEL_REGISTRY: Record<string, ModelEntry> = {
  CHAT_PLANNER: {
    hubRepo: 'onnx-community/Qwen2.5-0.5B-Instruct',
    localFolder: 'onnx-community_Qwen2.5-0.5B-Instruct',
  },

  EMBEDDER: {
    hubRepo: 'Qwen/Qwen3-Embedding-0.6B',
    localFolder: 'Qwen_Qwen3-Embedding-0.6B',
  },

  /**
   * VISION (SmolVLM-256M):
   * Folder name includes "smolvlm" so LocalModelHub routes to SmolVLM loader.
   */
  VISION: {
    hubRepo: 'HuggingFaceTB/SmolVLM-256M-Instruct',
    localFolder: 'HuggingFaceTB_SmolVLM-256M-Instruct',
    notes: 'Multi-ONNX: onnx/vision_encoder.onnx + onnx/embed_tokens.onnx + onnx/decoder_model_merged.onnx',
  },

  IMAGE_GEN: {
    hubRepo: 'onnx-community/stable-diffusion-v1-5',
    localFolder: 'onnx-community_stable-diffusion-v1-5',
  },

  VIT_BACKUP: {
    hubRepo: 'Xenova/vit-tiny-patch16-224',
    localFolder: 'Xenova_vit-tiny-patch16-224',
  },
} as const;

export function modelsBaseUrl(): string {
  const base = (import.meta as any).env?.BASE_URL || '/';
  const normalized = String(base).endsWith('/') ? String(base) : `${base}/`;
  return `${normalized}models/`;
}

export function localModelUrl(folderId: string): string {
  const f = String(folderId || '').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
  return `${modelsBaseUrl()}${f}/`;
}

// Back-compat helper name used elsewhere
export function localModelPath(folderId: string): string {
  return localModelUrl(folderId);
}
