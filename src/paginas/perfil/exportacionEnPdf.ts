import {
  DocumentoPdf,
  type Color,
  type Columna,
  type Marcador,
  type Tramo,
} from '../../pdf/documentoPdf.ts';
import { sanearParaPdf } from '../../pdf/sanearParaPdf.ts';
import { esTipoDeOperacion } from '../../sincronizacion/cola.ts';
import { descripcionDelCambio } from '../../sincronizacion/resumen.ts';

/**
 * Lo que VSD Health guarda de la persona, en un PDF con la marca (SCRUM-191).
 *
 * Es **la misma exportacion que el JSON** (`armarLaExportacion`), contada para leerla: el JSON
 * sigue siendo la opcion completa y portable (D9). Por eso este modulo recibe lo que respondio el
 * servidor tal cual, como `unknown`, y **no confia en su forma**: cada seccion que no venga como
 * se espera se omite o dice que no hay nada, y la exportacion nunca se rompe.
 *
 * Reglas de lo que dice:
 *
 * - **Solo la persona**: todo sale de su propia exportacion. No se pide nada mas que el nombre de
 *   las actividades, que es el mismo catalogo publico de todo el mundo.
 * - **Sin lo que no le dice nada**: ni sus identificadores internos ni los bytes de su foto o de
 *   su mascota (eso va, completo, en el JSON).
 * - **Todo texto que escribio la persona pasa por `sanearParaPdf`**: un emoji no puede tirar la
 *   exportacion entera.
 * - **El tono de la app**: nada apura, exige ni reprocha; el nivel de una actividad es una
 *   orientacion, nunca un diagnostico.
 */

export const NOMBRE_DEL_PDF = 'vsd-health-mis-datos.pdf';

const TITULO_DEL_DOCUMENTO = 'Tus datos en VSD Health';

/** El verde de la marca (#3d7a6b), el mismo del primario de la app. */
const MARCA: Color = [0.24, 0.48, 0.42];
const VERDE_OSCURO: Color = [0.14, 0.33, 0.28];
const GRIS: Color = [0.4, 0.4, 0.4];
const FONDO_DE_LA_NOTA: Color = [0.93, 0.96, 0.94];

const SIN_DATO = '—';

export interface OpcionesDeLaExportacionEnPdf {
  /** El nombre de cada actividad por su identificador. Sin el, salen como «Actividad». */
  readonly actividades?: ReadonlyMap<string, string>;
}

// ---------------------------------------------------------------------------
// Leer lo que llego, sin confiar en su forma
// ---------------------------------------------------------------------------

type Registro = Readonly<Record<string, unknown>>;

function esRegistro(valor: unknown): valor is Registro {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function registro(valor: unknown): Registro {
  return esRegistro(valor) ? valor : {};
}

function lista(valor: unknown): readonly unknown[] {
  return Array.isArray(valor) ? (valor as readonly unknown[]) : [];
}

function cadena(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : undefined;
}

/** Un texto de la persona, listo para el PDF; `—` si no hay. */
function texto(valor: unknown): string {
  const dicho = cadena(valor);

  return dicho === undefined ? SIN_DATO : sanearParaPdf(dicho);
}

function siONo(valor: unknown): string {
  return valor === true ? 'Sí' : 'No';
}

// ---------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------

const UN_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Un dia (`AAAA-MM-DD`) no es un instante: no se corre por la zona horaria. */
function formatearDia(valor: unknown): string {
  const dicho = cadena(valor);

  if (dicho === undefined) {
    return SIN_DATO;
  }

  const partes = UN_DIA.exec(dicho);

  return partes === null ? sanearParaPdf(dicho) : `${partes[3]}/${partes[2]}/${partes[1]}`;
}

/** La zona horaria, si el navegador la conoce. Una inventada no tira nada abajo: va sin zona. */
function zonaConocida(zona: string | undefined): string | undefined {
  if (zona === undefined) {
    return undefined;
  }

  try {
    return new Intl.DateTimeFormat('es-CO', { timeZone: zona }).resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

function formateadorDe(zona: string | undefined): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: zona ?? 'UTC',
  });
}

/** Un instante, como `DD/MM/AAAA HH:MM` en la zona horaria de la persona. */
function instanteEn(formateador: Intl.DateTimeFormat, valor: unknown): string {
  const dicho = cadena(valor);

  if (dicho === undefined) {
    return SIN_DATO;
  }

  const milisegundos = Date.parse(dicho);

  if (Number.isNaN(milisegundos)) {
    return sanearParaPdf(dicho);
  }

  const partes = Object.fromEntries(
    formateador.formatToParts(new Date(milisegundos)).map((parte) => [parte.type, parte.value]),
  ) as Readonly<Record<string, string>>;

  return `${partes.day}/${partes.month}/${partes.year} ${partes.hour}:${partes.minute}`;
}

