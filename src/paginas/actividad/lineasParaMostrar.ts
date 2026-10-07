import type { LineaDeAtencion } from '../../infraestructura/api/resultados.ts';
import { zonaActual } from '../../tiempo/zonaHoraria.ts';

/**
 * Que lineas de atencion se ensenan al terminar una actividad (SCRUM-94).
 *
 * Las lineas son datos del servidor, y lo normal es mostrar las que manda. Son
 * las del **pais de la persona**, que el servidor saca de la zona horaria de su
 * cuenta (SCRUM-124): aqui no se decide nada.
 *
 * El respaldo de abajo existe por una sola razon: cuando el servidor dice que
 * conviene acompanar, la pantalla **nunca** puede quedarse sin un telefono.
 *
 * Eso pasa si el servidor es anterior a SCRUM-94 y no manda `lineasDeAtencion`,
 * o si la tabla de recursos quedo vacia por error. Una lista vacia en ese
 * momento es exactamente lo que no puede pasar.
 *
 * ## El respaldo tambien depende del pais
 *
 * Un numero de otro pais, ensenado como si fuera de quien lo lee, es el peor
 * error posible. Por eso el respaldo con telefonos es **solo de Colombia** y solo
 * para quien esta en una zona de Colombia. Quien esta en cualquier otro lugar
 * recibe el directorio internacional y ningun numero: no se sabe cual seria el
 * suyo.
 *
 * Es una copia, y por eso es corta: si el texto cambia en la base, el que se ve
 * es el de la base. La de Bogota no se copia porque solo atiende alli.
 */
export const LINEAS_DE_RESPALDO_DE_COLOMBIA: readonly LineaDeAtencion[] = [
  {
    id: '0192c0de-0000-4000-8000-000000000192',
    titulo: 'Línea 192, opción 4',
    descripcion:
      'Orientación en salud mental del Ministerio de Salud. Funciona en todo el país: se marca 192 y se elige la opción 4. Atiende un equipo de profesionales.',
    tipo: 'contacto',
    cobertura: 'nacional',
  },
  {
    id: '0123c0de-0000-4000-8000-000000000123',
    titulo: 'Línea 123',
    descripcion:
      'Línea única de emergencias, en todo el país. Es la que hay que marcar si hay riesgo inmediato para la vida de alguien.',
    tipo: 'contacto',
    cobertura: 'nacional',
  },
];

/** La URL del directorio internacional de lineas de ayuda. */
export const DIRECTORIO_INTERNACIONAL = 'https://findahelpline.com/';

/**
 * Lo que recibe quien no esta en Colombia cuando el servidor no manda lineas:
 * el mismo directorio que manda el servidor, sin ningun telefono.
 */
export const DIRECTORIO_DE_RESPALDO: LineaDeAtencion = {
  id: '0ffec0de-0000-4000-8000-00000000f1de',
  titulo: 'Directorio internacional de líneas de ayuda',
  descripcion:
    'Todavía no tenemos verificadas las líneas del lugar donde estás, y preferimos no darte un número que podría no ser el tuyo. Este directorio, que recomienda la Asociación Internacional para la Prevención del Suicidio, reúne líneas gratuitas de muchos países, por teléfono, chat o mensaje. Si hay riesgo inmediato para la vida de alguien, llama al número de emergencias del lugar donde estás.',
  tipo: 'contacto',
  cobertura: 'internacional',
  enlace: DIRECTORIO_INTERNACIONAL,
};

/**
 * Las zonas de Colombia. Es una sola, y esta escrita a mano igual que en el
 * servidor: misma hora no es mismo pais, y Lima o Quito comparten la hora de
 * Bogota.
 */
const ZONAS_DE_COLOMBIA: readonly string[] = ['America/Bogota'];

/** Si la zona es una de Colombia. Una zona que no se conoce no lo es. */
export function esZonaDeColombia(zona: string): boolean {
  return ZONAS_DE_COLOMBIA.includes(zona.trim());
}

/** El respaldo que corresponde a una zona: lo de Colombia, o el directorio. */
export function lineasDeRespaldo(zona: string = zonaActual()): readonly LineaDeAtencion[] {
  return esZonaDeColombia(zona) ? LINEAS_DE_RESPALDO_DE_COLOMBIA : [DIRECTORIO_DE_RESPALDO];
}

/** Las del servidor, o el respaldo de la zona si no llego ninguna. */
export function lineasParaMostrar(
  delServidor: readonly LineaDeAtencion[] | undefined,
  zona: string = zonaActual(),
): readonly LineaDeAtencion[] {
  return delServidor !== undefined && delServidor.length > 0 ? delServidor : lineasDeRespaldo(zona);
}

const COBERTURAS: Readonly<Record<string, string>> = {
  nacional: 'Todo el país',
  bogota: 'Desde Bogotá',
  universidad: 'Universidad',
  internacional: 'Directorio internacional',
};

/**
 * La cobertura dicha para personas. Si es una que no se conoce, no se inventa
 * una etiqueta: la descripcion ya cuenta donde atiende.
 */
export function textoDeCobertura(cobertura: string | undefined): string | undefined {
  return cobertura === undefined ? undefined : COBERTURAS[cobertura];
}
