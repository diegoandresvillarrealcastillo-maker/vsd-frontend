/**
 * Lo que se comprueba de un SVG antes de mandarlo (SCRUM-122).
 *
 * Es poco, a proposito. **El navegador no lee el SVG ni lo "limpia":** quien
 * decide que se acepta es el servidor, que lo reescribe desde una lista blanca.
 * Duplicar esas reglas aqui seria tener dos lugares que decidan lo mismo y, el
 * dia que no coincidan, una persona a la que este lado le dice que si y el otro
 * que no. Lo unico que se mira antes es lo que ahorra una subida inutil y deja
 * un mensaje claro sin esperar a la red: que sea un `.svg` y que no pese de mas.
 */

/** 100 KB, como el servidor. Un dibujo de trazos limpio pesa mucho menos. */
export const PESO_MAXIMO_DEL_SVG = 100 * 1024;

export type MotivoDeSvgRechazado = 'tipo' | 'peso';

export class SvgRechazado extends Error {
  readonly motivo: MotivoDeSvgRechazado;

  constructor(motivo: MotivoDeSvgRechazado) {
    super(`El SVG no se puede subir: ${motivo}.`);
    this.name = 'SvgRechazado';
    this.motivo = motivo;
  }
}

/**
 * Si el archivo es un `.svg`.
 *
 * Se mira el tipo que declara el navegador, sin sus parametros
 * (`image/svg+xml;charset=utf-8` es un SVG). Algunos sistemas no lo informan
 * (llega vacio o como `application/octet-stream`), y entonces se mira la
 * extension. No es una defensa —cualquiera puede renombrar un archivo, y por eso
 * el servidor mira el contenido—: es para decirle a quien se equivoco de archivo
 * que se equivoco.
 */
export function esUnSvg(archivo: Pick<File, 'name' | 'type'>): boolean {
  const tipo = (archivo.type.split(';')[0] ?? '').trim().toLowerCase();

  if (tipo === 'image/svg+xml') {
    return true;
  }

  if (tipo === '' || tipo === 'application/octet-stream' || tipo === 'text/xml') {
    return /\.svg$/i.test(archivo.name);
  }

  return false;
}

/** @throws {SvgRechazado} Si no es un `.svg` (`tipo`) o pesa de mas (`peso`). */
export function comprobarElSvg(archivo: Pick<File, 'name' | 'type' | 'size'>): void {
  if (!esUnSvg(archivo)) {
    throw new SvgRechazado('tipo');
  }

  if (archivo.size > PESO_MAXIMO_DEL_SVG) {
    throw new SvgRechazado('peso');
  }
}
