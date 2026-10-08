import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';

import { App } from './App.tsx';
import { AvisoDeSincronizacion } from './conexion/AvisoDeSincronizacion.tsx';
import { despertarElApi } from './infraestructura/api/despertar.ts';
import { AvisoDeVersionNueva } from './pwa/AvisoDeVersionNueva.tsx';
import { registrarElServiceWorker } from './pwa/registrarElServiceWorker.ts';
import { ProveedorDeSesion } from './sesion/ProveedorDeSesion.tsx';
import { iniciarLaSincronizacionAutomatica } from './sincronizacion/estado.ts';
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

// Lo guardado sin conexion se envia solo: al volver la red, al abrir la aplicacion,
// al volver a la pestana y de vez en cuando (SCRUM-137).
iniciarLaSincronizacionAutomatica();

const raiz = document.getElementById('raiz');

if (!raiz) {
  // Si esto ocurre, el index.html no es el que creemos. Fallar aqui con un
  // mensaje concreto ahorra media hora de mirar una pantalla en blanco.
  throw new Error('No se encontro el elemento #raiz en index.html.');
}

createRoot(raiz).render(
  <StrictMode>
    <BrowserRouter>
      <ProveedorDeSesion>
        <App />
        <AvisoDeSincronizacion />
        <AvisoDeVersionNueva />
      </ProveedorDeSesion>
    </BrowserRouter>
  </StrictMode>,
);
