import { ToolSpec } from './toolSpec';

const DB_NAME = 'agentlee_tools';
const STORE = 'tool_specs';

export class PersistentRegistry {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDb() {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((res, rej) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e: any) => {
        const db = e.target.result as IDBDatabase;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    return this.dbPromise;
  }

  async put(spec: ToolSpec) {
    const db = await this.openDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(spec);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async get(id: string) {
    const db = await this.openDb();
    return new Promise<ToolSpec | undefined>((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id as any);
      req.onsuccess = () => resolve(req.result as ToolSpec | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  async list() {
    const db = await this.openDb();
    return new Promise<ToolSpec[]>((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result as ToolSpec[]);
      req.onerror = () => reject(req.error);
    });
  }
}

export const persistentRegistry = new PersistentRegistry();
