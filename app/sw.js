/* BK+ Terrain — garde l'application disponible sans réseau (les données passent par la base locale de tech.js) */
const V = 'bk-terrain-4';
const SHELL = ['tech.html', 'tech.css?v=2', 'tech.js?v=4', '../config.js?v=2', '../logo-bk.png', '../icon-180.png', 'manifest.webmanifest',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => { })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.hostname.endsWith('supabase.co')) return; // données : jamais en cache ici
  if (r.mode === 'navigate') { if (!/tech\.html$/.test(u.pathname)) return; e.respondWith(fetch(r).then(res => { caches.open(V).then(c => c.put('tech.html', res.clone())); return res; }).catch(() => caches.match('tech.html'))); return; }
  e.respondWith(caches.match(r).then(hit => {
    const net = fetch(r).then(res => { if (res.ok && (u.origin === location.origin || /jsdelivr|gstatic|googleapis/.test(u.hostname))) caches.open(V).then(c => c.put(r, res.clone())); return res; }).catch(() => hit);
    return hit || net;
  }));
});
