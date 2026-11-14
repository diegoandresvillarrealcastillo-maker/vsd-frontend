import { PESO_MAXIMO_DEL_SVG } from '../../foto/comprobarElSvg.ts';

/**
 * El contenido de la guia para preparar el dibujo de la mascota propia
 * (SCRUM-122), como datos.
 *
 * Lo leen dos: la guia de la pantalla (`GuiaDeLaMascotaPropia.tsx`) y el PDF que
 * se descarga (`guiaEnPdf.ts`). Es una sola fuente a proposito: un PDF fijo que
 * dijera otra cosa que la pantalla seria una guia que miente, y nadie lo
 * notaria hasta que alguien siguiera el paso equivocado.
 *
 * Lo que dice de lo que se admite y de lo que no es lo que hace el servidor
 * (`SvgDeMascota` del backend): si uno cambia, este texto cambia con el.
 */

/** Un pedazo de texto: normal, resaltado o una tecla del teclado. */
export type Trozo = string | { readonly negrita: string } | { readonly tecla: string };

export type Texto = readonly Trozo[];

export interface PasoDeLaGuia {
  /** Lo que hay que hacer, en una frase, resaltado. */
  readonly titulo: string;
  /** Lo que sigue al titulo, en el mismo parrafo. */
  readonly texto?: Texto;
  /** Una lista bajo el paso. */
  readonly puntos?: readonly Texto[];
}

export const TITULO_DE_LA_GUIA = 'Cómo preparar mi dibujo';

const PESO_EN_KB = PESO_MAXIMO_DEL_SVG / 1024;

export const PASOS_DE_LA_GUIA: readonly PasoDeLaGuia[] = [
  {
    titulo: 'Dibuja en un programa de dibujo vectorial.',
    texto: [
      'Sirven Figma, Inkscape (gratuito) o Illustrator. Una foto o un archivo PNG o JPG no sirve: tiene que ser un dibujo hecho de formas.',
    ],
  },
  {
    titulo: 'Usa un lienzo cuadrado.',
    texto: [
      'Por ejemplo, de 512 × 512 píxeles. Así tu mascota se ve del tamaño completo y no con márgenes.',
    ],
  },
  {
    titulo: 'Dibuja solo con formas y colores.',
    puntos: [
      [
        'Se admiten: círculos, óvalos, rectángulos, líneas, polígonos y trazos libres; grupos; colores lisos y degradados; transparencias; y recortes.',
      ],
      [
        'No se admiten: textos, imágenes metidas dentro del dibujo, filtros y sombras difuminadas, patrones, animaciones ni hojas de estilo.',
      ],
      [
        'Un SVG con scripts o con enlaces a otros sitios se rechaza por seguridad, aunque el dibujo se vea bien.',
      ],
    ],
  },
  {
    titulo: 'Convierte los textos en formas.',
    texto: [
      'Si le pusiste letras a tu dibujo, conviértelas antes de exportar. En Mac, usa ',
      { tecla: 'Cmd' },
      ' en lugar de ',
      { tecla: 'Ctrl' },
      '.',
    ],
    puntos: [
      [
        'Figma: selecciona el texto y elige «Aplanar» (',
        { tecla: 'Ctrl' },
        ' + ',
        { tecla: 'E' },
        ').',
      ],
      [
        'Inkscape: selecciona el texto y elige «Camino › Objeto a camino» (',
        { tecla: 'Mayús' },
        ' + ',
        { tecla: 'Ctrl' },
        ' + ',
        { tecla: 'C' },
        ').',
      ],
      [
        'Illustrator: selecciona el texto y elige «Texto › Crear contornos» (',
        { tecla: 'Mayús' },
        ' + ',
        { tecla: 'Ctrl' },
        ' + ',
        { tecla: 'O' },
        ').',
      ],
    ],
  },
  {
    titulo: 'Exporta como SVG.',
    puntos: [
      ['Figma: selecciona el cuadro, en «Export» elige SVG y exporta.'],
      ['Inkscape: «Archivo › Guardar como…» y elige «SVG simple» (también se llama «Plain SVG»).'],
      [
        'Illustrator: «Archivo › Guardar como…» y elige SVG. En las opciones, en «Estilo», elige «Atributos de presentación» o «Estilo en línea», y no «CSS interno».',
      ],
    ],
  },
  {
    titulo: `Comprueba que pese menos de ${PESO_EN_KB} KB.`,
    texto: [
      'Un dibujo sencillo pesa unos pocos KB. Si pesa más, junta capas y quita los trazos que no se vean.',
    ],
  },
  {
    titulo: 'Súbelo con «Subir mi dibujo».',
    texto: ['Si algo no se admite, el mensaje te dice qué cambiar.'],
  },
];

/** Lo que se aclara al final: lo que se ve no es el archivo tal cual. */
export const NOTA_DE_LA_GUIA =
  'Lo que ves en tu pantalla no es tu archivo tal cual: antes de guardarlo lo reescribimos solo con formas y colores, y esa es la versión que se muestra.';

/** Para repasar antes de subir. Va en el PDF, donde se puede tener a un lado. */
export const LISTA_DE_COMPROBACION: readonly string[] = [
  'El lienzo es cuadrado.',
  'Solo hay formas y colores: nada de imágenes, filtros ni hojas de estilo.',
  'Los textos están convertidos en formas.',
  'Lo exporté como SVG.',
  `Pesa menos de ${PESO_EN_KB} KB.`,
];

/** El texto de un trozo, sin el formato: lo que leeria alguien en voz alta. */
export function textoDe(texto: Texto): string {
  return texto
    .map((trozo) =>
      typeof trozo === 'string' ? trozo : 'negrita' in trozo ? trozo.negrita : trozo.tecla,
    )
    .join('');
}
