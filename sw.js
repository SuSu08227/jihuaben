/**
 * Service Worker：静态资源离线缓存
 * 作用：装到手机主屏后，没网也能打开（数据本来就在本地）。
 * 注意：file:// 打开时不生效，需通过 http(s) 访问。
 */
var CACHE = 'daily-keeper-v1';

var ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/core/date.js',
  './js/core/store.js',
  './js/core/calc.js',
  './js/core/ics.js',
  './js/ui/ui.js',
  './js/views/today.js',
  './js/views/plan.js',
  './js/views/constraint.js',
  './js/views/budget.js',
  './js/views/settings.js',
  './js/app.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (res) {
        if (res && res.ok && new URL(e.request.url).origin === self.location.origin) {
          var clone = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, clone); });
        }
        return res;
      }).catch(function () {
        return caches.match('./index.html');
      });
    })
  );
});
