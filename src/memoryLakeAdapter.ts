/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: CORE.APP.COMPONENT.MAIN
   REGION: 🟢 CORE
   VERSION: 1.0.0
   ============================================================================
   memoryLakeAdapter.ts
   
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

const DB_NAME = 'agent-lee-neural-core';
const DB_VERSION = 4;

type LakeDrive = 'L' | 'E' | 'O' | 'N' | 'A' | 'R' | 'D' | 'LEE';

export interface MemoryLakeFile {
  id: string;              // stable id
  signature: string;       // sha256 over normalized payload
  path: string;            // prefix path
  name: string;            // human readable filename-ish
  mime: string;            // content type
  encoding: 'json' | 'text' | 'binary';
  compressed: boolean;     // gzip via CompressionStream (if used)
  content: string;         // base64 for binary OR raw text/json string
  createdAt: number;
  updatedAt: number;

  // routing metadata (optional)
  driveId?: LakeDrive;
  slotId?: number;
  tags?: string[];         // e.g. ["EMAIL", "SECURITY", "TASK", "RAG"]
  meta?: Record<string, any>;
}

interface LakeDB extends DBSchema {
  files: {
    key: string; // id
    value: MemoryLakeFile;
    indexes: {
      'by_path': string;
      'by_signature': string;
      'by_updatedAt': number;
    };
  };
  events: {
    key: string;
    value: { id: string; path: string; name: string; payload: string; createdAt: number };
    indexes: { 'by_path': string; 'by_createdAt': number };
  };
}

const channel = new BroadcastChannel('agentlee-memorylake');

function slugify(s: string) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function gzipIfPossible(text: string): Promise<{ compressed: boolean; content: string }> {
  const CS: any = (globalThis as any).CompressionStream;
  if (!CS) return { compressed: false, content: text };

  try {
    const stream = new Blob([text], { type: 'application/json' }).stream().pipeThrough(new CS('gzip'));
    const gzBlob = await new Response(stream).blob();
    const arr = new Uint8Array(await gzBlob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
    const b64 = btoa(bin);
    if (b64.length < text.length * 0.9) return { compressed: true, content: b64 };
    return { compressed: false, content: text };
  } catch {
    return { compressed: false, content: text };
  }
}

async function gunzipIfNeeded(file: MemoryLakeFile): Promise<string> {
  if (!file.compressed) return file.content;

  const DS: any = (globalThis as any).DecompressionStream;
  if (!DS) throw new Error('DecompressionStream not supported for compressed lake entries');

  const bin = atob(file.content);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const stream = new Blob([arr], { type: file.mime || 'application/octet-stream' }).stream().pipeThrough(new DS('gzip'));
  return await new Response(stream).text();
}

class MemoryLakeAdapter {
  private dbp: Promise<IDBPDatabase<LakeDB>> | null = null;

  private getDB(): Promise<IDBPDatabase<LakeDB>> {
    if (!this.dbp) {
      this.dbp = openDB<LakeDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('files')) {
            const s = db.createObjectStore('files', { keyPath: 'id' });
            s.createIndex('by_path', 'path');
            s.createIndex('by_signature', 'signature');
            s.createIndex('by_updatedAt', 'updatedAt');
          }
          if (!db.objectStoreNames.contains('events')) {
            const e = db.createObjectStore('events', { keyPath: 'id' });
            e.createIndex('by_path', 'path');
            e.createIndex('by_createdAt', 'createdAt');
          }
        },
      });
    }
    return this.dbp;
  }

  /** Write a structured event (small, always JSON, never compressed). */
  async putEvent(path: string, name: string, payload: any) {
    const db = await this.getDB();
    const id = `${path}${name}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const row = { id, path, name: slugify(name) || name, payload: JSON.stringify(payload ?? null), createdAt: Date.now() };
    await db.put('events', row);
    channel.postMessage({ type: 'LAKE_EVENT', pathPrefix: path, at: Date.now() });
  }

  /**
   * Put a file with:
   * - stable signature (sha256 of normalized text payload)
   * - stable ID derived from path + slug(name) + signature
   */
  async putFile(
    path: string,
    name: string,
    content: any,
    opts?: {
      mime?: string;
      tags?: string[];
      meta?: Record<string, any>;
      driveId?: LakeDrive;
      slotId?: number;
      compress?: boolean; // default true
    }
  ): Promise<MemoryLakeFile> {
    const db = await this.getDB();

    const mime = opts?.mime || 'application/json';
    const normalized =
      typeof content === 'string'
        ? content
        : content instanceof Blob
          ? await content.text()
          : JSON.stringify(content ?? null);

    const signature = await sha256Hex(normalized);
    const safeName = slugify(name) || `entry-${Date.now()}`;
    const id = `${slugify(path)}__${safeName}__${signature.slice(0, 16)}`;

    const compress = opts?.compress !== false;
    const payload = compress ? await gzipIfPossible(normalized) : { compressed: false, content: normalized };

    const now = Date.now();
    const existing = await db.get('files', id);

    const row: MemoryLakeFile = {
      id,
      signature,
      path,
      name: safeName,
      mime,
      encoding: mime.includes('json') ? 'json' : 'text',
      compressed: payload.compressed,
      content: payload.content,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      driveId: opts?.driveId,
      slotId: opts?.slotId,
      tags: opts?.tags || [],
      meta: opts?.meta || {},
    };

    await db.put('files', row);
    channel.postMessage({ type: 'LAKE_CHANGED', pathPrefix: path, at: now });
    return row;
  }

  async getFile(id: string): Promise<MemoryLakeFile | null> {
    const db = await this.getDB();
    return (await db.get('files', id)) || null;
  }

  async readFileText(id: string): Promise<string | null> {
    const row = await this.getFile(id);
    if (!row) return null;
    return await gunzipIfNeeded(row);
  }

  async listByPathPrefix(pathPrefix: string, limit = 500): Promise<MemoryLakeFile[]> {
    const db = await this.getDB();
    const all = await db.getAll('files');
    return all
      .filter(f => (f.path || '').startsWith(pathPrefix))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  }

  async deleteFile(id: string): Promise<boolean> {
    const db = await this.getDB();
    const existing = await db.get('files', id);
    if (!existing) return false;
    await db.delete('files', id);
    channel.postMessage({ type: 'LAKE_DELETED', id, at: Date.now() });
    return true;
  }

  async purgePathPrefix(pathPrefix: string): Promise<number> {
    const db = await this.getDB();
    const all = await db.getAll('files');
    const victims = all.filter(f => (f.path || '').startsWith(pathPrefix));
    for (const v of victims) await db.delete('files', v.id);
    channel.postMessage({ type: 'LAKE_PURGE', pathPrefix, count: victims.length, at: Date.now() });
    return victims.length;
  }
}

export const mlAdapter = new MemoryLakeAdapter();
export default mlAdapter;
