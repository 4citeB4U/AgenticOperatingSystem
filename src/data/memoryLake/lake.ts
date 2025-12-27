export type LakeEvent = {
  id: string;
  ts: number;
  sessionId: string;
  type: string;
  actor: 'user' | 'agent' | 'system';
  toolId?: string;
  inputHash?: string;
  outputHash?: string;
  refs?: { artifactIds?: string[]; docChunkIds?: string[]; cadModelIds?: string[]; eventIds?: string[] };
  payload?: any;
  privacy?: 'local' | 'sensitive';
};

const DB = 'agentlee_memorylake';

export class MemoryLake {
  private dbP: Promise<IDBDatabase> | null = null;

  private open() {
    if (this.dbP) return this.dbP;
    this.dbP = new Promise((res, rej) => {
      const rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = (e: any) => {
        const db = e.target.result as IDBDatabase;
        if (!db.objectStoreNames.contains('events')) db.createObjectStore('events', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('artifacts')) db.createObjectStore('artifacts', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('vectors')) db.createObjectStore('vectors', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('cad_models')) db.createObjectStore('cad_models', { keyPath: 'id' });
      };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
    return this.dbP;
  }

  async appendEvent(ev: LakeEvent) {
    const db = await this.open();
    return new Promise<void>((res, rej) => {
      const tx = db.transaction('events', 'readwrite');
      tx.objectStore('events').put(ev);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  async putDoc(doc: { id: string; text: string; ts: number; sourceId?: string; tags?: string[] }) {
    const db = await this.open();
    return new Promise<void>((res, rej) => {
      const tx = db.transaction('docs', 'readwrite');
      tx.objectStore('docs').put(doc as any);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  async listDocs() {
    const db = await this.open();
    return new Promise<any[]>((res, rej) => {
      const req = db.transaction('docs', 'readonly').objectStore('docs').getAll();
      req.onsuccess = () => res(req.result as any[]);
      req.onerror = () => rej(req.error);
    });
  }

  async putVector(id: string, vector: number[], meta: any = {}) {
    const db = await this.open();
    return new Promise<void>((res, rej) => {
      const tx = db.transaction('vectors', 'readwrite');
      tx.objectStore('vectors').put({ id, vector, meta });
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  async listVectors() {
    const db = await this.open();
    return new Promise<any[]>((res, rej) => {
      const req = db.transaction('vectors', 'readonly').objectStore('vectors').getAll();
      req.onsuccess = () => res(req.result as any[]);
      req.onerror = () => rej(req.error);
    });
  }
}

export const MemoryLakeInstance = new MemoryLake();
