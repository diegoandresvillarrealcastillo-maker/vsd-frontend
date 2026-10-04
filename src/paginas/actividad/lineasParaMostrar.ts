import type { LineaDeAtencion } from '../../infraestructura/api/resultados.ts';

/**
 * Que lineas de atencion se ensenan al terminar una actividad (SCRUM-94).
 *
 * Las lineas son datos del servidor, y lo normal es mostrar las que manda. El
 * respaldo de abajo existe por una sola razon: cuando el servidor dice que
 * conviene acompanar, la pantalla **nunca** puede quedarse sin un telefono.
 *
 * Eso pasa si el servidor es anterior a SCRUM-94 y no manda `lineasDeAtencion`,
 * o si la tabla de recursos quedo vacia por error. Una lista vacia en ese
 * momento es exactamente lo que no puede pasar, asi que aqui hay una copia de
 * las dos nacionales.
 *
 * Es una copia, y por eso es corta: si el texto cambia en la base, el que se ve
 * es el de la base. La de Bogota no se copia porque solo atiende alli.
 */
export const LINEAS_DE_RESPALDO: readonly LineaDeAtencion[] = [
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

/** Las del servidor, o el respaldo si no llego ninguna. */
export function lineasParaMostrar(
  delServidor: readonly LineaDeAtencion[] | undefined,
): readonly LineaDeAtencion[] {
  return delServidor !== undefined && delServidor.length > 0 ? delServidor : LINEAS_DE_RESPALDO;
}

const COBERTURAS: Readonly<Record<string, string>> = {
  nacional: 'Todo el país',
  bogota: 'Desde Bogotá',
  universidad: 'Universidad',
};

/**
 * La cobertura dicha para personas. Si es una que no se conoce, no se inventa
 * una etiqueta: la descripcion ya cuenta donde atiende.
 */
export function textoDeCobertura(cobertura: string | undefined): string | undefined {
  return cobertura === undefined ? undefined : COBERTURAS[cobertura];
}
