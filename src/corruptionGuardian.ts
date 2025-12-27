/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: CORE.APP.COMPONENT.MAIN
   REGION: 🟢 CORE
   VERSION: 1.0.0
   ============================================================================
   corruptionGuardian.ts
   
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

import type { DriveId, NeuralFile } from './lakeCore';
import { neuralDB } from './lakeCore';
import { emitLakeChanged } from './lakeBus';

export type CorruptionFinding = {
  file: NeuralFile;
  reason: string;
};

export function isLikelyCorrupt(file: NeuralFile): { corrupt: boolean; suspect: boolean; reason: string } {
  if (typeof file.content === 'string' && file.content.includes('CORRUPTED_SECTOR_DATA')) {
    return { corrupt: true, suspect: false, reason: 'Corrupted sector marker detected' };
  }
  if (file.status === 'offloaded') return { corrupt: false, suspect: false, reason: 'Offloaded external reference' };
  if (!file.content && file.sizeBytes > 1024 * 256) {
    return { corrupt: false, suspect: true, reason: 'Large file has null content (possible broken reference)' };
  }
  const ext = (file.extension || '').toLowerCase();
  if (file.category === 'code' && !['js', 'ts', 'tsx', 'json'].includes(ext)) {
    return { corrupt: false, suspect: true, reason: 'Code category with unusual extension' };
  }
  return { corrupt: false, suspect: false, reason: 'No signal' };
}

export async function scanLake(scope?: { driveId?: DriveId; slotId?: number; pathPrefix?: string }) {
  const all = scope?.driveId ? await neuralDB.getFilesByDrive(scope.driveId) : await neuralDB.getAllFiles();
  const filtered = all.filter((f: NeuralFile) => {
    if (scope?.slotId && f.slotId !== scope.slotId) return false;
    if (scope?.pathPrefix && !(f.path || '').startsWith(scope.pathPrefix)) return false;
    return true;
  });

  const findings: CorruptionFinding[] = [];

  for (const f of filtered) {
    const res = isLikelyCorrupt(f);
    if (res.corrupt || res.suspect || f.status === 'corrupt' || f.status === 'suspect') {
      findings.push({ file: f, reason: res.reason });
      emitLakeChanged({ type: 'CORRUPTION_FOUND', id: f.id, signature: f.signature, driveId: f.driveId, slotId: f.slotId });
    }
  }

  return findings;
}

export async function purgeFile(id: string) {
  await neuralDB.deleteFile(id);
  emitLakeChanged({ type: 'CORRUPTION_PURGED', ids: [id] });
}

export async function purgeSignature(signature: string) {
  const copies = await neuralDB.getCopies(signature);
  const ids = copies.map((c: NeuralFile) => c.id);
  for (const c of copies) await neuralDB.deleteFile(c.id);
  emitLakeChanged({ type: 'CORRUPTION_PURGED', signature, ids });
}
