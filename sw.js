// ソムリン スカウター — 最小サービスワーカー（オフライン外殻＋更新）
// 重要: Supabase(POST) や CDN/wasm はキャッシュせず素通し（GET・同一オリジンのみ扱う）
const CACHE = 'somm-scout-v1';
const SHELL = ['./scouter.html', './manifest.webmanifest'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(()=>{}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;            // Supabase等の書き込みは素通し
  if (u.origin !== location.origin) return;          // CDN/wasm/Supabase は素通し
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(()=>{});
      return resp;
    }).catch(() => r))
  );
});
