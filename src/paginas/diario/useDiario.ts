import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { consultarLaVersionDelAviso } from '../../infraestructura/api/aviso.ts';
import { darDeAltaLaCuenta } from '../../infraestructura/api/cuenta.ts';
import { consultarElDiario, type Anotacion } from '../../infraestructura/api/diario.ts';
import type { LineaDeAtencion } from '../../infraestructura/api/resultados.ts';
import { reintentarCambio } from '../../sincronizacion/acciones.ts';
import {
  esAnotacionCopiada,
  type EdicionEnCola,
  type EscrituraEnCola,
  type MotivoDeLaCopia,
} from '../../sincronizacion/anotaciones.ts';
import { clasificarFallo } from '../../sincronizacion/clasificarFallo.ts';
import { encolar } from '../../sincronizacion/ciclo.ts';
import {
  DIAS_QUE_SE_GUARDAN_DEL_DIARIO,
  leerElDiarioConCopia,
  leerLoLocalDelDiario,
  type LoLocalDelDiario,
} from '../../sincronizacion/diarioLocal.ts';
import { operacionDeUnIdLocal } from '../../sincronizacion/ejecutores.ts';
import { suscribirAlProgreso, type Progreso } from '../../sincronizacion/progreso.ts';
import { seguirUnaOperacion } from '../../sincronizacion/seguimiento.ts';
import { diasAntes } from '../../tiempo/dias.ts';
import { explicar } from '../panel/useDatosDelPanel.ts';
import { ahoraMismo, diaDe } from './calendarioDelDiario.ts';
import type { LoQueSeEscribio } from './EditorDelDiario.tsx';
import {
  componerElHistorial,
  mezclarAnotaciones,
  minutosQueLeQuedan,
  type EntradaDelHistorial,
} from './historial.ts';

export type { EntradaDelHistorial } from './historial.ts';

/** Cuantos dias se cargan de una vez, hacia atras desde hoy. */
export const DIAS_POR_TANDA = DIAS_QUE_SE_GUARDAN_DEL_DIARIO;

export type FaseDelDiario =
  | { readonly fase: 'cargando' }
  | { readonly fase: 'listo' }
  | { readonly fase: 'error'; readonly mensaje: string };

/** Algo que paso con lo que se escribio y la persona tiene que saber. */
export interface NovedadDelDiario {
  readonly tipo: 'copia';
  readonly motivo: MotivoDeLaCopia;
}

const SIN_NADA_LOCAL: LoLocalDelDiario = { instantanea: null, marcas: {}, pendientes: [] };

/**
 * Lo que se le dice a la persona cuando no se pudo leer el diario.
 *
 * Sin conexion y sin una copia en este equipo no hay nada que mostrar: se dice por que y
 * que hacer. Mas atras de los ultimos 30 dias nunca hay copia, y lo que ya se veia sigue
 * ahi: ahi solo hace falta conexion para ver mas.
 */
function explicarLaCarga(error: unknown, ultimosDias: boolean): string {
  if (clasificarFallo(error).clase !== 'red') {
    return explicar(error);
  }

  return ultimosDias
    ? 'Todavía no hay una copia de tu diario en este equipo. Conéctate una vez para guardarla y podrás verlo sin conexión.'
    : 'Para ver días anteriores hace falta conexión. Lo que ya tenías sigue aquí.';
}

function esObjeto(valor: unknown): valor is Readonly<Record<string, unknown>> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/**
 * Mi diario (SCRUM-96, SCRUM-139).
 *
 * Lo que se escribe o se corrige **entra a la cola de este equipo** (durable y cifrada) y
 * se ve al instante en el historial, tenga o no conexion. De ahi el motor lo envia con
 * identificador estable: reintentar no duplica. Nada de lo escrito esta solo en la
 * pantalla.
 *
 * El historial se arma de tres cosas (`componerElHistorial`): lo que dijo el servidor (o
 * la copia de los ultimos 30 dias, sin conexion), lo que esta pendiente en la cola, y
 * cuales anotaciones son copia de otra.
 */
