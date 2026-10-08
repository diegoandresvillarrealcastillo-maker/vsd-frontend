import { describe, expect, it } from 'vitest';

import type { ReglasLocales } from '../infraestructura/api/reglasLocales.ts';
import type { LineaDeAtencion } from '../infraestructura/api/resultados.ts';
import contratoJson from './contrato/reglas-locales.json';
import {
  esReglasLocales,
  lineasDeLaZona,
  normalizar,
  palabrasDe,
  responderSinConexion,
  type ResultadoSinConexion,
} from './reglasLocales.ts';

/**
 * El motor que responde sin conexion (SCRUM-141), con dos clases de prueba.
 *
 * 1. **Contra el contrato del backend** (`contrato/reglas-locales.json`): el paquete que
 *    publica el servidor y lo que tiene que responder el dispositivo a cada frase. Es la
 *    prueba que dice que este algoritmo y el del servidor son el mismo, y que no hay aqui
 *    ninguna lista propia: todo sale del paquete.
 * 2. **Con reglas minimas, hechas aqui**, para fijar cada mecanismo (palabras completas,
 *    `*`, relleno, orden, variantes) sin depender de lo que digan hoy los textos.
 */

// ---------------------------------------------------------------------------
// El contrato
// ---------------------------------------------------------------------------

type Esperado =
  | { readonly tipo: 'riesgo'; readonly mensaje: string; readonly lineas: readonly string[] }
  | { readonly tipo: 'charla'; readonly intencion: string; readonly mensaje: string }
  | {
      readonly tipo: 'ayuda';
      readonly intencion: string;
      readonly mensaje: string;
      readonly lineas: readonly string[];
    }
  | { readonly tipo: 'exige-conexion' };

interface CasoDelContrato {
  readonly texto: string;
  readonly zona: string;
  readonly mascota?: string;
  readonly esperado: Esperado;
}

const contrato = contratoJson as unknown as {
  paquete: unknown;
  casos: readonly CasoDelContrato[];
};

if (!esReglasLocales(contrato.paquete)) {
  throw new Error('El contrato guardado no es un paquete que esta aplicacion entienda.');
}

const REGLAS: ReglasLocales = contrato.paquete;

/** Lo que responde el motor, con las lineas dichas por su identificador, como en el contrato. */
function comoEnElContrato(resultado: ResultadoSinConexion): Esperado {
  switch (resultado.tipo) {
    case 'riesgo':
      return {
        tipo: 'riesgo',
        mensaje: resultado.mensaje,
        lineas: resultado.lineas.map((linea) => linea.id),
      };
    case 'ayuda':
      return {
        tipo: 'ayuda',
        intencion: resultado.intencion,
        mensaje: resultado.mensaje,
        lineas: resultado.lineas.map((linea) => linea.id),
      };
    default:
      return resultado;
  }
}

const idsDe = (lineas: readonly LineaDeAtencion[]) => lineas.map((linea) => linea.id);

describe('el contrato del backend', () => {
  it('el paquete que trae es uno que esta aplicacion sabe aplicar', () => {
    expect(esReglasLocales(contrato.paquete)).toBe(true);
    expect(REGLAS.esquema).toBe(1);
  });

  it('trae un conjunto de frases con de todo: riesgo, charla, ayuda y lo que exige conexion', () => {
    expect(contrato.casos.length).toBeGreaterThan(40);
    expect(new Set(contrato.casos.map((caso) => caso.esperado.tipo))).toEqual(
      new Set(['riesgo', 'charla', 'ayuda', 'exige-conexion']),
    );
  });

  it.each(contrato.casos.map((caso) => [`${caso.texto} (${caso.zona})`, caso] as const))(
    'responde lo mismo que el servidor a: %s',
    (_nombre, caso) => {
      const respuesta = responderSinConexion(REGLAS, {
        texto: caso.texto,
        zona: caso.zona,
        mascota: caso.mascota,
      });

      expect(comoEnElContrato(respuesta)).toEqual(caso.esperado);
    },
  );
});

