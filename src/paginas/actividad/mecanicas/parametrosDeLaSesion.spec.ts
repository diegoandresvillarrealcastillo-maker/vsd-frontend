import { describe, expect, it } from 'vitest';

import {
  leerCuestionario,
  leerSecuenciaDeCasillas,
  maximoDelCuestionario,
  leerEscrituraDeUnCampo,
  leerSecuenciaDeNumeros,
  leerTocarElObjetivo,
} from './parametrosDeLaSesion.ts';

/**
 * Lo que el servidor manda en `sesion.parametros` (SCRUM-208), leido con cuidado.
 *
 * El servidor ya valida el contrato, pero lo que llega aqui puede ser una copia guardada por una
 * version anterior de la aplicacion, o de un servidor mas nuevo. Un `parametros` con una forma
 * inesperada **nunca rompe la pantalla**: la lectura devuelve `null` y la pantalla usa sus
 * valores de siempre.
 *
 * Los ejemplos son los de la migracion de la Fase 0 del backend, tal cual.
 */

const DIGITOS = Array.from({ length: 10 }, (_, i) => ({ clave: String(i), nombre: String(i) }));

const SECUENCIA = {
  casillas: DIGITOS,
  largoInicial: 3,
  rondas: 12,
  msPorElemento: 700,
  msDeMargen: 1000,
};

const DIFERENCIA = { rondas: 15, segundosPorRonda: 15, lados: [3, 4, 5] };

const COLORES = [
  { clave: 'circulo', nombre: 'círculo verde', forma: 'círculo', color: 'verde' },
  { clave: 'cuadrado', nombre: 'cuadrado azul', forma: 'cuadrado', color: 'azul' },
  { clave: 'triangulo', nombre: 'triángulo ámbar', forma: 'triángulo', color: 'ámbar' },
  { clave: 'rombo', nombre: 'rombo violeta', forma: 'rombo', color: 'violeta' },
];

/** Una sesion de «Recuerda los colores»: casillas que se iluminan una a una. */
const CASILLAS = {
  casillas: COLORES,
  largoInicial: 3,
  rondas: 12,
  msPorElemento: 1000,
  msDeMargen: 1000,
  msDestello: 700,
};

const CUESTIONARIO = {
  indicacion: 'Piensa solo en hoy. No hay respuestas buenas ni malas.',
  preguntas: [
    { clave: 'arrancar', texto: '¿Cuánto te costó arrancar el día?' },
    { clave: 'tension', texto: '¿Cuánta tensión has cargado hoy?' },
  ],
  opciones: [
    { valor: 0, texto: 'Nada' },
    { valor: 1, texto: 'Algo' },
    { valor: 2, texto: 'Mucho' },
  ],
};

const ESCRITURA = {
  invitacion: '¿Qué estuvo bien hoy?',
  ideas: ['Un café a buena hora', 'Una conversación bonita'],
  campos: 1,
  minimo: 1,
  largoMaximo: 500,
  permiteNingunaHoy: true,
};

/** Una copia de `base` con un campo cambiado. */
function con<T extends object>(base: T, cambios: Record<string, unknown>): unknown {
  return { ...base, ...cambios };
}

/** Una copia de `base` sin un campo. */
function sin<T extends object>(base: T, campo: string): unknown {
  const copia: Record<string, unknown> = { ...(base as Record<string, unknown>) };

  delete copia[campo];

  return copia;
}

const NO_ES_UN_OBJETO = [null, undefined, 7, 'texto', true, [], [1, 2]];

