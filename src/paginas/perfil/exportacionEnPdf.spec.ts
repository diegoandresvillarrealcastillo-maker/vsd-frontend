import { describe, expect, it } from 'vitest';

import { generarLaExportacionEnPdf, NOMBRE_DEL_PDF } from './exportacionEnPdf.ts';

/**
 * La exportacion de los datos propios en PDF, con la marca de VSD Health (SCRUM-191, D9).
 *
 * Tres cosas que importan mas que el diseno:
 *
 * 1. **Un diario con emojis exporta sin error y sin perder el resto.** El escritor de PDF solo
 *    conoce WinAnsi; un caracter que no este no puede tirar la exportacion entera.
 * 2. **Solo los datos de la propia persona**, y sin lo que no le dice nada: ni sus identificadores
 *    internos ni los bytes de su foto.
 * 3. **Nunca se rompe por lo que llegue**: la respuesta del servidor se lee como `unknown`.
 */
const CUENTA_ID = '11111111-1111-4111-8111-111111111111';
const ENTRADA_ID = '22222222-2222-4222-9222-222222222222';
const FOTO_EN_BASE64 = 'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo';

function documento(...parrafos: string[]) {
  return {
    type: 'doc',
    content: parrafos.map((texto) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: texto }],
    })),
  };
}

function exportacion(cambios: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    generadoEn: '2026-10-13T23:30:00.000Z',
    cuenta: {
      id: CUENTA_ID,
      correo: 'ana@example.com',
      rol: 'usuario',
      nombre: 'Ana María',
      registradoEn: '2026-09-01T15:00:00.000Z',
      modulosActivos: ['bienestar', 'emociones'],
      diarioConRecomendaciones: false,
      zonaHoraria: 'America/Bogota',
      foto: { actualizadaEl: '2026-09-02T10:00:00.000Z' },
      mascotaPropia: null,
    },
    fechaNacimiento: '1998-02-14',
    consentimientos: [
      { tipo: 'aviso_de_privacidad', version: '2026-10-1', aceptadoEn: '2026-09-01T15:00:00.000Z' },
      { tipo: 'terminos', version: '2026-10-1', aceptadoEn: '2026-09-01T15:00:00.000Z' },
    ],
    resultados: [
      {
        id: 'r1',
        activityId: 'act-memoria',
        nivelOrientativo: 'favorable',
        sugiereAcompanamiento: false,
        lineasDeAtencion: [],
        metadata: {},
        // En Bogota (UTC-5) esto es el 4 de octubre a las 22:30, no el 5.
        completedAt: '2026-10-05T03:30:00.000Z',
      },
    ],
    entradasDeDiario: [
      {
        id: ENTRADA_ID,
        dia: '2026-10-03',
        titulo: 'Un buen día 😀',
        contenido: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Hoy salí a caminar con ' },
                { type: 'text', text: 'calma', marks: [{ type: 'bold' }] },
                { type: 'text', text: ' 🌳❤️.' },
              ],
            },
            {
              type: 'bulletList',
              content: [
                {
                  type: 'listItem',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Primero' }] }],
                },
                {
                  type: 'listItem',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Segundo' }] }],
                },
              ],
            },
          ],
        },
        adjuntos: [{ id: 'd1', tipo: 'diagrama', datos: {} }],
        version: 1,
        creadaEn: '2026-10-03T20:15:00.000Z',
        editadaEn: '2026-10-03T20:15:00.000Z',
        editableHasta: '2026-10-03T21:15:00.000Z',
      },
    ],
    pendientes: [
      {
        id: 'p1',
        texto: 'Llamar a la médica (urgente)',
        nivel: 'urgente',
        hecho: false,
        posponerHasta: null,
        fechaLimite: '2026-10-20',
        version: 1,
        creadoEn: '2026-10-01T10:00:00.000Z',
        editadoEn: '2026-10-01T10:00:00.000Z',
      },
    ],
    avisos: {
      horaSemaforo: '08:00',
      frecuenciaSemaforo: 'dos_veces',
      horaRacha: null,
      recordatorioManana: true,
      recordatorioNoche: false,
      navegadores: 1,
    },
    foto: {
      tipo: 'image/jpeg',
      actualizadaEl: '2026-09-02T10:00:00.000Z',
      contenidoBase64: FOTO_EN_BASE64,
    },
    mascotaPropia: null,
    datoCurioso: { dia: '2026-10-13', texto: 'Los pulpos tienen tres corazones.' },
    ...cambios,
  };
}

/** Lo que dice el PDF, en orden, con sus escapes deshechos: palabras separadas por un espacio. */
function textoDe(pdf: string): string {
  return [...pdf.matchAll(/Tm \(((?:[^()\\]|\\.)*)\) Tj ET/g)]
    .map((m) =>
      (m[1] ?? '')
        .replace(/\\([0-7]{3})/g, (_, octal: string) => String.fromCharCode(parseInt(octal, 8)))
        .replace(/\\([()\\])/g, '$1'),
    )
    .join(' ');
}