// ---------------------------------------------------------------------------
// El diario: un arbol de nodos, a parrafos
// ---------------------------------------------------------------------------

interface Parrafo {
  readonly tramos: readonly Tramo[];
  readonly sangria: number;
  readonly marcador?: Marcador;
}

/** Los bloques anidados mas hondos que esto no se leen: un diario real no llega ni cerca. */
const PROFUNDIDAD_MAXIMA = 40;
const SANGRIA_DE_UNA_LISTA = 22;
const SANGRIA_DE_UNA_CITA = 16;

function tieneNegrita(nodo: Registro): boolean {
  return lista(nodo.marks).some((marca) => registro(marca).type === 'bold');
}

/** El texto en linea de un bloque, partido donde hay un salto de linea. */
function lineasDe(nodo: Registro, negrita: boolean): Tramo[][] {
  const lineas: Tramo[][] = [[]];

  const recorrer = (actual: Registro, enNegrita: boolean, profundidad: number) => {
    if (profundidad > PROFUNDIDAD_MAXIMA) {
      return;
    }

    if (typeof actual.text === 'string') {
      lineas[lineas.length - 1]?.push({
        texto: sanearParaPdf(actual.text),
        ...(enNegrita || tieneNegrita(actual) ? { fuente: 'negrita' as const } : {}),
      });

      return;
    }

    if (actual.type === 'hardBreak') {
      lineas.push([]);

      return;
    }

    for (const hijo of lista(actual.content)) {
      recorrer(registro(hijo), enNegrita, profundidad + 1);
    }
  };

  recorrer(nodo, negrita, 0);

  return lineas.filter((linea) => linea.some((tramo) => tramo.texto.trim() !== ''));
}

/** Los parrafos de un documento del editor. Un tipo que no se conoce deja su texto. */
function parrafosDe(
  nodo: Registro,
  sangria: number,
  salida: Parrafo[] = [],
  profundidad = 0,
): Parrafo[] {
  if (profundidad > PROFUNDIDAD_MAXIMA) {
    return salida;
  }

  const hijos = () => {
    for (const hijo of lista(nodo.content)) {
      parrafosDe(registro(hijo), sangria, salida, profundidad + 1);
    }
  };

  switch (nodo.type) {
    case 'paragraph':
    case 'codeBlock':
    case 'heading': {
      for (const tramos of lineasDe(nodo, nodo.type === 'heading')) {
        salida.push({ tramos, sangria });
      }

      break;
    }
    case 'bulletList':
    case 'orderedList': {
      const inicio = esRegistro(nodo.attrs) ? nodo.attrs.start : undefined;
      let numero = typeof inicio === 'number' && Number.isInteger(inicio) ? inicio : 1;

      for (const elemento of lista(nodo.content)) {
        const delElemento = parrafosDe(
          registro(elemento),
          sangria + SANGRIA_DE_UNA_LISTA,
          [],
          profundidad + 1,
        );
        const [primero, ...resto] = delElemento;

        if (primero !== undefined) {
          const marcador: Marcador = nodo.type === 'bulletList' ? '•' : `${String(numero)}.`;

          salida.push({ ...primero, marcador }, ...resto);
        }

        numero += 1;
      }

      break;
    }
    case 'blockquote': {
      for (const hijo of lista(nodo.content)) {
        parrafosDe(registro(hijo), sangria + SANGRIA_DE_UNA_CITA, salida, profundidad + 1);
      }

      break;
    }
    case 'horizontalRule':
    case 'diagrama':
    case 'hardBreak':
      // Sin texto: los diagramas se cuentan aparte, desde los adjuntos de la anotacion.
      break;
    default: {
      if (typeof nodo.text === 'string') {
        for (const tramos of lineasDe(nodo, false)) {
          salida.push({ tramos, sangria });
        }
      } else {
        hijos();
      }
    }
  }

  return salida;
}

// ---------------------------------------------------------------------------
// Las palabras de cada cosa
// ---------------------------------------------------------------------------

const MODULOS: Readonly<Record<string, string>> = {
  cognicion: 'Cognición',
  bienestar: 'Bienestar',
  emociones: 'Emociones',
};

const CONSENTIMIENTOS: Readonly<Record<string, string>> = {
  aviso_de_privacidad: 'Aviso de privacidad',
  terminos: 'Términos',
};

