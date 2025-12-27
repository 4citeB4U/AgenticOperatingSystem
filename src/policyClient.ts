/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: CORE.APP.COMPONENT.MAIN
   REGION: 🟢 CORE
   VERSION: 1.0.0
   ============================================================================
   policyClient.ts
   
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

export type CapabilityId =
  | 'REMOTE_LLM'
  | 'GENAI_TTS'
  | 'WEB_CAMERA'
  | 'MICROPHONE'
  | 'FS_EXPORT'
  | 'FS_IMPORT';

export interface PolicyProfile {
  id: string;
  label: string;
  zeroEgress: boolean;
  overrides: Partial<Record<CapabilityId, boolean>>;
}

function loadProfile(): PolicyProfile {
  try {
    const raw = localStorage.getItem('agent_lee_policy_profile');
    if (!raw) return { id: 'LEEWAY_ZERO_EGRESS', label: 'Leeway Zero-Egress', zeroEgress: true, overrides: {} };
    const parsed = JSON.parse(raw) as PolicyProfile;
    if (parsed && parsed.id) return parsed;
  } catch (e) {
    // ignore
  }
  return { id: 'LEEWAY_ZERO_EGRESS', label: 'Leeway Zero-Egress', zeroEgress: true, overrides: {} };
}

export function isAllowed(cap: CapabilityId): boolean {
  const profile = loadProfile();
  const override = profile.overrides[cap];
  if (typeof override === 'boolean') return override;
  if (profile.zeroEgress) {
    // block any REMOTE_API capabilities
    if (cap === 'REMOTE_LLM' || cap === 'GENAI_TTS') return false;
  }
  return true;
}

export function requireCapability(cap: CapabilityId) {
  if (!isAllowed(cap)) throw new Error(`[POLICY BLOCK] ${cap} is disabled by policy profile.`);
}

export default { isAllowed, requireCapability };
