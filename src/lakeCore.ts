/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: CORE.APP.COMPONENT.MAIN
   REGION: 🟢 CORE
   VERSION: 1.0.0
   ============================================================================
   lakeCore.ts
   
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

import { DBSchema, IDBPDatabase, openDB } from 'idb';
import { emitLakeChanged } from './lakeBus';

// DB Names
const DB_NAME_CORE = 'agent-lee-neural-core';
const DB_VERSION_CORE = 3;
const DB_NAME_COLD = 'agent-lee-cold-store';
const DB_VERSION_COLD = 1;

export type DriveId = "L" | "E" | "O" | "N" | "A" | "R" | "D" | "LEE";
export type CorruptionStatus = "safe" | "suspect" | "corrupt" | "offloaded"; 
export type FileCategory = "code" | "data" | "doc" | "media" | "sys" | "archive" | "intelligence";

export interface ExternalRef {
    type: 'opfs' | 'handle';
    path: string;
    archiveId?: string;
}

export interface NeuralFile {
  id: string;
  driveId: DriveId;
  slotId: number;
  name: string;
  path: string;
  extension: string;
  sizeBytes: number;
  content: string | Blob | null;
  category: FileCategory;
  status: CorruptionStatus;
  lastModified: number;
  signature: string;
  annotations: { id: string; text: string; timestamp: string }[];
  vector?: number[];
  externalRef?: ExternalRef;
}

export interface ColdArchiveEntry {
  id: string;
  name: string;
  sizeBytes: number;
  createdAt: number;
  path: string;
  mimeType: string;
  originalDriveId?: string;
  originalSlotId?: number;
}

function normalizePath(path: string): string {
  return path.replace(/^opfs:\//, "").replace(/^\/+/, "");
}

async function getOpfsRoot(): Promise<FileSystemDirectoryHandle> {
  // may throw if OPFS not available
  // callers should handle errors
  // @ts-ignore
  return await navigator.storage.getDirectory();
}

export async function opfsWriteFile(path: string, blob: Blob): Promise<void> {
  const rel = normalizePath(path);
  const parts = rel.split("/").filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) throw new Error(`Invalid OPFS path: ${path}`);

  let dir = await getOpfsRoot();
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create: true });
  }

  const fh = await dir.getFileHandle(fileName, { create: true });
  const w = await fh.createWritable();
  await w.write(blob);
  await w.close();
}

export async function opfsReadFile(path: string): Promise<File> {
  const rel = normalizePath(path);
  const parts = rel.split("/").filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) throw new Error(`Invalid OPFS path: ${path}`);

  let dir = await getOpfsRoot();
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create: false });
  }

  const fh = await dir.getFileHandle(fileName, { create: false });
  return await fh.getFile();
}

export async function opfsDeleteFile(path: string): Promise<void> {
  const rel = normalizePath(path);
  const parts = rel.split("/").filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) return;

  try {
    let dir = await getOpfsRoot();
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create: false });
    }
    await dir.removeEntry(fileName);
  } catch (e) {
    console.warn("Failed to delete OPFS file:", path, e);
  }
}

// Cold store DB
interface ColdDB extends DBSchema {
  archives: { key: string; value: ColdArchiveEntry };
}

class ColdStorageLink {
  private dbPromise = openDB<ColdDB>(DB_NAME_COLD, DB_VERSION_COLD, {
    upgrade(db) {
      db.createObjectStore('archives', { keyPath: 'id' });
    },
  });

  async addArchive(blob: Blob, meta: Omit<ColdArchiveEntry, 'path' | 'createdAt' | 'sizeBytes'>): Promise<ColdArchiveEntry> {
    const path = `archives/${meta.id}_${meta.name}`;
    await opfsWriteFile(path, blob);

    const entry: ColdArchiveEntry = {
      ...meta,
      path,
      sizeBytes: blob.size,
      createdAt: Date.now(),
    };

    const db = await this.dbPromise;
    await db.put('archives', entry);
    emitLakeChanged({ type: 'ARCHIVE_ADDED', id: entry.id });
    return entry;
  }

  async getArchiveBlob(id: string): Promise<Blob | null> {
    const db = await this.dbPromise;
    const entry = await db.get('archives', id);
    if (!entry) return null;
    try {
      return await opfsReadFile(entry.path);
    } catch (e) {
      console.error("Failed to read cold archive:", e);
      return null;
    }
  }

