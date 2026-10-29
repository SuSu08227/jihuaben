/**
 * Service Worker：静态资源离线缓存
 * 作用：装到手机主屏后，没网也能打开（数据本来就在本地）。
 * 注意：file:// 打开时不生效，需通过 http(s) 访问。
 */
var CACHE = 'daily-keeper-v5';

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
      .then(function (c) { return cacheAllValidated(c); })
      .then(function () { return self.skipWaiting(); })
  );
});

/**
 * 逐个预取并校验后入库：
 * - 状态非 200 或响应体为空（CDN 瞬断会出现 200+空文件）一律视为失败，
 *   安装失败浏览器会稍后自动重试，避免把空脚本永久缓存导致交互全部失效。
 */
function cacheAllValidated(cache) {
  return Promise.all(ASSETS.map(function (u) {
    return fetch(u, { cache: 'no-store' }).then(function (res) {
      if (!res || !res.ok) throw new Error('bad status ' + res.status + ' ' + u);
      var copy = res.clone();
      return res.text().then(function (body) {
        if (!body || !body.length) throw new Error('empty body ' + u);
        return cache.put(u, copy);
      });
    });
  }));
}

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
      // 命中但状态异常（防历史脏数据）一律当未命中
      if (hit && hit.status === 200) return hit;
      return fetchAndCache(e.request);
    })
  );
});

function fetchAndCache(req) {
  return fetch(req).then(function (res) {
    if (res && res.ok && res.status === 200 && new URL(req.url).origin === self.location.origin) {
      var copy = res.clone();
      // 拒绝缓存空响应体
      res.text().then(function (body) {
        if (body && body.length) {
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
      }).catch(function () {});
    }
    return res;
  }).catch(function () {
    return caches.match('./index.html');
  });
}