describe('leerSecuenciaDeNumeros', () => {
  it('lee la sesion de la Fase 0', () => {
    expect(leerSecuenciaDeNumeros(SECUENCIA)).toEqual({
      largoInicial: 3,
      rondas: 12,
      msPorElemento: 700,
      msDeMargen: 1000,
    });
  });

  it.each(NO_ES_UN_OBJETO)('devuelve null si no es un objeto: %j', (valor) => {
    expect(leerSecuenciaDeNumeros(valor)).toBeNull();
  });

  it.each(['casillas', 'largoInicial', 'rondas', 'msPorElemento', 'msDeMargen'])(
    'devuelve null si falta %s',
    (campo) => {
      expect(leerSecuenciaDeNumeros(sin(SECUENCIA, campo))).toBeNull();
    },
  );

  it.each([
    ['largoInicial', 0],
    ['largoInicial', 11],
    ['largoInicial', 2.5],
    ['largoInicial', '3'],
    ['rondas', 0],
    ['rondas', 51],
    ['rondas', Number.NaN],
    ['msPorElemento', 199],
    ['msPorElemento', 5001],
    ['msDeMargen', -1],
    ['msDeMargen', 10_001],
  ])('devuelve null si %s vale %j', (campo, valor) => {
    expect(leerSecuenciaDeNumeros(con(SECUENCIA, { [campo]: valor }))).toBeNull();
  });

  it.each([
    ['largoInicial', 1],
    ['largoInicial', 10],
    ['rondas', 1],
    ['rondas', 50],
    ['msPorElemento', 200],
    ['msPorElemento', 5000],
    ['msDeMargen', 0],
    ['msDeMargen', 10_000],
  ])('acepta el borde: %s vale %j', (campo, valor) => {
    expect(leerSecuenciaDeNumeros(con(SECUENCIA, { [campo]: valor }))).not.toBeNull();
  });

  it('devuelve null si las casillas no son los diez digitos: esta pantalla solo juega con digitos', () => {
    const colores = [
      { clave: 'circulo', nombre: 'círculo verde', forma: 'círculo', color: 'verde' },
      { clave: 'cuadrado', nombre: 'cuadrado azul', forma: 'cuadrado', color: 'azul' },
    ];

    expect(leerSecuenciaDeNumeros(con(SECUENCIA, { casillas: colores }))).toBeNull();
    expect(leerSecuenciaDeNumeros(con(SECUENCIA, { casillas: DIGITOS.slice(0, 9) }))).toBeNull();
    expect(leerSecuenciaDeNumeros(con(SECUENCIA, { casillas: 'cero' }))).toBeNull();
    // Diez casillas, pero falta el 9 (y hay una letra): no son los diez digitos.
    const conLetra = [...DIGITOS.slice(0, 9), { clave: 'a', nombre: 'a' }];
    // Los diez digitos y uno mas: sobra una.
    const conUnaDeMas = [...DIGITOS, { clave: 'a', nombre: 'a' }];

    expect(leerSecuenciaDeNumeros(con(SECUENCIA, { casillas: conLetra }))).toBeNull();
    expect(leerSecuenciaDeNumeros(con(SECUENCIA, { casillas: conUnaDeMas }))).toBeNull();
    expect(leerSecuenciaDeNumeros(con(SECUENCIA, { casillas: [null] }))).toBeNull();
  });

  it('tolera un parametro de mas, que un servidor mas nuevo podria mandar', () => {
    expect(leerSecuenciaDeNumeros(con(SECUENCIA, { msDestello: 700, otra: true }))).not.toBeNull();
  });
});

