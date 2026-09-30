/* Web Push: se importa dentro del service worker generado por vite-plugin-pwa (importScripts). */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { cuerpo: event.data ? event.data.text() : '' };
  }
  const titulo = data.titulo || 'Salta Delivery';
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: data.cuerpo || '',
      tag: data.tag || 'salta-delivery',
      renotify: true,
      icon: 'pwa-192.png',
      badge: 'favicon-32.png',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/#/cadete/viajes' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = new URL(event.notification.data?.url || '/#/cadete/viajes', self.location.origin)
    .href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      for (const w of ventanas) {
        if (new URL(w.url).origin === self.location.origin && 'focus' in w) {
          return w.navigate(destino).then((nav) => (nav || w).focus());
        }
      }
      return self.clients.openWindow(destino);
    }),
  );
});
