/*
 * El service worker de VSD Health (SCRUM-102).
 *
 * Hace una sola cosa: recibir los avisos por Web Push y mostrarlos. No guarda
 * nada en cache: la aplicacion necesita la red para funcionar, y un cache mal
 * invalidado deja a la gente con una version vieja sin que nadie lo note.
 *
 * Lo que muestra viene del servidor, ya pensado para la pantalla bloqueada:
 * cuantos pendientes hay, o una invitacion. Nunca nada de salud.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(self.clients.claim());
});

/** Solo rutas de esta misma aplicacion: nada de llevar a otro sitio. */
function rutaPropia(ruta) {
  return typeof ruta === 'string' && ruta.startsWith('/') && !ruta.startsWith('//')
    ? ruta
    : '/panel';
}

self.addEventListener('push', (evento) => {
  let datos = {};

  try {
    datos = evento.data ? evento.data.json() : {};
  } catch {
    datos = {};
  }

  const titulo = typeof datos.titulo === 'string' ? datos.titulo : 'VSD Health';

  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: typeof datos.cuerpo === 'string' ? datos.cuerpo : '',
      icon: '/icono-192.png',
      badge: '/icono-192.png',
      lang: 'es-CO',
      // Uno nuevo del mismo tipo reemplaza al anterior en vez de apilarse.
      tag: typeof datos.tipo === 'string' ? datos.tipo : 'vsd-health',
      data: { ruta: rutaPropia(datos.ruta) },
    }),
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();

  const ruta = rutaPropia(evento.notification.data && evento.notification.data.ruta);

  evento.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const abierta = ventanas.find(
        (ventana) => new URL(ventana.url).origin === self.location.origin,
      );

      // Si la aplicacion ya esta abierta, se usa esa pestana.
      if (abierta) {
        await abierta.focus();

        if ('navigate' in abierta) {
          await abierta.navigate(ruta);
        }

        return;
      }

      await self.clients.openWindow(ruta);
    })(),
  );
});
