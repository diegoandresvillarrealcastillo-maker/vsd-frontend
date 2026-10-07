/**
 * Un escritor de PDF minimo, sin dependencias (SCRUM-122).
 *
 * Existe para una sola cosa: generar la guia de la mascota propia que se
 * descarga desde el perfil, a partir del mismo contenido que la pantalla. No es
 * un motor de maquetacion: pone texto con Helvetica, lo parte en lineas, lo
 * reparte en paginas A4 y dibuja unas lineas y recuadros. Nada mas.
 *
 * Decisiones:
 *
 * - **Solo ASCII.** Los textos se escriben con escapes octales y los flujos no
 *   se comprimen. El archivo pesa unos 20 KB, y a cambio es **texto puro**: se
 *   puede revisar con un diff, y el resultado es **identico byte a byte** en
 *   cada ejecucion (no lleva fechas), que es lo que permite una prueba que
 *   compare el archivo versionado con lo que se generaria hoy.
 * - **Fuentes estandar** (Helvetica y Helvetica-Bold): todo lector de PDF las
 *   trae, asi que no hay que incrustar nada. A cambio solo se pueden escribir
 *   los caracteres de WinAnsi; uno que no este es un error, no un hueco.
 * - **Los anchos son los de las tablas oficiales de Helvetica** (AFM), para
 *   partir las lineas sin medir con un navegador.
 */

export type Fuente = 'normal' | 'negrita';

export interface Tramo {
  readonly texto: string;
  readonly fuente?: Fuente;
}

export interface EstiloDeTexto {
  readonly tamano?: number;
  /** El alto de cada linea, como multiplo del tamano. */
  readonly interlineado?: number;
  /** Cuanto se mete el texto desde el margen izquierdo, en puntos. */
  readonly sangria?: number;
  /** El espacio que queda debajo, en puntos. */
  readonly despues?: number;
  /** Gris de 0 (negro) a 1 (blanco), o un color RGB de 0 a 1. */
  readonly color?: Color;
  /** La fuente de los tramos que no dicen la suya. */
  readonly fuente?: Fuente;
  /** El ancho en que se parte el texto, si no es el que queda desde la sangria. */
  readonly anchoMaximo?: number;
}

/** Lo que va a la izquierda de la primera linea: un numero, una vineta o una casilla. */
export type Marcador = string | { readonly casilla: true };

export type Color = readonly [number, number, number];

export interface OpcionesDelDocumento {
  readonly titulo: string;
  readonly asunto?: string;
  readonly idioma: string;
  /** El pie de cada pagina, dados su numero y el total. */
  readonly pie: (pagina: number, total: number) => { izquierda: string; derecha: string };
}

// ---------------------------------------------------------------------------
// Medidas
// ---------------------------------------------------------------------------

const ANCHO_DE_LA_PAGINA = 595.28;
const ALTO_DE_LA_PAGINA = 841.89;
const MARGEN_LATERAL = 56;
const MARGEN_SUPERIOR = 60;
const MARGEN_INFERIOR = 64;

export const ANCHO_UTIL = ANCHO_DE_LA_PAGINA - 2 * MARGEN_LATERAL;

const NEGRO: Color = [0.1, 0.1, 0.1];

/** Lo que cuelga a la izquierda del texto para el numero, la viñeta o la casilla. */
const ANCHO_DEL_MARCADOR = 18;

// ---------------------------------------------------------------------------
// Anchos de Helvetica y Helvetica-Bold, en milesimas de tamano, para los
// caracteres ASCII imprimibles (32 a 126) en orden.
// ---------------------------------------------------------------------------

const ANCHOS_NORMAL = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
  611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
  222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

const ANCHOS_NEGRITA = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667,
  611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556,
  278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