describe('lo que publica el servidor, regla por regla', () => {
  it.each(REGLAS.riesgo.expresiones)(
    'la expresion de riesgo "%s" ensena las lineas, sin esperar la red',
    (expresion) => {
      const respuesta = responderSinConexion(REGLAS, { texto: expresion, zona: 'America/Bogota' });

      expect(respuesta).toMatchObject({ tipo: 'riesgo', mensaje: REGLAS.riesgo.mensaje });
      expect(respuesta.tipo === 'riesgo' ? respuesta.lineas.length : 0).toBeGreaterThan(0);
    },
  );

  it.each(
    REGLAS.charla.reglas.flatMap((regla) =>
      regla.patrones.map((patron) => [regla.intencion, patron.replace(/\*$/u, '')] as const),
    ),
  )('la charla de "%s" reconoce "%s"', (intencion, texto) => {
    const regla = REGLAS.charla.reglas.find((una) => una.intencion === intencion);
    const respuesta = responderSinConexion(REGLAS, { texto, zona: 'America/Bogota' });

    if (regla?.mensaje === null) {
      expect(respuesta).toEqual({ tipo: 'exige-conexion' });
    } else {
      expect(respuesta).toMatchObject({ tipo: 'charla', intencion });
    }
  });

  it.each(
    REGLAS.intenciones.flatMap((regla) =>
      regla.patrones.map((patron) => [regla.intencion, patron.replace(/\*$/u, '')] as const),
    ),
  )('lo demas de "%s" reconoce "%s"', (intencion, texto) => {
    const regla = REGLAS.intenciones.find((una) => una.intencion === intencion);
    const respuesta = responderSinConexion(REGLAS, { texto, zona: 'America/Bogota' });

    if (regla?.mensaje === null) {
      expect(respuesta).toEqual({ tipo: 'exige-conexion' });
    } else {
      expect(respuesta).toMatchObject({ tipo: 'ayuda', intencion });
    }
  });

  it.each(
    Object.entries(REGLAS.paises).flatMap(([pais, datos]) =>
      datos.zonas.map((zona) => [pais, zona] as const),
    ),
  )('desde una zona de %s (%s), las lineas son las de ese pais y de ningun otro', (pais, zona) => {
    const lineas = lineasDeLaZona(REGLAS, zona);

    expect(idsDe(lineas)).toEqual(idsDe(REGLAS.paises[pais]?.lineas ?? []));
    expect(lineas.length).toBeGreaterThan(0);
  });

  it('cada zona de cada pais es de un solo pais', () => {
    const vistas = new Map<string, string>();

    for (const [pais, datos] of Object.entries(REGLAS.paises)) {
      for (const zona of datos.zonas) {
        expect(vistas.get(zona), zona).toBeUndefined();
        vistas.set(zona, pais);
      }
    }
  });

  it.each(['Asia/Tokyo', 'America/Lima', 'Narnia/Cair_Paravel', ''])(
    'una zona sin pais ("%s") recibe el directorio internacional y ningun telefono de otro pais',
    (zona) => {
      const lineas = lineasDeLaZona(REGLAS, zona);

      expect(idsDe(lineas)).toEqual(idsDe(REGLAS.internacional));
      expect(lineas.length).toBeGreaterThan(0);
    },
  );
});

// ---------------------------------------------------------------------------
// Los mecanismos, con reglas minimas
// ---------------------------------------------------------------------------

const LINEA_CO: LineaDeAtencion = { id: 'co-1', titulo: 'Linea de Colombia', tipo: 'contacto' };
const LINEA_ES: LineaDeAtencion = { id: 'es-1', titulo: 'Linea de Espana', tipo: 'contacto' };
const DIRECTORIO: LineaDeAtencion = { id: 'dir', titulo: 'Directorio', tipo: 'contacto' };

