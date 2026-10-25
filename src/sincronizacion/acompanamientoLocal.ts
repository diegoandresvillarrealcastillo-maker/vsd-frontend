import {
  consultarElAcompanamiento,
  type Acompanamiento,
  type NivelDeAcompanamiento,
} from '../infraestructura/api/acompanamiento.ts';
import type { LineaDeAtencion } from '../infraestructura/api/resultados.ts';
import { leerConCopia, type LecturaConCopia } from './lecturas.ts';

/**
 * El acompanamiento con copia en este dispositivo (SCRUM-177).
 *
 * Sin conexion tambien se tiene que poder ver lo ultimo que se supo: quien esta pasando una semana
 * dificil no deja de estarlo porque se le fue la red, y las lineas de atencion son justo lo que
 * hace falta a mano. La copia vive en el almacen de la persona, cifrado, y se borra al cerrar sesion.
 *
 * **Lo que se guarda son solo los niveles y las lineas de su pais**: nunca un puntaje ni cuantos dias
 * van, porque el servidor no los manda.
 */
export const CLAVE_DEL_ACOMPANAMIENTO = 'acompanamiento';

const SIN_NADA: Acompanamiento = { nivel: 'ninguno', abandono: 'ninguno', lineasDeAtencion: [] };

const NIVELES: readonly string[] = ['ninguno', 'moderado', 'critico'];

function esObjeto(valor: unknown): valor is Readonly<Record<string, unknown>> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function esLinea(valor: unknown): valor is LineaDeAtencion {
  return (
    esObjeto(valor) &&
    typeof valor.id === 'string' &&
    valor.id !== '' &&
    typeof valor.titulo === 'string' &&
    valor.titulo !== '' &&
    typeof valor.tipo === 'string'
  );
}

/**
 * Lo guardado, o lo que mande un servidor mas nuevo, puede traer algo que esta version no entiende:
 * un nivel desconocido se lee como «ninguno» y nunca se inventa un aviso. Las lineas que no tienen
 * la forma esperada se dejan fuera; si no queda ninguna, la pantalla usa las de respaldo del pais.
 *
 * `abandono` (SCRUM-256) falta en lo que guardo una version anterior o un servidor anterior: sin el,
 * o con un valor que no se entiende, se lee como «ninguno».
 */
export function comoAcompanamiento(valor: unknown): Acompanamiento {
  if (!esObjeto(valor) || typeof valor.nivel !== 'string' || !NIVELES.includes(valor.nivel)) {
    return SIN_NADA;
  }

  return {
    nivel: valor.nivel as NivelDeAcompanamiento,
    abandono:
      typeof valor.abandono === 'string' && NIVELES.includes(valor.abandono)
        ? (valor.abandono as NivelDeAcompanamiento)
        : 'ninguno',
    lineasDeAtencion: Array.isArray(valor.lineasDeAtencion)
      ? (valor.lineasDeAtencion as unknown[]).filter(esLinea)
      : [],
  };
}

/**
 * Lo ultimo que se sabe del acompanamiento: del servidor si se puede, de la copia si no. Sin copia y
 * sin conexion falla, y quien llama no muestra nada.
 *
 * shortcut: con una copia y una red lenta, esta vista usa la copia y la renueva en segundo plano
 * (lo normal de `leerConCopia`): un nivel viejo puede verse una vez mas. Preguntar siempre es
 * `verificar: true`, pero entonces sin conexion no habria copia que mostrar.
 */
export async function leerElAcompanamiento(
  senal?: AbortSignal,
): Promise<LecturaConCopia<Acompanamiento>> {
  const lectura = await leerConCopia<Acompanamiento>(
    CLAVE_DEL_ACOMPANAMIENTO,
    async () => ({
      estado: 'nuevo',
      valor: await consultarElAcompanamiento(senal),
      etag: null,
    }),
    senal,
  );

  return { ...lectura, valor: comoAcompanamiento(lectura.valor) };
}
