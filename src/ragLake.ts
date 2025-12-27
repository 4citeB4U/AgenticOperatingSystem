/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: AI.ORCHESTRATION.RAG.LAKEYSTORE
   REGION: 🧠 AI
   VERSION: 2.0.0
   ============================================================================
   ragLake.ts

   Upgrades:
   - Deterministic embedding fallback stays (no hard failure)
   - Adds: delete by signature, purge all, prune stale refs
   - Logs every RAG mutation to Memory Lake (local-only)

   DISCOVERY_PIPELINE:
     MODEL=Voice>Intent>Location>Vertical>Ranking>Render;
     ROLE=rag;
     INTENT_SCOPE=retrieve-and-rank;
     LOCATION_DEP=indexeddb;
     VERTICALS=rag;
     RENDER_SURFACE=in-app;
     SPEC_REF=LEEWAY.v12.DiscoveryArchitecture

   SPDX-License-Identifier: MIT
   ============================================================================ */

import { DBSchema, openDB } from "idb";
import { CORE_REGISTRY } from "./coreRegistry";
import { emitLakeChanged } from "./lakeBus";
import type { DriveId, NeuralFile } from "./lakeCore";
import { neuralDB } from "./lakeCore";
import { LocalModelHub } from "./LocalModelHub";
import { mlAdapter } from "./memoryLakeAdapter";

const DEFAULT_EMBED_MODEL: string = (CORE_REGISTRY as any).EMBED?.repo || "/models/qwen3-embedding-0.6b-q4";

interface RagDB extends DBSchema {
  vectors: {
    key: string;
    value: {
      signature: string;
      dim: number;
      vector: number[];
      updatedAt: number;
      createdAt: number;
      refs: { fileId: string; driveId: DriveId; slotId: number; name: string; updatedAt: number }[];
      preview: string;
      modelRepo: string;
    };
    indexes: {
      "by_updatedAt": number;
    };
  };
}

const RAG_DB_NAME = "agent-lee-rag";
const RAG_DB_VERSION = 2;

async function getRagDB() {
  return openDB<RagDB>(RAG_DB_NAME, RAG_DB_VERSION, {
    upgrade(db, oldVersion, newVersion, tx) {
      if (oldVersion < 1) {
        const s = db.createObjectStore("vectors", { keyPath: "signature" });
        s.createIndex("by_updatedAt", "updatedAt");
      } else if (oldVersion < 2) {
        if (tx) {
          const s = (tx as any).objectStore("vectors");
          if (!s.indexNames.contains("by_updatedAt")) s.createIndex("by_updatedAt", "updatedAt");
        }
      }
    },
  });
}

type Embedder = (text: string) => Promise<number[]>;
let _embedder: Embedder | null = null;

function fallbackVector(text: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return new Array(16).fill(0).map((_, i) => ((h >> (i % 24)) & 0xff) / 255);
}

export async function loadEmbedder(): Promise<Embedder> {
  if (_embedder) return _embedder;

    _embedder = async (text: string) => {
    try {
      const vec = await LocalModelHub.embedText(text);
      if (Array.isArray(vec) && vec.length > 0) return vec;
    } catch (e) {
      console.warn("[ragLake] embedText failed; using fallback", e);
    }
    return fallbackVector(text);
  };

  return _embedder;
}

function cosine(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length);
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i], y = b[i];
    dot += x * y; aa += x * x; bb += y * y;
  }
  return dot / (Math.sqrt(aa) * Math.sqrt(bb) + 1e-9);
}

