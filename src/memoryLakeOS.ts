/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: CORE.APP.COMPONENT.MAIN
   REGION: 🟢 CORE
   VERSION: 1.0.0
   ============================================================================
   memoryLakeOS.ts
   
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

import { emitLakeChanged } from "./lakeBus";
import type { ColdArchiveEntry, CorruptionStatus, DriveId, ExternalRef, FileCategory, NeuralFile } from "./lakeCore";
import { coldStore, neuralDB } from "./lakeCore";

export type ArtifactKind =
  | "email"
  | "call"
  | "contact"
  | "note"
  | "task"
  | "attachment"
  | "research"
  | "image_observation";

export type CreateArtifactInput = {
  kind: ArtifactKind;
  driveId: DriveId;
  slotId: number;
  name: string;
  path?: string;
  category: FileCategory;
  content: string | Blob;
  signature: string;
  annotations?: NeuralFile["annotations"];
  status?: CorruptionStatus;
  lastModified?: number;
};

export function slotStrategyFromStableKey(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (Math.abs(h) % 8) + 1;
}

export function makeSignature(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
  return `SIG_${Math.abs(h)}`;
}

export function inferExtension(name: string, category: FileCategory) {
  const lower = name.toLowerCase();
  const ext = lower.includes(".") ? lower.split(".").pop()! : "";
  if (ext) return ext;
  if (category === "media") return "bin";
  if (category === "code") return "ts";
  if (category === "doc") return "txt";
  return "dat";
}

export async function createArtifact(input: CreateArtifactInput): Promise<NeuralFile> {
  const now = Date.now();
  const path = input.path ?? "";
  const extension = inferExtension(input.name, input.category);

  const sizeBytes =
    typeof input.content === "string"
      ? new Blob([input.content], { type: "text/plain" }).size
      : input.content.size;

  const nf: NeuralFile = {
    id: `${input.driveId}-${input.slotId}-${now}-${Math.random()}`,
    driveId: input.driveId,
    slotId: input.slotId,
    name: input.name,
    path,
    extension,
    sizeBytes,
    content: input.content,
    category: input.category,
    status: input.status ?? "safe",
    lastModified: input.lastModified ?? now,
    signature: input.signature,
    annotations: input.annotations ?? [],
  } as NeuralFile;

  await neuralDB.addFile(nf);
  emitLakeChanged({ type: "FILE_ADDED", id: nf.id, driveId: nf.driveId, slotId: nf.slotId });
  return nf;
}

export async function offloadToColdStore(file: NeuralFile): Promise<{ archive: ColdArchiveEntry; ref: ExternalRef }> {
  if (!file.content) throw new Error("Cannot offload: file has no content");
  const blob = file.content instanceof Blob ? file.content : new Blob([file.content], { type: "text/plain" });

  const archive = await coldStore.addArchive(blob, {
    id: file.id,
    name: file.name,
    mimeType: blob.type || "application/octet-stream",
    originalDriveId: file.driveId,
    originalSlotId: file.slotId,
  });

  const ref: ExternalRef = { type: "opfs", path: archive.path, archiveId: archive.id };
  await neuralDB.offload(file.id, ref);
  return { archive, ref };
}

export async function registerExternalSegmentLink(opts: {
  driveId: DriveId;
  slotId: number;
  displayName: string;
  externalPath: string;
  signatureKey: string;
}) {
  const signature = makeSignature(`SEGMENT:${opts.signatureKey}:${opts.externalPath}`);
  const content = JSON.stringify({
    type: "SEGMENT_LINK",
    externalPath: opts.externalPath,
    createdAt: Date.now(),
  });

  const link = await createArtifact({
    kind: "research",
    driveId: opts.driveId,
    slotId: opts.slotId,
    name: `${opts.displayName}.segment.link.json`,
    category: "sys",
    content,
    signature,
    annotations: [{ id: "seg", text: "External 1GB memory segment link (Lake remains lightweight).", timestamp: new Date().toISOString() }],
  });

  emitLakeChanged({ type: "FILE_UPDATED", id: link.id, driveId: link.driveId, slotId: link.slotId });
  return link;
}

/**
 * Export a CAD spec into the Memory Lake as a JSON artifact (minimal stub).
 * Returns the created artifact record.
 */
export async function exportCadToLake(opts: {
  driveId: DriveId;
  slotId: number;
  name: string;
  spec: any;
  alsoDownload?: boolean;
}) {
  const signature = makeSignature(`CAD:${opts.name}:${Date.now()}`);
  const content = JSON.stringify({ spec: opts.spec, exportedAt: Date.now() }, null, 2);
  const art = await createArtifact({
    kind: 'attachment',
    driveId: opts.driveId,
    slotId: opts.slotId,
    name: `${opts.name}.cad.json`,
    category: 'media',
    content,
    path: '',
    signature,
  } as any);

  if (opts.alsoDownload) {
    try {
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = art.name;
      a.click();
    } catch {}
  }

  return art;
}