/** Los caracteres que no son ASCII y que se pueden escribir: su byte en WinAnsi y su ancho. */
const EXTRAS: Readonly<Record<string, { byte: number; normal: number; negrita: number }>> = {
  '¡': { byte: 0xa1, normal: 333, negrita: 333 },
  '¿': { byte: 0xbf, normal: 611, negrita: 611 },
  '«': { byte: 0xab, normal: 556, negrita: 556 },
  '»': { byte: 0xbb, normal: 556, negrita: 556 },
  '×': { byte: 0xd7, normal: 584, negrita: 584 },
  '·': { byte: 0xb7, normal: 278, negrita: 278 },
  '°': { byte: 0xb0, normal: 400, negrita: 400 },
  '–': { byte: 0x96, normal: 556, negrita: 556 },
  '—': { byte: 0x97, normal: 1000, negrita: 1000 },
  '‘': { byte: 0x91, normal: 222, negrita: 278 },
  '’': { byte: 0x92, normal: 222, negrita: 278 },
  '“': { byte: 0x93, normal: 333, negrita: 500 },
  '”': { byte: 0x94, normal: 333, negrita: 500 },
  '•': { byte: 0x95, normal: 350, negrita: 350 },
  '…': { byte: 0x85, normal: 1000, negrita: 1000 },
  '›': { byte: 0x9b, normal: 333, negrita: 333 },
  '‹': { byte: 0x8b, normal: 333, negrita: 333 },
};

/** Las letras con tilde o con dieresis miden lo mismo que su letra sin ella. */
const LETRAS_ACENTUADAS = /^[A-Za-z]$/;

interface Glifo {
  readonly byte: number;
  readonly ancho: number;
}

function glifoDe(caracter: string, fuente: Fuente): Glifo {
  const codigo = caracter.codePointAt(0) ?? 0;

  if (codigo >= 32 && codigo <= 126) {
    const tabla = fuente === 'negrita' ? ANCHOS_NEGRITA : ANCHOS_NORMAL;

    return { byte: codigo, ancho: tabla[codigo - 32] ?? 0 };
  }

  const extra = EXTRAS[caracter];

  if (extra !== undefined) {
    return { byte: extra.byte, ancho: fuente === 'negrita' ? extra.negrita : extra.normal };
  }

  // Latin-1: á é í ó ú ü ñ y sus mayusculas ocupan el mismo byte en WinAnsi.
  const base = caracter.normalize('NFD').charAt(0);

  if (codigo >= 0xc0 && codigo <= 0xff && LETRAS_ACENTUADAS.test(base) && codigo !== 0xd7) {
    return { byte: codigo, ancho: glifoDe(base, fuente).ancho };
  }

  throw new Error(`El PDF no puede escribir el caracter «${caracter}» (U+${codigo.toString(16)}).`);
}

function anchoDe(texto: string, fuente: Fuente, tamano: number): number {
  let milesimas = 0;

  for (const caracter of texto) {
    milesimas += glifoDe(caracter, fuente).ancho;
  }

  return (milesimas * tamano) / 1000;
}

/** Un texto como cadena literal de PDF: solo ASCII, con todo lo demas en octal. */
function cadenaDePdf(texto: string, fuente: Fuente = 'normal'): string {
  let salida = '';

  for (const caracter of texto) {
    const { byte } = glifoDe(caracter, fuente);

    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) {
      salida += `\\${String.fromCharCode(byte)}`;
    } else if (byte >= 32 && byte <= 126) {
      salida += String.fromCharCode(byte);
    } else {
      salida += `\\${byte.toString(8).padStart(3, '0')}`;
    }
  }

  return `(${salida})`;
}

function numero(valor: number): string {
  return Number(valor.toFixed(2)).toString();
}

function colorDe(color: Color): string {
  return color.map(numero).join(' ');
}

// ---------------------------------------------------------------------------
// El texto partido en lineas
// ---------------------------------------------------------------------------

interface Segmento {
  readonly texto: string;
  readonly fuente: Fuente;
}

interface Palabra {
  readonly segmentos: readonly Segmento[];
  readonly ancho: number;
}

interface Linea {
  readonly palabras: readonly Palabra[];
  readonly ancho: number;
}

