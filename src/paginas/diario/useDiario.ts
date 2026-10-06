import { useCallback, useEffect, useState } from 'react';

import { consultarLaVersionDelAviso } from '../../infraestructura/api/aviso.ts';
import { ErrorDeLaApi } from '../../infraestructura/api/clienteHttp.ts';
import { darDeAltaLaCuenta } from '../../infraestructura/api/cuenta.ts';
import {
  consultarElDiario,
  editarAnotacion,
  escribirEnElDiario,
  NO_SE_PUEDE_EDITAR,
  type Anotacion,
  type AnotacionGuardada,
  type AnotacionPorEscribir,
} from '../../infraestructura/api/diario.ts';
import type { LineaDeAtencion } from '../../infraestructura/api/resultados.ts';
import { explicar } from '../panel/useDatosDelPanel.ts';
import { ahoraMismo, diaDe, diasAntes } from './calendarioDelDiario.ts';
import type { LoQueSeEscribio } from './EditorDelDiario.tsx';

/** Cuantos dias se cargan de una vez, hacia atras desde hoy. */
export const DIAS_POR_TANDA = 30;

/**
 * Una anotacion del historial, con lo que le pasa en este momento.
 *
 * Lo recien escrito entra **antes** de que responda el servidor, como
 * `guardando`, para que aparezca al instante. Si el envio falla queda como
 * `error`, con lo que hacia falta para reintentar: la misma operacion, que
 * el servidor reconoce y no duplica.
 */
export type EntradaDelHistorial = Anotacion &
  (
    | { readonly estado: 'guardada' }
    | { readonly estado: 'guardando' | 'error'; readonly operacion: AnotacionPorEscribir }
  );

export type FaseDelDiario =
  | { readonly fase: 'cargando' }
  | { readonly fase: 'listo' }
  | { readonly fase: 'error'; readonly mensaje: string };

/** El id provisional de lo que todavia no confirmo el servidor. */
function idProvisional(operacion: string): string {
  return `pendiente-${operacion}`;
}

function guardada(anotacion: Anotacion): EntradaDelHistorial {
  return { ...anotacion, estado: 'guardada' };
}

export function useDiario() {
  const [hoy] = useState(() => diaDe(ahoraMismo()));
  const [desde, setDesde] = useState(() => diasAntes(hoy, DIAS_POR_TANDA - 1));
  const [fase, setFase] = useState<FaseDelDiario>({ fase: 'cargando' });
  const [entradas, setEntradas] = useState<readonly EntradaDelHistorial[]>([]);
  const [lineas, setLineas] = useState<readonly LineaDeAtencion[] | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    const control = new AbortController();

    async function cargar(): Promise<void> {
      try {
        // Como el perfil y el sendero: alguien puede abrir esta direccion
        // directamente, antes de que exista su cuenta.
        const version = await consultarLaVersionDelAviso(control.signal);
        await darDeAltaLaCuenta(version, control.signal);
        const delServidor = await consultarElDiario(desde, hoy, control.signal);

        if (control.signal.aborted) {
          return;
        }

        // Lo que todavia se esta enviando no se pierde al recargar.
        setEntradas((antes) => [
          ...delServidor.map(guardada),
          ...antes.filter((entrada) => entrada.estado !== 'guardada'),
        ]);
        setFase({ fase: 'listo' });
      } catch (error) {
        if (!control.signal.aborted) {
          setFase({ fase: 'error', mensaje: explicar(error) });
        }
      }
    }

    void cargar();

    return () => {
      control.abort();
    };
  }, [desde, hoy, intento]);

  /** Lo que devuelve el servidor reemplaza a lo provisional, o a la version anterior. */
  const confirmar = useCallback((idAnterior: string, respuesta: AnotacionGuardada) => {
    const { sugiereAcompanamiento, lineasDeAtencion, ...anotacion } = respuesta;

    setEntradas((antes) => [
      ...antes.filter((entrada) => entrada.id !== idAnterior && entrada.id !== anotacion.id),
      guardada(anotacion),
    ]);

    if (sugiereAcompanamiento) {
      setLineas(lineasDeAtencion);
    }
  }, []);

  const enviar = useCallback(
    async (operacion: AnotacionPorEscribir) => {
      const id = idProvisional(operacion.clientOperationId);

      setEntradas((antes) =>
        antes.map((entrada) =>
          entrada.id === id ? { ...entrada, estado: 'guardando', operacion } : entrada,
        ),
      );

      try {
        confirmar(id, await escribirEnElDiario(operacion));
      } catch {
        setEntradas((antes) =>
          antes.map((entrada) =>
            entrada.id === id ? { ...entrada, estado: 'error', operacion } : entrada,
          ),
        );
      }
    },
    [confirmar],
  );

  /** Escribe una anotacion nueva. Aparece en el historial al momento. */
  const escribir = useCallback(
    (escrito: LoQueSeEscribio) => {
      const operacion: AnotacionPorEscribir = {
        clientOperationId: globalThis.crypto.randomUUID(),
        dia: escrito.dia,
        ...(escrito.titulo === '' ? {} : { titulo: escrito.titulo }),
        contenido: escrito.contenido,
        ...(escrito.adjuntos.length > 0 ? { adjuntos: escrito.adjuntos } : {}),
      };
      const ahora = new Date();

      setEntradas((antes) => [
        ...antes,
        {
          id: idProvisional(operacion.clientOperationId),
          dia: operacion.dia,
          titulo: operacion.titulo ?? null,
          contenido: operacion.contenido,
          adjuntos: operacion.adjuntos ?? [],
          version: 0,
          creadaEn: ahora.toISOString(),
          editadaEn: ahora.toISOString(),
          editableHasta: ahora.toISOString(),
          estado: 'guardando',
          operacion,
        },
      ]);

      void enviar(operacion);
    },
    [enviar],
  );

  /** Vuelve a mandar una que fallo, con la misma operacion. */
  const reintentar = useCallback(
    (entrada: EntradaDelHistorial) => {
      if (entrada.estado !== 'guardada') {
        void enviar(entrada.operacion);
      }
    },
    [enviar],
  );

  /**
   * Corrige una anotacion.
   *
   * Si el servidor dice que ya paso su hora, o que otro dispositivo la
   * cambio, no se pierde nada: lo que se traia se guarda como una anotacion
   * nueva del mismo dia (ADR 0009). Devuelve cual de las dos cosas paso.
   */
  const corregir = useCallback(
    async (anotacion: Anotacion, escrito: LoQueSeEscribio): Promise<'corregida' | 'nueva'> => {
      try {
        confirmar(
          anotacion.id,
          await editarAnotacion(anotacion.id, {
            version: anotacion.version,
            titulo: escrito.titulo === '' ? null : escrito.titulo,
            contenido: escrito.contenido,
            adjuntos: escrito.adjuntos.length > 0 ? escrito.adjuntos : null,
          }),
        );

        return 'corregida';
      } catch (error) {
        if (error instanceof ErrorDeLaApi && NO_SE_PUEDE_EDITAR.has(error.codigo ?? '')) {
          escribir({ ...escrito, dia: anotacion.dia });

          return 'nueva';
        }

        throw error;
      }
    },
    [confirmar, escribir],
  );

  return {
    hoy,
    fase,
    entradas,
    lineas,
    cerrarLineas: () => setLineas(null),
    escribir,
    reintentar,
    corregir,
    verDiasAnteriores: () => setDesde((antes) => diasAntes(antes, DIAS_POR_TANDA)),
    recargar: () => {
      setFase({ fase: 'cargando' });
      setIntento((antes) => antes + 1);
    },
  };
}
