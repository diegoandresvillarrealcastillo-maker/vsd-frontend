import { useCallback, useEffect, useRef, useState } from 'react';

import {
  borrarPendiente,
  consultarElSemaforo,
  crearPendiente,
  editarPendiente,
  type CambiosDePendiente,
  type NivelDePendiente,
  type Pendiente,
  type Recordatorio,
} from '../infraestructura/api/pendientes.ts';

export type EstadoDelSemaforo =
  | { readonly fase: 'cargando' }
  | { readonly fase: 'error' }
  | {
      readonly fase: 'listo';
      readonly pendientes: readonly Pendiente[];
      /** El de esta visita, si la persona no lo ha dejado para luego. */
      readonly recordatorio: Recordatorio | null;
    };

/**
 * Los recordatorios que la persona dejo para luego en esta visita.
 *
 * Viven en memoria a proposito: el backend vuelve a mandar el mismo mientras
 * nadie lo atienda, y "ahora no" tiene que durar lo que dura la visita, no
 * para siempre. Al recargar o volver otro dia, se recuerda de nuevo. Fuera
 * de la pantalla, para que cambiar de pagina no lo haga reaparecer.
 */
const dejadosParaLuego = new Set<string>();

/** Para las pruebas: cada una empieza con la visita en blanco. */
export function olvidarLosRecordatoriosDejados(): void {
  dejadosParaLuego.clear();
}

function visible(recordatorio: Recordatorio | null): Recordatorio | null {
  return recordatorio !== null && dejadosParaLuego.has(recordatorio.pendienteId)
    ? null
    : recordatorio;
}

/**
 * El semaforo de la persona: lo carga y lo cambia.
 *
 * Cada cambio espera a la API y pinta lo que ella devuelve. Si falla, lanza y
 * no toca nada: la pantalla decide como contarlo.
 */
export function useSemaforo() {
  const [estado, setEstado] = useState<EstadoDelSemaforo>({ fase: 'cargando' });
  const [intento, setIntento] = useState(0);
  // Un reintento del mismo pendiente reutiliza el identificador: si la
  // primera vez llego al servidor y se perdio la respuesta, no se duplica.
  const ultimoIntento = useRef<{ texto: string; nivel: NivelDePendiente; id: string } | null>(null);

  useEffect(() => {
    const control = new AbortController();

    consultarElSemaforo(control.signal).then(
      (semaforo) => {
        if (!control.signal.aborted) {
          setEstado({
            fase: 'listo',
            pendientes: semaforo.pendientes,
            recordatorio: visible(semaforo.recordatorio),
          });
        }
      },
      () => {
        if (!control.signal.aborted) {
          setEstado({ fase: 'error' });
        }
      },
    );

    return () => control.abort();
  }, [intento]);

  const reintentar = useCallback(() => {
    setEstado({ fase: 'cargando' });
    setIntento((antes) => antes + 1);
  }, []);

  /** Cambia la lista. Un recordatorio de algo que ya se atendio, se va. */
  const actualizar = useCallback(
    (cambiar: (pendientes: readonly Pendiente[]) => readonly Pendiente[], atendido?: string) => {
      setEstado((antes) =>
        antes.fase === 'listo'
          ? {
              ...antes,
              pendientes: cambiar(antes.pendientes),
              recordatorio:
                atendido !== undefined && antes.recordatorio?.pendienteId === atendido
                  ? null
                  : antes.recordatorio,
            }
          : antes,
      );
    },
    [],
  );

  const crear = useCallback(
    async (texto: string, nivel: NivelDePendiente): Promise<Pendiente> => {
      const anterior = ultimoIntento.current;
      const id =
        anterior?.texto === texto && anterior.nivel === nivel
          ? anterior.id
          : globalThis.crypto.randomUUID();

      ultimoIntento.current = { texto, nivel, id };

      const creado = await crearPendiente({ clientOperationId: id, texto, nivel });

      ultimoIntento.current = null;
      // Un reintento que ya habia llegado devuelve el mismo: no se repite.
      actualizar((pendientes) => [...pendientes.filter((uno) => uno.id !== creado.id), creado]);

      return creado;
    },
    [actualizar],
  );

  const editar = useCallback(
    async (id: string, cambios: CambiosDePendiente): Promise<Pendiente> => {
      const editado = await editarPendiente(id, cambios);

      actualizar(
        (pendientes) => pendientes.map((uno) => (uno.id === id ? editado : uno)),
        // Cambiar el nivel, terminarlo o posponerlo es atenderlo; corregir el
        // texto, no.
        cambios.nivel !== undefined ||
          cambios.hecho !== undefined ||
          cambios.posponerHasta !== undefined
          ? id
          : undefined,
      );

      return editado;
    },
    [actualizar],
  );

  const borrar = useCallback(
    async (id: string): Promise<void> => {
      await borrarPendiente(id);
      actualizar((pendientes) => pendientes.filter((uno) => uno.id !== id), id);
    },
    [actualizar],
  );

  const recordatorio = estado.fase === 'listo' ? estado.recordatorio : null;

  const dejarParaLuego = useCallback(() => {
    if (recordatorio === null) {
      return;
    }

    dejadosParaLuego.add(recordatorio.pendienteId);
    setEstado((antes) => (antes.fase === 'listo' ? { ...antes, recordatorio: null } : antes));
  }, [recordatorio]);

  return { estado, reintentar, crear, editar, borrar, dejarParaLuego };
}
