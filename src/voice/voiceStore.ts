/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: CORE.VOICE.STORE.MAIN
   REGION: 🟢 CORE
   VERSION: 1.0.1
   ============================================================================
   voiceStore.ts

   DISCOVERY_PIPELINE:
     Voice → Intent → Location → Vertical → Ranking → Render

   SPDX-License-Identifier: MIT
   ============================================================================ */

import type { AgentLeeVoiceProfile, AgentLeeVoiceTuning, VoiceConfigState } from "./voiceTypes";

const KEY = "agentlee_voice_config_v1";

const DEFAULTS: VoiceConfigState = {
  profile: {
    langBase: "en",
    langFull: "en-US",
    gender: "neutral",
    preferLocalService: true,
    nameHints: ["jenny", "zira", "samantha"],
    categoryHints: ["Google", "Microsoft", "Apple"],
    pinnedVoiceURI: undefined,
  },
  tuning: { rate: 1.0, pitch: 1.0, volume: 1.0 },
  interruptMode: "cancel",
};

function safeParse(raw: string | null): VoiceConfigState | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;
    return obj as VoiceConfigState;
  } catch {
    return null;
  }
}

export function loadVoiceConfig(): VoiceConfigState {
  if (typeof window === "undefined") return DEFAULTS;
  const saved = safeParse(window.localStorage.getItem(KEY));
  return {
    ...DEFAULTS,
    ...(saved ?? {}),
    profile: { ...DEFAULTS.profile, ...(saved?.profile ?? {}) },
    tuning: { ...DEFAULTS.tuning, ...(saved?.tuning ?? {}) },
  };
}

export function saveVoiceConfig(next: VoiceConfigState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export type VoiceConfigPatch = {
  profile?: Partial<AgentLeeVoiceProfile>;
  tuning?: Partial<AgentLeeVoiceTuning>;
  interruptMode?: VoiceConfigState['interruptMode'];
};

export function updateVoiceConfig(patch: VoiceConfigPatch): VoiceConfigState {
  const cur = loadVoiceConfig();
  const next: VoiceConfigState = {
    ...cur,
    profile: { ...cur.profile, ...(patch.profile ?? {}) },
    tuning: { ...cur.tuning, ...(patch.tuning ?? {}) },
    interruptMode: patch.interruptMode ?? cur.interruptMode,
  };
  saveVoiceConfig(next);
  try {
    window.dispatchEvent(
      new CustomEvent("agentlee:voice-config-changed", { detail: next })
    );
  } catch {
    // ignore
  }
  return next;
}

export function getDefaultVoiceConfig(): VoiceConfigState {
  return DEFAULTS;
}