function reglas(parte: Partial<ReglasLocales> = {}): ReglasLocales {
  return {
    esquema: 1,
    riesgo: { expresiones: ['quiero morir', 'hacerme dano'], mensaje: 'Esto es importante.' },
    charla: {
      reglas: [
        {
          intencion: 'como_estas',
          patrones: ['como estas', 'que tal'],
          mensaje: null,
          variantes: [],
        },
        {
          intencion: 'despedida',
          patrones: ['adios', 'buenas noches'],
          mensaje: 'Hasta pronto.',
          variantes: [{ patrones: ['buenas noches'], mensaje: 'Buenas noches.' }],
        },
        {
          intencion: 'agradecimiento',
          patrones: ['gracias*'],
          mensaje: 'Con gusto.',
          variantes: [],
        },
        {
          intencion: 'saludo',
          patrones: ['hola', 'buenas', 'saludo*'],
          mensaje: 'Hola.',
          variantes: [],
        },
      ],
      relleno: ['muchas', 'de', 'nuevo', 'a', 'todos'],
    },
    intenciones: [
      {
        intencion: 'donde_busco_ayuda',
        patrones: ['ayud*', 'psicolog*', 'con quien hablo'],
        mensaje: 'Pedir ayuda es una buena decision.',
        conLineas: true,
      },
      {
        intencion: 'como_duermo_mejor',
        patrones: ['dormir', 'duerm*'],
        mensaje: null,
        conLineas: false,
      },
    ],
    paises: {
      CO: { zonas: ['America/Bogota'], lineas: [LINEA_CO] },
      ES: { zonas: ['Europe/Madrid'], lineas: [LINEA_ES] },
    },
    internacional: [DIRECTORIO],
    ...parte,
  };
}

const responder = (texto: string, extra: { zona?: string; mascota?: string } = {}) =>
  responderSinConexion(reglas(), { texto, zona: extra.zona ?? 'America/Bogota', ...extra });

describe('normalizar', () => {
  it('quita las tildes, pasa a minusculas y deja un solo espacio', () => {
    expect(normalizar('  ¡Adiós,   MÍ  querido AMIGO!  ')).toBe('¡adios, mi querido amigo!');
  });

  it('la enie pierde su tilde como cualquier otra, igual que en el servidor', () => {
    expect(normalizar('hacerme daño')).toBe('hacerme dano');
  });

  it('un texto vacio sigue siendo vacio', () => {
    expect(normalizar('')).toBe('');
    expect(normalizar('   ')).toBe('');
  });
});

describe('palabrasDe', () => {
  it('separa por todo lo que no es letra ni numero', () => {
    expect(palabrasDe('Hola, ¿cómo estás? 2 veces')).toEqual([
      'hola',
      'como',
      'estas',
      '2',
      'veces',
    ]);
  });

  it('tres letras iguales seguidas se leen como una: holaaaa es hola', () => {
    expect(palabrasDe('holaaaa graciasss')).toEqual(['hola', 'gracias']);
  });

  it('dos letras iguales seguidas se quedan: "llorar" y "aaa" distinto de "aa"', () => {
    expect(palabrasDe('llorar aa')).toEqual(['llorar', 'aa']);
  });

  it('sin palabras no hay nada', () => {
    expect(palabrasDe('¿¡...!?')).toEqual([]);
  });
});

describe('el riesgo', () => {
  it('se busca dentro del texto, sobre el texto normalizado', () => {
    expect(responder('QUIERO MORIR')).toMatchObject({ tipo: 'riesgo' });
    expect(responder('a veces quiero morirme del todo')).toMatchObject({ tipo: 'riesgo' });
    expect(responder('quiero hacerme daño')).toMatchObject({ tipo: 'riesgo' });
  });

  it('va primero: un saludo delante no lo esconde', () => {
    expect(responder('hola, quiero morir')).toMatchObject({ tipo: 'riesgo' });
  });

  it('no interpreta negaciones: se prefiere el falso positivo', () => {
    expect(responder('no quiero morir')).toMatchObject({ tipo: 'riesgo' });
  });

  it('trae el mensaje y las lineas de su pais', () => {
    expect(responder('quiero morir', { zona: 'Europe/Madrid' })).toEqual({
      tipo: 'riesgo',
      mensaje: 'Esto es importante.',
      lineas: [LINEA_ES],
    });
  });

  it('una expresion pegada a otra palabra tambien cuenta: es un suelo, no un techo', () => {
    // Se compara sobre texto, no sobre palabras, como en el servidor.
    expect(responder('siquiero morir')).toMatchObject({ tipo: 'riesgo' });
  });

  it('sin expresiones no hay riesgo', () => {
    expect(
      responderSinConexion(reglas({ riesgo: { expresiones: [], mensaje: 'x' } }), {
        texto: 'quiero morir',
        zona: 'America/Bogota',
      }),
    ).toEqual({ tipo: 'exige-conexion' });
  });
});

