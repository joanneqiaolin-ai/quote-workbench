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

  // ---- 备份 / 恢复（跨设备同步，纯本机，不上云）----
  function _clearStore(name) {
    return tx(name, 'readwrite').then(store => reqP(store.clear()));
  }
  function _abToB64(ab) {
    const bytes = new Uint8Array(ab);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function _b64ToAb(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  DB.exportAll = async function () {
    const [products, templates, company, rate] = await Promise.all([
      DB.listProducts(), DB.listTemplates(),
      DB.getKV('company', ''), DB.getKV('rate', '7.2')
    ]);
    return {
      app: 'wb-quote-workbench',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: { company: company || '', rate: rate || '7.2' },
      products: products || [],
      templates: (templates || []).map(t => ({ ...t, data: _abToB64(t.data) }))
    };
  };

  DB.importAll = async function (obj) {
    if (!obj || obj.app !== 'wb-quote-workbench') throw new Error('不是有效的工作台备份文件');
    await _clearStore(STORES.products);
    await _clearStore(STORES.templates);
    if (obj.settings) {
      if (obj.settings.company != null) await DB.setKV('company', obj.settings.company);
      if (obj.settings.rate != null) await DB.setKV('rate', obj.settings.rate);
    }
    for (const p of (obj.products || [])) await DB.saveProduct(p);
    for (const t of (obj.templates || [])) {
      const rec = { ...t };
      if (typeof rec.data === 'string') rec.data = _b64ToAb(rec.data);
      await DB.saveTemplate(rec);
    }
  };

  global.WB = global.WB || {};
  global.WB.DB = DB;
})(window);
