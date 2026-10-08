/**
 * El service worker de VSD Health (SCRUM-102 para los avisos, SCRUM-135 para
 * abrir sin conexion).
 *
 * Hace dos cosas, y solo estas:
 *
 * 1. **Guarda la aplicacion** (los archivos de la compilacion, tipografias
 *    incluidas) para poder abrirla sin red.
 * 2. **Recibe los avisos** por Web Push y los muestra.
 *
 * ---------------------------------------------------------------------------
 * Lo que NO hace, y es lo mas importante
 * ---------------------------------------------------------------------------
 *
 * **No toca la API, ni Supabase, ni nada que no sea de esta aplicacion.** Sus
 * rutas solo reconocen archivos de la compilacion y pantallas de la
 * aplicacion. Una respuesta de la API nunca pasa por la cache de este
 * service worker: lo que contiene es de una persona, y esa copia no se borraria
 * al cerrar sesion. Las copias propias de la aplicacion viven en IndexedDB, por
 * persona (SCRUM-136).
 *
 * **No toma el control al instalarse una version nueva.** Hasta SCRUM-135 este
 * archivo llamaba a `skipWaiting()` al instalarse, y estaba bien porque no
 * guardaba nada. Ahora guarda archivos con hash en el nombre: si una version
 * nueva tomara el control mientras una pagina vieja sigue abierta, esa pagina
 * pediria archivos que la version nueva ya borro y se quedaria a medias, sin
 * ningun error que lo explique. La version nueva espera, la pagina avisa
 * ("Hay una version nueva") y toma el control cuando la persona lo decide.
 *
 * Las decisiones que no necesitan el navegador estan en
 * `pwa/reglasDelServiceWorker.ts`, donde se prueban.
 */
import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';

import {
  avisoDesde,
  esOrdenDeActualizar,
  esPantallaDeLaApp,
  rutaPropia,
} from './pwa/reglasDelServiceWorker.ts';

declare const self: ServiceWorkerGlobalScope & {
  // Lo reemplaza `vite-plugin-pwa` al compilar con la lista de archivos.
  __WB_MANIFEST: Parameters<typeof precacheAndRoute>[0];
};

// ---------------------------------------------------------------------------
// 1. La aplicacion
// ---------------------------------------------------------------------------

precacheAndRoute(self.__WB_MANIFEST);

// Las versiones anteriores dejan sus archivos en la cache; esto los retira al
// activarse la nueva.
cleanupOutdatedCaches();

// Una pantalla de la aplicacion (/panel, /diario...) la dibuja el enrutador de
// React, asi que sin red basta con servir `index.html`. Un archivo (un PDF, una
// imagen) no: tiene que ser ese archivo.
registerRoute(
  ({ request, url }) => request.mode === 'navigate' && esPantallaDeLaApp(url, self.location.origin),
  createHandlerBoundToURL('/index.html'),
);

// La tipografia no necesita una regla propia: viaja con la aplicacion (L-06 de la
// auditoria 360) y sus archivos van en la misma lista que se guarda arriba. Antes se
// pedia a Google y aqui se guardaba la primera vez que se pedia.

// ---------------------------------------------------------------------------
// Las versiones nuevas
// ---------------------------------------------------------------------------

// En la primera instalacion no hay nada viejo con lo que chocar, y asi la
// primera visita ya queda bajo control sin esperar a recargar. Una version
// nueva, en cambio, no se activa hasta que la persona la acepta (ver abajo) o
// hasta que ya no queda ninguna pagina de la version vieja abierta.
clientsClaim();

// La pagina avisa de que la persona acepto la version nueva.
self.addEventListener('message', (evento) => {
  if (esOrdenDeActualizar(evento.data)) {
    void self.skipWaiting();
  }
});

// ---------------------------------------------------------------------------
// 2. Los avisos (SCRUM-102)
//
// Lo que muestra viene del servidor, ya pensado para la pantalla bloqueada:
// cuantos pendientes hay, o una invitacion. Nunca nada de salud.
// ---------------------------------------------------------------------------

/** Lo que trae el aviso, o nada si no es un JSON valido. */
function datosDelAviso(evento: PushEvent): unknown {
  try {
    return evento.data ? evento.data.json() : {};
  } catch {
    return {};
  }
}

self.addEventListener('push', (evento) => {
  const aviso = avisoDesde(datosDelAviso(evento));

  evento.waitUntil(
    self.registration.showNotification(aviso.titulo, {
      body: aviso.cuerpo,
      icon: '/icono-192.png',
      badge: '/icono-192.png',
      lang: 'es-CO',
      tag: aviso.etiqueta,
      data: { ruta: aviso.ruta },
    }),
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();

  const datos = evento.notification.data as { ruta?: unknown } | null;
  const ruta = rutaPropia(datos?.ruta);

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
