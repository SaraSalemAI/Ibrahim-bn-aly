// IndexedDB persistence. Source files are stored as parsed, frozen records together with their SHA-256 hash.
// The audit trail is append-only and hash-chained so any alteration is detectable.
import type { AuditLogEntry, SourceFile } from '../engine/types';
import { sha256Text } from '../engine/values';

const DB = 'sumed-audit';
const VERSION = 1;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let dbp: Promise<IDBDatabase> | null = null;
const db = () => (dbp ??= open());

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then((d) => new Promise<T>((resolve, reject) => {
    const t = d.transaction(store, mode);
    const r = fn(t.objectStore(store));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}

function freezeFile(f: SourceFile): SourceFile {
  for (const t of f.tables) { for (const r of t.rows) { Object.freeze(r.values); Object.freeze(r); } Object.freeze(t.rows); }
  return f;
}

export const store = {
  async allFiles(): Promise<SourceFile[]> {
    try { return ((await tx<SourceFile[]>('files', 'readonly', (s) => s.getAll() as IDBRequest<SourceFile[]>)) ?? []).map(freezeFile).sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt)); } catch { return []; }
  },
  putFile: (f: SourceFile) => tx('files', 'readwrite', (s) => s.put(f)).catch(() => undefined),
  deleteFile: (id: string) => tx('files', 'readwrite', (s) => s.delete(id)).catch(() => undefined),
  async get<T>(key: string, fallback: T): Promise<T> {
    try { const v = await tx<T>('kv', 'readonly', (s) => s.get(key) as IDBRequest<T>); return v === undefined ? fallback : v; } catch { return fallback; }
  },
  set: <T>(key: string, value: T) => tx('kv', 'readwrite', (s) => s.put(value, key)).catch(() => undefined),
  async clearAll() {
    const d = await db();
    await new Promise<void>((res) => { const t = d.transaction(['files', 'kv'], 'readwrite'); t.objectStore('files').clear(); t.objectStore('kv').clear(); t.oncomplete = () => res(); });
  },
};

export async function appendLog(log: AuditLogEntry[], e: Omit<AuditLogEntry, 'seq' | 'ts' | 'prevHash' | 'hash'>): Promise<AuditLogEntry[]> {
  const prev = log[log.length - 1];
  const seq = (prev?.seq ?? 0) + 1;
  const ts = new Date().toISOString();
  const prevHash = prev?.hash ?? 'GENESIS';
  const { user, role, action, target, detail } = e;
  const hash = await sha256Text(JSON.stringify({ seq, ts, user, role, action, target, detail, prevHash }));
  return [...log, { seq, ts, user, role, action, target, detail, prevHash, hash }];
}

/** Re-compute the hash chain; returns the first broken sequence number, or null when intact. */
export async function verifyLog(log: AuditLogEntry[]): Promise<number | null> {
  let prev = 'GENESIS';
  for (const e of log) {
    const { seq, ts, user, role, action, target, detail } = e;
    const h = await sha256Text(JSON.stringify({ seq, ts, user, role, action, target, detail, prevHash: prev }));
    if (e.prevHash !== prev || h !== e.hash) return e.seq;
    prev = e.hash;
  }
  return null;
}
