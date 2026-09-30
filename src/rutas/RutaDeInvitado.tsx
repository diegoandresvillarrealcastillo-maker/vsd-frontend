import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { useSesion } from '../sesion/useSesion.ts';
import { RUTAS } from './rutas.ts';

/**
 * Lo contrario de `RutaProtegida`: envuelve lo que solo tiene sentido si
 * **no** hay sesion.
 *
 * Entrar, registrarse o pedir una contrasena nueva son cosas que ya no se
 * necesitan cuando ya estas dentro. Dejar esas pantallas accesibles con la
 * sesion abierta no es peligroso, pero si desconcertante: la persona rellena
 * un formulario que no va a cambiar nada y no entiende que paso.
 *
 * Como `RutaProtegida`, esto es orden, no seguridad. Lo que de verdad protege
 * son el token que la API verifica y las politicas de aislamiento de la base.
 */
export function RutaDeInvitado({ children }: { children: ReactNode }) {
  const { sesion, cargando } = useSesion();

  if (cargando) {
    // Todavia no se sabe si hay sesion. Pintar el formulario ahora y quitarlo
    // medio segundo despues es peor que esperar.
    return (
      <p role="status" aria-live="polite" className="solo-lectores">
        Comprobando la sesión
      </p>
    );
  }

  if (sesion) {
    return <Navigate to={RUTAS.PANEL} replace />;
  }

  return <>{children}</>;
}
