import { describe, it, expect } from 'vitest';
import c from './contrato/reglas-locales.json';
import {
  contieneLaExpresion,
  leerConInvisibles,
  normalizar,
  responderSinConexion,
} from './reglasLocales.ts';

describe('riesgo sin conexion con invisibles dentro y entre palabras a la vez (SCRUM-319)', () => {
  const reglas = c.paquete;
  const ROTATIVOS = ['​', '­', '‍', '⁠', '﻿', '‎'];
  const tipoDe = (texto: string) => responderSinConexion(reglas, { texto, zona: 'Colombia' }).tipo;

  /**
   * La expresion con un invisible en cada hueco, de los dos tipos a la vez: uno tras la segunda
   * letra de cada palabra (escondido dentro de ella) y otro en lugar de cada espacio.
   */
  function mezclada(expresion: string, invisibles: readonly string[]): string {
    let n = 0;
    const siguiente = () => invisibles[n++ % invisibles.length] ?? '';

    return expresion
      .split(' ')
      .map((palabra) =>
        palabra.length > 2 ? `${palabra.slice(0, 2)}${siguiente()}${palabra.slice(2)}` : palabra,
      )
      .join(siguiente());
  }

  it('el caso de la auditoria: uno entre las palabras y otro dentro de la segunda', () => {
    expect(tipoDe('quiero​mo​rir')).toBe('riesgo');
  });

  it.each(reglas.riesgo.expresiones)('«%s» se detecta mezclando los dos usos', (expresion) => {
    expect(tipoDe(mezclada(expresion, ['​']))).toBe('riesgo');
    expect(tipoDe(mezclada(expresion, ROTATIVOS))).toBe('riesgo');
    expect(tipoDe(`hoy fue largo y ${mezclada(expresion, ROTATIVOS)} gracias`)).toBe('riesgo');
  });

  it.each(reglas.riesgo.expresiones)(
    '«%s» se detecta con un invisible en cada hueco y alrededor de cada espacio',
    (expresion) => {
      const entreTodo = [...expresion].map((letra) => (letra === ' ' ? '​ ‍' : letra));

      expect(tipoDe(entreTodo.join('​'))).toBe('riesgo');
      expect(tipoDe(entreTodo.join('­​'))).toBe('riesgo');
    },
  );

  it.each(reglas.riesgo.expresiones.filter((expresion) => expresion.split(' ').length >= 3))(
    '«%s» se detecta alternando espacios de verdad e invisibles entre las palabras',
    (expresion) => {
      // Con un espacio real en medio, ni quitar todos los invisibles ni leerlos todos como espacio
      // alcanza: hace falta decidir en cada hueco.
      let n = 0;
      const separador = () => (n++ % 2 === 0 ? '​' : ' ');
      const texto = expresion
        .split(' ')
        .map((palabra) => `${palabra.slice(0, 2)}‍${palabra.slice(2)}`)
        .reduce((junto, palabra) => `${junto}${separador()}${palabra}`);

      expect(tipoDe(texto)).toBe('riesgo');
    },
  );

  it('un invisible junto a un espacio de verdad tampoco separa de mas', () => {
    expect(tipoDe('quiero ​mo​rir')).toBe('riesgo');
    expect(tipoDe('quiero​ mo​rir')).toBe('riesgo');
    expect(tipoDe('qui​ero​​‍morir')).toBe('riesgo');
  });

  it.each([
    'hola​ bue​nas tar­des',
    'quiero​comer',
    'quiero​comer​morir',
    'mo​rir de risa',
    'no​vale​la​pena',
    'quie​ro un ca​fe',
  ])('«%s» no dispara por llevar invisibles mezclados', (texto) => {
    expect(tipoDe(texto)).not.toBe('riesgo');
  });

  it('sin ningun separador entre las palabras no se inventa la expresion', () => {
    expect(tipoDe('hacerme​dano')).toBe('riesgo');
    expect(tipoDe('hacermedano')).not.toBe('riesgo');
    expect(tipoDe('quieromorir')).not.toBe('riesgo');
  });

  it('un texto largo de puros invisibles se resuelve sin variantes exponenciales', () => {
    const relleno = '​'.repeat(20_000);

    expect(tipoDe(`quiero${relleno}x${relleno}morir`)).not.toBe('riesgo');
    expect(tipoDe(`quiero${relleno}mo${relleno}rir`)).toBe('riesgo');
    expect(tipoDe('quiero​'.repeat(5_000))).not.toBe('riesgo');
  });

  it('con una errata y un invisible como separador, igual que antes', () => {
    expect(tipoDe('kiero​morirme')).toBe('riesgo');
    expect(tipoDe('kiero mo​rirme')).toBe('riesgo');
  });
});

describe('contieneLaExpresion sobre lo leido con invisibles (SCRUM-319)', () => {
  const dentro = (texto: string, expresion = 'quiero morir') =>
    contieneLaExpresion(leerConInvisibles(texto), expresion);

  it('lo leido se parece a normalizar, con una marca donde habia invisibles', () => {
    expect(leerConInvisibles('  Quiero   MORÍR ')).toBe(normalizar('  Quiero   MORÍR '));
    expect(leerConInvisibles('mo​rir').replace('\u0001', '')).toBe('morir');
    expect(leerConInvisibles('mo​rir')).not.toBe('morir');
  });

  it.each(['quiero morir', 'quiero​mo​rir', 'quiero ​ ­morir', 'QUIERO⁠MORÍR'])(
    'reconoce «%s»',
    (texto) => {
      expect(dentro(texto)).toBe(true);
    },
  );

  it.each(['quieromorir', 'quiero  mor', 'quiero​', 'quier​o​morr', ''])(
    'no reconoce «%s»',
    (texto) => {
      expect(dentro(texto)).toBe(false);
    },
  );

  it('una expresion vacia no coincide con nada', () => {
    expect(dentro('suicidarme', '')).toBe(false);
    expect(dentro('', '')).toBe(false);
  });

  it('busca en todas las apariciones de la primera letra, no solo en la primera', () => {
    expect(dentro('qqquiero​mo​rir')).toBe(true);
    expect(dentro('quiero quiero​morir')).toBe(true);
  });
});

describe('riesgo Unicode sin conexion', () => {
  const reglas = c.paquete;
  const frase = reglas.riesgo.expresiones.find((x) => x.includes(' '))!;
  for (const separador of ['\u200b', '\u200d', '\u2060', '\ufeff', '\u034f', '\u200e']) {
    it('mantiene riesgo con invisible ' + separador.codePointAt(0)?.toString(16), () => {
      for (const texto of [frase, [...frase].join(separador), frase.replaceAll(' ', separador)]) {
        expect(responderSinConexion(reglas, { texto, zona: 'Colombia' }).tipo).toBe('riesgo');
      }
    });
  }
});