/** Parte los tramos en palabras. Una palabra puede cruzar tramos: «(Ctrl)». */
function palabrasDe(tramos: readonly Tramo[], fuenteBase: Fuente, tamano: number): Palabra[] {
  const palabras: Palabra[] = [];
  let segmentos: Segmento[] = [];
  let ancho = 0;

  const cerrar = () => {
    if (segmentos.length > 0) {
      palabras.push({ segmentos, ancho });
      segmentos = [];
      ancho = 0;
    }
  };

  for (const tramo of tramos) {
    const fuente = tramo.fuente ?? fuenteBase;

    for (const [indice, trozo] of tramo.texto.split(/\s+/).entries()) {
      // Entre dos trozos hubo un espacio: la palabra anterior termino.
      if (indice > 0) {
        cerrar();
      }

      if (trozo !== '') {
        segmentos.push({ texto: trozo, fuente });
        ancho += anchoDe(trozo, fuente, tamano);
      }
    }
  }

  cerrar();

  return palabras;
}

function partirEnLineas(
  palabras: readonly Palabra[],
  tamano: number,
  anchoMaximo: number,
): Linea[] {
  const espacio = anchoDe(' ', 'normal', tamano);
  const lineas: Linea[] = [];
  let actuales: Palabra[] = [];
  let ancho = 0;

  for (const palabra of palabras) {
    const conEsta = actuales.length === 0 ? palabra.ancho : ancho + espacio + palabra.ancho;

    if (conEsta > anchoMaximo && actuales.length > 0) {
      lineas.push({ palabras: actuales, ancho });
      actuales = [palabra];
      ancho = palabra.ancho;
    } else {
      actuales.push(palabra);
      ancho = conEsta;
    }
  }

  if (actuales.length > 0) {
    lineas.push({ palabras: actuales, ancho });
  }

  return lineas;
}

// ---------------------------------------------------------------------------
// El documento
// ---------------------------------------------------------------------------

const TAMANO_POR_DEFECTO = 10.5;
const INTERLINEADO_POR_DEFECTO = 1.45;

export class DocumentoPdf {
  private readonly paginas: string[][] = [[]];
  /** Donde esta el cursor, en puntos desde el borde de arriba de la pagina. */
  private cursor = MARGEN_SUPERIOR;

  private readonly opciones: OpcionesDelDocumento;

  constructor(opciones: OpcionesDelDocumento) {
    this.opciones = opciones;
  }

  /** Lo que queda de la pagina de ahora, hasta el margen de abajo. */
  get espacioLibre(): number {
    return ALTO_DE_LA_PAGINA - MARGEN_INFERIOR - this.cursor;
  }

  /** Empieza otra pagina. */
  nuevaPagina(): void {
    this.paginas.push([]);
    this.cursor = MARGEN_SUPERIOR;
  }

  /** Si no caben `alto` puntos en la pagina de ahora, empieza otra. */
  reservar(alto: number): void {
    if (alto > this.espacioLibre && this.cursor > MARGEN_SUPERIOR) {
      this.nuevaPagina();
    }
  }

  /** Baja el cursor. */
  espacio(puntos: number): void {
    this.cursor += puntos;
  }

  /** Cuanto ocupa un texto, con el espacio de debajo. */
  medir(tramos: readonly Tramo[], estilo: EstiloDeTexto = {}): number {
    const { tamano, interlineado, anchoMaximo, despues } = this.resolver(estilo);
    const lineas = partirEnLineas(
      palabrasDe(tramos, estilo.fuente ?? 'normal', tamano),
      tamano,
      anchoMaximo,
    );

    return lineas.length * tamano * interlineado + despues;
  }