describe('leerSecuenciaDeCasillas', () => {
  it('lee la sesion de las casillas, con su forma, su nombre y su color', () => {
    expect(leerSecuenciaDeCasillas(CASILLAS)).toEqual({
      casillas: COLORES,
      largoInicial: 3,
      rondas: 12,
      msPorElemento: 1000,
      msDeMargen: 1000,
      msDestello: 700,
    });
  });

  it.each(NO_ES_UN_OBJETO)('devuelve null si no es un objeto: %j', (valor) => {
    expect(leerSecuenciaDeCasillas(valor)).toBeNull();
  });

  it.each([
    'casillas',
    'largoInicial',
    'rondas',
    'msPorElemento',
    'msDeMargen',
    // Sin destello es la secuencia de numeros, que muestra todos los digitos a la vez.
    'msDestello',
  ])('devuelve null si falta %s', (campo) => {
    expect(leerSecuenciaDeCasillas(sin(CASILLAS, campo))).toBeNull();
  });

  it.each([
    ['largoInicial', 0],
    ['largoInicial', 11],
    ['largoInicial', 2.5],
    ['rondas', 0],
    ['rondas', 51],
    ['msPorElemento', 199],
    ['msPorElemento', 5001],
    ['msDeMargen', -1],
    ['msDeMargen', 10_001],
    // La baranda de accesibilidad R10: una casilla que se ilumina menos de 600 ms no se alcanza a ver.
    ['msDestello', 599],
    ['msDestello', 5001],
    ['msDestello', '700'],
  ])('devuelve null si %s vale %j', (campo, valor) => {
    expect(leerSecuenciaDeCasillas(con(CASILLAS, { [campo]: valor }))).toBeNull();
  });

  it.each([
    ['largoInicial', 1],
    ['largoInicial', 10],
    ['rondas', 1],
    ['rondas', 50],
    ['msPorElemento', 5000],
    ['msDeMargen', 0],
    ['msDeMargen', 10_000],
    ['msDestello', 600],
  ])('acepta el borde: %s vale %j', (campo, valor) => {
    const base = con(CASILLAS, { msPorElemento: 5000 }) as Record<string, unknown>;

    expect(leerSecuenciaDeCasillas({ ...base, [campo]: valor })).not.toBeNull();
  });

  it('acepta el turno mas corto posible: 600 ms por casilla con un destello de 600', () => {
    expect(
      leerSecuenciaDeCasillas(con(CASILLAS, { msPorElemento: 600, msDestello: 600 })),
    ).not.toBeNull();
  });

  it('el destello cabe en el tiempo de cada casilla: si lo pasa, la siguiente no tendria su momento', () => {
    expect(
      leerSecuenciaDeCasillas(con(CASILLAS, { msPorElemento: 800, msDestello: 801 })),
    ).toBeNull();
    // Justo es posible: sin pausa entre una y otra.
    expect(
      leerSecuenciaDeCasillas(con(CASILLAS, { msPorElemento: 800, msDestello: 800 })),
    ).not.toBeNull();
  });

  it('la sesion lenta del piloto: iluminada 1.100 ms y 600 ms de pausa', () => {
    expect(
      leerSecuenciaDeCasillas(con(CASILLAS, { msPorElemento: 1700, msDestello: 1100 })),
    ).toMatchObject({ msPorElemento: 1700, msDestello: 1100 });
  });

  describe('las casillas', () => {
    const conCasillas = (casillas: unknown) => con(CASILLAS, { casillas });
    const letras = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        clave: `c${String(i)}`,
        nombre: `Casilla ${String(i)}`,
      }));

    it.each([
      ['no es una lista', 'cuatro'],
      ['es una sola', letras(1)],
      ['son 13', letras(13)],
      ['trae una que no es un objeto', [...letras(2), null]],
      ['trae una sin nombre', [...letras(2), { clave: 'x' }]],
      ['trae una sin clave', [...letras(2), { nombre: 'Sin clave' }]],
      ['trae un nombre vacio', [...letras(2), { clave: 'x', nombre: '  ' }]],
      ['repite la clave', [...letras(2), { clave: 'c0', nombre: 'Otra' }]],
      ['repite el nombre', [...letras(2), { clave: 'x', nombre: 'Casilla 0' }]],
      [
        'repite el nombre con otras mayusculas',
        [...letras(2), { clave: 'x', nombre: ' casilla 0 ' }],
      ],
      ['trae una forma que no es texto', [...letras(2), { clave: 'x', nombre: 'X', forma: 3 }]],
      ['trae una forma vacia', [...letras(2), { clave: 'x', nombre: 'X', forma: '' }]],
      [
        'trae un color que no es texto',
        [...letras(2), { clave: 'x', nombre: 'X', forma: 'cuadrado', color: 7 }],
      ],
      // R10: el color nunca es la unica pista.
      ['trae un color sin forma', [...letras(2), { clave: 'x', nombre: 'X', color: 'verde' }]],
    ])('devuelve null si %s', (_caso, casillas) => {
      expect(leerSecuenciaDeCasillas(conCasillas(casillas))).toBeNull();
    });

    it('acepta de 2 a 12 casillas', () => {
      expect(leerSecuenciaDeCasillas(conCasillas(letras(2)))).not.toBeNull();
      expect(leerSecuenciaDeCasillas(conCasillas(letras(12)))).not.toBeNull();
    });

    it('una forma sin color es posible: la casilla es de un solo tono', () => {
      const leida = leerSecuenciaDeCasillas(
        conCasillas([...letras(1), { clave: 'x', nombre: 'Estrella', forma: 'estrella' }]),
      );

      expect(leida?.casillas[1]).toEqual({ clave: 'x', nombre: 'Estrella', forma: 'estrella' });
    });

    it('sin forma ni color, es solo su nombre', () => {
      expect(leerSecuenciaDeCasillas(conCasillas(letras(2)))?.casillas[0]).toEqual({
        clave: 'c0',
        nombre: 'Casilla 0',
      });
    });

    it('acepta los diez digitos tambien, mientras traiga destello', () => {
      expect(leerSecuenciaDeCasillas(conCasillas(DIGITOS))).not.toBeNull();
    });
  });

  it('tolera un parametro de mas, y en una casilla tambien', () => {
    expect(
      leerSecuenciaDeCasillas(
        con(CASILLAS, {
          otra: true,
          casillas: [
            { ...COLORES[0], peso: 1 },
            { ...COLORES[1], peso: 2 },
          ],
        }),
      ),
    ).not.toBeNull();
  });

  it('devuelve copias: lo que se lee no cambia si cambia lo recibido', () => {
    const recibido = { ...CASILLAS, casillas: COLORES.map((casilla) => ({ ...casilla })) };
    const leido = leerSecuenciaDeCasillas(recibido);

    recibido.casillas[0] = { ...COLORES[0]!, nombre: 'Cambiada' };

    expect(leido?.casillas[0]?.nombre).toBe('círculo verde');
  });
});

