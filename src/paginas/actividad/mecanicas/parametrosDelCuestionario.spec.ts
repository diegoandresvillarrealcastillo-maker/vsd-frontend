import { describe, expect, it } from 'vitest';

import {
  GESTOS,
  PREGUNTAS,
  PREGUNTAS_CON_AYUDA,
  RUEDA,
  TARJETA,
} from '../../../pruebas/sesionesDeBienestar.ts';
import {
  leerLaRueda,
  leerLaTarjeta,
  leerLasPreguntas,
  leerLosGestos,
} from './parametrosDelCuestionario.ts';

/**
 * Lo que la pantalla lee de `sesion.parametros` en el cuestionario corto sin puntaje (SCRUM-227): devuelve `null`
 * ante una forma que no entiende, tolera lo que sobra y devuelve copias. Repite los limites del contrato del
 * dominio, y ninguna opcion lleva `valor`: lo que se responde no suma ni se interpreta (R7).
 */
describe.each([
  ['leerLaTarjeta', leerLaTarjeta, TARJETA],
  ['leerLosGestos', leerLosGestos, GESTOS],
  ['leerLasPreguntas', leerLasPreguntas, PREGUNTAS],
  ['leerLasPreguntas (con ayuda)', leerLasPreguntas, PREGUNTAS_CON_AYUDA],
  ['leerLaRueda', leerLaRueda, RUEDA],
] as const)('%s', (_nombre, leer, valida) => {
  it('lee la sesion que manda el servidor', () => {
    expect(leer(valida)).not.toBeNull();
  });

  it('tolera campos de mas y no devuelve la referencia que recibio', () => {
    const conDeMas = { ...valida, algoNuevo: { x: 1 } };
    const leida = leer(conDeMas);

    expect(leida).not.toBeNull();
    expect(leida).not.toBe(conDeMas);
    expect(leida).not.toHaveProperty('algoNuevo');
  });

  it.each([undefined, null, 'texto', 7, [], {}])(
    'ante %j no la entiende y devuelve null',
    (valor) => {
      expect(leer(valor)).toBeNull();
    },
  );

  it('rechaza el modo de otra pantalla, y el cuestionario con puntaje (sin modo)', () => {
    expect(leer({ ...valida, modo: 'otro' })).toBeNull();

    const { modo: _quitado, ...sinModo } = valida;

    expect(leer(sinModo)).toBeNull();
  });

  it('rechaza un cierre o una nota que no son texto', () => {
    expect(leer({ ...valida, cierre: 7 })).toBeNull();
    expect(leer({ ...valida, nota: '' })).toBeNull();
  });
});

describe('leerLaTarjeta', () => {
  it('lee la practica, su por que y las opciones, sin ningun valor', () => {
    const leida = leerLaTarjeta(TARJETA);

    expect(leida?.titulo).toBe('Apagar las pantallas un rato antes de dormir');
    expect(leida?.porQue).toBe('La luz de las pantallas puede hacer que cueste más dormirse.');
    expect(leida?.opciones.map((una) => una.clave)).toEqual(['si', 'luego', 'no']);
    expect(JSON.stringify(leida)).not.toMatch(/valor|puntaje/);
  });

  it('el por que, la indicacion y la nota son opcionales y no aparecen si no estan', () => {
    const { porQue: _a, indicacion: _b, nota: _c, cierre: _d, ...minima } = TARJETA;
    const leida = leerLaTarjeta(minima);

    expect(leida).not.toBeNull();
    expect(leida).not.toHaveProperty('porQue');
    expect(leida).not.toHaveProperty('indicacion');
    expect(leida).not.toHaveProperty('nota');
    expect(leida).not.toHaveProperty('cierre');
  });

  it('pide entre 2 y 4 opciones, sin claves ni textos repetidos', () => {
    expect(leerLaTarjeta({ ...TARJETA, opciones: TARJETA.opciones.slice(0, 1) })).toBeNull();
    expect(
      leerLaTarjeta({
        ...TARJETA,
        opciones: [...TARJETA.opciones, { clave: 'a', texto: 'A' }, { clave: 'b', texto: 'B' }],
      }),
    ).toBeNull();
    expect(
      leerLaTarjeta({
        ...TARJETA,
        opciones: [TARJETA.opciones[0], { ...TARJETA.opciones[1], clave: 'si' }],
      }),
    ).toBeNull();
    expect(
      leerLaTarjeta({
        ...TARJETA,
        opciones: [TARJETA.opciones[0], { ...TARJETA.opciones[1], texto: ' LO PROBÉ HOY ' }],
      }),
    ).toBeNull();
  });

  it('rechaza una tarjeta sin titulo o sin texto', () => {
    expect(leerLaTarjeta({ ...TARJETA, titulo: ' ' })).toBeNull();
    expect(leerLaTarjeta({ ...TARJETA, texto: undefined })).toBeNull();
  });
});