describe('la charla: solo cuando el mensaje entero es charla', () => {
  it('un saludo, un agradecimiento y una despedida', () => {
    expect(responder('hola')).toEqual({ tipo: 'charla', intencion: 'saludo', mensaje: 'Hola.' });
    expect(responder('gracias')).toEqual({
      tipo: 'charla',
      intencion: 'agradecimiento',
      mensaje: 'Con gusto.',
    });
    expect(responder('adios')).toEqual({
      tipo: 'charla',
      intencion: 'despedida',
      mensaje: 'Hasta pronto.',
    });
  });

  it('las mayusculas, las tildes y los signos no importan', () => {
    expect(responder('¡HOLA!!!')).toMatchObject({ intencion: 'saludo' });
    expect(responder('Adiós.')).toMatchObject({ intencion: 'despedida' });
  });

  it('el relleno acompana sin dejar de ser charla', () => {
    expect(responder('muchas gracias a todos')).toMatchObject({ intencion: 'agradecimiento' });
    expect(responder('hola de nuevo')).toMatchObject({ intencion: 'saludo' });
  });

  it('una palabra que no es de ninguna lista y ya no es charla', () => {
    expect(responder('hola, quiero desaparecer')).toEqual({ tipo: 'exige-conexion' });
    expect(responder('gracias por todo')).toEqual({ tipo: 'exige-conexion' });
    expect(responder('adios a todo')).toEqual({ tipo: 'exige-conexion' });
  });

  it('el relleno solo no es charla', () => {
    expect(responder('muchas de nuevo')).toEqual({ tipo: 'exige-conexion' });
  });

  it('un patron con * lee la familia, pero la palabra tiene que empezar asi', () => {
    expect(responder('graciassss')).toMatchObject({ intencion: 'agradecimiento' });
    expect(responder('saludos')).toMatchObject({ intencion: 'saludo' });
    // "mil gracias" no: "mil" no esta en el relleno de estas reglas.
    expect(responder('mil gracias')).toEqual({ tipo: 'exige-conexion' });
    // Ni dentro de otra palabra.
    expect(responder('desagradecido')).toEqual({ tipo: 'exige-conexion' });
  });

  it('una raiz con * solo se lee al comienzo de la palabra, no en medio de otra', () => {
    expect(responder('psicologo')).toMatchObject({ tipo: 'ayuda' });
    expect(responder('psicologia clinica')).toMatchObject({ tipo: 'ayuda' });
    // "psicolog" esta dentro de "neuropsicologo", pero no al comienzo.
    expect(responder('neuropsicologo')).toEqual({ tipo: 'exige-conexion' });
  });

  it('palabras completas: "hola" no se lee dentro de "holandes"', () => {
    expect(responder('holandes')).toEqual({ tipo: 'exige-conexion' });
  });

  it('un patron de varias palabras tiene que aparecer seguido', () => {
    expect(responder('buenas noches')).toMatchObject({ intencion: 'despedida' });
    expect(responder('noches buenas')).toEqual({ tipo: 'exige-conexion' });
  });

  it('gana la primera regla de la lista: "buenas noches" es despedida y no saludo', () => {
    // "buenas" tambien es un saludo, y la despedida va antes.
    expect(responder('buenas noches')).toMatchObject({ tipo: 'charla', intencion: 'despedida' });
    expect(responder('buenas')).toMatchObject({ intencion: 'saludo' });
  });

  it('la variante cambia el mensaje cuando el mensaje la pide', () => {
    expect(responder('buenas noches')).toMatchObject({ mensaje: 'Buenas noches.' });
    expect(responder('adios')).toMatchObject({ mensaje: 'Hasta pronto.' });
  });

  it('lo que sin conexion no se responde sigue ocupando su lugar: "hola, como estas" no es un saludo', () => {
    expect(responder('hola, como estas')).toEqual({ tipo: 'exige-conexion' });
    expect(responder('que tal')).toEqual({ tipo: 'exige-conexion' });
  });

  it('el nombre de la mascota cuenta como relleno', () => {
    expect(responder('hola luma', { mascota: 'Luma' })).toMatchObject({ intencion: 'saludo' });
    expect(responder('hola luma', { mascota: 'Chispita' })).toEqual({ tipo: 'exige-conexion' });
    expect(responder('hola luma')).toEqual({ tipo: 'exige-conexion' });
  });

  it('un nombre de varias palabras tambien', () => {
    expect(responder('hola mi luna', { mascota: 'Mi Luna' })).toMatchObject({
      intencion: 'saludo',
    });
  });

  it('un texto vacio no es charla', () => {
    expect(responder('')).toEqual({ tipo: 'exige-conexion' });
    expect(responder('¿¡!?')).toEqual({ tipo: 'exige-conexion' });
  });

  it('una charla que cubre todas las palabras pero que no es de ninguna regla no es charla', () => {
    expect(responder('de nuevo a todos')).toEqual({ tipo: 'exige-conexion' });
  });
});