describe('leerTocarElObjetivo', () => {
  it('lee la sesion de la Fase 0', () => {
    expect(leerTocarElObjetivo(DIFERENCIA)).toEqual({
      rondas: 15,
      segundosPorRonda: 15,
      lados: [3, 4, 5],
    });
  });

  it.each(NO_ES_UN_OBJETO)('devuelve null si no es un objeto: %j', (valor) => {
    expect(leerTocarElObjetivo(valor)).toBeNull();
  });

  it.each(['rondas', 'segundosPorRonda', 'lados'])('devuelve null si falta %s', (campo) => {
    expect(leerTocarElObjetivo(sin(DIFERENCIA, campo))).toBeNull();
  });

  it.each([
    ['rondas', 0],
    ['rondas', 61],
    ['rondas', 7.5],
    ['segundosPorRonda', 2],
    ['segundosPorRonda', 121],
    ['segundosPorRonda', '15'],
    ['lados', []],
    ['lados', [3, 3, 4]],
    ['lados', [5, 4, 3]],
    ['lados', [1, 3]],
    ['lados', [3, 9]],
    ['lados', [3, 4, 5, 6, 7, 8, 9]],
    ['lados', '3,4,5'],
    ['lados', [3, '4', 5]],
  ])('devuelve null si %s vale %j', (campo, valor) => {
    expect(leerTocarElObjetivo(con(DIFERENCIA, { [campo]: valor }))).toBeNull();
  });

  it('admite hasta seis lados y no siete', () => {
    expect(
      leerTocarElObjetivo(con(DIFERENCIA, { rondas: 12, lados: [2, 3, 4, 5, 6, 7] })),
    ).not.toBeNull();
    expect(
      leerTocarElObjetivo(con(DIFERENCIA, { rondas: 14, lados: [2, 3, 4, 5, 6, 7, 8] })),
    ).toBeNull();
  });

  it('devuelve null si hay menos rondas que lados: algun tamano no se jugaria nunca', () => {
    expect(leerTocarElObjetivo(con(DIFERENCIA, { rondas: 2 }))).toBeNull();
  });

  it('devuelve null si no hay tiempo (null): esta pantalla siempre juega contra reloj', () => {
    expect(leerTocarElObjetivo(con(DIFERENCIA, { segundosPorRonda: null }))).toBeNull();
  });

  it.each([
    ['rondas', 3],
    ['rondas', 60],
    ['segundosPorRonda', 3],
    ['segundosPorRonda', 120],
  ])('acepta el borde: %s vale %j', (campo, valor) => {
    expect(leerTocarElObjetivo(con(DIFERENCIA, { [campo]: valor }))).not.toBeNull();
  });

  it('tolera un parametro de mas', () => {
    expect(leerTocarElObjetivo(con(DIFERENCIA, { otra: 1 }))).not.toBeNull();
  });
});