const NIVELES_DE_UNA_ACTIVIDAD: Readonly<Record<string, string>> = {
  favorable: 'Favorable',
  en_seguimiento: 'En seguimiento',
  requiere_atencion: 'Requiere atención',
};

const NIVELES_DE_UN_PENDIENTE: Readonly<Record<string, string>> = {
  urgente: 'Urgente',
  prioridad: 'Prioridad',
  aplazable: 'Aplazable',
};

const ESTADOS_DE_UN_CAMBIO: Readonly<Record<string, string>> = {
  pendiente: 'Pendiente de enviar',
  enviando: 'Enviándose',
  requiere_atencion: 'Necesita que lo mires',
  conflicto: 'Chocó con un cambio de otro dispositivo',
};

function nombrado(diccionario: Readonly<Record<string, string>>, valor: unknown): string {
  const clave = cadena(valor);

  return clave === undefined ? SIN_DATO : (diccionario[clave] ?? sanearParaPdf(clave));
}

// ---------------------------------------------------------------------------
// El documento
// ---------------------------------------------------------------------------

/** @returns El PDF completo, como texto ASCII: se guarda tal cual en un archivo. */
export function generarLaExportacionEnPdf(
  datos: unknown,
  opciones: OpcionesDeLaExportacionEnPdf = {},
): string {
  const exportacion = registro(datos);
  const cuenta = registro(exportacion.cuenta);
  const zona = zonaConocida(cadena(cuenta.zonaHoraria));
  const formateador = formateadorDe(zona);
  const instante = (valor: unknown) => instanteEn(formateador, valor);
  const nombreDeLaZona = zona === undefined ? 'hora universal (UTC)' : sanearParaPdf(zona);

  const documento = new DocumentoPdf({
    // Todo lo que se escribe pasa por el saneador: un campo que no se haya previsto no puede
    // romper la exportacion.
    saneador: sanearParaPdf,
    titulo: TITULO_DEL_DOCUMENTO,
    asunto: 'Lo que VSD Health guarda de ti',
    idioma: 'es-CO',
    pie: (pagina, total) => ({
      izquierda: 'VSD Health · Tus datos',
      derecha: `Página ${String(pagina)} de ${String(total)}`,
    }),
  });

  const seccion = (titulo: string) => {
    documento.reservar(70);
    documento.espacio(8);
    documento.texto([{ texto: titulo }], {
      tamano: 14,
      fuente: 'negrita',
      color: VERDE_OSCURO,
      despues: 4,
    });
    documento.regla([0.78, 0.86, 0.82]);
    documento.espacio(10);
  };

  const aparte = (frase: string) => {
    documento.texto([{ texto: frase }], { tamano: 9.5, color: GRIS, despues: 10 });
  };

  // --- La portada ---------------------------------------------------------

  documento.banda({
    titulo: 'VSD Health',
    subtitulo: 'Tus datos',
    fondo: MARCA,
    logo: true,
  });
  documento.texto(
    [{ texto: `Generado el ${instante(exportacion.generadoEn)} (${nombreDeLaZona}).` }],
    { tamano: 10, color: GRIS, despues: 6 },
  );
  documento.texto(
    [
      {
        texto:
          'Aquí está lo que VSD Health guarda de ti: tu cuenta, tus actividades, tu diario y tus ' +
          'pendientes. Es tuyo; si lo compartes, que sea cuando tú quieras.',
      },
    ],
    { tamano: 11, despues: 4 },
  );

  // --- La cuenta ----------------------------------------------------------

  seccion('Tu cuenta');

  const modulos = lista(cuenta.modulosActivos).map((modulo) => nombrado(MODULOS, modulo));
  const tienesFoto = esRegistro(exportacion.foto) || esRegistro(cuenta.foto);
  const tienesMascota = esRegistro(exportacion.mascotaPropia) || esRegistro(cuenta.mascotaPropia);

  documento.tabla(
    [
      { titulo: 'Dato', ancho: 0.34 },
      { titulo: 'Valor', ancho: 0.66 },
    ],
    [
      ['Nombre', texto(cuenta.nombre)],
      ['Correo', texto(cuenta.correo)],
      [
        'Fecha de nacimiento',
        cadena(exportacion.fechaNacimiento) === undefined
          ? 'No la tienes registrada'
          : formatearDia(exportacion.fechaNacimiento),
      ],
      ['Cuenta creada el', instante(cuenta.registradoEn)],
      ['Zona horaria', texto(cuenta.zonaHoraria)],
      ['Módulos activos', modulos.length === 0 ? 'Todavía no elegiste' : modulos.join(', ')],
      ['Diario con recomendaciones', siONo(cuenta.diarioConRecomendaciones)],
      ['Foto de perfil', siONo(tienesFoto)],
      ['Mascota propia', siONo(tienesMascota)],
    ],
  );

  // --- Lo que acepto -------------------------------------------------------

  seccion('Lo que aceptaste');

  const aceptados = lista(exportacion.consentimientos).map(registro);
  const delaCuenta = registro(cuenta.consentimiento);
  const filasDeAceptados: string[][] =
    aceptados.length > 0
      ? aceptados.map((aceptado) => [
          nombrado(CONSENTIMIENTOS, aceptado.tipo),
          texto(aceptado.version),
          instante(aceptado.aceptadoEn),
        ])
      : cadena(delaCuenta.versionPolitica) === undefined
        ? []
        : [
            [
              'Aviso de privacidad',
              texto(delaCuenta.versionPolitica),
              instante(delaCuenta.aceptadoEn),
            ],
          ];

  documento.tabla(
    [
      { titulo: 'Qué', ancho: 0.4 },
      { titulo: 'Versión', ancho: 0.25 },
      { titulo: 'Cuándo', ancho: 0.35 },
    ],
    filasDeAceptados,
    { vacia: 'No hay aceptaciones registradas.' },
  );

  // --- Las actividades -----------------------------------------------------

  seccion('Tus actividades');

  const resultados = lista(exportacion.resultados).map(registro);
  const columnasDeActividades: readonly Columna[] = [
    { titulo: 'Cuándo', ancho: 0.28 },
    { titulo: 'Actividad', ancho: 0.4 },
    { titulo: 'Nivel orientativo', ancho: 0.32 },
  ];

  documento.tabla(
    columnasDeActividades,
    resultados.map((resultado) => {
      const identificador = cadena(resultado.activityId);
      const nombre =
        identificador === undefined ? undefined : opciones.actividades?.get(identificador);

      return [
        instante(resultado.completedAt),
        nombre === undefined ? 'Actividad' : sanearParaPdf(nombre),
        nombrado(NIVELES_DE_UNA_ACTIVIDAD, resultado.nivelOrientativo),
      ];
    }),
    { vacia: 'Todavía no has completado actividades.', despues: resultados.length > 0 ? 6 : 14 },
  );

  if (resultados.length > 0) {
    aparte('El nivel es una orientación sobre cómo fue la actividad, nunca un diagnóstico.');
  }

  // --- El diario ------------------------------------------------------------

  seccion('Tu diario');

  const entradas = lista(exportacion.entradasDeDiario).map(registro);

  if (entradas.length === 0) {
    documento.texto([{ texto: 'Todavía no has escrito en tu diario.' }], {
      color: GRIS,
      despues: 14,
    });
  }

  for (const entrada of entradas) {
    const titulo = cadena(entrada.titulo);
    const cabecera: Tramo[] = [
      {
        texto:
          titulo === undefined
            ? formatearDia(entrada.dia)
            : `${formatearDia(entrada.dia)} · ${sanearParaPdf(titulo)}`,
        fuente: 'negrita',
      },
    ];
    const parrafos = parrafosDe(registro(entrada.contenido), 0);
    const diagramas = lista(entrada.adjuntos).length;

    // El titulo de una anotacion no se queda solo al final de una pagina.
    documento.reservar(
      documento.medir(cabecera, { tamano: 11.5, despues: 2 }) +
        (parrafos[0] === undefined ? 0 : documento.medir(parrafos[0].tramos, { despues: 4 })) +
        30,
    );
    documento.texto(cabecera, { tamano: 11.5, color: VERDE_OSCURO, despues: 2 });
    documento.texto([{ texto: `Escrita el ${instante(entrada.creadaEn)}` }], {
      tamano: 8.5,
      color: GRIS,
      despues: 5,
    });

    if (parrafos.length === 0) {
      documento.texto([{ texto: 'Sin texto.' }], { color: GRIS, despues: 4 });
    }

    for (const parrafo of parrafos) {
      documento.texto(parrafo.tramos, { sangria: parrafo.sangria, despues: 4 }, parrafo.marcador);
    }

    if (diagramas > 0) {
      documento.texto(
        [
          {
            texto:
              diagramas === 1
                ? 'Esta anotación tiene 1 diagrama; está en el archivo JSON.'
                : `Esta anotación tiene ${String(diagramas)} diagramas; están en el archivo JSON.`,
          },
        ],
        { tamano: 9.5, color: GRIS, despues: 4 },
      );
    }

    documento.espacio(10);
  }

  // --- Los pendientes -------------------------------------------------------

  seccion('Tu semáforo de pendientes');

  const pendientes = lista(exportacion.pendientes).map(registro);

  documento.tabla(
    [
      { titulo: 'Pendiente', ancho: 0.44 },
      { titulo: 'Nivel', ancho: 0.16 },
      { titulo: 'Estado', ancho: 0.22 },
      { titulo: 'Límite', ancho: 0.18 },
    ],
    pendientes.map((pendiente) => [
      texto(pendiente.texto),
      nombrado(NIVELES_DE_UN_PENDIENTE, pendiente.nivel),
      pendiente.hecho === true
        ? 'Hecho'
        : cadena(pendiente.posponerHasta) === undefined
          ? 'Por hacer'
          : `Pospuesto hasta ${instante(pendiente.posponerHasta)}`,
      formatearDia(pendiente.fechaLimite),
    ]),
    { vacia: 'No tienes pendientes anotados.' },
  );

  // --- Los avisos y el dato curioso -----------------------------------------

  const avisos = registro(exportacion.avisos);

  seccion('Tus avisos');
  documento.tabla(
    [
      { titulo: 'Aviso', ancho: 0.5 },
      { titulo: 'Cómo lo tienes', ancho: 0.5 },
    ],
    [
      ['Semáforo', cadena(avisos.horaSemaforo) ?? 'Sin hora'],
      ['Racha', cadena(avisos.horaRacha) ?? 'Sin hora'],
      ['Recordatorio de la mañana', avisos.recordatorioManana === true ? 'Activado' : 'Apagado'],
      ['Recordatorio de la noche', avisos.recordatorioNoche === true ? 'Activado' : 'Apagado'],
      [
        'Navegadores con avisos',
        typeof avisos.navegadores === 'number' ? String(avisos.navegadores) : SIN_DATO,
      ],
    ],
  );

  const datoCurioso = registro(exportacion.datoCurioso);

  if (cadena(datoCurioso.texto) !== undefined) {
    seccion('El último dato curioso que viste');
    documento.texto([{ texto: texto(datoCurioso.texto) }], { despues: 3 });
    aparte(formatearDia(datoCurioso.dia));
  }

  // --- Lo que este equipo guarda y no ha enviado ----------------------------

  const sinEnviar = lista(exportacion.sinEnviarDesdeEsteEquipo).map(registro);

  if (sinEnviar.length > 0) {
    seccion('Guardado en este equipo, sin enviar');
    documento.texto(
      [
        {
          texto:
            'Estos cambios todavía no se han enviado a VSD Health: solo están en este equipo. ' +
            'Se envían cuando hay conexión.',
        },
      ],
      { despues: 8 },
    );

    for (const cambio of sinEnviar) {
      const tipo = cambio.tipo;
      const contenido = registro(cambio.contenido);
      const nombre = esTipoDeOperacion(tipo)
        ? descripcionDelCambio(tipo)
        : 'Un cambio guardado en este equipo';
      const escrito: Parrafo[] = [];

      if (tipo === 'diario.escribir' || tipo === 'diario.editar') {
        const titulo = cadena(contenido.titulo);

        if (titulo !== undefined) {
          escrito.push({
            tramos: [{ texto: sanearParaPdf(titulo), fuente: 'negrita' }],
            sangria: 14,
          });
        }

        escrito.push(...parrafosDe(registro(contenido.contenido), 14));
      } else if (tipo === 'pendiente.crear' || tipo === 'pendiente.editar') {
        const texto = cadena(contenido.texto);

        if (texto !== undefined) {
          escrito.push({ tramos: [{ texto: sanearParaPdf(texto) }], sangria: 14 });
        }
      }

      documento.reservar(60);
      documento.texto(
        [
          { texto: nombre, fuente: 'negrita' },
          {
            texto: ` · ${instante(cambio.creadaEn)} · ${nombrado(ESTADOS_DE_UN_CAMBIO, cambio.estado)}`,
          },
        ],
        { despues: 3 },
      );

      for (const parrafo of escrito) {
        documento.texto(parrafo.tramos, { sangria: parrafo.sangria, despues: 3 }, parrafo.marcador);
      }

      documento.espacio(6);
    }
  }

  // --- Lo que no cabe en un PDF ---------------------------------------------

  documento.espacio(8);
  documento.caja(
    [
      {
        texto:
          'Tu foto de perfil, tu mascota propia y los diagramas de tu diario no caben en un PDF ' +
          'de texto: están completos, tal como se guardan, en el archivo JSON («Descargar en ' +
          'JSON», en Perfil › Tus datos).',
      },
    ],
    { fondo: FONDO_DE_LA_NOTA, tamano: 10, despues: 0 },
  );

  return documento.generar();
}
