export const DB_NAME = 'notion_like_db_modular_v1';
export const STORE_SCHEMAS = 'schemas'; // keyPath: name
export const STORE_RECORDS = 'records'; // { id auto, schema, data, createdAt }

export function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SCHEMAS))
        db.createObjectStore(STORE_SCHEMAS, { keyPath: 'name' });
      if (!db.objectStoreNames.contains(STORE_RECORDS))
        db.createObjectStore(STORE_RECORDS, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function withStore(store, mode, fn) {
  return openDB().then(
    db =>
      new Promise((res, rej) => {
        const tx = db.transaction(store, mode);
        const st = tx.objectStore(store);
        const out = fn(st);
        tx.oncomplete = () => res(out);
        tx.onerror = () => rej(tx.error);
      })
  );
}

/* ---------------------- SCHEMA STORE ---------------------- */
export const schemaStore = {
  getAll() {
    return withStore(STORE_SCHEMAS, 'readonly', s =>
      new Promise(r => {
        const q = s.getAll();
        q.onsuccess = () => r(q.result || []);
      })
    );
  },
  get(name) {
    return withStore(STORE_SCHEMAS, 'readonly', s =>
      new Promise(r => {
        const q = s.get(name);
        q.onsuccess = () => r(q.result);
      })
    );
  },
  put(schema) {
    return withStore(STORE_SCHEMAS, 'readwrite', s => s.put(schema));
  },
  delete(name) {
    return withStore(STORE_SCHEMAS, 'readwrite', s => s.delete(name));
  },
};

/* ---------------------- RECORD STORE ---------------------- */
export const recordStore = {
  add(rec) {
    return withStore(STORE_RECORDS, 'readwrite', s => s.put(rec));
  },

  getAll() {
    return withStore(STORE_RECORDS, 'readonly', s =>
      new Promise(r => {
        const q = s.getAll();
        q.onsuccess = () => r(q.result || []);
      })
    );
  },

  all() {
    return this.getAll();
  },

  deleteBySchema(schema) {
    return withStore(STORE_RECORDS, 'readwrite', s =>
      new Promise(r => {
        const c = s.openCursor();
        c.onsuccess = () => {
          const cur = c.result;
          if (cur) {
            if (cur.value.schema === schema) cur.delete();
            cur.continue();
          } else r();
        };
      })
    );
  },

  renameSchema(oldName, newName) {
    return withStore(STORE_RECORDS, 'readwrite', s =>
      new Promise(r => {
        const c = s.openCursor();
        c.onsuccess = () => {
          const cur = c.result;
          if (cur) {
            const v = cur.value;
            if (v.schema === oldName) {
              v.schema = newName;
              cur.update(v);
            }
            cur.continue();
          } else r();
        };
      })
    );
  },
};
