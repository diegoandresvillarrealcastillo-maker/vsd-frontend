import { ErrorDeLaApi } from '../../infraestructura/api/clienteHttp.ts';
import { FotoRechazada } from '../../foto/prepararLaFoto.ts';

/**
 * Lo que se le dice a la persona cuando su foto no se pudo guardar o quitar
 * (SCRUM-120).
 *
 * Cada motivo tiene su frase, porque «no se pudo» no le sirve a nadie: lo que
 * hace falta es saber **que hacer**. Un archivo que no es una foto se cambia por
 * otro; uno que pesa de mas se cambia por otro; y un servidor que no responde se
 * reintenta. Lo que dice el servidor se decide por su **codigo**, nunca por su
 * texto, que puede reescribirse.
 *
 * Los mismos motivos pueden salir de dos sitios: del navegador, que mira el
 * archivo antes de mandarlo, y de la API, que lo mira otra vez. La persona no
 * tiene por que saber cual de los dos fue.
 */

const NO_ES_JPG_NI_PNG = 'Esa foto no sirve: elige un archivo .jpg o .png de tu galería.';
const NO_ES_UNA_IMAGEN = 'Ese archivo no es una imagen .jpg o .png válida. Prueba con otra foto.';
const PESA_DEMASIADO = 'La foto pesa demasiado: tiene que ser de menos de 50 KB.';

export function explicarLaFoto(error: unknown, accion: 'guardar' | 'quitar'): string {
  if (error instanceof FotoRechazada) {
    switch (error.motivo) {
      case 'tipo':
        return NO_ES_JPG_NI_PNG;
      case 'pesado':
        return 'Ese archivo pesa demasiado para abrirlo. Elige una foto de menos de 10 MB.';
      case 'ilegible':
        return 'No se pudo abrir esa imagen. Prueba con otra foto .jpg o .png.';
      case 'no-cabe':
        return 'No se pudo dejar esa foto en menos de 50 KB. Prueba con otra.';
    }
  }

  // Sin respuesta del servidor: no hay red, o la API no esta arrancada.
  if (!(error instanceof ErrorDeLaApi)) {
    return `No se pudo ${accion} la foto. Revisa tu conexión e inténtalo de nuevo.`;
  }

  switch (error.codigo) {
    case 'FOTO_TIPO_NO_PERMITIDO':
      return NO_ES_JPG_NI_PNG;
    case 'FOTO_NO_ES_UNA_IMAGEN':
      return NO_ES_UNA_IMAGEN;
    case 'FOTO_DEMASIADO_PESADA':
    case 'CUERPO_DEMASIADO_GRANDE':
      return PESA_DEMASIADO;
    case 'FOTO_DEMASIADO_GRANDE':
      return 'La foto es demasiado grande. Prueba con otra.';
    case 'ALMACENAMIENTO_NO_DISPONIBLE':
      return `No se pudo ${accion} tu foto ahora mismo. Inténtalo de nuevo en unos minutos.`;
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

  return `No se pudo ${accion} tu foto (error ${error.estado}). Inténtalo de nuevo en un momento.`;
}
