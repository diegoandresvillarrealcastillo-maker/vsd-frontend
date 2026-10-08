import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAlVolverLaRed } from '../conexion/useAlVolverLaRed.ts';
import type {
  CambiosDePendiente,
  NivelDePendiente,
  Pendiente,
  Recordatorio,
} from '../infraestructura/api/pendientes.ts';
import { encolar } from '../sincronizacion/ciclo.ts';
import { operacionDeUnIdLocal } from '../sincronizacion/ejecutores.ts';
import { suscribirAlProgreso, type Progreso } from '../sincronizacion/progreso.ts';
import { seguirUnaOperacion } from '../sincronizacion/seguimiento.ts';
import {
  leerElSemaforoConCopia,
  leerLoLocalDelSemaforo,
  type LoLocalDelSemaforo,
} from '../sincronizacion/semaforoLocal.ts';
import {
  cambiosEnConflicto,
  componerElSemaforo,
  type CambiosEnConflicto,
  type PendienteEnPantalla,
} from './composicion.ts';
import { aplicarMiCambio, quedarseConLoDelServidor } from './resolver.ts';

export type EstadoDelSemaforo =
  | { readonly fase: 'cargando' }
  | { readonly fase: 'error' }
  | {
      readonly fase: 'listo';
      readonly pendientes: readonly PendienteEnPantalla[];
      /** El de esta visita, si la persona no lo ha dejado para luego. Nunca sale de la copia. */
      readonly recordatorio: Recordatorio | null;
      /** Cuando se guardo la copia que se esta ensenando, o `null` si es lo que dijo el servidor. */
      readonly deLaCopia: string | null;
    };

/** Un cambio que choco con otro dispositivo, listo para ensenarse y elegir. */
export interface Choque extends CambiosEnConflicto {
  /** Lo que se ve del pendiente, con los cambios de la persona puestos. */
  readonly mio: PendienteEnPantalla;
  /** Lo que tiene el servidor, si se sabe. */
  readonly delServidor: Pendiente | undefined;
}

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

const SIN_NADA_LOCAL: LoLocalDelSemaforo = { instantanea: null, pendientes: [] };

/**
 * El semaforo de la persona: lo carga y lo cambia (SCRUM-98, SCRUM-140).
 *
 * Lo que se anota, se cambia o se borra **entra a la cola de este equipo** (durable y cifrada)
 * y se ve al instante, tenga o no conexion. De ahi el motor lo envia con identificador
 * estable. El historial se arma de lo que dijo el servidor (o la copia, sin conexion) mas lo
 * pendiente de la cola (`componerElSemaforo`).
 *
 * Si un cambio choca con otro dispositivo (409), queda detenido y se ofrece elegir
 * (`choques`, `resolver`): no se pierde ninguna de las dos versiones antes de confirmar.
 *
 * Cada accion termina cuando esta guardada **en este equipo**; si no se pudo (no hay donde
 * guardar), lanza y la pantalla lo cuenta.
 */
