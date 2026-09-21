import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Sin esto, cada prueba deja su arbol montado y la siguiente encuentra dos
// veces el mismo boton. El sintoma es una prueba que falla solo cuando se
// ejecuta despues de otra, que es de las cosas mas molestas de diagnosticar.
afterEach(() => {
  cleanup();
});
