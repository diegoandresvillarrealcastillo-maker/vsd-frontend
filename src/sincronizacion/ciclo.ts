import { deleteDB } from 'idb';

import { hayConexionConLaApi } from '../infraestructura/api/conexion.ts';
import {
  abrirAlmacenEnIndexedDB,
  crearAlmacenEnMemoria,
  nombreDeLaBase,
  type AlmacenLocal,
} from './almacenLocal.ts';
import { crearLlaveroEnIndexedDB, type Llavero } from './llavero.ts';
import {
  nuevaOperacion,
  ultimaPendienteDe,
  type DatosDeOperacionNueva,
  type Operacion,
} from './cola.ts';
import { crearMotor, type MotorDeSincronizacion } from './motor.ts';

/**
 * La vida del almacen local dentro de la aplicacion (SCRUM-136).
 *
 * Es quien decide **cuando se abre, cuando se cierra y cuando se olvida** lo de una
 * persona. Hay tres momentos y no son lo mismo:
 *
 * - **Entra la sesion de una persona**: se abre su almacen (y se borra el de
 *   cualquier otra persona que hubiera quedado en este equipo).
 * - **La sesion termina sin que la persona lo pida** (caduco, se revoco, se cerro
 *   en otra pestana): el almacen se **cierra pero NO se borra**. Lo que la persona
 *   hizo sin conexion y no se envio sigue ahi: cuando vuelva a entrar, se envia
 *   (HU_MF09_002, criterio 5: "sin descartar la cola").
 * - **La persona cierra sesion** (o borra su cuenta): se **olvida todo**, base y
 *   clave (HU_MF09_001, criterio 4: al cerrar sesion, nada de lo privado queda en el
 *   dispositivo).
 *
 * Distinguir los dos ultimos es la razon de este archivo: ambos terminan en "no hay
 * sesion", y tratarlos igual o bien borraria cambios sin enviar por una sesion
 * caducada, o bien dejaria los datos de alguien en un equipo compartido.
 *
 * ## Si no hay donde guardar
 *
 * Con la sesion que no se recuerda en este equipo, o si el navegador no deja usar
 * IndexedDB (navegacion privada en algunos), el almacen es **en memoria**: sirve
 * mientras la pestana siga abierta y no deja nada escrito.
 */

export interface CicloAbierto {
  readonly persona: string;
  readonly almacen: AlmacenLocal;
  readonly motor: MotorDeSincronizacion;
}

/**
 * Por donde las pestanas se avisan de que la cola cambio. Lo que se manda es solo
 * de quien es la cola: nunca el contenido de una operacion.
 */
export interface CanalDeLaCola {
  publicar(persona: string): void;
  escuchar(oyente: (persona: string) => void): void;
  cerrar(): void;
}

const NOMBRE_DEL_CANAL = 'vsd-cola';

/** Lo que se puede cambiar para probar el ciclo sin un navegador de verdad. */
export interface FabricasDelCiclo {
  readonly hayIndexedDB: () => boolean;
  readonly crearLlavero: () => Llavero;
  readonly abrirEnIndexedDB: (persona: string, llavero: Llavero) => Promise<AlmacenLocal>;
  readonly crearEnMemoria: (persona: string) => AlmacenLocal;
  readonly borrarBase: (persona: string) => Promise<void>;
  readonly confirmarConexion: () => Promise<boolean>;
  readonly pedirPersistencia: () => void;
  /** `null` donde el navegador no tiene `BroadcastChannel`: entonces cada pestana va por su lado. */
  readonly crearCanalDeLaCola: () => CanalDeLaCola | null;
}

const FABRICAS_REALES: FabricasDelCiclo = {
  hayIndexedDB: () => typeof indexedDB !== 'undefined',
  crearLlavero: () => crearLlaveroEnIndexedDB(),
  abrirEnIndexedDB: abrirAlmacenEnIndexedDB,
  crearEnMemoria: crearAlmacenEnMemoria,
  borrarBase: (persona) => deleteDB(nombreDeLaBase(persona)),
  confirmarConexion: hayConexionConLaApi,
  pedirPersistencia: () => {
    // Le pide al navegador que no borre esto por falta de espacio. Es una
    // peticion: Safari, por ejemplo, la contesta como quiera. Si falla, no pasa
    // nada.
    void navigator.storage?.persist?.().catch(() => undefined);
  },
  crearCanalDeLaCola: () => {
    if (typeof BroadcastChannel === 'undefined') {
      return null;
    }

    const canal = new BroadcastChannel(NOMBRE_DEL_CANAL);

    return {
      publicar: (persona) => {
        canal.postMessage({ persona });
      },
      escuchar: (oyente) => {
        canal.addEventListener('message', (evento: MessageEvent<unknown>) => {
          const datos = evento.data as { persona?: unknown } | null;

          if (typeof datos?.persona === 'string') {
            oyente(datos.persona);
          }
        });
      },
      cerrar: () => {
        canal.close();
      },
    };
  },
};

