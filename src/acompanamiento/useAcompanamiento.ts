import { useCallback, useEffect, useReducer, useState } from 'react';

import type { Acompanamiento } from '../infraestructura/api/acompanamiento.ts';
import type { LineaDeAtencion } from '../infraestructura/api/resultados.ts';
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

/**
 * Las cuentas que ya cerraron el aviso de abandono **en esta visita** (SCRUM-256). Se cierra tambien
 * el critico: es una bienvenida, no una vigilancia (ADR 0035), y quien vuelve tras una mala racha no
 * puede encontrarse con un aviso que no se quita. Mismas reglas que `cerrados`: en memoria y sin
 * guardar nada sobre la persona en este equipo.
 */
const cerradosDeAbandono = new Set<string>();

/** Para las pruebas: olvida lo que se cerro. */
export function olvidarLosAvisosCerrados(): void {
  cerrados.clear();
  cerradosDeAbandono.clear();
}

/**
 * Lo que hay que mostrar, ya decidido: por que (`dias` seguidos o `abandono`), en que nivel y con que
 * lineas. Los dos motivos no se dan a la vez: el servidor no los manda juntos.
 */
export interface AvisoVigente {
  readonly motivo: 'dias' | 'abandono';
  readonly nivel: 'moderado' | 'critico';
  readonly lineasDeAtencion: readonly LineaDeAtencion[];
}

/**
 * El acompanamiento de la cuenta de ahora, o `null` si no hay nada que mostrar (SCRUM-177).
 *
 * Lo pide al montarse y otra vez cuando vuelve la conexion. Si no se puede pedir —sin conexion y sin
 * copia, o sin cuenta todavia— no es un error que la persona deba ver: no se muestra nada. Es un
 * acompanamiento, no una pantalla que pueda fallar.
 *
 * El nivel lo calcula el servidor, en la zona de la persona: aqui no se cuenta nada. Por dias seguidos,
 * **el critico no se cierra**; el moderado si, y no vuelve en esta visita. El de abandono (SCRUM-256)
 * se cierra siempre, moderado o critico, y tampoco vuelve en esta visita.
 */
export function useAcompanamiento(): {
  readonly aviso: AvisoVigente | null;
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
    if (cuenta !== null && lectura !== null) {
      // Lo que se ve cuando no hay nivel por dias es el de abandono: es ese el que se cierra.
      (lectura.nivel === 'ninguno' ? cerradosDeAbandono : cerrados).add(cuenta);
      repintar();
    }
  }, [cuenta, lectura]);

  if (cuenta === null || lectura === null) {
    return { aviso: null, cerrar };
  }

  if (lectura.nivel !== 'ninguno') {
    return {
      aviso:
        lectura.nivel === 'moderado' && cerrados.has(cuenta)
          ? null
          : { motivo: 'dias', nivel: lectura.nivel, lineasDeAtencion: lectura.lineasDeAtencion },
      cerrar,
    };
  }

  if (lectura.abandono === 'ninguno' || cerradosDeAbandono.has(cuenta)) {
    return { aviso: null, cerrar };
  }

  return {
    aviso: {
      motivo: 'abandono',
      nivel: lectura.abandono,
      lineasDeAtencion: lectura.lineasDeAtencion,
    },
    cerrar,
  };
}
