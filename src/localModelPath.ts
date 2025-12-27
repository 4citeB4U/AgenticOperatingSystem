/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: AI.ORCHESTRATION.MODEL.LOADER
   REGION: 🟢 CORE
   VERSION: 1.0.0
   ============================================================================
   localModelPath.ts
   
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
 * localModelPath.ts
 *
 * Normalizes a model folder/id so it can be used as the `modelId` parameter
 * in @xenova/transformers pipeline(task, modelId, opts).
 *
 * IMPORTANT:
 * - This returns a model ID (folder name), NOT a full URL.
 * - Your base URL is configured separately via env.localModelPath / env.remoteModelPath.
 */

export function viteBaseUrl(): string {
  // Vite provides BASE_URL at build time
  const base = (import.meta as any)?.env?.BASE_URL ?? '/';
  return typeof base === 'string' && base.length ? base : '/';
}

export function modelsBaseUrl(): string {
  const base = viteBaseUrl();
  const baseSlash = base.endsWith('/') ? base : base + '/';
  return baseSlash + 'models/';
}

/**
 * Convert a user-provided model reference into a clean model ID.
 * Accepts:
 * - "qwen2-0.5b-instruct"
 * - "/models/qwen2-0.5b-instruct/"
 * - "<base>/models/qwen2-0.5b-instruct"
 * - "models/qwen2-0.5b-instruct"
 *
 * Returns:
 * - "qwen2-0.5b-instruct"
 */
export function localModelPath(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new Error(`[localModelPath] invalid input: ${String(input)}`);
  }

  let s = input.trim();

  // Strip URL origin if present
  // e.g., https://example.com/base/models/foo -> /base/models/foo
  try {
    if (/^https?:\/\//i.test(s)) {
      const u = new URL(s);
      s = u.pathname;
    }
  } catch {
    // ignore malformed URL, treat as plain string
  }

  // Normalize slashes
  s = s.replace(/\\/g, '/');

  // Remove Vite base if present
  const base = viteBaseUrl();
  if (base && base !== '/' && s.startsWith(base)) {
    s = s.slice(base.length);
  }

  // Remove leading slash
  s = s.replace(/^\/+/, '');

  // Remove leading "models/" if present
  if (s.startsWith('models/')) s = s.slice('models/'.length);

  // Remove any remaining "/models/" segment if someone passed "/x/models/foo"
  const idx = s.indexOf('models/');
  if (idx !== -1) s = s.slice(idx + 'models/'.length);

  // Remove trailing slashes
  s = s.replace(/\/+$/, '');

  // Final safety: do not allow empty
  if (!s) {
    throw new Error(`[localModelPath] resolved to empty model id from: ${input}`);
  }

  return s;
}