describe('leerCuestionario', () => {
  it('lee la sesion de la Fase 0', () => {
    expect(leerCuestionario(CUESTIONARIO)).toEqual({
      indicacion: 'Piensa solo en hoy. No hay respuestas buenas ni malas.',
      preguntas: [
        { clave: 'arrancar', texto: '¿Cuánto te costó arrancar el día?' },
        { clave: 'tension', texto: '¿Cuánta tensión has cargado hoy?' },
      ],
      opciones: [
        { valor: 0, texto: 'Nada' },
        { valor: 1, texto: 'Algo' },
        { valor: 2, texto: 'Mucho' },
      ],
    });
  });

  it.each(NO_ES_UN_OBJETO)('devuelve null si no es un objeto: %j', (valor) => {
    expect(leerCuestionario(valor)).toBeNull();
  });

  it.each(['indicacion', 'preguntas', 'opciones'])('devuelve null si falta %s', (campo) => {
    expect(leerCuestionario(sin(CUESTIONARIO, campo))).toBeNull();
  });

  it.each([
    ['indicacion', ''],
    ['indicacion', '   '],
    ['indicacion', 4],
    ['preguntas', []],
    ['preguntas', 'una'],
    ['preguntas', [null]],
    ['preguntas', [{ clave: 'a' }]],
    ['preguntas', [{ texto: 'a' }]],
    ['preguntas', [{ clave: '', texto: 'a' }]],
    ['preguntas', [{ clave: 'a', texto: '  ' }]],
    [
      'preguntas',
      [
        { clave: 'a', texto: 'uno' },
        { clave: 'a', texto: 'dos' },
      ],
    ],
    ['opciones', [{ valor: 0, texto: 'Nada' }]],
    ['opciones', 'nada'],
    [
      'opciones',
      [
        { valor: 0, texto: 'Nada' },
        { valor: 0, texto: 'Algo' },
      ],
    ],
    [
      'opciones',
      [
        { valor: 0, texto: 'Nada' },
        { valor: -1, texto: 'Algo' },
      ],
    ],
    [
      'opciones',
      [
        { valor: 0, texto: 'Nada' },
        { valor: 0.5, texto: 'Algo' },
      ],
    ],
    [
      'opciones',
      [
        { valor: 0, texto: 'Nada' },
        { valor: '1', texto: 'Algo' },
      ],
    ],
    [
      'opciones',
      [
        { valor: 0, texto: 'Nada' },
        { valor: 1, texto: '' },
      ],
    ],
  ])('devuelve null si %s vale %j', (campo, valor) => {
    expect(leerCuestionario(con(CUESTIONARIO, { [campo]: valor }))).toBeNull();
  });

  it('acepta dos opciones, las minimas, y un valor de hasta 1000', () => {
    const dos = [
      { valor: 0, texto: 'No' },
      { valor: 1000, texto: 'Si' },
    ];

    expect(leerCuestionario(con(CUESTIONARIO, { opciones: dos }))).not.toBeNull();
    expect(
      leerCuestionario(
        con(CUESTIONARIO, {
          opciones: [
            { valor: 0, texto: 'No' },
            { valor: 1001, texto: 'Si' },
          ],
        }),
      ),
    ).toBeNull();
  });

  it('tolera un parametro de mas, y en una pregunta tambien', () => {
    expect(
      leerCuestionario(
        con(CUESTIONARIO, {
          otra: true,
          preguntas: [{ clave: 'a', texto: 'Una', peso: 2 }],
        }),
      ),
    ).not.toBeNull();
  });

  it('devuelve copias: lo que se lee no cambia si cambia lo recibido', () => {
    const recibido = {
      ...CUESTIONARIO,
      preguntas: [{ clave: 'a', texto: 'Una' }],
    };
    const leido = leerCuestionario(recibido);

    recibido.preguntas[0] = { clave: 'a', texto: 'Cambiada' };

    expect(leido?.preguntas[0]?.texto).toBe('Una');
  });
});

