/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: CORE.APP.COMPONENT.MAIN
   REGION: 🟢 CORE
   VERSION: 1.0.0
   ============================================================================
   lakeBus.ts
   
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

export type LakeChange =
  | { type: "FILE_ADDED"; id: string; driveId: string; slotId: number }
  | { type: "FILE_UPDATED"; id: string; driveId: string; slotId: number }
  | { type: "FILE_DELETED"; id: string; driveId?: string; slotId?: number }
  | { type: "OFFLOADED"; id: string; driveId: string; slotId: number; archiveId?: string }
  | { type: "ARCHIVE_ADDED"; id: string }
  | { type: "ARCHIVE_REMOVED"; id: string }
  | { type: "RAG_UPSERT"; signature: string }
  | { type: "RAG_REBUILT" }
  | { type: "CORRUPTION_FOUND"; id: string; signature?: string; driveId: string; slotId: number }
  | { type: "CORRUPTION_PURGED"; signature?: string; ids?: string[] };

const CHANNEL = "LAKE_CHANGED";

export function emitLakeChanged(change: LakeChange) {
  try {
    const bc = new BroadcastChannel(CHANNEL);
    bc.postMessage({ at: Date.now(), change });
    bc.close();
  } catch {
    // ignore; BroadcastChannel may not be available in all environments
  }
}

export function onLakeChanged(handler: (evt: { at: number; change: LakeChange }) => void) {
  const bc = new BroadcastChannel(CHANNEL);
  bc.onmessage = (e) => handler(e.data);
  return () => bc.close();
}
