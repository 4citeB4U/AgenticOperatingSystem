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

  return () => AGENT_CONTROL.unregister("SystemSettingsVoice");
}
