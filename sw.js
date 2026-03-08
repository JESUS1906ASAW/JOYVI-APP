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
const CN = 'joyvi-v3';

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(clients.claim()); });

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(r => {
      const rc = r.clone();
      caches.open(CN).then(c => c.put(e.request, rc));
      return r;
    }).catch(() => caches.match(e.request))
  );
});

messaging.onBackgroundMessage(payload => {
  const n = payload.notification || {};
  const d = payload.data || {};
  self.registration.showNotification(n.title || '🔔 Joyvi', {
    body: n.body || 'Nueva notificación',
    icon: d.icon || '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [300,100,300,100,300],
    tag: d.tag || 'joyvi-notif-' + Date.now(),
    renotify: true,
    requireInteraction: true,
    data: { url: d.url || '/' }
  });
});

self.addEventListener('push', e => {
  if (!e.data) return;
  let d;
  try { d = e.data.json(); } catch { d = { title: '🔔 Joyvi', body: 'Nueva notificación' }; }
  e.waitUntil(self.registration.showNotification(d.title || '🔔 Joyvi', {
    body: d.body || 'Nueva notificación',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [300,100,300,100,300],
    tag: 'joyvi-notif-' + Date.now(),
    renotify: true,
    requireInteraction: true,
    data: { url: '/' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type:'window', includeUncontrolled:true }).then(cs => {
    const url = e.notification.data?.url || '/';
    const w = cs.find(c => c.url.includes(location.origin));
    if (w) return w.focus();
    return clients.openWindow(url);
  }));
});
