import type { SesionDeLaActividad } from '../infraestructura/api/progreso.ts';
import {
  buscarSesionPublicada,
  consultarSesionesHechas,
  type SesionPublicada,
} from '../infraestructura/api/sesionesPublicadas.ts';
import { leerSiCambio } from '../infraestructura/api/clienteHttp.ts';
import type { Modulo } from '../infraestructura/api/cuenta.ts';
import { leerLosResultadosDeLaCola } from './panelLocal.ts';
import { leerConCopia, leerSoloLaCopia, type LecturaConCopia } from './lecturas.ts';

const MODULOS: readonly Modulo[] = ['cognicion', 'bienestar', 'emociones'];

export const claveDelSendero = (modulo: Modulo): string => `sendero:sesiones:${modulo}`;

const claveDeSesionesHechas = (modulo: Modulo): string => `sendero:hechas:${modulo}`;

function esObjeto(valor: unknown): valor is Readonly<Record<string, unknown>> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/** Catálogo público de sesiones, cifrado en la copia de la cuenta para uso sin conexión. */
export function traerSesionesPublicadasConCopia(
  modulo: Modulo,
  senal?: AbortSignal,
): Promise<LecturaConCopia<readonly SesionPublicada[]>> {
  return leerConCopia<readonly SesionPublicada[]>(
    claveDelSendero(modulo),
    (etag) =>
      leerSiCambio(`/api/catalogo/sesiones/${modulo}`, {
        etag,
        ...(senal ? { senal } : {}),
      }),
    senal,
  );
}

function idSesionDeLaOperacion(payload: unknown): string | null {
  if (!esObjeto(payload) || typeof payload.idSesion !== 'string') return null;
  return payload.idSesion;
}

/**
 * Estado de finalización de esta cuenta: copia cifrada más resultados locales aún por enviar.
 * Los IDs se limitan a las sesiones publicadas en el módulo para que un dato antiguo o de otro
 * módulo no encienda un nodo.
 */
export async function consultarSesionesHechasConCopia(
  modulo: Modulo,
  sesionesPublicadas: readonly SesionPublicada[],
  senal?: AbortSignal,
): Promise<readonly string[]> {
  let hechasDelServidor: readonly string[] = [];

  try {
    hechasDelServidor = (
      await leerConCopia<readonly string[]>(
        claveDeSesionesHechas(modulo),
        async () => ({
          estado: 'nuevo',
          valor: await consultarSesionesHechas(modulo, senal),
          etag: null,
        }),
        senal,
      )
    ).valor;
  } catch (error) {
    // Una primera visita offline sigue mostrando el árbol. Sin respuesta ni copia no se inventan
    // completadas; los resultados guardados localmente sí se agregan abajo.
    if (senal?.aborted) throw error;
  }

  const idsPublicados = new Set(sesionesPublicadas.map((sesion) => sesion.id));
  const hechasLocales = (await leerLosResultadosDeLaCola())
    .map((operacion) => idSesionDeLaOperacion(operacion.payload))
    .filter((id): id is string => id !== null && idsPublicados.has(id));

  return [...new Set([...hechasDelServidor, ...hechasLocales])].filter((id) =>
    idsPublicados.has(id),
  );
}

/** Carga el detalle de la lista offline precargada; conserva un respaldo por ID para árboles antiguos. */
export async function buscarSesionPublicadaConCopia(
  id: string,
  senal?: AbortSignal,
): Promise<(SesionDeLaActividad & { readonly idActividad: string }) | null> {
  for (const modulo of MODULOS) {
    const catalogo = await leerSoloLaCopia<readonly SesionPublicada[]>(claveDelSendero(modulo));
    const encontrada = catalogo?.find((sesion) => sesion.id === id);

    if (encontrada?.parametros !== undefined) {
      return {
        id: encontrada.id,
        idActividad: encontrada.idActividad,
        titulo: encontrada.titulo,
        nivel: encontrada.nivel,
        parametros: encontrada.parametros,
      };
    }
  }

  return (
    await leerConCopia<(SesionDeLaActividad & { readonly idActividad: string }) | null>(
      `sendero:sesion:${id}`,
      async () => ({
        estado: 'nuevo',
        valor: await buscarSesionPublicada(id, senal),
        etag: null,
      }),
      senal,
    )
  ).valor;
}

/** Deja los tres árboles, su contenido y el avance actual listos para la próxima desconexión. */
export async function precargarLosSenderos(): Promise<void> {
  await Promise.allSettled(
    MODULOS.map(async (modulo) => {
      const { valor: sesiones } = await traerSesionesPublicadasConCopia(modulo);
      await consultarSesionesHechasConCopia(modulo, sesiones);
    }),
  );
}
