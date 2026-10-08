import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';

import { App } from './App.tsx';
import { LimiteDeErrores } from './errores/LimiteDeErrores.tsx';
import { reportarError } from './errores/reportarError.ts';
import { despertarElApi } from './infraestructura/api/despertar.ts';
import { AvisoDeVersionNueva } from './pwa/AvisoDeVersionNueva.tsx';
import { registrarElServiceWorker } from './pwa/registrarElServiceWorker.ts';
import { ProveedorDeSesion } from './sesion/ProveedorDeSesion.tsx';
import { seguirAlSistema } from './tema/tema.ts';
import './estilos/global.css';

// El tema inicial ya lo puso el script del `index.html`, antes del primer
// pintado. Lo unico que queda es seguir al sistema si cambia y nadie habia
// elegido nada.
seguirAlSistema();

// Lo antes posible: si el API dormia, que vaya despertando mientras la
// persona lee la portada o escribe su correo (SCRUM-111).
despertarElApi();

// El service worker guarda la aplicacion para abrirla sin conexion y recibe los
// avisos (SCRUM-135). Una version nueva se ofrece con un aviso; no se activa sola.
registrarElServiceWorker(registerSW);

const raiz = document.getElementById('raiz');

if (!raiz) {
  // Si esto ocurre, el index.html no es el que creemos. Fallar aqui con un
  // mensaje concreto ahorra media hora de mirar una pantalla en blanco.
  throw new Error('No se encontro el elemento #raiz en index.html.');
}

// Lo que React no atrapa en ningun limite (SCRUM-156): errores de los
// manejadores de eventos, de lo asincrono y de las promesas sin atender. No
// cambian la pantalla, pero alguien tiene que enterarse. Van al mismo reportero
// que los de pintado, que no se lleva el mensaje del error.
window.addEventListener('error', (evento) => reportarError(evento.error, 'ventana'));
window.addEventListener('unhandledrejection', (evento) => reportarError(evento.reason, 'promesa'));

createRoot(raiz, {
  // Un error que ningun limite atrapo: lo que falla dentro de la propia pantalla
  // de error, o antes de que exista un limite.
  onUncaughtError: (error, info) => reportarError(error, 'no-capturado', info.componentStack),
}).render(
  <StrictMode>
    {/* El limite de mas afuera: si se rompe el enrutador, la sesion o cualquier
        proveedor, la persona ve la pantalla de error y no una pagina en blanco.
        Las rutas tienen el suyo dentro de `App`, que deja viva la navegacion. */}
    <LimiteDeErrores origen="raiz">
      <BrowserRouter>
        <ProveedorDeSesion>
          <App />
          <AvisoDeVersionNueva />
        </ProveedorDeSesion>
      </BrowserRouter>
    </LimiteDeErrores>
  </StrictMode>,
);