describe('leerLosGestos', () => {
  it('pide entre 3 y 6 gestos, sin repetir', () => {
    expect(leerLosGestos({ ...GESTOS, items: GESTOS.items.slice(0, 2) })).toBeNull();
    expect(
      leerLosGestos({
        ...GESTOS,
        items: [
          ...GESTOS.items,
          { clave: 'a', texto: 'A' },
          { clave: 'b', texto: 'B' },
          { clave: 'c', texto: 'C' },
        ],
      }),
    ).toBeNull();
    expect(
      leerLosGestos({
        ...GESTOS,
        items: [GESTOS.items[0], GESTOS.items[1], { ...GESTOS.items[2], clave: 'luz' }],
      }),
    ).toBeNull();
  });

  it('rechaza una indicacion vacia', () => {
    expect(leerLosGestos({ ...GESTOS, indicacion: '' })).toBeNull();
  });
});

describe('leerLasPreguntas', () => {
  it('lee los tres tipos de pregunta, y la de hora sin opciones', () => {
    const leidas = leerLasPreguntas(PREGUNTAS);

    expect(leidas?.preguntas.map((una) => una.tipo)).toEqual(['hora', 'opcion', 'varias']);
    expect(leidas?.preguntas[0]).not.toHaveProperty('opciones');
    expect(leidas?.preguntas[0]?.pista).toBe('Una hora aproximada.');
    expect(leidas?.enlaceAlAviso).toBe(true);
    expect(leidas?.conLineasDeAyuda).toBe(false);
  });

  it('trae el aviso de siempre y el acceso a las lineas cuando la sesion lo pide', () => {
    const leidas = leerLasPreguntas(PREGUNTAS_CON_AYUDA);

    expect(leidas?.avisoSiempre).toBe('Si lo necesitas, hay personas que pueden acompañarte.');
    expect(leidas?.conLineasDeAyuda).toBe(true);
    expect(leidas?.enlaceAlAviso).toBe(false);
  });

  it('una pregunta de hora no lleva opciones; las otras dos las necesitan', () => {
    const [hora, opcion, varias] = PREGUNTAS.preguntas;

    expect(
      leerLasPreguntas({
        ...PREGUNTAS,
        preguntas: [{ ...hora, opciones: opcion?.opciones }, opcion, varias],
      }),
    ).toBeNull();
    expect(
      leerLasPreguntas({
        ...PREGUNTAS,
        preguntas: [hora, { ...opcion, opciones: undefined }, varias],
      }),
    ).toBeNull();
    expect(
      leerLasPreguntas({
        ...PREGUNTAS,
        preguntas: [hora, { ...opcion, opciones: opcion?.opciones?.slice(0, 1) }, varias],
      }),
    ).toBeNull();
  });

  it('rechaza un tipo de pregunta que no existe, o claves repetidas', () => {
    const [hora, opcion, varias] = PREGUNTAS.preguntas;

    expect(
      leerLasPreguntas({ ...PREGUNTAS, preguntas: [{ ...hora, tipo: 'abierta' }, opcion, varias] }),
    ).toBeNull();
    expect(
      leerLasPreguntas({ ...PREGUNTAS, preguntas: [hora, { ...opcion, clave: 'hora' }, varias] }),
    ).toBeNull();
  });

  it('pide entre 1 y 6 preguntas', () => {
    expect(leerLasPreguntas({ ...PREGUNTAS, preguntas: [] })).toBeNull();
    expect(
      leerLasPreguntas({
        ...PREGUNTAS,
        preguntas: Array.from({ length: 7 }, (_, i) => ({
          clave: `p${String(i)}`,
          texto: 'Hora',
          tipo: 'hora',
        })),
      }),
    ).toBeNull();
  });

  it('las lineas de atencion piden su frase, y los banderines son un si o un no', () => {
    const { avisoSiempre: _quitado, ...sinAviso } = PREGUNTAS_CON_AYUDA;

    expect(leerLasPreguntas(sinAviso)).toBeNull();
    expect(leerLasPreguntas({ ...PREGUNTAS, conLineasDeAyuda: 'si' })).toBeNull();
    expect(leerLasPreguntas({ ...PREGUNTAS, enlaceAlAviso: 'si' })).toBeNull();
  });
});

