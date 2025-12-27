/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: CORE.VOICE.TYPES.MAIN
   REGION: 🟢 CORE
   VERSION: 1.0.1
   ============================================================================
   voiceTypes.ts

   DISCOVERY_PIPELINE:
     Voice → Intent → Location → Vertical → Ranking → Render

   SPDX-License-Identifier: MIT
   ============================================================================ */

export type GenderHint = "male" | "female" | "neutral";

export type AgentLeeVoiceProfile = {
  langBase: string;              // "en"
  langFull?: string;             // "en-US"
  gender?: GenderHint;
  preferLocalService?: boolean;  // prefer voice.localService === true
  nameHints?: string[];          // ["jenny","zira","samantha"]
  categoryHints?: string[];      // ["Google","Microsoft","Apple"]
  pinnedVoiceURI?: string;       // best-effort within same browser only
};

export type AgentLeeVoiceTuning = {
  rate: number;    // 0.5 - 2
  pitch: number;   // 0 - 2
  volume: number;  // 0 - 1
};

export type VoiceConfigState = {
  profile: AgentLeeVoiceProfile;
  tuning: AgentLeeVoiceTuning;
  interruptMode: "cancel" | "queue";
};