describe('maximoDelCuestionario', () => {
  const preguntas = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      clave: `p${String(i)}`,
      texto: `Pregunta ${String(i)}`,
    }));
  const opciones = (...valores: number[]) =>
    valores.map((valor) => ({ valor, texto: `Opcion ${String(valor)}` }));

  it('son las preguntas por el valor mas alto: cinco por cuatro, veinte; cinco por dos, diez', () => {
    expect(
      maximoDelCuestionario({ preguntas: preguntas(5), opciones: opciones(0, 1, 2, 3, 4) }),
    ).toBe(20);
    expect(maximoDelCuestionario({ preguntas: preguntas(5), opciones: opciones(0, 1, 2) })).toBe(
      10,
    );
  });

  it('no depende del orden de las opciones, ni de que empiecen en cero', () => {
    expect(maximoDelCuestionario({ preguntas: preguntas(3), opciones: opciones(3, 0, 2, 1) })).toBe(
      9,
    );
    expect(maximoDelCuestionario({ preguntas: preguntas(2), opciones: opciones(1, 5) })).toBe(10);
  });
});

describe('leerEscrituraDeUnCampo', () => {
  it('lee la sesion de la Fase 0', () => {
    expect(leerEscrituraDeUnCampo(ESCRITURA)).toEqual({
      invitacion: '¿Qué estuvo bien hoy?',
      ideas: ['Un café a buena hora', 'Una conversación bonita'],
      largoMaximo: 500,
      permiteNingunaHoy: true,
    });
  });

  it.each(NO_ES_UN_OBJETO)('devuelve null si no es un objeto: %j', (valor) => {
    expect(leerEscrituraDeUnCampo(valor)).toBeNull();
  });

  it.each(['invitacion', 'campos', 'largoMaximo'])('devuelve null si falta %s', (campo) => {
    expect(leerEscrituraDeUnCampo(sin(ESCRITURA, campo))).toBeNull();
  });

  it('lo opcional que falta toma su valor por omision: sin ideas, y sin permiso para «ninguna hoy»', () => {
    const minima = { invitacion: 'Algo bueno', campos: 1, largoMaximo: 300 };

    expect(leerEscrituraDeUnCampo(minima)).toEqual({
      invitacion: 'Algo bueno',
      ideas: [],
      largoMaximo: 300,
      permiteNingunaHoy: false,
    });
  });

  it.each([
    ['invitacion', ''],
    ['invitacion', '  '],
    ['invitacion', 3],
    ['largoMaximo', 49],
    ['largoMaximo', 1001],
    ['largoMaximo', 500.5],
    ['largoMaximo', '500'],
    ['ideas', 'un cafe'],
    ['ideas', [3]],
    ['ideas', ['']],
    ['ideas', ['bien', '  ']],
    ['permiteNingunaHoy', 'si'],
  ])('devuelve null si %s vale %j', (campo, valor) => {
    expect(leerEscrituraDeUnCampo(con(ESCRITURA, { [campo]: valor }))).toBeNull();
  });

  it('devuelve null si hay mas de un campo: varios campos llegan con su propio motor', () => {
    expect(leerEscrituraDeUnCampo(con(ESCRITURA, { campos: 3 }))).toBeNull();
    expect(leerEscrituraDeUnCampo(con(ESCRITURA, { campos: 0 }))).toBeNull();
  });

  it('devuelve null si no basta con una respuesta: esta pantalla pide una', () => {
    expect(leerEscrituraDeUnCampo(con(ESCRITURA, { minimo: 0 }))).toBeNull();
    expect(leerEscrituraDeUnCampo(con(ESCRITURA, { minimo: 2 }))).toBeNull();
    expect(leerEscrituraDeUnCampo(sin(ESCRITURA, 'minimo'))).not.toBeNull();
  });

  it.each([
    ['largoMaximo', 50],
    ['largoMaximo', 1000],
  ])('acepta el borde: %s vale %j', (campo, valor) => {
    expect(leerEscrituraDeUnCampo(con(ESCRITURA, { [campo]: valor }))).not.toBeNull();
  });

  it('tolera un parametro de mas', () => {
    expect(leerEscrituraDeUnCampo(con(ESCRITURA, { otra: true }))).not.toBeNull();
  });
});