describe('leerLaRueda', () => {
  it('lee la puerta, los tres niveles y la linea opcional', () => {
    const leida = leerLaRueda(RUEDA);

    expect(leida?.puerta.titulo).toBe('Ponerle nombre');
    expect(leida?.rueda.map((nodo) => nodo.clave)).toEqual(['alegria', 'tristeza']);
    expect(leida?.rueda[0]?.hijos?.[0]?.hijos?.[0]).toEqual({
      clave: 'calma',
      nombre: 'Calma',
      definicion: 'Calma: sentir que todo está en su lugar.',
    });
    expect(leida?.linea).toEqual({
      invitacion: 'Si quieres, cuéntalo en una línea.',
      largoMaximo: 160,
    });
  });

  it('la linea es opcional', () => {
    const { linea: _quitada, ...sinLinea } = RUEDA;

    expect(leerLaRueda(sinLinea)).not.toHaveProperty('linea');
  });

  it('rechaza una linea con un largo fuera de 50 a 500', () => {
    expect(leerLaRueda({ ...RUEDA, linea: { invitacion: 'Algo', largoMaximo: 20 } })).toBeNull();
    expect(leerLaRueda({ ...RUEDA, linea: { invitacion: 'Algo', largoMaximo: 501 } })).toBeNull();
    expect(leerLaRueda({ ...RUEDA, linea: 'texto' })).toBeNull();
  });

  it('rechaza una rueda sin puerta, o con la puerta a medias', () => {
    const { puerta: _quitada, ...sinPuerta } = RUEDA;

    expect(leerLaRueda(sinPuerta)).toBeNull();
    expect(leerLaRueda({ ...RUEDA, puerta: { titulo: 'Ponerle nombre' } })).toBeNull();
  });

  it('una emocion (una hoja) lleva su definicion: es la que se lee al elegirla', () => {
    const rueda = structuredClone(RUEDA);
    const hoja = rueda.rueda[0]?.hijos?.[0]?.hijos?.[0] as Record<string, unknown>;

    delete hoja.definicion;

    expect(leerLaRueda(rueda)).toBeNull();
  });

  it('las claves son unicas en toda la rueda, no solo entre hermanas', () => {
    const rueda = structuredClone(RUEDA);
    const hoja = rueda.rueda[1]?.hijos?.[1]?.hijos?.[0] as Record<string, unknown>;

    hoja.clave = 'CALMA';

    expect(leerLaRueda(rueda)).toBeNull();
  });

  it('ningun nivel pasa de tres', () => {
    const rueda = structuredClone(RUEDA);
    const hoja = rueda.rueda[0]?.hijos?.[0]?.hijos?.[0] as Record<string, unknown>;

    hoja.hijos = [
      { clave: 'x1', nombre: 'X1', definicion: 'Una.' },
      { clave: 'x2', nombre: 'X2', definicion: 'Otra.' },
    ];

    expect(leerLaRueda(rueda)).toBeNull();
  });

  it('cada nivel tiene de 2 a 8 nodos', () => {
    const rueda = structuredClone(RUEDA);
    const nodo = rueda.rueda[0]?.hijos?.[0] as Record<string, unknown>;

    nodo.hijos = (nodo.hijos as unknown[]).slice(0, 1);

    expect(leerLaRueda(rueda)).toBeNull();
    expect(leerLaRueda({ ...RUEDA, rueda: RUEDA.rueda.slice(0, 1) })).toBeNull();
  });
});
