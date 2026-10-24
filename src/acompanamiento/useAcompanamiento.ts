import { useCallback, useEffect, useReducer, useState } from 'react';

import type { Acompanamiento } from '../infraestructura/api/acompanamiento.ts';
import { useSesion } from '../sesion/useSesion.ts';
import { leerElAcompanamiento } from '../sincronizacion/acompanamientoLocal.ts';

/**
 * Las cuentas que ya cerraron el aviso moderado **en esta visita** (SCRUM-177).
 *
 * Vive en memoria y no se guarda: si el aviso moderado volvio es porque, al abrir la aplicacion de
 * nuevo, los dias siguen ahi, y una marca guardada diria algo sobre la persona en este equipo.
 * Cerrarlo no pide cuentas ni lo vuelve a mostrar mientras se navega.
 *
 * shortcut: cerrarlo vale hasta recargar la pagina (y se mantiene si se cierra y se vuelve a abrir la
 * sesion en la misma pestana). Si Diego quiere «no mas hoy», hay que guardarlo por persona y por dia.
 */
const cerrados = new Set<string>();

/** Para las pruebas: olvida lo que se cerro. */
export function olvidarLosAvisosCerrados(): void {
  cerrados.clear();
}

/**
 * El acompanamiento de la cuenta de ahora, o `null` si no hay nada que mostrar (SCRUM-177).
 *
 * Lo pide al montarse y otra vez cuando vuelve la conexion. Si no se puede pedir —sin conexion y sin
 * copia, o sin cuenta todavia— no es un error que la persona deba ver: no se muestra nada. Es un
 * acompanamiento, no una pantalla que pueda fallar.
 *
 * El nivel lo calcula el servidor, en la zona de la persona: aqui no se cuenta nada. **El critico no
 * se cierra**; el moderado si, y no vuelve en esta visita.
 */
export function useAcompanamiento(): {
  readonly aviso: Acompanamiento | null;
  readonly cerrar: () => void;
} {
  const { sesion } = useSesion();
  const cuenta = sesion?.user.id ?? null;
  const [lectura, setLectura] = useState<Acompanamiento | null>(null);
  const [, repintar] = useReducer((cuantas: number) => cuantas + 1, 0);

  useEffect(() => {
    if (cuenta === null) {
      return undefined;
    }

    const control = new AbortController();

    function pedir() {
      leerElAcompanamiento(control.signal)
        .then((leida) => {
          if (!control.signal.aborted) {
            setLectura(leida.valor);
          }
        })
        .catch(() => {
          // Sin conexion y sin copia, o sin cuenta todavia: no hay nada que ofrecer.
        });
    }

    pedir();
    window.addEventListener('online', pedir);

    return () => {
      control.abort();
      window.removeEventListener('online', pedir);
    };
  }, [cuenta]);

  const cerrar = useCallback(() => {
    if (cuenta !== null) {
      cerrados.add(cuenta);
      repintar();
    }
  }, [cuenta]);

  if (cuenta === null || lectura === null || lectura.nivel === 'ninguno') {
    return { aviso: null, cerrar };
  }

  return { aviso: lectura.nivel === 'moderado' && cerrados.has(cuenta) ? null : lectura, cerrar };
}
