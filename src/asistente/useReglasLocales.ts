import { useCallback, useEffect, useState } from 'react';

import { useAlVolverLaRed } from '../conexion/useAlVolverLaRed.ts';
import type { ReglasLocales } from '../infraestructura/api/reglasLocales.ts';
import { leerLasReglasLocalesConCopia } from '../sincronizacion/reglasLocalesLocal.ts';

/**
 * Las reglas con las que VSD IA responde sin conexion (SCRUM-141), listas para usarse.
 *
 * Al abrir el asistente se leen: con conexion se le pregunta al servidor con el `ETag` de
 * la copia (si no cambiaron no se baja nada), y sin ella se usa la copia. Cuando vuelve la
 * conexion se preguntan de nuevo, para renovar las lineas.
 *
 * Devuelve `null` mientras no se sabe, y **sigue siendo `null` si no hay nada que usar**:
 * sin conexion y sin copia no se inventa nada. Una lectura que falla despues de tener
 * reglas **no las quita**: las que ya se tenian siguen sirviendo.
 */
export function useReglasLocales(): ReglasLocales | null {
  const [reglas, setReglas] = useState<ReglasLocales | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    const control = new AbortController();
    const { signal: senal } = control;

    async function leer(): Promise<void> {
      try {
        const lectura = await leerLasReglasLocalesConCopia(senal);

        if (!senal.aborted) {
          setReglas(lectura.valor);
        }
      } catch {
        // Sin conexion y sin copia, o un paquete que no se entiende: no hay reglas nuevas. Las
        // que se tenian, si se tenian, siguen siendo las que valen.
      }
    }

    void leer();

    return () => {
      control.abort();
    };
  }, [intento]);

  // Al volver la conexion se renuevan: las lineas pueden haber cambiado.
  const preguntarDeNuevo = useCallback(() => {
    setIntento((antes) => antes + 1);
  }, []);

  useAlVolverLaRed(true, preguntarDeNuevo);

  return reglas;
}
