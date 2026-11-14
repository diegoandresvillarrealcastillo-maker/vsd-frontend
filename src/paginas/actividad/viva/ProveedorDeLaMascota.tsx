import type { ReactNode } from 'react';

import { MascotaContexto } from './mascotaDeLaPersona.ts';
import { useCargarLaMascota } from './useCargarLaMascota.ts';

/**
 * Carga la mascota de la persona una vez y se la ofrece a todo lo que hay dentro de la pantalla
 * de la actividad (SCRUM-173): la mecanica, que habla con ella, y el logro, que baila con ella.
 * La mascota que se ve es siempre la que la persona tiene elegida en su cuenta.
 */
export function ProveedorDeLaMascota({ children }: { children: ReactNode }) {
  const mascota = useCargarLaMascota();

  return <MascotaContexto.Provider value={mascota}>{children}</MascotaContexto.Provider>;
}