  /**
   * Escribe un texto, partido en lineas. Si lleva un marcador (un numero, una
   * viñeta, una casilla), va a la izquierda de la primera linea, en el margen,
   * fuera de la sangria.
   */
  texto(tramos: readonly Tramo[], estilo: EstiloDeTexto = {}, marcador?: Marcador): void {
    const { tamano, interlineado, anchoMaximo, sangria, despues, color } = this.resolver(estilo);
    const fuenteBase = estilo.fuente ?? 'normal';
    const lineas = partirEnLineas(palabrasDe(tramos, fuenteBase, tamano), tamano, anchoMaximo);
    const alto = tamano * interlineado;
    const espacio = anchoDe(' ', 'normal', tamano);

    for (const [indice, linea] of lineas.entries()) {
      if (alto > this.espacioLibre) {
        this.nuevaPagina();
      }

      // La linea base: el cursor es el borde de arriba de la linea, y el texto
      // va centrado en ella, con las letras subiendo 0,8 del tamano sobre la base.
      const y = ALTO_DE_LA_PAGINA - this.cursor - ((alto - tamano) / 2 + tamano * 0.8);
      let x = MARGEN_LATERAL + sangria;

      if (indice === 0 && marcador !== undefined) {
        // Sangria francesa: el marcador cuelga a la izquierda del texto.
        const xDelMarcador = MARGEN_LATERAL + sangria - ANCHO_DEL_MARCADOR;

        if (typeof marcador === 'string') {
          this.poner(this.operacionDeTexto(marcador, 'negrita', tamano, color, xDelMarcador, y));
        } else {
          const lado = tamano * 0.95;

          this.poner(
            `${colorDe(color)} RG 0.8 w ${numero(xDelMarcador)} ${numero(y - tamano * 0.12)} ` +
              `${numero(lado)} ${numero(lado)} re S`,
          );
        }
      }

      for (const [numeroDePalabra, palabra] of linea.palabras.entries()) {
        if (numeroDePalabra > 0) {
          x += espacio;
        }

        for (const segmento of palabra.segmentos) {
          this.poner(this.operacionDeTexto(segmento.texto, segmento.fuente, tamano, color, x, y));
          x += anchoDe(segmento.texto, segmento.fuente, tamano);
        }
      }

      this.cursor += alto;
    }

    this.cursor += despues;
  }

  /** Una linea horizontal del ancho de la pagina util. */
  regla(color: Color = [0.8, 0.8, 0.8], grosor = 0.75): void {
    const y = ALTO_DE_LA_PAGINA - this.cursor;

    this.poner(
      `${colorDe(color)} RG ${numero(grosor)} w ${numero(MARGEN_LATERAL)} ${numero(y)} m ` +
        `${numero(MARGEN_LATERAL + ANCHO_UTIL)} ${numero(y)} l S`,
    );
  }

  /**
   * Un recuadro con un texto dentro. El alto sale del texto, y el recuadro se
   * dibuja **antes** que el, para que no lo tape.
   */
  caja(
    tramos: readonly Tramo[],
    estilo: EstiloDeTexto & { readonly fondo: Color; readonly relleno?: number },
  ): void {
    const relleno = estilo.relleno ?? 10;
    const { tamano, interlineado, despues } = this.resolver(estilo);
    // El texto se parte en el ancho que queda dentro del recuadro, a ambos lados.
    const anchoDelTexto = ANCHO_UTIL - 2 * relleno;
    const lineas = partirEnLineas(
      palabrasDe(tramos, estilo.fuente ?? 'normal', tamano),
      tamano,
      anchoDelTexto,
    );
    const alto = lineas.length * tamano * interlineado + 2 * relleno;

    this.reservar(alto + despues);

    this.poner(
      `${colorDe(estilo.fondo)} rg ${numero(MARGEN_LATERAL)} ${numero(ALTO_DE_LA_PAGINA - this.cursor - alto)} ` +
        `${numero(ANCHO_UTIL)} ${numero(alto)} re f`,
    );

    this.cursor += relleno;
    this.texto(tramos, { ...estilo, sangria: relleno, anchoMaximo: anchoDelTexto, despues: 0 });
    this.cursor += relleno + despues;
  }

