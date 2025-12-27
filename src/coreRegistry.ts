/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: CORE.REGISTRY.MODELS.MAIN
   REGION: 🟢 CORE
   VERSION: 1.1.0
   ============================================================================
   coreRegistry.ts

   DISCOVERY_PIPELINE:
     Voice -> Intent -> Location -> Vertical -> Ranking -> Render

   SPDX-License-Identifier: MIT
   ============================================================================ */

import { mlAdapter } from './memoryLakeAdapter';
import { MODEL_REGISTRY } from './tools/modelRegistry';

/**
 * CONTRACT:
 * - `repo` is the model folder id only (NOT "/models/...").
 * - LocalModelHub composes URLs using env.localModelPath + repo.
 */
export const CORE_REGISTRY = {
  QWEN: {
    repo: MODEL_REGISTRY.CHAT_PLANNER.localFolder,
    type: 'llm' as const,
  },

  EMBED: {
    repo: MODEL_REGISTRY.EMBEDDER.localFolder,
    type: 'embed' as const,
  },

  VISION: {
    repo: MODEL_REGISTRY.VISION.localFolder,
    type: 'vision_multi' as const,
  },

  IMAGE_GEN: {
    repo: MODEL_REGISTRY.IMAGE_GEN.localFolder,
    type: 'img-gen' as const,
  },
} as const;

export type CoreKey = keyof typeof CORE_REGISTRY;

/** -----------------------------
 *  Agent Control bus (imperative actions)
 *  ----------------------------- */
export type AgentActionHandler = (args?: any) => Promise<any> | any;
export type AgentControlHandle = Record<string, AgentActionHandler>;

type AgentControlAuditEvent = {
  at: number;
  component: string;
  action: string;
  ok: boolean;
  ms: number;
  argsPreview?: string;
  error?: string;
};

function safePreviewArgs(args: any): string {
  try {
    if (args == null) return '';
    const json = JSON.stringify(args);
    return json.length > 400 ? json.slice(0, 400) + '…' : json;
  } catch {
    return '[unserializable]';
  }
}

class AgentControlBus {
  private handles = new Map<string, AgentControlHandle>();

  register(component: string, handle: AgentControlHandle) {
    this.handles.set(component, handle);
  }
  unregister(component: string) {
    this.handles.delete(component);
  }
  list() {
    return Array.from(this.handles.entries()).map(([component, handle]) => ({
      component,
      actions: Object.keys(handle),
    }));
  }

  async call(component: string, action: string, args?: any) {
    const start = performance.now();
    const handle = this.handles.get(component);
    if (!handle) throw new Error(`AGENT_CONTROL: component not registered: ${component}`);
    const fn = handle[action];
    if (!fn) throw new Error(`AGENT_CONTROL: action not found: ${component}.${action}`);

    try {
      const out = await fn(args);
      const ms = Math.round(performance.now() - start);
      void this.audit({ at: Date.now(), component, action, ok: true, ms, argsPreview: safePreviewArgs(args) });
      return out;
    } catch (e: any) {
      const ms = Math.round(performance.now() - start);
      void this.audit({
        at: Date.now(),
        component,
        action,
        ok: false,
        ms,
        argsPreview: safePreviewArgs(args),
        error: String(e?.message || e),
      });
      throw e;
    }
  }

  private async audit(evt: AgentControlAuditEvent) {
    try {
      await mlAdapter.putEvent('agent/control/', `control_${evt.at}`, evt);
    } catch {
      // never block caller
    }
  }
}

export const AGENT_CONTROL = new AgentControlBus();
export default CORE_REGISTRY;
