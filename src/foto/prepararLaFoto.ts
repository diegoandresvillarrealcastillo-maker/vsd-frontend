/**
 * Deja la foto lista para guardar: cuadrada, de unos 256 px y de menos de 50 KB
 * (SCRUM-120). Todo ocurre en el navegador, sin librerias: el archivo original
 * nunca sale del dispositivo, solo sale lo que queda despues de recortarlo.
 *
 * Por que importa hacerlo aqui y no en el servidor:
 *
 * - **Privacidad**: lo que se sube es una foto pequena y recortada, no la
 *   original con su encuadre completo ni lo que lleve en los metadatos
 *   (ubicacion, camara). Al pasar por un lienzo, los metadatos no sobreviven.
 * - **Datos moviles**: una foto de camara pesa varios MB. Mandarla para que el
 *   servidor la reduzca seria gastar la red de la persona para tirarla.
 *
 * El servidor **no se fia de esto** y comprueba el resultado otra vez: la
 * validacion de aqui existe para dar un mensaje claro sin esperar a la red, no
 * para proteger nada.
 */

/** Lo que acepta la API: «menos de 50 KB». */
export const PESO_MAXIMO_DE_LA_FOTO = 50 * 1024;

/**
 * A lo que se apunta, un poco menos del maximo: el servidor mide los bytes
 * exactos, y no conviene quedar a un byte del rechazo.
 */
export const PESO_OBJETIVO_DE_LA_FOTO = 45 * 1024;

/**
 * Lo mas que pesa el archivo que se elige. No es el limite de la foto, que es
 * mucho menor: es para no intentar abrir un archivo que se come la memoria del
 * telefono. Una foto de camara pesa unos 2 a 8 MB.
 */
export const PESO_MAXIMO_DEL_ORIGINAL = 10 * 1024 * 1024;

/** Los lados que se prueban, de mayor a menor, hasta que la foto cabe. */
export const LADOS_DE_LA_FOTO: readonly number[] = [256, 192, 128];

/** Las calidades de JPEG que se prueban, de mayor a menor, en cada lado. */
export const CALIDADES_DE_LA_FOTO: readonly number[] = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4];

/** Por que una foto no se pudo preparar. Cada motivo lleva su mensaje en la pantalla. */
export type MotivoDeFotoRechazada = 'tipo' | 'pesado' | 'ilegible' | 'no-cabe';

export class FotoRechazada extends Error {
  readonly motivo: MotivoDeFotoRechazada;

  constructor(motivo: MotivoDeFotoRechazada) {
    super(`La foto no se pudo preparar: ${motivo}.`);
    this.name = 'FotoRechazada';
    this.motivo = motivo;
  }
}

/**
 * Si el archivo es un `.jpg` o un `.png`.
 *
 * Se mira el tipo que declara el navegador. Algunos sistemas no lo informan
 * (llega vacio o como `application/octet-stream`), y entonces se mira la
 * extension. No es una defensa —cualquiera puede renombrar un archivo, y por
 * eso el servidor mira el contenido—: es para decirle a quien se equivoco de
 * archivo que se equivoco.
 */
export function esUnaFotoPermitida(archivo: Pick<File, 'name' | 'type'>): boolean {
  const tipo = archivo.type.trim().toLowerCase();

  if (tipo === 'image/jpeg' || tipo === 'image/png') {
    return true;
  }

  if (tipo === '' || tipo === 'application/octet-stream') {
    return /\.(jpe?g|png)$/i.test(archivo.name);
  }

  return false;
}

/** El cuadrado de en medio de la imagen: lo que queda al recortarla. */
export interface CajaDelRecorte {
  readonly x: number;
  readonly y: number;
  readonly lado: number;
}

/** El cuadrado mas grande que cabe en una imagen, centrado. */
export function cajaDelRecorte(ancho: number, alto: number): CajaDelRecorte {
  const lado = Math.min(ancho, alto);

  return {
    x: Math.floor((ancho - lado) / 2),
    y: Math.floor((alto - lado) / 2),
    lado,
  };
}

/**
 * Busca la primera combinacion de lado y calidad cuyo resultado cabe.
 *
 * Primero baja la calidad, que casi no se nota en una foto tan pequena, y solo
 * si no alcanza achica el lado. Lo que devuelve es **lo que ya se codifico**,
 * no se vuelve a codificar.
 *
 * @param codificar Dibuja la foto con ese lado y la codifica con esa calidad.
 *   Devuelve `null` si el navegador no pudo.
 * @param ladoInicial El mayor lado que se prueba; una imagen que ya es mas
 *   chica que 256 px no se agranda.
 */
