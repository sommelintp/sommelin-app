// ソムリン スカウター — 最小サービスワーカー（オフライン外殻＋更新）
// 重要: Supabase(POST) や CDN/wasm はキャッシュせず素通し（GET・同一オリジンのみ扱う）
// v2: ビジョンAI版。HTMLはネットワーク優先（更新が即届く）・オフライン時のみキャッシュ
const CACHE = 'somm-scout-v2';
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
  if (e.request.method !== 'GET') return;            // Supabase/identify等の書き込みは素通し
  if (u.origin !== location.origin) return;          // CDN/API は素通し

  // HTML（画面）はネットワーク優先: デプロイした更新が即反映。オフライン時のみキャッシュ
  const isDoc = e.request.mode === 'navigate' || u.pathname.endsWith('.html');
  if (isDoc) {
    e.respondWith(
      fetch(e.request).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(()=>{});
        return resp;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // 画像等の静的アセットはキャッシュ優先
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(()=>{});
      return resp;
    }).catch(() => r))
  );
});