let fabricas = FABRICAS_REALES;
let abierto: CicloAbierto | null = null;
let llaveroDelAbierto: Llavero | null = null;
/** Quien tiene la sesion ahora, para que el motor no envie con la de otra persona. */
let personaDeLaSesion: string | null = null;
let ocupado: Promise<void> = Promise.resolve();
const oyentes = new Set<() => void>();
const oyentesDeLaCola = new Set<() => void>();
let canalDeLaCola: CanalDeLaCola | null = null;

function avisar(): void {
  oyentes.forEach((oyente) => {
    oyente();
  });
}

/** Lo que hay abierto ahora, o `null` si no hay sesion o todavia no se abrio. */
export function cicloActual(): CicloAbierto | null {
  return abierto;
}

export function suscribirAlCiclo(oyente: () => void): () => void {
  oyentes.add(oyente);

  return () => {
    oyentes.delete(oyente);
  };
}

/**
 * Quien quiera enterarse de que la cola cambio —se agrego algo, se envio, se
 * descarto—, en esta pestana o en otra de la misma persona.
 */
export function suscribirALaCola(oyente: () => void): () => void {
  oyentesDeLaCola.add(oyente);

  // El canal se abre cuando alguien escucha por primera vez, no antes.
  if (canalDeLaCola === null) {
    canalDeLaCola = fabricas.crearCanalDeLaCola();
    canalDeLaCola?.escuchar((persona) => {
      // Lo de otra persona (otra sesion en este navegador) no es de esta pestana.
      if (persona === abierto?.persona) {
        avisarALosOyentesDeLaCola();
      }
    });
  }

  return () => {
    oyentesDeLaCola.delete(oyente);
  };
}

function avisarALosOyentesDeLaCola(): void {
  oyentesDeLaCola.forEach((oyente) => {
    oyente();
  });
}

/**
 * Avisa que la cola cambio: a quien escucha en esta pestana y a las otras
 * pestanas de la misma persona. Quien cambia la cola sin pasar por `encolar` (el
 * motor al enviar, una persona al descartar) lo llama al terminar.
 */
export function avisarQueLaColaCambio(): void {
  avisarALosOyentesDeLaCola();

  if (abierto !== null) {
    canalDeLaCola?.publicar(abierto.persona);
  }
}

export class SinAlmacenAbierto extends Error {
  constructor() {
    super('No hay un almacen abierto: hace falta una sesion.');
    this.name = 'SinAlmacenAbierto';
  }
}

/**
 * Guarda una operacion en la cola de la persona que tiene la sesion. **Es el unico
 * camino para agregar algo**: asi la cola y quien la mira nunca se desencuentran.
 *
 * Espera a que termine de abrirse el almacen si se esta abriendo. La operacion
 * queda guardada **antes** de volver, y el aviso de que la cola cambio (que es lo
 * que dispara el envio) va despues: nada se envia sin estar guardado.
 *
 * **El orden sobre una misma cosa se encadena solo** (SCRUM-139): si ya hay algo sin
 * terminar sobre la misma `entidad`, la nueva depende de la ultima. Escribir una
 * anotacion y corregirla sin conexion son dos operaciones que salen en ese orden, y la
 * correccion usa lo que respondio la creacion. Quien quiera otra cosa pasa `dependeDe`
 * (incluso `null`, para no depender de nada).
 *
 * @throws {SinAlmacenAbierto} Si no hay sesion.
 */
export async function encolar(datos: DatosDeOperacionNueva): Promise<Operacion> {
  await ocupado;

  if (abierto === null) {
    throw new SinAlmacenAbierto();
  }

  const dependeDe =
    datos.dependeDe === undefined
      ? (ultimaPendienteDe(await abierto.almacen.operaciones(), datos.entidad)?.operationId ?? null)
      : datos.dependeDe;
  const guardada = await abierto.almacen.agregarOperacion(
    nuevaOperacion({ ...datos, dependeDe }, new Date()),
  );

  avisarQueLaColaCambio();

  return guardada;
}

/**
 * Hace las cosas del ciclo de una en una. Abrir, cerrar y olvidar se pueden pedir
 * seguidas (la sesion cambia dos veces en un segundo) y no pueden pisarse.
 */
function enFila(tarea: () => Promise<void>): Promise<void> {
  const siguiente = ocupado.then(tarea);

  // Lo que sigue en la fila no se entera de si esta tarea fallo: la fila nunca se atasca.
  ocupado = siguiente.catch(() => undefined);

  return siguiente;
}