/** Upsert embeddings for a lake file */
export async function ragUpsertFromFile(file: NeuralFile, text: string) {
  const embed = await loadEmbedder();
  const vec = await embed(text);

  const db = await getRagDB();
  const existing = await db.get("vectors", file.signature);

  const now = Date.now();
  const refs = existing?.refs ?? [];
  const alreadyIdx = refs.findIndex(r => r.fileId === file.id);

  const nextRefs =
    alreadyIdx >= 0
      ? refs.map((r, i) => (i === alreadyIdx ? { ...r, updatedAt: now } : r))
      : refs.concat([{ fileId: file.id, driveId: file.driveId, slotId: file.slotId, name: file.name, updatedAt: now }]);

  await db.put("vectors", {
    signature: file.signature,
    dim: vec.length,
    vector: vec,
    updatedAt: now,
    createdAt: existing?.createdAt || now,
    refs: nextRefs,
    preview: text.slice(0, 280),
    modelRepo: DEFAULT_EMBED_MODEL,
  });

  emitLakeChanged({ type: "RAG_UPSERT", signature: file.signature });

  // Local-only audit
  void mlAdapter.putEvent("rag/logs/", `rag_upsert_${now}`, {
    signature: file.signature,
    fileId: file.id,
    driveId: file.driveId,
    slotId: file.slotId,
    name: file.name,
    dim: vec.length,
    modelRepo: DEFAULT_EMBED_MODEL,
  });
}

/** Search */
export async function ragSearch(query: string, topK = 6) {
  const embed = await loadEmbedder();
  const q = await embed(query);

  const db = await getRagDB();
  const all = await db.getAll("vectors");

  const scored = all
    .map((row) => ({ row, score: cosine(q, row.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  void mlAdapter.putEvent("rag/logs/", `rag_search_${Date.now()}`, {
    queryPreview: query.slice(0, 160),
    topK,
    hits: scored.length,
  });

  return scored;
}

/** Remove a single vector row */
export async function ragDeleteSignature(signature: string): Promise<boolean> {
  const db = await getRagDB();
  const existing = await db.get("vectors", signature);
  if (!existing) return false;
  await db.delete("vectors", signature);
  emitLakeChanged({ type: "RAG_REBUILT" });
  void mlAdapter.putEvent("rag/logs/", `rag_delete_${Date.now()}`, { signature });
  return true;
}

/** Purge all vectors (useful for resets) */
export async function ragPurgeAll(): Promise<number> {
  const db = await getRagDB();
  const all = await db.getAll("vectors");
  for (const r of all) await db.delete("vectors", r.signature);
  emitLakeChanged({ type: "RAG_REBUILT" });
  void mlAdapter.putEvent("rag/logs/", `rag_purge_${Date.now()}`, { count: all.length });
  return all.length;
}

/** Rebuild from lake; also prunes refs to missing files */
export async function ragRebuildFromLake() {
  const files = await neuralDB.getAllFiles();
  const fileIdSet = new Set(files.map(f => f.id));

  // Upsert all valid text content
  for (const f of files) {
    if (typeof f.content !== "string") continue;
    const text = f.content?.trim();
    if (!text || text.length < 8) continue;
    await ragUpsertFromFile(f, text);
  }

  // Prune refs for missing file IDs
  const db = await getRagDB();
  const allVec = await db.getAll("vectors");
  for (const v of allVec) {
    const nextRefs = v.refs.filter(r => fileIdSet.has(r.fileId));
    if (nextRefs.length !== v.refs.length) {
      await db.put("vectors", { ...v, refs: nextRefs, updatedAt: Date.now() });
    }
  }

  emitLakeChanged({ type: "RAG_REBUILT" });
  void mlAdapter.putEvent("rag/logs/", `rag_rebuild_${Date.now()}`, { files: files.length, vectors: allVec.length });
}

// Backwards-compatible aliases expected by some tools
export const ragQuery = ragSearch;

export async function ragUpsert(args: { id?: string; signature?: string; driveId: string; slotId: number; path?: string; name: string; text: string; meta?: any; }) {
  // Construct a lightweight NeuralFile-like object for upsert convenience
  const file: any = {
    id: args.id || `${args.driveId}-${args.slotId}-${Date.now()}`,
    driveId: args.driveId,
    slotId: args.slotId,
    name: args.name || 'doc',
    path: args.path || '',
    content: args.text,
    signature: args.signature || `SIG_${Math.abs(Math.floor(Math.random()*1e9))}`,
    lastModified: Date.now(),
  };

  await ragUpsertFromFile(file, args.text);
  return { id: file.id, signature: file.signature };
}