describe('lo demas que se reconoce', () => {
  it('donde buscar ayuda se responde con su mensaje y las lineas de su pais', () => {
    expect(responder('donde busco ayuda')).toEqual({
      tipo: 'ayuda',
      intencion: 'donde_busco_ayuda',
      mensaje: 'Pedir ayuda es una buena decision.',
      lineas: [LINEA_CO],
    });
    expect(responder('necesito un psicologo', { zona: 'Europe/Madrid' })).toMatchObject({
      tipo: 'ayuda',
      lineas: [LINEA_ES],
    });
  });

  it('basta con que una palabra aparezca, aunque haya mas', () => {
    expect(responder('hola, con quien hablo de esto')).toMatchObject({ tipo: 'ayuda' });
    expect(responder('necesito ayuda para dormir')).toMatchObject({
      tipo: 'ayuda',
      intencion: 'donde_busco_ayuda',
    });
  });

  it('lo que exige conexion no se responde ni se inventa', () => {
    expect(responder('como duermo mejor')).toEqual({ tipo: 'exige-conexion' });
    expect(responder('cuanto cuesta el parqueadero')).toEqual({ tipo: 'exige-conexion' });
  });

  it('una respuesta sin lineas no las trae', () => {
    const sinLineas = reglas({
      intenciones: [
        { intencion: 'una', patrones: ['hablemos'], mensaje: 'Aqui estoy.', conLineas: false },
      ],
    });

    expect(responderSinConexion(sinLineas, { texto: 'hablemos', zona: 'America/Bogota' })).toEqual({
      tipo: 'ayuda',
      intencion: 'una',
      mensaje: 'Aqui estoy.',
      lineas: [],
    });
  });

  it('la charla va antes que lo demas: "ayuda" solo es charla si el mensaje entero lo es', () => {
    const conAyudaDeCharla = reglas({
      charla: {
        reglas: [
          { intencion: 'saludo', patrones: ['ayuda'], mensaje: 'Soy charla.', variantes: [] },
        ],
        relleno: [],
      },
    });

    expect(
      responderSinConexion(conAyudaDeCharla, { texto: 'ayuda', zona: 'America/Bogota' }),
    ).toMatchObject({ tipo: 'charla' });
    expect(
      responderSinConexion(conAyudaDeCharla, { texto: 'ayuda ahora', zona: 'America/Bogota' }),
    ).toMatchObject({ tipo: 'ayuda' });
  });

  it('gana la primera regla que coincide, en el orden del servidor', () => {
    const dosReglas = reglas({
      intenciones: [
        { intencion: 'primera', patrones: ['tema'], mensaje: 'Uno.', conLineas: false },
        { intencion: 'segunda', patrones: ['tema'], mensaje: 'Dos.', conLineas: false },
      ],
    });

    expect(
      responderSinConexion(dosReglas, { texto: 'tema', zona: 'America/Bogota' }),
    ).toMatchObject({ intencion: 'primera' });
  });
});