function cerrarLoAbierto(): void {
  if (abierto === null) {
    return;
  }

  abierto.almacen.cerrar();
  abierto = null;
  llaveroDelAbierto = null;
  avisar();
}

/**
 * Borra de este equipo lo de todas las personas menos la indicada. Si entra otra
 * persona, lo de la anterior no se queda para que la lea: es el caso de la sala de
 * computo. Lo que la anterior no alcanzo a enviar se pierde, y es el costo
 * deliberado de no dejar datos de salud de una persona a la vista de otra.
 */
async function olvidarLosAjenos(llavero: Llavero, persona: string): Promise<void> {
  for (const otra of await llavero.personas()) {
    if (otra !== persona) {
      await fabricas.borrarBase(otra);
      await llavero.olvidar(otra);
    }
  }
}

/**
 * Cambio en la sesion: entro una persona (`persona`) o ya no hay sesion (`null`).
 *
 * Con `null` el almacen **se cierra y se conserva**: ver arriba. Para olvidarlo de
 * verdad, `olvidarLosDatosDeLaSesionActual`.
 */
export function alCambiarLaSesion(
  persona: string | null,
  opciones: { readonly persistente: boolean },
): Promise<void> {
  // Se anota ya, sin esperar a la fila: el motor mira esto en cada envio.
  personaDeLaSesion = persona;

  return enFila(async () => {
    if (persona === null) {
      cerrarLoAbierto();

      return;
    }

    // Ya esta abierto para esta persona y de la misma manera: nada que hacer.
    if (
      abierto !== null &&
      abierto.persona === persona &&
      abierto.almacen.persistente === opciones.persistente
    ) {
      return;
    }

    cerrarLoAbierto();

    let almacen: AlmacenLocal | null = null;
    let llavero: Llavero | null = null;

    if (opciones.persistente && fabricas.hayIndexedDB()) {
      try {
        llavero = fabricas.crearLlavero();
        almacen = await fabricas.abrirEnIndexedDB(persona, llavero);
        await olvidarLosAjenos(llavero, persona);
        fabricas.pedirPersistencia();
      } catch (error) {
        // IndexedDB no esta disponible aunque exista (navegacion privada, datos
        // del sitio bloqueados). No es un error de la aplicacion: es un equipo
        // donde no se puede guardar, y se sigue en memoria. Si ya se habia llegado a
        // abrir, se cierra: no se deja una conexion abierta que nadie va a usar.
        console.warn('No se pudo abrir el almacen local; se usa solo la memoria.', error);
        almacen?.cerrar();
        almacen = null;
        llavero = null;
      }
    }

    almacen ??= fabricas.crearEnMemoria(persona);

    abierto = {
      persona,
      almacen,
      motor: crearMotor({
        almacen,
        personaDeLaSesion: () => personaDeLaSesion,
        confirmarConexion: fabricas.confirmarConexion,
      }),
    };
    llaveroDelAbierto = llavero;
    avisar();
  });
}

/**
 * La persona cerro sesion (o borro su cuenta): se olvida **todo** lo suyo en este
 * equipo, la base y la clave que la cifraba. Lo que cifro deja de poder leerse
 * aunque quedara algun rastro.
 *
 * Se usa la persona de la sesion y no la del almacen abierto: si cerro sesion antes
 * de que terminara de abrirse, tambien se borra.
 */
export function olvidarLosDatosDeLaSesionActual(): Promise<void> {
  const persona = personaDeLaSesion;

  return enFila(async () => {
    const llavero = llaveroDelAbierto;

    cerrarLoAbierto();

    if (persona === null) {
      return;
    }

    // Son dos cosas y cada una se intenta aunque la otra falle: si la base no se
    // deja borrar (otra pestana la tiene abierta), olvidar la clave igual deja lo
    // que contiene sin poder leerse. Ninguna debe impedir cerrar la sesion.
    try {
      await fabricas.borrarBase(persona);
    } catch (error) {
      console.warn('No se pudo borrar lo guardado en este equipo.', error);
    }

    try {
      await (llavero ?? (fabricas.hayIndexedDB() ? fabricas.crearLlavero() : null))?.olvidar(
        persona,
      );
    } catch (error) {
      console.warn('No se pudo olvidar la clave de este equipo.', error);
    }
  });
}

/** Solo para las pruebas: cambia las fabricas y deja todo como al abrir la aplicacion. */
export function reiniciarElCicloParaLasPruebas(nuevas: FabricasDelCiclo = FABRICAS_REALES): void {
  abierto?.almacen.cerrar();
  abierto = null;
  llaveroDelAbierto = null;
  personaDeLaSesion = null;
  ocupado = Promise.resolve();
  oyentes.clear();
  oyentesDeLaCola.clear();
  canalDeLaCola?.cerrar();
  canalDeLaCola = null;
  fabricas = nuevas;
}
