import { MemoryLakeInstance } from '../../data/memoryLake/lake';

export type RagConfig = { indexName?: string; dim?: number };

function hashToVector(text: string, dim = 32) {
  // deterministic pseudo-embedding: simple hash -> float vector
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  const v: number[] = new Array(dim);
  for (let i = 0; i < dim; i++) {
    h = Math.imul(h ^ (h >>> 13), 16777619);
    v[i] = ((h >>> 0) % 1000) / 1000; // 0..0.999
  }
  return v;
}

function cosine(a: number[], b: number[]) {
  let da = 0, db = 0, dot = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; da += a[i]*a[i]; db += b[i]*b[i]; }
  return dot / (Math.sqrt(da) * Math.sqrt(db) + 1e-12);
}

export class RagCore {
  private cfg: RagConfig;

  constructor(cfg?: RagConfig) { this.cfg = cfg || { dim: 32 }; }

  async ingest(text: string, metadata?: Record<string, any>) {
    const id = Date.now().toString();
    const ts = Date.now();
    await MemoryLakeInstance.putDoc({ id, text, ts, sourceId: metadata?.sourceId, tags: metadata?.tags });
    const vec = hashToVector(text, this.cfg.dim);
    await MemoryLakeInstance.putVector(id, vec, { textSnippet: text.slice(0,200), ts });
    await MemoryLakeInstance.appendEvent({ id: `${id}-evt`, ts, sessionId: 'local', type: 'RAG.INGEST', actor: 'system', payload: { docId: id } });
    return { id };
  }

  async query(q: string, topK = 5) {
    const qv = hashToVector(q, this.cfg.dim);
    const vs = await MemoryLakeInstance.listVectors();
    const ranked = vs.map((v: any) => ({ id: v.id, score: cosine(qv, v.vector), meta: v.meta }));
    ranked.sort((a: any,b:any)=>b.score-a.score);
    return ranked.slice(0, topK);
  }
}

export const createRagCore = (cfg?: RagConfig) => new RagCore(cfg);