const ACTIVIDADES = new Map([['act-memoria', 'Memoria de trabajo']]);

/** Donde empieza una palabra suelta del PDF: la columna (x) y la linea (y) de su `Tm`. */
function lugarDe(pdf: string, palabra: string): { x: number; y: number } {
  const hallado = new RegExp(`1 0 0 1 ([\\d.]+) ([\\d.]+) Tm \\(${palabra}\\) Tj`).exec(pdf);

  if (hallado === null) {
    throw new Error(`«${palabra}» no esta en el PDF.`);
  }

  return { x: Number(hallado[1]), y: Number(hallado[2]) };
}

function parrafo(texto: string) {
  return { type: 'paragraph', content: [{ type: 'text', text: texto }] };
}

/** Un diario de una sola anotacion con el contenido que se le pase. */
function conDiario(contenido: unknown, adjuntos: unknown[] = [], titulo: unknown = null) {
  return exportacion({
    entradasDeDiario: [
      { dia: '2026-10-03', titulo, contenido, adjuntos, creadaEn: '2026-10-03T20:15:00.000Z' },
    ],
  });
}

/** `veces` envolturas sin significado alrededor de `interior`: solo gastan profundidad. */
function envolver(interior: unknown, veces: number): unknown {
  let actual = interior;

  for (let i = 0; i < veces; i += 1) {
    actual = { type: 'caja', content: [actual] };
  }

  return actual;
}

