/* global caches, fetch, Response, self, URL */

const CACHE_NAME = 'my-app-shell-v1';
const APP_SHELL = ['/', '/word', '/word/cards', '/index.html', '/manifest.webmanifest', '/icons/icon-192.svg', '/icons/icon-512.svg'];
const DEV_PATH_PREFIXES = ['/@vite', '/src/', '/node_modules/', '/@react-refresh'];

function isApiRequest(pathname) {
  return pathname.startsWith('/api/');
}

function isPrivateFile(pathname) {
  return pathname.startsWith('/collection/files/');
}

function isStaticRequest(pathname) {
  return pathname === '/'
    || pathname === '/index.html'
    || pathname === '/manifest.webmanifest'
    || pathname === '/sw.js'
    || pathname === '/favicon.ico'
    || pathname.startsWith('/assets/')
    || pathname.startsWith('/icons/');
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isDevServer = ['localhost', '127.0.0.1'].includes(url.hostname);
  const isViteAsset = DEV_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));

  if (isDevServer && isViteAsset) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (url.origin !== self.location.origin || isApiRequest(url.pathname) || isPrivateFile(url.pathname)) return;

  const isNavigation = event.request.mode === 'navigate';
  if (!isNavigation && !isStaticRequest(url.pathname)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          event.waitUntil(
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(event.request, response.clone()))
              .catch(() => undefined),
          );
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (isNavigation) return caches.match('/index.html');
        return new Response('Offline', { status: 503 });
      }),
  );
});
