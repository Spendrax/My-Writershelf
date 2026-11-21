// Offline copy. Bump V on every release.
const V = 'ws-v18';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  'css/base.css',
  'css/attic.css',
  'css/buddy.css',
  'css/room.css',
  'css/walls.css',
  'css/sheets.css',
  'js/01-core.js',
  'js/02-google.js',
  'js/03-docs.js',
  'js/04-book-form.js',
  'js/05-book-card.js',
  'js/06-attic.js',
  'js/07-turning-walls.js',
  'js/08-buddy.js',
  'js/09-goals-stats.js',
  'js/10-write.js',
  'js/11-settings-backup.js',
  'js/12-drive-backup.js',
  'js/13-install-update.js',
  'js/14-whats-new.js',
  'js/15-languages.js',
  'js/16-buddy-moves.js',
  'js/17-customize.js',
  'js/18-weather.js',
  'js/19-achievements.js',
  'js/20-buddy-play.js',
  'js/21-room-life.js',
  'js/22-buddy-life.js',
  'js/23-sprint.js',
  'js/24-prompts.js',
  'js/lang/fr.js',
  'js/lang/es.js',
  'js/lang/ht.js',
  'js/lang/pt.js',
  'js/lang/de.js',
  'js/lang/it.js',
];

self.addEventListener('install', e => e.waitUntil(caches.open(V).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))));
// the page's "Update now" button asks the new version to take over
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.reduce((a, k) => k !== V ? a.concat(caches.delete(k)) : a, []))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  // Google (sign-in, Docs, Drive) and the helper always come fresh from the internet; only the app's own
  // files and its fonts are kept for offline use
  if (u.origin !== location.origin && !/fonts\.(googleapis|gstatic)\.com/.test(u.hostname)) return;
  e.respondWith(caches.open(V).then(c => c.match(r, { ignoreSearch: true }).then(hit => {
    const net = fetch(r).then(res => { if (res.ok || res.type === 'opaque') c.put(r, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  })));
});
