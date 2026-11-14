import { createContext, useContext } from 'react';

import type { Mascota } from '../../../infraestructura/api/cuenta.ts';

/**
 * La mascota que la persona tiene elegida en su cuenta, para quien la pinte en una actividad
 * (SCRUM-173).
 *
 * La carga una sola vez `ProveedorDeLaMascota`, que envuelve la pantalla de la actividad; las
 * mecanicas y el logro la leen de aqui con `useMascotaDeLaPersona`. Asi hay una sola consulta
 * por pantalla y todo lo que sale en ella es la misma mascota. Fuera de un proveedor vale
 * `null`, y se pinta la de siempre.
 */
export const MascotaContexto = createContext<Mascota | null>(null);

export function useMascotaDeLaPersona(): Mascota | null {
  return useContext(MascotaContexto);
}
