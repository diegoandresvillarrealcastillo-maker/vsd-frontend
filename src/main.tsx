import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from './App.tsx';
import './estilos/global.css';

const raiz = document.getElementById('raiz');

if (!raiz) {
  // Si esto ocurre, el index.html no es el que creemos. Fallar aqui con un
  // mensaje concreto ahorra media hora de mirar una pantalla en blanco.
  throw new Error('No se encontro el elemento #raiz en index.html.');
}

createRoot(raiz).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
