/* 外贸报价AI工作台 - 本地存储层 (IndexedDB)
 * 数据全部存于本机浏览器，免登录、隐私不外传。
 * 对象库：products(产品资料库) / templates(上传的文档模板) / kv(设置项)
 */
(function (global) {
  'use strict';

  const DB_NAME = 'wb_quote_db';
  const DB_VERSION = 1;
  const STORES = { products: 'products', templates: 'templates', kv: 'kv' };

  let _db = null;

  function openDB() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORES.products))
          db.createObjectStore(STORES.products, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORES.templates))
          db.createObjectStore(STORES.templates, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORES.kv))
          db.createObjectStore(STORES.kv, { keyPath: 'k' });
      };
      req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  function tx(store, mode) {
    return openDB().then(db => db.transaction(store, mode).objectStore(store));
  }
  function reqP(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  const DB = {
    // ---- products ----
    async listProducts() {
      const store = await tx(STORES.products, 'readonly');
      const all = await reqP(store.getAll());
      return (all || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    },
    async getProduct(id) {
      const store = await tx(STORES.products, 'readonly');
      return reqP(store.get(id));
    },
    async saveProduct(p) {
      if (!p.id) p.id = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      if (!p.createdAt) p.createdAt = Date.now();
      p.updatedAt = Date.now();
      const store = await tx(STORES.products, 'readwrite');
      await reqP(store.put(p));
      return p;
    },
    async deleteProduct(id) {
      const store = await tx(STORES.products, 'readwrite');
      return reqP(store.delete(id));
    },

    // ---- templates ----
    async listTemplates() {
      const store = await tx(STORES.templates, 'readonly');
      const all = await reqP(store.getAll());
      return (all || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    },
    async saveTemplate(t) {
      if (!t.id) t.id = 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      if (!t.createdAt) t.createdAt = Date.now();
      const store = await tx(STORES.templates, 'readwrite');
      await reqP(store.put(t));
      return t;
    },
    async getTemplate(id) {
      const store = await tx(STORES.templates, 'readonly');
      return reqP(store.get(id));
    },
    async deleteTemplate(id) {
      const store = await tx(STORES.templates, 'readwrite');
      return reqP(store.delete(id));
    },

    // ---- kv settings ----
    async getKV(k, def) {
      const store = await tx(STORES.kv, 'readonly');
      const r = await reqP(store.get(k));
      return r ? r.v : def;
    },
    async setKV(k, v) {
      const store = await tx(STORES.kv, 'readwrite');
      await reqP(store.put({ k, v }));
      return v;
    }
  };

  global.WB = global.WB || {};
  global.WB.DB = DB;
})(window);
