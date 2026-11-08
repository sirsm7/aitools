(function () {
  window.__memoryCache = window.__memoryCache || {};

  let dbPromise = null;

  async function resolveConfig() {
    if (window.ENV_READY) {
      await window.ENV_READY;
    }
    return window.__ENV || window.APP_CONFIG || {
      DB_NAME: "SchoolDashboardDB",
      DB_VERSION: 1,
      STORE_NAME: "teachers_data",
      CACHE_TTL_MS: 300000
    };
  }

  async function getDB() {
    if (dbPromise) return dbPromise;
    const cfg = await resolveConfig();
    dbPromise = new Promise((resolve) => {
      if (!window.indexedDB) {
        resolve(null);
        return;
      }
      try {
        const request = window.indexedDB.open(cfg.DB_NAME, cfg.DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(cfg.STORE_NAME)) {
            db.createObjectStore(cfg.STORE_NAME, { keyPath: "key" });
          }
        };

        request.onsuccess = (event) => {
          resolve(event.target.result);
        };

        request.onerror = () => {
          resolve(null);
        };
      } catch (_) {
        resolve(null);
      }
    });
    return dbPromise;
  }

  async function set(key, value) {
    const record = {
      key: key,
      value: value,
      updatedAt: Date.now()
    };
    try {
      const cfg = await resolveConfig();
      const db = await getDB();
      if (!db) {
        window.__memoryCache[key] = record;
        return true;
      }
      return new Promise((resolve) => {
        const tx = db.transaction(cfg.STORE_NAME, "readwrite");
        const store = tx.objectStore(cfg.STORE_NAME);
        store.put(record);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => {
          window.__memoryCache[key] = record;
          resolve(false);
        };
      });
    } catch (_) {
      window.__memoryCache[key] = record;
      return false;
    }
  }

  async function get(key) {
    const cfg = await resolveConfig();
    const ttl = cfg.CACHE_TTL_MS || 300000;
    try {
      const db = await getDB();
      let record = null;
      if (!db) {
        record = window.__memoryCache[key] || null;
      } else {
        record = await new Promise((resolve) => {
          const tx = db.transaction(cfg.STORE_NAME, "readonly");
          const store = tx.objectStore(cfg.STORE_NAME);
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(window.__memoryCache[key] || null);
        });
      }

      if (!record) return null;

      const isStale = (Date.now() - record.updatedAt) > ttl;
      return {
        data: record.value,
        updatedAt: record.updatedAt,
        isStale: isStale
      };
    } catch (_) {
      const memRecord = window.__memoryCache[key] || null;
      if (!memRecord) return null;
      return {
        data: memRecord.value,
        updatedAt: memRecord.updatedAt,
        isStale: (Date.now() - memRecord.updatedAt) > ttl
      };
    }
  }

  async function clear() {
    window.__memoryCache = {};
    try {
      const cfg = await resolveConfig();
      const db = await getDB();
      if (!db) return true;
      return new Promise((resolve) => {
        const tx = db.transaction(cfg.STORE_NAME, "readwrite");
        const store = tx.objectStore(cfg.STORE_NAME);
        store.clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (_) {
      return false;
    }
  }

  window.IDBCache = Object.freeze({
    set,
    get,
    clear
  });
})();