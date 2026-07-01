// Minimal IndexedDB wrapper for the per-channel uploads cache.
// One record per approved channel: { channelId, fetchedAt, videos: [...] }

const DB_NAME = 'kidtube';
const STORE = 'uploads';

let dbPromise = null;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE, { keyPath: 'channelId' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx(mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

export function getUploads(channelId) {
  return tx('readonly', (store) => store.get(channelId));
}

export function getAllUploads() {
  return tx('readonly', (store) => store.getAll());
}

export function putUploads(record) {
  return tx('readwrite', (store) => store.put(record));
}

export function deleteUploads(channelId) {
  return tx('readwrite', (store) => store.delete(channelId));
}