  async removeArchive(id: string) {
    const db = await this.dbPromise;
    const entry = await db.get('archives', id);
    if (entry) {
      await opfsDeleteFile(entry.path);
      await db.delete('archives', id);
      emitLakeChanged({ type: 'ARCHIVE_REMOVED', id });
    }
  }

  async listArchives(): Promise<ColdArchiveEntry[]> {
    const db = await this.dbPromise;
    return db.getAll('archives');
  }
}

export const coldStore = new ColdStorageLink();

// Neural DB
interface NeuralDB extends DBSchema {
  files: {
    key: string;
    value: NeuralFile;
    indexes: { 'by-slot': [string, number]; 'by-signature': string };
  };
  meta: { key: string; value: { initialized: boolean } };
}

class NeuralLink {
  private dbPromise: Promise<IDBPDatabase<NeuralDB>>;

  constructor() {
    this.dbPromise = openDB<NeuralDB>(DB_NAME_CORE, DB_VERSION_CORE, {
      upgrade(db, oldVersion) {
        if (oldVersion < 3) {
          if (db.objectStoreNames.contains('files')) {
            // migration placeholder
          }
        }
        if (!db.objectStoreNames.contains('files')) {
          const fileStore = db.createObjectStore('files', { keyPath: 'id' });
          fileStore.createIndex('by-slot', ['driveId', 'slotId']);
          fileStore.createIndex('by-signature', 'signature');
        }
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      },
    });
    this.initializeCore();
  }

  private async initializeCore() {
    const db = await this.dbPromise;
    const meta = await db.get('meta', 'init');
    if (!meta) {
      console.log("Agent Lee: Initializing Neural Grid...");
      await db.put('meta', { initialized: true }, 'init');
    }
  }

  async getFiles(driveId: DriveId, slotId: number): Promise<NeuralFile[]> {
    const db = await this.dbPromise;
    return db.getAllFromIndex('files', 'by-slot', [driveId, slotId]);
  }

  async getFilesByDrive(driveId: DriveId): Promise<NeuralFile[]> {
    const db = await this.dbPromise;
    const range = IDBKeyRange.bound([driveId, 0], [driveId, 100]);
    return db.getAllFromIndex('files', 'by-slot', range);
  }

  async getAllFiles(): Promise<NeuralFile[]> {
    const db = await this.dbPromise;
    return db.getAll('files');
  }

  async getCopies(signature: string): Promise<NeuralFile[]> {
    const db = await this.dbPromise;
    return db.getAllFromIndex('files', 'by-signature', signature);
  }

  async addFile(file: NeuralFile) {
    const db = await this.dbPromise;
    await db.put('files', file);
    emitLakeChanged({ type: 'FILE_ADDED', id: file.id, driveId: file.driveId, slotId: file.slotId });
  }

  async updateVector(id: string, vector: number[] | null) {
    const db = await this.dbPromise;
    const f = await db.get('files', id);
    if (!f) return;
    (f as any).vector = vector || null;
    await db.put('files', f);
    emitLakeChanged({ type: 'FILE_UPDATED', id: f.id, driveId: f.driveId, slotId: f.slotId });
  }

  async renameFile(id: string, newName: string) {
    const db = await this.dbPromise;
    const f = await db.get('files', id);
    if (f) {
      f.name = newName;
      f.lastModified = Date.now();
      await db.put('files', f);
      emitLakeChanged({ type: 'FILE_UPDATED', id: f.id, driveId: f.driveId, slotId: f.slotId });
    }
  }

  async deleteFile(id: string) {
    const db = await this.dbPromise;
    const f = await db.get('files', id);
    await db.delete('files', id);
    emitLakeChanged({ type: 'FILE_DELETED', id, driveId: f?.driveId, slotId: f?.slotId });
  }

  async updateStatus(id: string, status: CorruptionStatus) {
    const db = await this.dbPromise;
    const f = await db.get('files', id);
    if (f) { f.status = status; await db.put('files', f); emitLakeChanged({ type: 'FILE_UPDATED', id: f.id, driveId: f.driveId, slotId: f.slotId }); }
  }

  async offload(id: string, ref: ExternalRef) {
    const db = await this.dbPromise;
    const f = await db.get('files', id);
    if (f) {
      f.content = null;
      f.status = 'offloaded';
      f.externalRef = ref;
      f.lastModified = Date.now();
      await db.put('files', f);
      emitLakeChanged({ type: 'OFFLOADED', id: f.id, driveId: f.driveId, slotId: f.slotId, archiveId: ref.archiveId });
    }
  }
}

export const neuralDB = new NeuralLink();
