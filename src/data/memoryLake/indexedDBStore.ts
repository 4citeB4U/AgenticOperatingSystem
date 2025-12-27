export type MemoryRecord = {
  id: string;
  text: string;
  metadata?: Record<string, any>;
  createdAt?: number;
};

export class IndexedDBStore {
  private dbName = 'memoryLake';

  async open() {
    if ((this as any).db) return (this as any).db;
    return new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = (ev) => {
        const db = (ev.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('records')) {
          db.createObjectStore('records', { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).then((db) => ((this as any).db = db));
  }

  async put(record: MemoryRecord) {
    const db = await this.open();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('records', 'readwrite');
      const store = tx.objectStore('records');
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async get(id: string) {
    const db = await this.open();
    return new Promise<MemoryRecord | undefined>((resolve, reject) => {
      const tx = db.transaction('records', 'readonly');
      const store = tx.objectStore('records');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result as MemoryRecord | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  async listAll() {
    const db = await this.open();
    return new Promise<MemoryRecord[]>((resolve, reject) => {
      const tx = db.transaction('records', 'readonly');
      const store = tx.objectStore('records');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as MemoryRecord[]);
      req.onerror = () => reject(req.error);
    });
  }
}

export const createIndexedDBStore = () => new IndexedDBStore();
