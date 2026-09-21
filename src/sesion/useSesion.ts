import { useContext } from 'react';

import { SesionContexto, type EstadoDeSesion } from './SesionContexto.ts';

/**
 * Da acceso a la sesion desde cualquier componente.
 *
 * El nombre va en ingles, a diferencia del resto del proyecto, porque React
 * reconoce sus hooks por el prefijo use y sus reglas de lint no lo detectan de
 * ninguna otra forma. Es una convencion de la herramienta, no una preferencia.
 *
 * Falla si se usa fuera del proveedor. Es a proposito: devolver `null` en ese
 * caso obligaria a comprobarlo en cada sitio, y el dia que alguien se olvidara
 * el sintoma seria una pantalla que no hace nada, sin ningun error.
 */
export function useSesion(): EstadoDeSesion {
  const estado = useContext(SesionContexto);

  if (!estado) {
    throw new Error('useSesion() se llamo fuera de <ProveedorDeSesion>.');
  }

  return estado;
}