export async function comprimirHastaQueCaiga(
  codificar: (lado: number, calidad: number) => Promise<Blob | null>,
  ladoInicial: number,
): Promise<Blob> {
  const lados = [ladoInicial, ...LADOS_DE_LA_FOTO.filter((lado) => lado < ladoInicial)];

  for (const lado of lados) {
    for (const calidad of CALIDADES_DE_LA_FOTO) {
      const resultado = await codificar(lado, calidad);

      if (resultado === null) {
        throw new FotoRechazada('ilegible');
      }

      if (resultado.size <= PESO_OBJETIVO_DE_LA_FOTO) {
        return resultado;
      }
    }
  }

  throw new FotoRechazada('no-cabe');
}

/** Una imagen ya abierta, con lo necesario para dibujarla y para soltarla. */
interface ImagenAbierta {
  readonly imagen: CanvasImageSource;
  readonly ancho: number;
  readonly alto: number;
  readonly soltar: () => void;
}

/**
 * Abre el archivo como imagen.
 *
 * `createImageBitmap` es lo normal y respeta la orientacion que dejo la camara.
 * Si el navegador no lo tiene, o no sabe abrir ese archivo, se prueba con un
 * `<img>`, que abre lo mismo por otro camino.
 */
async function abrir(archivo: Blob): Promise<ImagenAbierta> {
  if (typeof createImageBitmap === 'function') {
    try {
      const mapa = await createImageBitmap(archivo, { imageOrientation: 'from-image' });

      return {
        imagen: mapa,
        ancho: mapa.width,
        alto: mapa.height,
        soltar: () => {
          mapa.close();
        },
      };
    } catch {
      // Se sigue con el otro camino.
    }
  }

  const direccion = URL.createObjectURL(archivo);

  try {
    const imagen = new Image();

    imagen.src = direccion;
    await imagen.decode();

    return {
      imagen,
      ancho: imagen.naturalWidth,
      alto: imagen.naturalHeight,
      soltar: () => {
        URL.revokeObjectURL(direccion);
      },
    };
  } catch {
    URL.revokeObjectURL(direccion);

    throw new FotoRechazada('ilegible');
  }
}

function aBlob(lienzo: HTMLCanvasElement, calidad: number): Promise<Blob | null> {
  return new Promise((resolver) => {
    lienzo.toBlob(resolver, 'image/jpeg', calidad);
  });
}

/**
 * Recorta la foto en cuadrado, la reduce y la comprime. Devuelve un JPEG.
 *
 * Siempre sale JPEG, aunque entre un PNG: es lo que mejor comprime una foto, y
 * lo que hace falta para quedar por debajo de 50 KB.
 *
 * @throws {FotoRechazada} Con el motivo: no es `.jpg` ni `.png` (`tipo`), pesa
 *   demasiado para abrirla (`pesado`), no se pudo abrir (`ilegible`), o no hubo
 *   forma de dejarla en menos de 50 KB (`no-cabe`).
 */
export async function prepararLaFoto(archivo: File): Promise<Blob> {
  if (!esUnaFotoPermitida(archivo)) {
    throw new FotoRechazada('tipo');
  }

  if (archivo.size > PESO_MAXIMO_DEL_ORIGINAL) {
    throw new FotoRechazada('pesado');
  }

  const abierta = await abrir(archivo);

  try {
    if (abierta.ancho < 1 || abierta.alto < 1) {
      throw new FotoRechazada('ilegible');
    }

    const caja = cajaDelRecorte(abierta.ancho, abierta.alto);
    const lienzo = document.createElement('canvas');

    return await comprimirHastaQueCaiga(
      async (lado, calidad) => {
        lienzo.width = lado;
        lienzo.height = lado;

        const contexto = lienzo.getContext('2d');

        if (contexto === null) {
          throw new FotoRechazada('ilegible');
        }

        // Un JPEG no tiene transparencia: lo transparente de un PNG se veria
        // negro. Se pinta antes un fondo blanco.
        contexto.fillStyle = '#ffffff';
        contexto.fillRect(0, 0, lado, lado);
        contexto.imageSmoothingQuality = 'high';
        contexto.drawImage(abierta.imagen, caja.x, caja.y, caja.lado, caja.lado, 0, 0, lado, lado);

        return aBlob(lienzo, calidad);
      },
      Math.min(caja.lado, LADOS_DE_LA_FOTO[0] ?? 256),
    );
  } finally {
    abierta.soltar();
  }
}
