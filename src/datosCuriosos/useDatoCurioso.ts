import { useEffect, useState } from 'react';

import { consultarElDatoDeHoy, type DatoCurioso } from '../infraestructura/api/datosCuriosos.ts';
import { useSesion } from '../sesion/useSesion.ts';
import { datoGuardadoDe, guardarElDato } from './memoriaDelDia.ts';

/**
 * El dato curioso de hoy, o `null` si todavia no se sabe (SCRUM-185).
 *
 * Arranca con lo ultimo que se supo en este equipo —el del dia, si ya se vio hoy— para que se
 * vea al instante y tambien sin conexion, y lo reemplaza por lo que diga el servidor en cuanto
 * llega: al abrir y al volver la conexion. Si no se puede pedir, no es un error que la persona
 * deba ver: se queda lo que habia, o nada.
 *
 * El dia y el orden los decide el servidor. Aqui no se elige ni se cuenta nada.
 */
export function useDatoCurioso(): DatoCurioso | null {
  const { sesion } = useSesion();
  const cuenta = sesion?.user.id ?? null;
  const [dato, setDato] = useState<DatoCurioso | null>(() =>
    cuenta === null ? null : (datoGuardadoDe(cuenta)?.dato ?? null),
  );

  useEffect(() => {
    if (cuenta === null) {
      return undefined;
    }

    let vigente = true;
    const controlador = new AbortController();

    function pedir() {
      consultarElDatoDeHoy(controlador.signal)
        .then((entregado) => {
          if (!vigente || cuenta === null) {
            return;
          }

          guardarElDato(cuenta, entregado);

          if (entregado.dato !== null) {
            setDato(entregado.dato);
          }
        })
        .catch(() => {
          // Sin conexion o sin cuenta todavia: se queda lo que habia.
        });
    }

    pedir();
    window.addEventListener('online', pedir);

    return () => {
      vigente = false;
      controlador.abort();
      window.removeEventListener('online', pedir);
    };
  }, [cuenta]);

  return cuenta === null ? null : dato;
}
