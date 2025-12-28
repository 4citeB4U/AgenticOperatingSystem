/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: TOOLS.VOICE.AGENTCONTROL.MAIN
   REGION: 🟣 MCP
   VERSION: 1.0.1
   ============================================================================
   voiceAgentControl.ts

   DISCOVERY_PIPELINE:
     Voice → Intent → Location → Vertical → Ranking → Render

   SPDX-License-Identifier: MIT
   ============================================================================ */

import { loadVoiceConfig, updateVoiceConfig } from "./voiceStore";

export function registerVoiceTools(AGENT_CONTROL: any) {
  AGENT_CONTROL.register("SystemSettingsVoice", {
    getVoiceConfig: async () => loadVoiceConfig(),
    setVoiceProfile: async ({ profile }: any) => updateVoiceConfig({ profile }),
    setVoiceTuning: async ({ tuning }: any) => updateVoiceConfig({ tuning }),
    setInterruptMode: async ({ interruptMode }: any) => updateVoiceConfig({ interruptMode }),
  });

  // Expose a speakText control that will call the global runtime bridge if present
  AGENT_CONTROL.register("speakText", {
    speak: async ({ text }: { text: string }) => {
      try {
        const win: any = window as any;
        const speaker = win.__AGENTLEE_SPEAKER__ || win.__AGENTLEE_VOICE_RUNTIME__?.speak;
        if (typeof speaker === "function") {
          // prefer promise-based API
          const res = speaker(text);
          if (res && typeof (res as Promise<any>).then === "function") await res;
          return { ok: true };
        }
      } catch (e) {
        return { ok: false, error: String(e) };
      }
      // fallback: attempt direct WebSpeech
      try {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(text);
          window.speechSynthesis.speak(u);
          return { ok: true, mode: 'webspeech' };
        }
      } catch (e) {
        return { ok: false, error: String(e) };
      }
      return { ok: false, error: 'no-speaker' };
    },
  });

  return () => {
    try { AGENT_CONTROL.unregister("SystemSettingsVoice"); } catch {}
    try { AGENT_CONTROL.unregister("speakText"); } catch {}
  };
}

// Non-React bridge helpers for code that wants to call TTS outside of hooks
export function speakAgentLee(text: string) {
  try {
    const win: any = window as any;
    const speaker = win.__AGENTLEE_SPEAKER__ || win.__AGENTLEE_VOICE_RUNTIME__?.speak;
    if (typeof speaker === "function") return speaker(text);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(u);
      return;
    }
  } catch (e) {
    // swallow
  }
}

export function stopAgentLee() {
  try {
    const win: any = window as any;
    const stopper = win.__AGENTLEE_VOICE_RUNTIME__?.stop;
    if (typeof stopper === "function") return stopper();
    if (typeof window !== "undefined" && "speechSynthesis" in window) return window.speechSynthesis.cancel();
  } catch {}
}
