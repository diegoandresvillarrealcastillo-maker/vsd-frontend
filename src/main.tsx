import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from './App.tsx';
import { despertarElApi } from './infraestructura/api/despertar.ts';
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
      </ProveedorDeSesion>
    </BrowserRouter>
  </StrictMode>,
);
