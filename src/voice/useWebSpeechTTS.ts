/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: CORE.VOICE.USETTS.MAIN
   REGION: 🟢 CORE
   VERSION: 1.0.2
   ============================================================================
   useWebSpeechTTS.ts

   DISCOVERY_PIPELINE:
     Voice → Intent → Location → Vertical → Ranking → Render

   SPDX-License-Identifier: MIT
   ============================================================================ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveVoice } from "./voiceResolver";
import { loadVoiceConfig } from "./voiceStore";

function splitIntoSentences(text: string): string[] {
  const t = (text || "").trim();
  if (!t) return [];
  return t
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function ensureVoicesReady(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  let voices = synth.getVoices();
  if (voices.length) return voices;

  await new Promise<void>((resolve) => {
    const on = () => {
      synth.removeEventListener("voiceschanged", on);
      resolve();
    };
    synth.addEventListener("voiceschanged", on);
    setTimeout(() => {
      try {
        synth.removeEventListener("voiceschanged", on);
      } catch {}
      resolve();
    }, 1000);
  });

  voices = synth.getVoices();
  return voices;
}

export function useWebSpeechTTS() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const queueRef = useRef<SpeechSynthesisUtterance[]>([]);
  const speakingRef = useRef(false);

  const refreshVoices = useCallback(async () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const v = await ensureVoicesReady();
    setVoices(v);
  }, []);

  useEffect(() => {
    refreshVoices();
  }, [refreshVoices]);

  useEffect(() => {
    const onCfg = () => {
      // config changed; no-op here, speak() always reads latest config
    };
    window.addEventListener("agentlee:voice-config-changed", onCfg as any);
    return () => window.removeEventListener("agentlee:voice-config-changed", onCfg as any);
  }, []);

  const stop = useCallback(() => {
    if (typeof window === "undefined") return;
    queueRef.current = [];
    speakingRef.current = false;
    setIsSpeaking(false);
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }, []);

  const speak = useCallback(
    async (text: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

      const cfg = loadVoiceConfig();
      const vlist = voices.length ? voices : await ensureVoicesReady();
      const { voice } = resolveVoice(cfg.profile, vlist);

      const chunks = splitIntoSentences(text);
      if (!chunks.length) return;

      if (cfg.interruptMode === "cancel") stop();

      const synth = window.speechSynthesis;

      const makeUtter = (s: string) => {
        const u = new SpeechSynthesisUtterance(s);
        if (voice) u.voice = voice;
        u.rate = cfg.tuning.rate;
        u.pitch = cfg.tuning.pitch;
        u.volume = cfg.tuning.volume;
        return u;
      };

      const runNext = () => {
        const next = queueRef.current.shift();
        if (!next) {
          speakingRef.current = false;
          setIsSpeaking(false);
          return;
        }
        speakingRef.current = true;
        setIsSpeaking(true);

        next.onend = () => runNext();
        next.onerror = () => runNext();
        try {
          synth.speak(next);
        } catch {
          runNext();
        }
      };

      for (const c of chunks) queueRef.current.push(makeUtter(c));
      if (!speakingRef.current) runNext();
    },
    [voices, stop]
  );

  const bargeIn = useCallback(() => stop(), [stop]);

  const resolved = useMemo(() => {
    const cfg = loadVoiceConfig();
    const { voice, reason } = resolveVoice(cfg.profile, voices);
    return { voice, reason, cfg };
  }, [voices]);

  return { voices, refreshVoices, speak, stop, bargeIn, isSpeaking, resolved };
}