export function useSemaforo() {
  const [fase, setFase] = useState<'cargando' | 'error' | 'listo'>('cargando');
  const [delServidor, setDelServidor] = useState<readonly Pendiente[]>([]);
  const [recordatorio, setRecordatorio] = useState<Recordatorio | null>(null);
  const [deLaCopia, setDeLaCopia] = useState<string | null>(null);
  const [local, setLocal] = useState<LoLocalDelSemaforo>(SIN_NADA_LOCAL);
  const [progreso, setProgreso] = useState<Progreso>({ sincronizando: false });
  const [ahora, setAhora] = useState(() => new Date());
  const [intento, setIntento] = useState(0);

  /** Cancela los seguimientos de lo guardado cuando la pantalla se cierra. */
  const seguimientos = useRef<AbortController>(new AbortController());

  useEffect(() => {
    const control = new AbortController();

    seguimientos.current = control;

    return () => {
      control.abort();
    };
  }, []);

  // ---------------------------------------------------------- lo de este equipo

  const lecturaMasReciente = useRef(0);
  /** Los cambios que chocaron y ya se vieron: de los nuevos se vuelve a leer el servidor. */
  const choquesVistos = useRef<ReadonlySet<string>>(new Set());

  /** Vuelve a leer lo guardado en este equipo: la copia y la cola. */
  const releerLoLocal = useCallback(async () => {
    lecturaMasReciente.current += 1;

    const esta = lecturaMasReciente.current;
    const leido = await leerLoLocalDelSemaforo();

    // Si mientras se leia llego otro aviso, esta lectura ya es vieja.
    if (esta === lecturaMasReciente.current) {
      setLocal(leido);
      setAhora(new Date());

      // Cuando algo choca, lo que tiene el servidor puede no ser lo de ahora (se vio la copia,
      // o se leyo antes): se vuelve a leer una vez para ensenar lo de verdad.
      const chocan = new Set(
        leido.pendientes.filter((o) => o.estado === 'conflicto').map((o) => o.operationId),
      );

      if ([...chocan].some((id) => !choquesVistos.current.has(id))) {
        setIntento((antes) => antes + 1);
      }

      choquesVistos.current = chocan;
    }
  }, []);

  useEffect(
    () =>
      suscribirAlProgreso((nuevo) => {
        setProgreso(nuevo);
        void releerLoLocal();
      }),
    [releerLoLocal],
  );

  // ---------------------------------------------------------- lo del servidor

  useEffect(() => {
    const control = new AbortController();
    const { signal: senal } = control;

    async function cargar(): Promise<void> {
      try {
        const lectura = await leerElSemaforoConCopia(senal);

        if (senal.aborted) {
          return;
        }

        setDelServidor(lectura.valor.pendientes);
        setRecordatorio(visible(lectura.valor.recordatorio));
        setDeLaCopia(lectura.deLaCopia ? lectura.guardadoEn : null);

        await releerLoLocal();

        if (!senal.aborted) {
          setFase('listo');
        }
      } catch {
        if (!senal.aborted) {
          setFase('error');
        }
      }
    }

    void cargar();

    return () => {
      control.abort();
    };
  }, [intento, releerLoLocal]);

  const reintentar = useCallback(() => {
    setFase('cargando');
    setIntento((antes) => antes + 1);
  }, []);

  // Si lo que se ve es la copia, en cuanto vuelve la conexion se pregunta de nuevo.
  const preguntarDeNuevo = useCallback(() => {
    setIntento((antes) => antes + 1);
  }, []);

  useAlVolverLaRed(deLaCopia !== null, preguntarDeNuevo);

  // ---------------------------------------------------------- lo que se ve

  const pendientes = useMemo(
    () =>
      componerElSemaforo({
        // La copia ya esta conciliada con lo que el servidor acepto, **incluido lo que se
        // borro**: lo leido antes lo seguiria teniendo y un pendiente borrado reaparecia.
        // Lo leido solo sirve si no se pudo guardar la copia.
        pendientes: local.instantanea?.pendientes ?? delServidor,
        operaciones: local.pendientes,
        sincronizando: progreso.sincronizando,
        ahora,
      }),
    [delServidor, local, progreso.sincronizando, ahora],
  );

  // La ultima version de lo que se ve, para quien decide con ella al actuar sin volver a pintar.
  const actuales = useRef<readonly PendienteEnPantalla[]>([]);

  useEffect(() => {
    actuales.current = pendientes;
  });

  const choques = useMemo((): readonly Choque[] => {
    const lista: Choque[] = [];

    for (const uno of pendientes) {
      const conflicto =
        uno.estado === 'choco' ? cambiosEnConflicto(local.pendientes, uno.id) : null;

      if (conflicto !== null) {
        lista.push({ ...conflicto, mio: uno, delServidor: uno.delServidor });
      }
    }

    return lista;
  }, [pendientes, local.pendientes]);

  // ---------------------------------------------------------- cambiar

  /** Pide enviar ya lo que se acaba de guardar. La lista no depende de esto. */
  const seguir = useCallback((operationId: string) => {
    void seguirUnaOperacion(operationId, {
      sincronizarYa: true,
      senal: seguimientos.current.signal,
    });
  }, []);

  /** Un recordatorio de algo que ya se atendio, se va. */
  const atender = useCallback((id: string) => {
    setRecordatorio((antes) => (antes?.pendienteId === id ? null : antes));
  }, []);

  const crear = useCallback(
    async (texto: string, nivel: NivelDePendiente, fechaLimite?: string): Promise<void> => {
      const operationId = globalThis.crypto.randomUUID();

      await encolar({
        operationId,
        tipo: 'pendiente.crear',
        entidad: `pendiente:${operationId}`,
        payload: {
          clientOperationId: operationId,
          texto,
          nivel,
          ...(fechaLimite === undefined ? {} : { fechaLimite }),
        },
      });
      seguir(operationId);
    },
    [seguir],
  );

  const editar = useCallback(
    async (id: string, cambios: CambiosDePendiente): Promise<void> => {
      const entrada = actuales.current.find((uno) => uno.id === id);
      // Se manda la version que el dispositivo tenia, solo si lo que se ve es lo del servidor.
      // Si ya hay algo pendiente sobre esto, la version sale de lo que responda eso: la que
      // tenia el dispositivo ya quedo atras. Y si se anoto aqui, todavia no tiene.
      const version =
        entrada?.estado === 'guardado' && entrada.version !== undefined
          ? entrada.version
          : undefined;
      const operationId = globalThis.crypto.randomUUID();

      await encolar({
        operationId,
        tipo: 'pendiente.editar',
        // Algo anotado aqui y sus cambios son de la misma cosa.
        entidad: `pendiente:${operacionDeUnIdLocal(id) ?? id}`,
        payload: { id, cambios: { ...(version === undefined ? {} : { version }), ...cambios } },
      });

      // Cambiar el nivel, terminarlo, posponerlo o darle otra fecha es atenderlo; corregir
      // el texto, no.
      if (
        cambios.nivel !== undefined ||
        cambios.hecho !== undefined ||
        cambios.posponerHasta !== undefined ||
        cambios.fechaLimite !== undefined
      ) {
        atender(id);
      }

      seguir(operationId);
    },
    [atender, seguir],
  );

  const borrar = useCallback(
    async (id: string): Promise<void> => {
      const operationId = globalThis.crypto.randomUUID();

      await encolar({
        operationId,
        tipo: 'pendiente.borrar',
        entidad: `pendiente:${operacionDeUnIdLocal(id) ?? id}`,
        payload: { id },
      });
      atender(id);
      seguir(operationId);
    },
    [atender, seguir],
  );

  /** La persona eligio con cual quedarse cuando un cambio choco con otro dispositivo. */
  const resolver = useCallback(
    async (id: string, eleccion: 'servidor' | 'mio'): Promise<void> => {
      const conflicto = choques.find((uno) => uno.id === id);

      if (conflicto === undefined) {
        return;
      }

      if (eleccion === 'servidor') {
        await quedarseConLoDelServidor(conflicto);

        return;
      }

      seguir(await aplicarMiCambio(conflicto, conflicto.delServidor?.version));
    },
    [choques, seguir],
  );

  const dejarParaLuego = useCallback(() => {
    if (recordatorio === null) {
      return;
    }

    dejadosParaLuego.add(recordatorio.pendienteId);
    setRecordatorio(null);
  }, [recordatorio]);

  const estado: EstadoDelSemaforo =
    fase === 'listo' ? { fase, pendientes, recordatorio, deLaCopia } : { fase };

  return { estado, choques, reintentar, crear, editar, borrar, resolver, dejarParaLuego };
}
