import { ErrorDeLaApi } from '../../infraestructura/api/clienteHttp.ts';
import { SvgRechazado } from '../../foto/comprobarElSvg.ts';

/**
 * Lo que se le dice a la persona cuando su mascota propia no se pudo guardar o
 * quitar (SCRUM-122).
 *
 * Cada motivo tiene su frase y dice **que hacer**, porque el motivo mas comun es
 * que un SVG de un programa de dibujo trae algo que no se admite (un texto, una
 * imagen, un filtro) y quien lo subio no tiene forma de saberlo. Lo que dice el
 * servidor se decide por su **codigo**, nunca por su texto, que puede
 * reescribirse. Ninguna frase repite lo que traia el archivo.
 */

const NO_ES_UN_SVG = 'Ese archivo no es un SVG. Elige uno que termine en .svg.';
const PESA_DEMASIADO =
  'El SVG pesa demasiado: tiene que ser de menos de 100 KB. Simplifica los trazos o quita lo que no se vea.';
const SIN_RESPUESTA = (accion: 'guardar' | 'quitar') =>
  `No se pudo ${accion} tu mascota. Revisa tu conexión e inténtalo de nuevo.`;

export function explicarLaMascotaPropia(error: unknown, accion: 'guardar' | 'quitar'): string {
  if (error instanceof SvgRechazado) {
    return error.motivo === 'tipo' ? NO_ES_UN_SVG : PESA_DEMASIADO;
  }

  // Sin respuesta del servidor: no hay red, o la API no esta arrancada.
  if (!(error instanceof ErrorDeLaApi)) {
    return SIN_RESPUESTA(accion);
  }

  switch (error.codigo) {
    case 'MASCOTA_SVG_TIPO_NO_PERMITIDO':
      return NO_ES_UN_SVG;
    case 'MASCOTA_SVG_DEMASIADO_PESADO':
    case 'CUERPO_DEMASIADO_GRANDE':
      return PESA_DEMASIADO;
    case 'MASCOTA_SVG_NO_ES_UN_SVG':
      return 'Ese archivo no es un SVG válido. Vuelve a exportarlo desde tu programa de dibujo.';
    case 'MASCOTA_SVG_PELIGROSO':
      return 'Ese SVG trae algo que no se puede aceptar por seguridad: scripts, enlaces a otros sitios o contenido que se ejecuta. Exporta de nuevo un SVG que lleve solo dibujo.';
    case 'MASCOTA_SVG_NO_ADMITIDO':
      return 'Ese SVG usa algo que todavía no se admite: textos, imágenes, filtros o estilos. Convierte los textos a trazos y quita lo demás; la guía te dice cómo.';
    case 'MASCOTA_SVG_DEMASIADO_COMPLEJO':
      return 'Ese SVG es demasiado complejo. Simplifica los trazos y junta las capas.';
    case 'ALMACENAMIENTO_NO_DISPONIBLE':
      return `No se pudo ${accion} tu mascota ahora mismo. Inténtalo de nuevo en unos minutos.`;
    case 'MASCOTA_INVALIDA':
      return 'No se pudo dejar tu mascota como la elegida. Elígela en «Tu mascota».';
    default:
      break;
  }

  if (error.estado === 401) {
    return 'Tu sesión caducó. Vuelve a entrar.';
  }

  if (error.estado === 429) {
    return 'Hiciste muchas peticiones seguidas. Espera un momento y vuelve a intentarlo.';
  }

  // Un 413 sin codigo conocido es de un proxy o de un lector de cuerpos mas
  // estrecho que el nuestro: el motivo es el mismo.
  if (error.estado === 413) {
    return PESA_DEMASIADO;
  }

  return `No se pudo ${accion} tu mascota (error ${error.estado}). Inténtalo de nuevo en un momento.`;
}
