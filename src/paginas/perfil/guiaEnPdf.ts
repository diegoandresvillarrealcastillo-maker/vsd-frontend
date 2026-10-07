import { DocumentoPdf, type Color, type Tramo } from '../../pdf/documentoPdf.ts';
import {
  LISTA_DE_COMPROBACION,
  NOTA_DE_LA_GUIA,
  PASOS_DE_LA_GUIA,
  TITULO_DE_LA_GUIA,
  type Texto,
} from './contenidoDeLaGuia.ts';

/**
 * La guia de la mascota propia (SCRUM-122) como PDF: la misma que la de la
 * pantalla, para tenerla a un lado mientras se dibuja.
 *
 * El archivo que se descarga, `public/guia-de-la-mascota-propia.pdf`, sale de
 * aqui con `npm run guia-de-la-mascota`. Una prueba compara el archivo
 * versionado con lo que esta funcion genera hoy, asi que no puede quedarse atras
 * de `contenidoDeLaGuia.ts`.
 */

export const TITULO_DEL_PDF = 'Cómo preparar el dibujo de tu mascota';

const INTRODUCCION =
  'Tu mascota propia es un dibujo tuyo, en formato SVG, que te acompaña por VSD Health. ' +
  'Esta guía te dice cómo prepararlo para que se acepte a la primera.';

const CIERRE = 'Esta guía también está en tu perfil, en «Tu propia mascota».';

const VERDE: Color = [0.2, 0.38, 0.28];
const GRIS: Color = [0.4, 0.4, 0.4];
const FONDO_DE_LA_NOTA: Color = [0.93, 0.96, 0.94];

/** Un texto con sus resaltados y sus teclas, como tramos del PDF. */
function tramosDe(texto: Texto): Tramo[] {
  return texto.map((trozo): Tramo => {
    if (typeof trozo === 'string') {
      return { texto: trozo };
    }

    return 'negrita' in trozo
      ? { texto: trozo.negrita, fuente: 'negrita' }
      : { texto: trozo.tecla, fuente: 'negrita' };
  });
}

/** @returns El PDF completo, como texto ASCII: se guarda tal cual en un archivo. */
export function generarLaGuiaEnPdf(): string {
  const documento = new DocumentoPdf({
    titulo: TITULO_DEL_PDF,
    asunto: TITULO_DE_LA_GUIA,
    idioma: 'es-CO',
    pie: (pagina, total) => ({
      izquierda: 'VSD Health · Guía de la mascota propia',
      derecha: `Página ${pagina} de ${total}`,
    }),
  });

  documento.texto([{ texto: TITULO_DEL_PDF }], {
    tamano: 22,
    interlineado: 1.2,
    fuente: 'negrita',
    color: VERDE,
    despues: 4,
  });
  documento.texto([{ texto: 'VSD Health · Mascota propia' }], {
    tamano: 11,
    color: GRIS,
    despues: 10,
  });
  documento.regla();
  documento.espacio(14);
  documento.texto([{ texto: INTRODUCCION }], { tamano: 11.5, despues: 16 });

  for (const [indice, paso] of PASOS_DE_LA_GUIA.entries()) {
    const principal: Tramo[] = [
      { texto: paso.titulo, fuente: 'negrita' },
      ...(paso.texto === undefined ? [] : [{ texto: ' ' }, ...tramosDe(paso.texto)]),
    ];
    const estiloDelPrincipal = { sangria: 24, despues: paso.puntos === undefined ? 12 : 3 };
    const estiloDeUnPunto = { sangria: 42, despues: 3 };

    // Un paso no se parte entre dos paginas: se pasa entero a la siguiente.
    documento.reservar(
      documento.medir(principal, estiloDelPrincipal) +
        (paso.puntos ?? []).reduce(
          (suma, punto) => suma + documento.medir(tramosDe(punto), estiloDeUnPunto),
          0,
        ) +
        9,
    );

    documento.texto(principal, estiloDelPrincipal, `${indice + 1}.`);

    for (const punto of paso.puntos ?? []) {
      documento.texto(tramosDe(punto), estiloDeUnPunto, '•');
    }

    if (paso.puntos !== undefined) {
      documento.espacio(9);
    }
  }

  documento.espacio(4);
  documento.caja([{ texto: NOTA_DE_LA_GUIA }], { fondo: FONDO_DE_LA_NOTA, despues: 20 });

  documento.reservar(
    documento.medir([{ texto: 'Antes de subirlo' }], { tamano: 14, despues: 8 }) +
      LISTA_DE_COMPROBACION.length * 22,
  );
  documento.texto([{ texto: 'Antes de subirlo' }], {
    tamano: 14,
    fuente: 'negrita',
    color: VERDE,
    despues: 8,
  });

  for (const elemento of LISTA_DE_COMPROBACION) {
    documento.texto([{ texto: elemento }], { sangria: 24, despues: 4 }, { casilla: true });
  }

  documento.espacio(14);
  documento.texto([{ texto: CIERRE }], { color: GRIS });

  return documento.generar();
}
