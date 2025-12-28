/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: UI.COMPONENT.VOICERUNTIME.MAIN
   REGION: 🔵 UI
   VERSION: 1.0.0
   ============================================================================
   VoiceRuntimeProvider.tsx

   DISCOVERY_PIPELINE:
     Voice → Intent → Location → Vertical → Ranking → Render

   SPDX-License-Identifier: MIT
   ============================================================================ */

import React, { createContext, useContext, useEffect, useMemo } from "react";
import { useWebSpeechTTS } from "./useWebSpeechTTS";

type VoiceRuntime = {
  say: (text: string) => Promise<void> | void;
  stop: () => void;
  isSpeaking: boolean;
};

const Ctx = createContext<VoiceRuntime | null>(null);

export function VoiceRuntimeProvider(props: { children: React.ReactNode }) {
  const tts = useWebSpeechTTS();

  const api = useMemo<VoiceRuntime>(() => {
    return {
      say: async (text: string) => tts.speak(text),
      stop: () => tts.stop(),
      isSpeaking: tts.isSpeaking,
    };
  }, [tts]);

  // optional bridge for non-React code
  useEffect(() => {
    try {
      const win: any = window as any;
      win.__AGENTLEE_SPEAKER__ = api.say;
      // expose the full runtime for non-React consumers
      win.__AGENTLEE_VOICE_RUNTIME__ = api;
    } catch {}
    return () => {
      try {
        const win: any = window as any;
        if (win.__AGENTLEE_SPEAKER__) delete win.__AGENTLEE_SPEAKER__;
        if (win.__AGENTLEE_VOICE_RUNTIME__) delete win.__AGENTLEE_VOICE_RUNTIME__;
      } catch {}
    };
  }, [api]);

  return <Ctx.Provider value={api}>{props.children}</Ctx.Provider>;
}

export function useVoiceRuntime() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useVoiceRuntime must be used within VoiceRuntimeProvider");
  return v;
}