export function useDiario() {
  const [hoy] = useState(() => diaDe(ahoraMismo()));
  const [desdeInicial] = useState(() => diasAntes(hoy, DIAS_POR_TANDA - 1));
  const [desde, setDesde] = useState(desdeInicial);
  const [fase, setFase] = useState<FaseDelDiario>({ fase: 'cargando' });
  const [delServidor, setDelServidor] = useState<readonly Anotacion[]>([]);
  /** Cuando se guardo la copia que se esta ensenando, o `null` si es lo que dijo el servidor. */
  const [deLaCopia, setDeLaCopia] = useState<string | null>(null);
  const [local, setLocal] = useState<LoLocalDelDiario>(SIN_NADA_LOCAL);
  const [progreso, setProgreso] = useState<Progreso>({ sincronizando: false });
  const [ahora, setAhora] = useState(ahoraMismo);
  const [lineas, setLineas] = useState<readonly LineaDeAtencion[] | null>(null);
  const [novedad, setNovedad] = useState<NovedadDelDiario | null>(null);
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

  /** Vuelve a leer lo guardado en este equipo: la copia, las marcas y la cola. */
  const releerLoLocal = useCallback(async () => {
    lecturaMasReciente.current += 1;

    const esta = lecturaMasReciente.current;
    const leido = await leerLoLocalDelDiario();

    // Si mientras se leia llego otro aviso, esta lectura ya es vieja.
    if (esta === lecturaMasReciente.current) {
      setLocal(leido);
      setAhora(ahoraMismo());
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
        if (desde === desdeInicial) {
          // Los ultimos 30 dias tienen copia: sin conexion se ensenan.
          const lectura = await leerElDiarioConCopia(
            { desde, hasta: hoy },
            { senal, darDeAlta: true },
          );

          if (senal.aborted) {
            return;
          }

          setDelServidor(lectura.valor.anotaciones);
          setDeLaCopia(lectura.deLaCopia ? lectura.guardadoEn : null);
        } else {
          // Mas atras de eso solo hay servidor: no se guardan.
          const version = await consultarLaVersionDelAviso(senal);

          await darDeAltaLaCuenta(version, senal);

          const anotaciones = await consultarElDiario(desde, hoy, senal);

          if (senal.aborted) {
            return;
          }

          setDelServidor(anotaciones);
          setDeLaCopia(null);
        }

        await releerLoLocal();

        if (!senal.aborted) {
          setFase({ fase: 'listo' });
        }
      } catch (error) {
        if (!senal.aborted) {
          setFase({ fase: 'error', mensaje: explicarLaCarga(error, desde === desdeInicial) });
        }
      }
    }

    void cargar();

    return () => {
      control.abort();
    };
  }, [desde, desdeInicial, hoy, intento, releerLoLocal]);

  // Si lo que se ve es la copia, en cuanto vuelve la conexion se pregunta de nuevo.
  const mostrandoLaCopia = deLaCopia !== null;

  useEffect(() => {
    if (!mostrandoLaCopia) {
      return undefined;
    }

    function alVolverLaRed(): void {
      setIntento((antes) => antes + 1);
    }

    window.addEventListener('online', alVolverLaRed);

    return () => {
      window.removeEventListener('online', alVolverLaRed);
    };
  }, [mostrandoLaCopia]);

  // ---------------------------------------------------------- el historial

  const entradas = useMemo(
    () =>
      componerElHistorial({
        anotaciones: mezclarAnotaciones(delServidor, local.instantanea?.anotaciones ?? []),
        pendientes: local.pendientes,
        marcas: local.marcas,
        sincronizando: progreso.sincronizando,
        ahora,
      }),
    [delServidor, local, progreso.sincronizando, ahora],
  );

  // ---------------------------------------------------------- escribir y corregir

  /** Lo que respondio el servidor a algo que se guardo aqui y salio despues. */
  const alSalir = useCallback((recibo: unknown) => {
    if (!esObjeto(recibo)) {
      return;
    }

    if (recibo.sugiereAcompanamiento === true && Array.isArray(recibo.lineasDeAtencion)) {
      setLineas(recibo.lineasDeAtencion as readonly LineaDeAtencion[]);
    }

    if (esAnotacionCopiada(recibo)) {
      setNovedad({ tipo: 'copia', motivo: recibo.motivo });
      // La original pudo cambiar en el servidor (por eso es copia): se vuelve a leer para
      // ensenar las dos tal como estan, y que la persona decida con cual quedarse.
      setIntento((antes) => antes + 1);
    }
  }, []);

  /**
   * Sigue lo que se acaba de guardar: pide enviarlo ya y, si no sale enseguida, lo espera
   * mientras la pantalla siga abierta. Cuando sale, se entera de lo que respondio la API.
   * La lista no depende de esto: se pone al dia sola cuando la cola cambia.
   */
  const seguir = useCallback(
    (operationId: string) => {
      const senal = seguimientos.current.signal;

      void (async () => {
        let seguimiento = await seguirUnaOperacion(operationId, { sincronizarYa: true, senal });

        if (seguimiento.tipo === 'guardada') {
          seguimiento = await seguirUnaOperacion(operationId, { esperaMaximaEnMs: null, senal });
        }

        if (!senal.aborted && seguimiento.tipo === 'enviada') {
          alSalir(seguimiento.recibo);
        }
      })();
    },
    [alSalir],
  );

  /**
   * Escribe una anotacion nueva. Aparece en el historial al momento.
   *
   * Termina cuando esta guardada **en este equipo**; si no se pudo (no hay donde guardar),
   * lanza, y quien llama no debe vaciar lo que la persona escribio.
   */
  const escribir = useCallback(
    async (
      escrito: LoQueSeEscribio,
      comoCopia?: { readonly copiaDe: string; readonly motivo: MotivoDeLaCopia },
    ): Promise<void> => {
      const operationId = globalThis.crypto.randomUUID();
      const payload: EscrituraEnCola = {
        clientOperationId: operationId,
        dia: escrito.dia,
        ...(escrito.titulo === '' ? {} : { titulo: escrito.titulo }),
        contenido: escrito.contenido,
        ...(escrito.adjuntos.length > 0 ? { adjuntos: escrito.adjuntos } : {}),
        // La hora del dispositivo: sin conexion, la de cuando llegue seria mentira.
        escritaEn: new Date().toISOString(),
        ...(comoCopia ?? {}),
      };

      await encolar({
        operationId,
        tipo: 'diario.escribir',
        entidad: `diario:${operationId}`,
        payload,
      });
      seguir(operationId);
    },
    [seguir],
  );

  /**
   * Corrige una anotacion.
   *
   * Entra a la cola con la version que el dispositivo tenia. Si al enviarla el servidor
   * dice que otro dispositivo la cambio, o que ya paso su hora, **no se pierde nada**: lo
   * escrito se guarda como una anotacion nueva del mismo dia y se avisa (ADR 0009). Si la
   * hora ya paso aqui mismo, se guarda como nueva de una vez.
   *
   * Devuelve cual de las dos cosas paso por ahora: `corregida` (entro como correccion) o
   * `nueva` (la hora ya habia pasado).
   */
  const corregir = useCallback(
    async (
      entrada: EntradaDelHistorial,
      escrito: LoQueSeEscribio,
    ): Promise<'corregida' | 'nueva'> => {
      if (minutosQueLeQuedan(entrada, ahoraMismo()) === 0) {
        await escribir(
          { ...escrito, dia: entrada.dia },
          { copiaDe: entrada.id, motivo: 'EDICION_FUERA_DE_PLAZO' },
        );

        return 'nueva';
      }

      const operationId = globalThis.crypto.randomUUID();
      const creadaAqui = operacionDeUnIdLocal(entrada.id);
      const payload: EdicionEnCola = {
        id: entrada.id,
        // Si ya hay algo pendiente sobre esta anotacion, la version se toma de lo que
        // responda eso: la que tenia el dispositivo ya quedo atras.
        ...(entrada.estado === 'guardada' ? { version: entrada.version } : {}),
        dia: entrada.dia,
        titulo: escrito.titulo === '' ? null : escrito.titulo,
        contenido: escrito.contenido,
        adjuntos: escrito.adjuntos.length > 0 ? escrito.adjuntos : null,
        editadaEn: new Date().toISOString(),
      };

      await encolar({
        operationId,
        tipo: 'diario.editar',
        // Una anotacion escrita aqui y una correccion de ella son de la misma cosa.
        entidad: `diario:${creadaAqui ?? entrada.id}`,
        payload,
      });
      seguir(operationId);

      return 'corregida';
    },
    [escribir, seguir],
  );

  /** Vuelve a mandar lo que la API no acepto. */
  const reintentar = useCallback(
    (entrada: EntradaDelHistorial) => {
      const operationId = entrada.operacionConError;

      if (operationId !== undefined) {
        void reintentarCambio(operationId).then((devuelta) => {
          if (devuelta) {
            seguir(operationId);
          }
        });
      }
    },
    [seguir],
  );

  return {
    hoy,
    fase,
    entradas,
    lineas,
    cerrarLineas: () => setLineas(null),
    /** Cuando se guardo la copia que se esta ensenando, o `null` si es lo del servidor. */
    deLaCopia,
    /** El instante de la ultima lectura de lo guardado en este equipo. */
    ahora,
    novedad,
    cerrarNovedad: () => setNovedad(null),
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
