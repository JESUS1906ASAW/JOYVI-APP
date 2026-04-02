importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:"AIzaSyCuHeyufr9KCxykW5LylfTi2l-FNhE9wqM",
  authDomain:"joyvi-9ba42.firebaseapp.com",
  projectId:"joyvi-9ba42",
  storageBucket:"joyvi-9ba42.firebasestorage.app",
  messagingSenderId:"389538618524",
  appId:"1:389538618524:web:15a33779904ef3fb42a159"
});

const messaging = firebase.messaging();
const CN       = 'joyvi-v6';       // bump de versión para limpiar caché anterior
const SHELL_CN = 'joyvi-shell-v6';

// Assets del app shell que se pre-cachean en el install
const SHELL_ASSETS = [
  '/JOYVI-APP/',
  '/JOYVI-APP/index.html',
  '/JOYVI-APP/icon-192.png',
  '/JOYVI-APP/icon-512.png',
  '/JOYVI-APP/manifest.json',
];

// ── Install: pre-cachear app shell ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL_CN).then(cache =>
      Promise.allSettled(
        SHELL_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('SW cache miss:', url, err))
        )
      )
    ).then(() => self.skipWaiting())
  );
});

// ── Activate: limpiar cachés viejas ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CN && k !== SHELL_CN)
          .map(k => caches.delete(k))
      )
    ).then(() => clients.claim())
  );
});

// ── Fetch: estrategia según tipo de recurso ──
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  // Solo interceptar GET
  if (req.method !== 'GET') return;

  // Nunca interceptar requests de Firestore/Auth/FCM (tienen su propia caché IndexedDB)
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('fcm.googleapis.com') ||
    url.hostname.includes('firebaseinstallations.googleapis.com')
  ) return;

  // Firebase SDK / CDNs externos (gstatic, cdnjs, fonts): Cache-first
  if (
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cdnjs.cloudflare.com')
  ) {
    e.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          if (res.ok) caches.open(CN).then(c => c.put(req, res.clone()));
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Navegación HTML (index.html): Network-first con fallback a caché
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) caches.open(SHELL_CN).then(c => c.put(req, res.clone()));
          return res;
        })
        .catch(() =>
          caches.match(req).then(r => r || caches.match('/JOYVI-APP/index.html'))
        )
    );
    return;
  }

  // Imágenes externas (Unsplash, etc.): Cache-first
  if (req.destination === 'image') {
    e.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          if (res.ok) caches.open(CN).then(c => c.put(req, res.clone()));
          return res;
        }).catch(() => cached || new Response('', { status: 404 }));
      })
    );
    return;
  }

  // Resto (mismo origen): Network-first con fallback a caché
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) caches.open(CN).then(c => c.put(req, res.clone()));
        return res;
      })
      .catch(() => caches.match(req))
  );
});

// ── FCM: mensajes en background (app cerrada o en segundo plano) ──
messaging.onBackgroundMessage(payload => {
  const n = payload.notification || {};
  const d = payload.data || {};
  self.registration.showNotification(n.title || '🔔 Joyvi', {
    body: n.body || 'Nueva notificación',
    icon: d.icon || '/JOYVI-APP/icon-192.png',
    badge: '/JOYVI-APP/icon-192.png',
    vibrate: [300, 100, 300, 100, 300],
    tag: d.tag || 'joyvi-notif-' + Date.now(),
    renotify: true,
    requireInteraction: true,
    data: { url: d.url || '/JOYVI-APP/' }
  });
});

// ── Push nativo (fallback si FCM no lo gestiona) ──
self.addEventListener('push', e => {
  if (!e.data) return;
  let d;
  try { d = e.data.json(); } catch { d = { title: '🔔 Joyvi', body: 'Nueva notificación' }; }
  e.waitUntil(
    self.registration.showNotification(d.title || '🔔 Joyvi', {
      body: d.body || 'Nueva notificación',
      icon: '/JOYVI-APP/icon-192.png',
      badge: '/JOYVI-APP/icon-192.png',
      vibrate: [300, 100, 300, 100, 300],
      tag: 'joyvi-notif-' + Date.now(),
      renotify: true,
      requireInteraction: true,
      data: { url: '/JOYVI-APP/' }
    })
  );
});

// ── Notification click ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      const url = e.notification.data?.url || '/JOYVI-APP/';
      const w = cs.find(c => c.url.includes(location.origin));
      if (w) return w.focus();
      return clients.openWindow(url);
    })
  );
});

// ── Control externo: SKIP_WAITING (para actualizaciones desde la app) ──
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
