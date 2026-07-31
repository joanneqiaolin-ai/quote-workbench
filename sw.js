/* Service Worker - 缓存应用外壳，支持离线打开 */
const CACHE = 'wb-quote-v6';
const SHELL = [
  '.',
  'index.html',
  'manifest.json',
  'css/style.css',
  'js/storage.js',
  'js/calc.js',
  'js/products.js',
  'js/docs.js',
  'js/copy.js',
  'js/app.js',
  'templates/Quotation.docx',
  'templates/PI.docx',
  'vendor/xlsx.full.min.js',
  'vendor/pizzip.min.js',
  'vendor/docxtemplater.min.js',
  'vendor/image-module.min.js',
  'vendor/FileSaver.min.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))   // 单个文件失败不阻断安装
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const net = fetch(e.request).then(resp => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return resp;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
