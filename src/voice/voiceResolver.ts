/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: CORE.VOICE.RESOLVER.MAIN
   REGION: 🟢 CORE
   VERSION: 1.0.1
   ============================================================================
   voiceResolver.ts

   DISCOVERY_PIPELINE:
     Voice → Intent → Location → Vertical → Ranking → Render

   SPDX-License-Identifier: MIT
   ============================================================================ */

import type { AgentLeeVoiceProfile, GenderHint } from "./voiceTypes";

const norm = (s: string) => (s || "").toLowerCase().trim();

function scoreGender(name: string, target?: GenderHint): number {
  if (!target || target === "neutral") return 0;
  const n = norm(name);
  const femaleHints = ["female", "woman", "girl", "jenny", "zira", "samantha", "victoria"];
  const maleHints = ["male", "man", "boy", "david", "mark", "alex", "daniel"];
  const hit =
    target === "female"
      ? femaleHints.some((h) => n.includes(h))
      : maleHints.some((h) => n.includes(h));
  return hit ? 15 : 0;
}

function scoreLang(voice: SpeechSynthesisVoice, profile: AgentLeeVoiceProfile): number {
  const vlang = norm(voice.lang);
  const base = norm(profile.langBase);
  const full = norm(profile.langFull ?? "");
  if (full && vlang === full) return 35;
  if (base && vlang.startsWith(base)) return 20;
  return 0;
}

function scoreHints(name: string, profile: AgentLeeVoiceProfile): number {
  const n = norm(name);
  let s = 0;

  for (const h of profile.nameHints ?? []) {
    if (h && n.includes(norm(h))) s += 20;
  }
  for (const c of profile.categoryHints ?? []) {
    if (c && n.includes(norm(c))) s += 10;
  }
  return s;
}

function scoreLocalService(voice: SpeechSynthesisVoice, profile: AgentLeeVoiceProfile): number {
  if (!profile.preferLocalService) return 0;
  return voice.localService ? 10 : 0;
}

export function resolveVoice(
  profile: AgentLeeVoiceProfile,
  voices: SpeechSynthesisVoice[]
): { voice: SpeechSynthesisVoice | null; reason: string } {
  if (!voices?.length) return { voice: null, reason: "no-voices" };

  if (profile.pinnedVoiceURI) {
    const exact = voices.find((v) => v.voiceURI === profile.pinnedVoiceURI);
    if (exact) return { voice: exact, reason: "pinnedVoiceURI" };
  }

  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -1;

  for (const v of voices) {
    const s =
      scoreLang(v, profile) +
      scoreHints(v.name, profile) +
      scoreGender(v.name, profile.gender) +
      scoreLocalService(v, profile);

    if (s > bestScore) {
      bestScore = s;
      best = v;
    }
  }

  if (best) return { voice: best, reason: `scored:${bestScore}` };

  const def = voices.find((v) => (v as any).default) ?? voices[0];
  return { voice: def ?? null, reason: "default-fallback" };
}