  /** El documento completo, como texto ASCII. */
  generar(): string {
    const total = this.paginas.length;
    const objetos: string[] = [];

    // 1: el catalogo; 2: las paginas; 3 y 4: las fuentes; 5: la informacion.
    // Despues, de a dos por pagina: la pagina y su contenido.
    const idDeLaPagina = (indice: number) => 6 + indice * 2;
    const idDelContenido = (indice: number) => 7 + indice * 2;

    objetos.push(
      `<< /Type /Catalog /Pages 2 0 R /Lang ${cadenaDePdf(this.opciones.idioma)} >>`,
      `<< /Type /Pages /Count ${total} /Kids [${this.paginas.map((_, i) => `${idDeLaPagina(i)} 0 R`).join(' ')}] >>`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
      `<< /Title ${cadenaDePdf(this.opciones.titulo)} ${
        this.opciones.asunto === undefined ? '' : `/Subject ${cadenaDePdf(this.opciones.asunto)} `
      }/Producer (VSD Health) >>`,
    );

    for (const [indice, operaciones] of this.paginas.entries()) {
      const pie = this.opciones.pie(indice + 1, total);
      const yDelPie = MARGEN_INFERIOR - 22;
      const gris: Color = [0.45, 0.45, 0.45];
      const contenido = [
        ...operaciones,
        `${colorDe([0.85, 0.85, 0.85])} RG 0.5 w ${numero(MARGEN_LATERAL)} ${numero(yDelPie + 14)} m ` +
          `${numero(MARGEN_LATERAL + ANCHO_UTIL)} ${numero(yDelPie + 14)} l S`,
        this.operacionDeTexto(pie.izquierda, 'normal', 8.5, gris, MARGEN_LATERAL, yDelPie),
        this.operacionDeTexto(
          pie.derecha,
          'normal',
          8.5,
          gris,
          MARGEN_LATERAL + ANCHO_UTIL - anchoDe(pie.derecha, 'normal', 8.5),
          yDelPie,
        ),
      ].join('\n');

      objetos.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ANCHO_DE_LA_PAGINA} ${ALTO_DE_LA_PAGINA}] ` +
          `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${idDelContenido(indice)} 0 R >>`,
        `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
      );
    }

    let archivo = '%PDF-1.4\n';
    const posiciones: number[] = [];

    for (const [indice, objeto] of objetos.entries()) {
      posiciones.push(archivo.length);
      archivo += `${indice + 1} 0 obj\n${objeto}\nendobj\n`;
    }

    const inicioDeLasReferencias = archivo.length;

    archivo += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;

    for (const posicion of posiciones) {
      archivo += `${posicion.toString().padStart(10, '0')} 00000 n \n`;
    }

    archivo +=
      `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R /Info 5 0 R >>\n` +
      `startxref\n${inicioDeLasReferencias}\n%%EOF\n`;

    return archivo;
  }

  private resolver(estilo: EstiloDeTexto) {
    const sangria = estilo.sangria ?? 0;

    return {
      tamano: estilo.tamano ?? TAMANO_POR_DEFECTO,
      interlineado: estilo.interlineado ?? INTERLINEADO_POR_DEFECTO,
      sangria,
      anchoMaximo: estilo.anchoMaximo ?? ANCHO_UTIL - sangria,
      despues: estilo.despues ?? 0,
      color: estilo.color ?? NEGRO,
    };
  }

  private operacionDeTexto(
    texto: string,
    fuente: Fuente,
    tamano: number,
    color: Color,
    x: number,
    y: number,
  ): string {
    const nombre = fuente === 'negrita' ? 'F2' : 'F1';

    return (
      `BT ${colorDe(color)} rg /${nombre} ${numero(tamano)} Tf 1 0 0 1 ${numero(x)} ${numero(y)} Tm ` +
      `${cadenaDePdf(texto, fuente)} Tj ET`
    );
  }

  private poner(operacion: string): void {
    this.paginas[this.paginas.length - 1]?.push(operacion);
  }
}