describe('las lineas de una zona', () => {
  it('la zona se lee como la lee IANA: sin importar mayusculas y con sus alias', () => {
    expect(lineasDeLaZona(reglas(), 'america/bogota')).toEqual([LINEA_CO]);
    expect(lineasDeLaZona(reglas(), 'EUROPE/MADRID')).toEqual([LINEA_ES]);
  });

  it('una zona de otro pais recibe el directorio, y ningun telefono', () => {
    expect(lineasDeLaZona(reglas(), 'Asia/Tokyo')).toEqual([DIRECTORIO]);
  });

  it('una zona que no existe recibe el directorio y no revienta', () => {
    expect(lineasDeLaZona(reglas(), 'Narnia/Cair_Paravel')).toEqual([DIRECTORIO]);
    expect(lineasDeLaZona(reglas(), '')).toEqual([DIRECTORIO]);
  });

  it('un pais sin lineas en el paquete recibe lo que el paquete diga: nada inventado', () => {
    const sinLineas = reglas({
      paises: { CO: { zonas: ['America/Bogota'], lineas: [] } },
    });

    expect(lineasDeLaZona(sinLineas, 'America/Bogota')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Lo que se acepta
// ---------------------------------------------------------------------------

describe('esReglasLocales', () => {
  const base = reglas();
  type Cambios = Readonly<Record<string, unknown>>;

  // Un paquete completo con una sola cosa cambiada. Los cambios se dicen con `undefined`
  // cuando algo falta: para el motor, un campo que no esta y uno que vale `undefined` son lo mismo.
  const conRiesgo = (cambios: Cambios) => ({ ...base, riesgo: { ...base.riesgo, ...cambios } });
  const conCharla = (cambios: Cambios) => ({ ...base, charla: { ...base.charla, ...cambios } });
  const conReglaDeCharla = (indice: number, cambios: Cambios) =>
    conCharla({
      reglas: base.charla.reglas.map((regla, i) =>
        i === indice ? { ...regla, ...cambios } : regla,
      ),
    });
  const conVariante = (cambios: Cambios) =>
    conReglaDeCharla(1, {
      variantes: [{ ...base.charla.reglas[1]?.variantes[0], ...cambios }],
    });
  const conIntencion = (cambios: Cambios) => ({
    ...base,
    intenciones: base.intenciones.map((regla, i) => (i === 0 ? { ...regla, ...cambios } : regla)),
  });
  const conPais = (cambios: Cambios) => ({
    ...base,
    paises: { ...base.paises, CO: { ...base.paises.CO, ...cambios } },
  });
  const conLinea = (cambios: Cambios) => conPais({ lineas: [{ ...LINEA_CO, ...cambios }] });

  it('acepta un paquete completo', () => {
    expect(esReglasLocales(base)).toBe(true);
    expect(esReglasLocales(JSON.parse(JSON.stringify(base)))).toBe(true);
  });

  it.each([
    ['nada', null],
    ['un texto', 'reglas'],
    ['un numero', 5],
    ['una lista', []],
    ['un objeto vacio', {}],
  ])('no acepta %s', (_nombre, valor) => {
    expect(esReglasLocales(valor)).toBe(false);
  });

  it.each([2, 0, '1', null, undefined])(
    'no acepta el esquema %s: no se aplica a medias',
    (esquema) => {
      expect(esReglasLocales({ ...base, esquema })).toBe(false);
    },
  );

  it.each([
    ['sin riesgo', { ...base, riesgo: undefined }],
    ['con expresiones que no son texto', conRiesgo({ expresiones: [1] })],
    ['con expresiones que no son una lista', conRiesgo({ expresiones: 'x' })],
    ['sin expresiones', conRiesgo({ expresiones: undefined })],
    ['con un mensaje de riesgo que no es texto', conRiesgo({ mensaje: 5 })],
    ['sin mensaje de riesgo', conRiesgo({ mensaje: undefined })],
    ['sin charla', { ...base, charla: undefined }],
    ['con reglas de charla que no son una lista', conCharla({ reglas: {} })],
    ['con una regla de charla sin intencion', conReglaDeCharla(0, { intencion: undefined })],
    ['con una regla de charla sin patrones', conReglaDeCharla(0, { patrones: 'hola' })],
    [
      'con una regla de charla con patrones que no son texto',
      conReglaDeCharla(0, { patrones: [1] }),
    ],
    [
      'con una regla de charla con un mensaje que no es texto ni nulo',
      conReglaDeCharla(1, { mensaje: 5 }),
    ],
    ['con una regla de charla sin mensaje', conReglaDeCharla(1, { mensaje: undefined })],
    ['con variantes que no son una lista', conReglaDeCharla(1, { variantes: null })],
    ['con una variante sin mensaje', conVariante({ mensaje: undefined })],
    ['con una variante sin patrones', conVariante({ patrones: undefined })],
    ['con un relleno que no es texto', conCharla({ relleno: [1] })],
    ['sin relleno', conCharla({ relleno: undefined })],
    ['con intenciones que no son una lista', { ...base, intenciones: null }],
    ['con una intencion sin patrones', conIntencion({ patrones: undefined })],
    ['con una intencion con un nombre que no es texto', conIntencion({ intencion: 5 })],
    ['con una intencion con un mensaje que no es texto ni nulo', conIntencion({ mensaje: 5 })],
    ['con una intencion sin saber si lleva lineas', conIntencion({ conLineas: undefined })],
    ['con una intencion con conLineas que no es cierto o falso', conIntencion({ conLineas: 'si' })],
    ['con paises que no son un objeto', { ...base, paises: [] }],
    ['con un pais sin zonas', conPais({ zonas: undefined })],
    ['con un pais con zonas que no son texto', conPais({ zonas: [1] })],
    ['con un pais sin lineas', conPais({ lineas: undefined })],
    ['con una linea sin identificador', conLinea({ id: undefined })],
    ['con una linea con el identificador vacio', conLinea({ id: '' })],
    ['con una linea sin titulo', conLinea({ titulo: undefined })],
    ['con una linea sin tipo', conLinea({ tipo: undefined })],
    ['con una linea con una descripcion que no es texto', conLinea({ descripcion: 5 })],
    ['con una linea con una cobertura que no es texto', conLinea({ cobertura: 5 })],
    ['con una linea con un enlace que no es texto', conLinea({ enlace: 5 })],
    ['con una linea que no es un objeto', conPais({ lineas: ['una linea'] })],
    ['sin el directorio internacional', { ...base, internacional: undefined }],
    ['con un directorio que no es una lista', { ...base, internacional: {} }],
    ['con un directorio con una linea rota', { ...base, internacional: [{ id: 'x' }] }],
  ])('no acepta un paquete %s', (_nombre, paquete) => {
    expect(esReglasLocales(paquete)).toBe(false);
  });

  it('acepta lo opcional de una linea cuando esta y cuando no', () => {
    expect(esReglasLocales(conLinea({}))).toBe(true);
    expect(
      esReglasLocales(
        conLinea({
          descripcion: 'Algo',
          cobertura: 'nacional',
          enlace: 'https://ejemplo.test',
        }),
      ),
    ).toBe(true);
  });

  it('un mensaje nulo es valido: es lo que sin conexion no se responde', () => {
    expect(esReglasLocales(conReglaDeCharla(0, { mensaje: null }))).toBe(true);
    expect(esReglasLocales(conIntencion({ mensaje: null }))).toBe(true);
  });

  it('un pais sin lineas, o sin ningun pais, es un paquete valido: lo dice el servidor', () => {
    expect(esReglasLocales(conPais({ lineas: [] }))).toBe(true);
    expect(esReglasLocales({ ...base, paises: {} })).toBe(true);
  });
});