describe('generarLaExportacionEnPdf', () => {
  describe('el documento', () => {
    it('es un PDF con la banda de marca y el nombre de la app', () => {
      const pdf = generarLaExportacionEnPdf(exportacion());

      expect(pdf.startsWith('%PDF-1.4\n')).toBe(true);
      expect(pdf.endsWith('%%EOF\n')).toBe(true);
      // La banda de borde a borde, en el verde de la marca (#3d7a6b), con su nombre en blanco.
      expect(pdf).toMatch(/0\.24 0\.48 0\.42 rg 0 [\d.]+ 595\.28 [\d.]+ re f/);
      expect(textoDe(pdf)).toContain('VSD Health Tus datos');
    });

    it('la portada lleva el logo de VSD Health, junto al nombre (SCRUM-247)', () => {
      const pdf = generarLaExportacionEnPdf(exportacion());

      // El pulso del isotipo (trazo redondeado) y el nombre, corrido a la derecha del logo.
      expect(pdf).toContain('1 J 1 j');
      expect(pdf).toMatch(/1 0 0 1 120 [\d.]+ Tm \(VSD Health\) Tj/);
    });

    it('lo que sale es ASCII puro, aunque lo escrito no lo sea', () => {
      const pdf = generarLaExportacionEnPdf(exportacion());

      // eslint-disable-next-line no-control-regex
      expect(pdf).toMatch(/^[\x09\x0a\x0d\x20-\x7e]*$/);
    });

    it('se llama como un archivo de datos propios', () => {
      expect(NOMBRE_DEL_PDF).toBe('vsd-health-mis-datos.pdf');
    });

    it('dice cuando se genero, en la zona horaria de la persona', () => {
      const texto = textoDe(generarLaExportacionEnPdf(exportacion()));

      // 23:30 UTC es las 18:30 en Bogota.
      expect(texto).toContain('13/10/2026 18:30');
      expect(texto).toContain('America/Bogota');
    });
  });

  describe('lo que dice de la persona', () => {
    it('su cuenta: nombre, correo, fecha de nacimiento y desde cuando', () => {
      const texto = textoDe(generarLaExportacionEnPdf(exportacion()));

      expect(texto).toContain('Ana María');
      expect(texto).toContain('ana@example.com');
      // El dia de nacimiento es un dia, no un instante: no se corre por la zona horaria.
      expect(texto).toContain('14/02/1998');
      expect(texto).toContain('01/09/2026');
    });

    it('lo que acepto, version por version', () => {
      const texto = textoDe(generarLaExportacionEnPdf(exportacion()));

      expect(texto).toContain('Aviso de privacidad');
      expect(texto).toContain('Términos');
      expect(texto).toContain('2026-10-1');
    });

    it('sus actividades, con el nombre del catalogo y su dia segun su zona horaria', () => {
      const texto = textoDe(generarLaExportacionEnPdf(exportacion(), { actividades: ACTIVIDADES }));

      expect(texto).toContain('Memoria de trabajo');
      expect(texto).toContain('Favorable');
      expect(texto).toContain('04/10/2026 22:30');
      expect(texto).toMatch(/nunca un diagn/i);
    });

    it('sin el catalogo (sin conexion) las actividades siguen saliendo, sin su nombre', () => {
      const texto = textoDe(generarLaExportacionEnPdf(exportacion()));

      expect(texto).toContain('Actividad');
      expect(texto).toContain('Favorable');
    });

    it('sus pendientes del semaforo, con su estado y su limite', () => {
      const texto = textoDe(generarLaExportacionEnPdf(exportacion()));

      expect(texto).toContain('Llamar a la médica (urgente)');
      expect(texto).toContain('Urgente');
      expect(texto).toContain('Por hacer');
      expect(texto).toContain('20/10/2026');
    });

    it('sus avisos y el ultimo dato curioso que vio', () => {
      const texto = textoDe(generarLaExportacionEnPdf(exportacion()));

      expect(texto).toContain('08:00');
      expect(texto).toContain('Dos veces al día');
      expect(texto).toContain('Los pulpos tienen tres corazones.');
    });
  });

  describe('el diario', () => {
    it('sale con su dia, su titulo y su texto, con los emojis dichos y sin perder el resto', () => {
      const texto = textoDe(generarLaExportacionEnPdf(exportacion()));

      expect(texto).toContain('03/10/2026');
      expect(texto).toContain('Un buen día [emoji]');
      expect(texto).toContain('Hoy salí a caminar con calma [emoji].');
      expect(texto).toContain('Primero');
      expect(texto).toContain('Segundo');
    });

    it('lo que va en negrita sale en negrita', () => {
      const pdf = generarLaExportacionEnPdf(exportacion());

      expect(pdf).toMatch(/\/F2 [\d.]+ Tf 1 0 0 1 [\d.]+ [\d.]+ Tm \(calma\) Tj/);
    });

    it('las listas llevan su vineta', () => {
      const pdf = generarLaExportacionEnPdf(exportacion());

      // La vineta (•) es el byte 0x95 de WinAnsi, en octal 225.
      expect(pdf).toMatch(/Tm \(\\225\) Tj/);
    });

    it('avisa de los diagramas y dice donde estan', () => {
      const texto = textoDe(generarLaExportacionEnPdf(exportacion()));

      expect(texto).toMatch(/1 diagrama/);
      expect(texto).toMatch(/archivo JSON/);
    });

    it('un diario sin anotaciones lo dice con calma', () => {
      const texto = textoDe(generarLaExportacionEnPdf(exportacion({ entradasDeDiario: [] })));

      expect(texto).toContain('Todavía no has escrito en tu diario.');
    });

    it('un texto con simbolos de programacion o de PDF se lee como texto', () => {
      const pdf = generarLaExportacionEnPdf(
        exportacion({
          entradasDeDiario: [
            {
              dia: '2026-10-03',
              titulo: null,
              contenido: documento('<script>alert(1)</script> ) (\\ Tj ET'),
              adjuntos: [],
              creadaEn: '2026-10-03T20:15:00.000Z',
            },
          ],
        }),
      );

      expect(textoDe(pdf)).toContain('<script>alert(1)</script> ) (\\ Tj ET');
    });

    it('un diario enorme no lo rompe: sigue en otras paginas', () => {
      const entradas = Array.from({ length: 60 }, (_, i) => ({
        dia: '2026-10-03',
        titulo: `Dia ${i} 😀`,
        contenido: documento('palabra '.repeat(150), '🌳'.repeat(30)),
        adjuntos: [],
        creadaEn: '2026-10-03T20:15:00.000Z',
      }));
      const pdf = generarLaExportacionEnPdf(exportacion({ entradasDeDiario: entradas }));

      expect(Number(/\/Count (\d+)/.exec(pdf)?.[1])).toBeGreaterThan(5);
      expect(textoDe(pdf)).toContain('Dia 59 [emoji]');
    });
  });

  describe('lo que NO sale', () => {
    it('ni los identificadores internos ni los bytes de la foto', () => {
      const pdf = generarLaExportacionEnPdf(exportacion());
      const texto = textoDe(pdf);

      expect(pdf).not.toContain(CUENTA_ID);
      expect(pdf).not.toContain(ENTRADA_ID);
      expect(pdf).not.toContain(FOTO_EN_BASE64);
      expect(texto).not.toContain('contenidoBase64');
    });

    it('dice que la foto, la mascota y los diagramas estan en el JSON, completos', () => {
      const texto = textoDe(generarLaExportacionEnPdf(exportacion()));

      expect(texto).toMatch(/foto de perfil/i);
      expect(texto).toMatch(/archivo JSON/);
    });

    it('nada que apure ni que reproche', () => {
      const texto = textoDe(generarLaExportacionEnPdf(exportacion()));

      expect(texto).not.toMatch(/debes|tienes que|obligatori|no olvides|perd|castig/i);
    });
  });

  describe('lo que este equipo todavia no ha enviado', () => {
    it('sale aparte, con lo escrito, para que la exportacion sea todo lo que se guarda', () => {
      const pdf = generarLaExportacionEnPdf(
        exportacion({
          sinEnviarDesdeEsteEquipo: [
            {
              operationId: 'op-1',
              tipo: 'diario.escribir',
              estado: 'pendiente',
              creadaEn: '2026-10-13T12:00:00.000Z',
              contenido: {
                titulo: 'Sin conexión',
                contenido: documento('Esto lo escribí sin red 🙂'),
                adjuntos: [],
              },
            },
            {
              operationId: 'op-2',
              tipo: 'pendiente.crear',
              estado: 'requiere_atencion',
              creadaEn: '2026-10-13T13:00:00.000Z',
              contenido: { texto: 'Comprar pan' },
            },
          ],
        }),
      );
      const texto = textoDe(pdf);

      expect(texto).toMatch(/todav.a no se han enviado/i);
      expect(texto).toContain('Anotación del diario');
      expect(texto).toContain('Esto lo escribí sin red [emoji]');
      expect(texto).toContain('Pendiente nuevo');
      expect(texto).toContain('Comprar pan');
    });

    it('si no hay nada sin enviar, no abre la seccion', () => {
      const texto = textoDe(generarLaExportacionEnPdf(exportacion()));

      expect(texto).not.toMatch(/no se han enviado/i);
    });
  });

  describe('el diario, bloque por bloque', () => {
    const item = (...hijos: unknown[]) => ({ type: 'listItem', content: hijos });

    it('una lista numerada cuenta desde 1, o desde donde diga el editor', () => {
      const desde1 = generarLaExportacionEnPdf(
        conDiario({
          type: 'doc',
          content: [{ type: 'orderedList', content: [item(parrafo('uno')), item(parrafo('dos'))] }],
        }),
      );
      const desde5 = generarLaExportacionEnPdf(
        conDiario({
          type: 'doc',
          content: [
            {
              type: 'orderedList',
              attrs: { start: 5 },
              content: [item(parrafo('uno')), item(parrafo('dos'))],
            },
          ],
        }),
      );

      expect(desde1).toMatch(/Tm \(1\.\) Tj/);
      expect(desde1).toMatch(/Tm \(2\.\) Tj/);
      expect(desde5).toMatch(/Tm \(5\.\) Tj/);
      expect(desde5).toMatch(/Tm \(6\.\) Tj/);
      expect(desde5).not.toMatch(/Tm \(1\.\) Tj/);
    });

    it.each([
      ['un decimal', 2.5],
      ['un texto', '7'],
      ['nada', null],
    ])('si el inicio de la lista es %s, cuenta desde 1', (_nombre, inicio) => {
      const pdf = generarLaExportacionEnPdf(
        conDiario({
          type: 'doc',
          content: [
            {
              type: 'orderedList',
              attrs: { start: inicio },
              content: [item(parrafo('uno'))],
            },
          ],
        }),
      );

      expect(pdf).toMatch(/Tm \(1\.\) Tj/);
    });

    it('un elemento sin texto no se pinta, pero ocupa su numero', () => {
      const pdf = generarLaExportacionEnPdf(
        conDiario({
          type: 'doc',
          content: [{ type: 'orderedList', content: [item(), item(parrafo('segundo'))] }],
        }),
      );

      expect(pdf).toMatch(/Tm \(2\.\) Tj/);
      expect(pdf).not.toMatch(/Tm \(1\.\) Tj/);
    });

    it('las vinetas no usan el numero de inicio', () => {
      const pdf = generarLaExportacionEnPdf(
        conDiario({
          type: 'doc',
          content: [{ type: 'bulletList', attrs: { start: 9 }, content: [item(parrafo('uno'))] }],
        }),
      );

      expect(pdf).toMatch(/Tm \(\\225\) Tj/);
      expect(pdf).not.toMatch(/Tm \(9\.\) Tj/);
    });

    it('las citas y las listas se corren hacia la derecha, y cada nivel un poco mas', () => {
      const pdf = generarLaExportacionEnPdf(
        conDiario({
          type: 'doc',
          content: [
            parrafo('afuera'),
            { type: 'blockquote', content: [parrafo('cita')] },
            {
              type: 'bulletList',
              content: [
                item(parrafo('padre'), {
                  type: 'bulletList',
                  content: [item(parrafo('hijo'))],
                }),
              ],
            },
          ],
        }),
      );
      const afuera = lugarDe(pdf, 'afuera').x;
      const padre = lugarDe(pdf, 'padre').x;

      expect(lugarDe(pdf, 'cita').x - afuera).toBe(16);
      expect(padre - afuera).toBe(22);
      expect(lugarDe(pdf, 'hijo').x - padre).toBe(22);
    });

    it('un titulo dentro del texto sale en negrita; un parrafo, no', () => {
      const pdf = generarLaExportacionEnPdf(
        conDiario({
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'titular' }] },
            parrafo('corriente'),
          ],
        }),
      );

      expect(pdf).toMatch(/\/F2 [\d.]+ Tf 1 0 0 1 [\d.]+ [\d.]+ Tm \(titular\) Tj/);
      expect(pdf).not.toMatch(/\/F2 [\d.]+ Tf 1 0 0 1 [\d.]+ [\d.]+ Tm \(corriente\) Tj/);
    });

    it('un bloque de codigo se lee como texto', () => {
      const texto = textoDe(
        generarLaExportacionEnPdf(
          conDiario({
            type: 'doc',
            content: [{ type: 'codeBlock', content: [{ type: 'text', text: 'let a = 1;' }] }],
          }),
        ),
      );

      expect(texto).toContain('let a = 1;');
    });

    it('un salto de linea baja a otra linea', () => {
      const conSalto = generarLaExportacionEnPdf(
        conDiario({
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'arriba' },
                { type: 'hardBreak' },
                { type: 'text', text: 'abajo' },
              ],
            },
          ],
        }),
      );
      const sinSalto = generarLaExportacionEnPdf(
        conDiario({
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'arriba ' },
                { type: 'text', text: 'abajo' },
              ],
            },
          ],
        }),
      );

      expect(lugarDe(conSalto, 'abajo').y).toBeLessThan(lugarDe(conSalto, 'arriba').y);
      expect(lugarDe(sinSalto, 'abajo').y).toBe(lugarDe(sinSalto, 'arriba').y);
    });

    it('una linea en blanco no deja hueco', () => {
      const conBlanco = generarLaExportacionEnPdf(
        conDiario({
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'hardBreak' }, { type: 'text', text: '  ' }, { type: 'hardBreak' }],
            },
            parrafo('suelta'),
          ],
        }),
      );
      const sinBlanco = generarLaExportacionEnPdf(conDiario(documento('suelta')));

      expect(lugarDe(conBlanco, 'suelta').y).toBe(lugarDe(sinBlanco, 'suelta').y);
    });

    it('las lineas horizontales, los diagramas y los saltos sueltos no dejan texto', () => {
      const texto = textoDe(
        generarLaExportacionEnPdf(
          conDiario({
            type: 'doc',
            content: [
              { type: 'horizontalRule', content: [{ type: 'text', text: 'REGLA' }] },
              { type: 'diagrama', content: [{ type: 'text', text: 'DIBUJO' }] },
              { type: 'hardBreak', content: [{ type: 'text', text: 'SALTO' }] },
              parrafo('Si sale'),
            ],
          }),
        ),
      );

      expect(texto).toContain('Si sale');
      expect(texto).not.toMatch(/REGLA|DIBUJO|SALTO/);
    });

    it('un bloque que no se conoce deja el texto que lleve dentro', () => {
      const texto = textoDe(
        generarLaExportacionEnPdf(
          conDiario({
            type: 'doc',
            content: [
              { type: 'seccion-nueva', content: [parrafo('dentro de algo nuevo')] },
              { type: 'text', text: 'texto suelto' },
            ],
          }),
        ),
      );

      expect(texto).toContain('dentro de algo nuevo');
      expect(texto).toContain('texto suelto');
    });

    // Un diario real no llega ni cerca: el limite solo frena lo que llegue a modo de ataque.
    it('los bloques hasta 40 niveles de hondo se leen; los de mas abajo, no', () => {
      const hasta = generarLaExportacionEnPdf(
        conDiario({ type: 'doc', content: [envolver(parrafo('hondo'), 39)] }),
      );
      const mas = generarLaExportacionEnPdf(
        conDiario({ type: 'doc', content: [envolver(parrafo('hondo'), 40)] }),
      );

      expect(textoDe(hasta)).toContain('hondo');
      expect(textoDe(mas)).not.toContain('hondo');
    });

    it('el texto en linea hasta 40 niveles de hondo se lee; el de mas abajo, no', () => {
      const hasta = generarLaExportacionEnPdf(
        conDiario({
          type: 'doc',
          content: [
            { type: 'paragraph', content: [envolver({ type: 'text', text: 'hondo' }, 39)] },
          ],
        }),
      );
      const mas = generarLaExportacionEnPdf(
        conDiario({
          type: 'doc',
          content: [
            { type: 'paragraph', content: [envolver({ type: 'text', text: 'hondo' }, 40)] },
          ],
        }),
      );

      expect(textoDe(hasta)).toContain('hondo');
      expect(textoDe(mas)).not.toContain('hondo');
    });
  });

  describe('cada anotacion del diario', () => {
    it('con mas de un diagrama dice cuantos son', () => {
      const texto = textoDe(
        generarLaExportacionEnPdf(conDiario(documento('hola'), [{ tipo: 'diagrama' }, {}, 3])),
      );

      expect(texto).toContain('Esta anotación tiene 3 diagramas; están en el archivo JSON.');
    });

    it('con un solo diagrama lo dice en singular', () => {
      const texto = textoDe(generarLaExportacionEnPdf(conDiario(documento('hola'), [{}])));

      expect(texto).toContain('Esta anotación tiene 1 diagrama; está en el archivo JSON.');
    });

    it('sin diagramas no dice nada de ellos', () => {
      const texto = textoDe(generarLaExportacionEnPdf(conDiario(documento('hola'))));

      expect(texto).not.toContain('Esta anotación tiene');
    });

    it('sin titulo, la cabecera es solo el dia', () => {
      const texto = textoDe(generarLaExportacionEnPdf(conDiario(documento('hola'))));

      expect(texto).toContain('03/10/2026 Escrita el');
    });

    it('sin texto lo dice, en vez de dejar un hueco', () => {
      const texto = textoDe(generarLaExportacionEnPdf(conDiario({ type: 'doc', content: [] })));

      expect(texto).toContain('Sin texto.');
    });

    it('con texto no dice «Sin texto»', () => {
      const texto = textoDe(generarLaExportacionEnPdf(conDiario(documento('hola'))));

      expect(texto).not.toContain('Sin texto.');
    });
  });

  describe('lo que aceptaste cuando falta el registro nuevo', () => {
    function sinRegistro(consentimiento: unknown) {
      const base = exportacion();

      return exportacion({
        consentimientos: [],
        cuenta: { ...(base.cuenta as object), consentimiento },
      });
    }

    it('la version del aviso que guarda la cuenta sale como aceptada', () => {
      const texto = textoDe(
        generarLaExportacionEnPdf(
          sinRegistro({ versionPolitica: '2026-09-1', aceptadoEn: '2026-09-01T15:00:00.000Z' }),
        ),
      );

      expect(texto).toContain('Aviso de privacidad 2026-09-1 01/09/2026 10:00');
      expect(texto).not.toContain('No hay aceptaciones registradas.');
    });

    it.each([
      ['la cuenta no guarda nada', null],
      ['la cuenta no tiene version', { aceptadoEn: '2026-09-01T15:00:00.000Z' }],
    ])('si %s, dice que no hay aceptaciones', (_nombre, consentimiento) => {
      const texto = textoDe(generarLaExportacionEnPdf(sinRegistro(consentimiento)));

      expect(texto).toContain('No hay aceptaciones registradas.');
    });

    it('con el registro nuevo, la version vieja de la cuenta no se repite', () => {
      const base = exportacion();
      const texto = textoDe(
        generarLaExportacionEnPdf({
          ...base,
          cuenta: {
            ...(base.cuenta as object),
            consentimiento: { versionPolitica: 'vieja-9', aceptadoEn: '2026-01-01T00:00:00.000Z' },
          },
        }),
      );

      expect(texto).not.toContain('vieja-9');
    });
  });

  describe('los pendientes y los avisos, con todas sus variantes', () => {
    it('un pendiente hecho, uno pospuesto y uno por hacer sin limite', () => {
      const texto = textoDe(
        generarLaExportacionEnPdf(
          exportacion({
            pendientes: [
              { texto: 'Pagar', nivel: 'prioridad', hecho: true, fechaLimite: null },
              {
                texto: 'Barrer',
                nivel: 'aplazable',
                hecho: false,
                posponerHasta: '2026-10-20T14:00:00.000Z',
                fechaLimite: '2026-11-02',
              },
              { texto: 'Cocinar', nivel: 'urgente', hecho: false, posponerHasta: null },
            ],
          }),
        ),
      );

      expect(texto).toContain('Pagar Prioridad Hecho');
      // El estado largo baja a otra linea de su celda, despues del limite de la fila.
      expect(texto).toContain('Barrer Aplazable Pospuesto hasta');
      expect(texto).toContain('02/11/2026');
      expect(texto).toContain('20/10/2026 09:00');
      expect(texto).toContain('Cocinar Urgente Por hacer');
    });

    it('un pendiente hecho no dice que este pospuesto', () => {
      const texto = textoDe(
        generarLaExportacionEnPdf(
          exportacion({
            pendientes: [
              {
                texto: 'Pagar',
                nivel: 'urgente',
                hecho: true,
                posponerHasta: '2026-10-20T14:00:00.000Z',
              },
            ],
          }),
        ),
      );

      expect(texto).not.toContain('Pospuesto');
    });

    it('sin pendientes lo dice con calma', () => {
      const texto = textoDe(generarLaExportacionEnPdf(exportacion({ pendientes: [] })));

      expect(texto).toContain('No tienes pendientes anotados.');
    });

    it('los avisos encendidos, con su hora', () => {
      const texto = textoDe(
        generarLaExportacionEnPdf(
          exportacion({
            avisos: {
              horaSemaforo: '07:30',
              frecuenciaSemaforo: 'manana',
              horaRacha: '21:15',
              recordatorioManana: true,
              recordatorioNoche: true,
              navegadores: 2,
            },
          }),
        ),
      );

      expect(texto).toContain('Semáforo 07:30');
      expect(texto).toContain('Solo en la mañana');
      expect(texto).toContain('Racha 21:15');
      expect(texto).toContain('Recordatorio de la mañana Activado');
      expect(texto).toContain('Recordatorio de la noche Activado');
      expect(texto).toContain('Navegadores con avisos 2');
    });

    it('los avisos apagados y sin hora', () => {
      const texto = textoDe(
        generarLaExportacionEnPdf(
          exportacion({
            avisos: {
              horaSemaforo: null,
              frecuenciaSemaforo: 'noche',
              horaRacha: null,
              recordatorioManana: false,
              recordatorioNoche: false,
              navegadores: 0,
            },
          }),
        ),
      );

      expect(texto).toContain('Semáforo Sin hora');
      expect(texto).toContain('Solo en la noche');
      expect(texto).toContain('Racha Sin hora');
      expect(texto).toContain('Recordatorio de la mañana Apagado');
      expect(texto).toContain('Recordatorio de la noche Apagado');
      expect(texto).toContain('Navegadores con avisos 0');
    });

    it('unos avisos que no dicen cuantos navegadores hay no inventan el numero', () => {
      const texto = textoDe(generarLaExportacionEnPdf(exportacion({ avisos: {} })));

      expect(texto).toContain('Navegadores con avisos');
      expect(texto).not.toContain('undefined');
    });

    it('un dato curioso sin texto no abre su seccion', () => {
      const texto = textoDe(
        generarLaExportacionEnPdf(exportacion({ datoCurioso: { dia: '2026-10-13' } })),
      );

      expect(texto).not.toContain('El último dato curioso que viste');
    });
  });

  describe('cada cambio que sigue sin enviarse', () => {
    const creadaEn = '2026-10-13T12:00:00.000Z';

    function sinEnviar(...cambios: Record<string, unknown>[]) {
      return textoDe(generarLaExportacionEnPdf(exportacion({ sinEnviarDesdeEsteEquipo: cambios })));
    }

    it('una correccion del diario lleva su titulo y su texto', () => {
      const pdf = generarLaExportacionEnPdf(
        exportacion({
          sinEnviarDesdeEsteEquipo: [
            {
              tipo: 'diario.editar',
              estado: 'enviando',
              creadaEn,
              contenido: { titulo: 'Mi titulo', contenido: documento('Texto corregido') },
            },
          ],
        }),
      );
      const texto = textoDe(pdf);

      expect(texto).toContain('Corrección de una anotación del diario');
      expect(texto).toContain('Enviándose');
      expect(texto).toContain('Texto corregido');
      expect(pdf).toMatch(/\/F2 [\d.]+ Tf 1 0 0 1 [\d.]+ [\d.]+ Tm \(titulo\) Tj/);
    });

    it('una anotacion sin titulo solo lleva su texto', () => {
      const pdf = generarLaExportacionEnPdf(
        exportacion({
          sinEnviarDesdeEsteEquipo: [
            {
              tipo: 'diario.escribir',
              estado: 'pendiente',
              creadaEn,
              contenido: { contenido: documento('Solo texto') },
            },
          ],
        }),
      );

      expect(textoDe(pdf)).toContain('Solo texto');
      expect(textoDe(pdf)).not.toContain('undefined');
    });

    it('un pendiente editado lleva su texto', () => {
      const texto = sinEnviar({
        tipo: 'pendiente.editar',
        estado: 'conflicto',
        creadaEn,
        contenido: { texto: 'Comprar leche' },
      });

      expect(texto).toContain('Cambio en un pendiente');
      expect(texto).toContain('Chocó con un cambio de otro dispositivo');
      expect(texto).toContain('Comprar leche');
    });

    it('el nombre del cambio va en negrita y lo escrito, corrido bajo el', () => {
      const pdf = generarLaExportacionEnPdf(
        exportacion({
          sinEnviarDesdeEsteEquipo: [
            {
              tipo: 'pendiente.editar',
              estado: 'pendiente',
              creadaEn,
              contenido: { texto: 'Comprar' },
            },
            {
              tipo: 'diario.escribir',
              estado: 'pendiente',
              creadaEn,
              contenido: { titulo: 'Titulito', contenido: documento('Parrafito') },
            },
          ],
        }),
      );
      const delPendiente = lugarDe(pdf, 'Cambio').x;
      // «Anotación» lleva la o con tilde, que en el PDF se escribe \363.
      const delDiario = lugarDe(pdf, String.raw`Anotaci\\363n`).x;

      expect(pdf).toMatch(/\/F2 [\d.]+ Tf 1 0 0 1 [\d.]+ [\d.]+ Tm \(Cambio\) Tj/);
      expect(lugarDe(pdf, 'Comprar').x - delPendiente).toBe(14);
      expect(lugarDe(pdf, 'Titulito').x - delDiario).toBe(14);
      expect(lugarDe(pdf, 'Parrafito').x - delDiario).toBe(14);
    });

    it('un pendiente sin texto solo dice que existe', () => {
      const texto = sinEnviar({
        tipo: 'pendiente.crear',
        estado: 'pendiente',
        creadaEn,
        contenido: {},
      });

      expect(texto).toContain('Pendiente nuevo');
      expect(texto).toContain('Pendiente de enviar');
    });

    it('de lo demas solo se dice que hay un cambio, nunca su contenido', () => {
      const texto = sinEnviar(
        {
          tipo: 'resultado.registrar',
          estado: 'pendiente',
          creadaEn,
          contenido: { metadata: { respuesta: 'confidencial' }, texto: 'tampoco esto' },
        },
        {
          tipo: 'pendiente.borrar',
          estado: 'pendiente',
          creadaEn,
          contenido: { texto: 'ni esto' },
        },
      );

      expect(texto).toContain('Resultado de una actividad');
      expect(texto).toContain('Pendiente borrado');
      expect(texto).not.toMatch(/confidencial|tampoco esto|ni esto/);
    });

    it('un tipo o un estado que no se conocen salen con su nombre, saneado', () => {
      const texto = sinEnviar({ tipo: 'inventado', estado: 'raro 😀', creadaEn });

      expect(texto).toContain('Un cambio guardado en este equipo');
      expect(texto).toContain('raro [emoji]');
    });
  });

  describe('nunca se rompe por lo que llegue', () => {
    it.each([
      ['null', null],
      ['un texto', 'hola'],
      ['un numero', 42],
      ['una lista', []],
      ['un objeto vacio', {}],
      [
        'secciones con la forma equivocada',
        {
          cuenta: 'x',
          consentimientos: 'no es una lista',
          resultados: [null, 5, 'x', {}],
          entradasDeDiario: [null, { contenido: 5 }, { contenido: { type: 7 } }, { dia: 4 }],
          pendientes: {},
          avisos: [],
          datoCurioso: 3,
          sinEnviarDesdeEsteEquipo: [null, 'x', { tipo: 'no-existe' }],
        },
      ],
    ])('%s da un PDF valido', (_nombre, entrada) => {
      const pdf = generarLaExportacionEnPdf(entrada);

      expect(pdf.startsWith('%PDF-1.4\n')).toBe(true);
      expect(pdf.endsWith('%%EOF\n')).toBe(true);
    });

    it('una fecha que no es una fecha sale tal cual, saneada', () => {
      const texto = textoDe(generarLaExportacionEnPdf(exportacion({ fechaNacimiento: 'ayer 😀' })));

      expect(texto).toContain('ayer [emoji]');
    });

    it('ningun campo del servidor, ni el mas inesperado, tira abajo la exportacion', () => {
      const pdf = generarLaExportacionEnPdf(
        exportacion({
          avisos: { horaSemaforo: '08:00 😀', horaRacha: '→', navegadores: 1 },
          cuenta: {
            nombre: '😀',
            correo: '→',
            zonaHoraria: 'America/Bogota',
            modulosActivos: ['😀', 7],
          },
          consentimientos: [{ tipo: '😀', version: '→', aceptadoEn: 'ayer 😀' }],
          pendientes: [{ texto: '😀', nivel: '→', hecho: false, fechaLimite: '😀' }],
          datoCurioso: { dia: '😀', texto: 'x 😀' },
        }),
      );

      expect(pdf.endsWith('%%EOF\n')).toBe(true);
      expect(textoDe(pdf)).toContain('08:00 [emoji]');
    });
    it('una zona horaria inventada no tira nada abajo: usa la hora universal', () => {
      const base = exportacion();
      const pdf = generarLaExportacionEnPdf({
        ...base,
        cuenta: { ...(base.cuenta as object), zonaHoraria: 'Marte/Olimpo' },
      });

      expect(textoDe(pdf)).toContain('13/10/2026 23:30');
    });
  });
});
