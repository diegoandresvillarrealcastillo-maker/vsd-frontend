import { describe, expect, it } from 'vitest';

import { FRASES_POR_MOMENTO, MOMENTOS, TODAS_LAS_FRASES } from './frasesDeLaMascota.ts';
import { PERSONAJES, PERSONAJES_EN_ORDEN } from './personajes.ts';

/**
 * El banco de frases de la mascota (SCRUM-129).
 *
 * Lo que se comprueba aqui es lo que el ticket promete: cuantas hay, que no se
 * repiten, que no hablan de salud, que sirven a cualquier avatar y que las
 * tildes y las enes estan donde deben. Son pruebas sobre el texto, y por eso
 * cada una dice cual frase la rompe.
 */

/** Quita tildes, signos y mayusculas: para ver si dos frases son la misma. */
function esencia(frase: string): string {
  return frase
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Cada frase junto con su momento, para que un fallo diga de donde viene. */
const CON_MOMENTO = MOMENTOS.flatMap((momento) =>
  FRASES_POR_MOMENTO[momento].map((frase) => ({ momento, frase })),
);

function ofensoras(patron: RegExp): string[] {
  return CON_MOMENTO.filter(({ frase }) => patron.test(frase)).map(
    ({ momento, frase }) => `[${momento}] ${frase}`,
  );
}

describe('el banco de frases', () => {
  describe('cuantas hay', () => {
    it('son al menos 200, y se cuentan todas', () => {
      expect(TODAS_LAS_FRASES.length).toBeGreaterThanOrEqual(200);
      expect(TODAS_LAS_FRASES).toHaveLength(CON_MOMENTO.length);
    });

    it('estan los seis momentos del ticket', () => {
      expect([...MOMENTOS].sort()).toEqual(
        ['actividad', 'diario', 'general', 'manana', 'noche', 'racha'].sort(),
      );
    });

    it.each(MOMENTOS)('el momento «%s» tiene suficientes para no repetirse pronto', (momento) => {
      expect(FRASES_POR_MOMENTO[momento].length).toBeGreaterThanOrEqual(30);
    });
  });

  describe('no se repiten', () => {
    it('ninguna frase esta dos veces, ni entre momentos', () => {
      const vistas = new Set<string>();
      const repetidas: string[] = [];

      for (const frase of TODAS_LAS_FRASES) {
        if (vistas.has(frase)) {
          repetidas.push(frase);
        }

        vistas.add(frase);
      }

      expect(repetidas).toEqual([]);
    });

    it('ni siquiera cambiando mayusculas, tildes o signos', () => {
      const porEsencia = new Map<string, string>();
      const parecidas: string[] = [];

      for (const frase of TODAS_LAS_FRASES) {
        const previa = porEsencia.get(esencia(frase));

        if (previa !== undefined) {
          parecidas.push(`«${previa}» y «${frase}»`);
        }

        porEsencia.set(esencia(frase), frase);
      }

      expect(parecidas).toEqual([]);
    });

    it('ninguna es igual a una frase propia de un personaje', () => {
      const propias = new Set(PERSONAJES_EN_ORDEN.flatMap((p) => PERSONAJES[p].frases));

      expect(TODAS_LAS_FRASES.filter((frase) => propias.has(frase))).toEqual([]);
    });
  });

  describe('estan bien escritas', () => {
    it('empiezan con mayuscula o con signo de apertura, y terminan con punto o signo', () => {
      const mal = CON_MOMENTO.filter(
        ({ frase }) => !/^[¡¿]?\p{Lu}/u.test(frase) || !/[.!?]$/u.test(frase),
      ).map(({ frase }) => frase);

      expect(mal).toEqual([]);
    });

    it('no tienen espacios de mas ni sobrantes en los bordes', () => {
      const mal = CON_MOMENTO.filter(
        ({ frase }) => frase !== frase.trim() || /\s{2,}/u.test(frase),
      ).map(({ frase }) => frase);

      expect(mal).toEqual([]);
    });

    it('cada signo de apertura tiene su cierre', () => {
      const mal = CON_MOMENTO.filter(({ frase }) => {
        const abren = (frase.match(/¿/gu) ?? []).length;
        const cierran = (frase.match(/\?/gu) ?? []).length;
        const aperturaDeAdmiracion = (frase.match(/¡/gu) ?? []).length;
        const cierreDeAdmiracion = (frase.match(/!/gu) ?? []).length;

        return abren !== cierran || aperturaDeAdmiracion !== cierreDeAdmiracion;
      }).map(({ frase }) => frase);

      expect(mal).toEqual([]);
    });

    it('caben en un globo: ninguna pasa de 90 caracteres', () => {
      expect(
        CON_MOMENTO.filter(({ frase }) => frase.length > 90).map(({ frase }) => frase),
      ).toEqual([]);
    });

    it('no llevan numeros: la mascota no sabe cuantos dias llevas', () => {
      expect(ofensoras(/\d/u)).toEqual([]);
    });
  });

  describe('tildes y enes', () => {
    it('estan en Unicode normalizado, y no como letra mas marca suelta', () => {
      // Una "a" con la tilde como caracter aparte se ve bien y no coincide al
      // buscar o comparar.
      expect(TODAS_LAS_FRASES.filter((frase) => frase !== frase.normalize('NFC'))).toEqual([]);
    });

    it('no quedo ningun caracter roto por una mala codificacion', () => {
      expect(ofensoras(/[�ÃÂ]/u)).toEqual([]);
    });

    it('ninguna palabra de las que siempre llevan tilde o ene esta sin ella', () => {
      // Formas sin tilde de palabras que en espanol casi nunca se escriben asi.
      // No es un corrector: es una red para los descuidos mas comunes.
      const sinTilde = new RegExp(
        '(?<!\\p{L})(' +
          [
            'dia',
            'dias',
            'manana',
            'tambien',
            'asi',
            'aqui',
            'ahi',
            'alla',
            'despues',
            'ademas',
            'facil',
            'dificil',
            'util',
            'rapido',
            'ultimo',
            'ultima',
            'unico',
            'unica',
            'ano',
            'anos',
            'sueno',
            'pequeno',
            'pequena',
            'companero',
            'compania',
            'ensenar',
            'ensena',
            'ningun',
            'algun',
            'segun',
            'habito',
            'habitos',
            'ortografia',
            'pagina',
            'paginas',
            'telefono',
            'numero',
            'musica',
            'energia',
            'sera',
            'estara',
            'tendra',
            'podra',
            'seran',
            'mas',
            'mision',
            'accion',
            'atencion',
            'opinion',
            'cancion',
            'razon',
            'corazon',
            'decision',
            'emocion',
          ].join('|') +
          ')(?!\\p{L})',
        'iu',
      );

      expect(ofensoras(sinTilde)).toEqual([]);
    });

    it('las preguntas y las exclamaciones llevan tilde en «qué», «cómo», «cuándo»…', () => {
      const interrogativos =
        /(?<!\p{L})(que|como|cuando|donde|cuanto|cuanta|quien|cual)(?!\p{L})/iu;
      const mal = CON_MOMENTO.filter(({ frase }) =>
        (frase.match(/[¿¡][^?!]*[?!]/gu) ?? []).some((tramo) => interrogativos.test(tramo)),
      ).map(({ frase }) => frase);

      expect(mal).toEqual([]);
    });

    it('lleva las tildes que debe: «mañana», «día», «también»', () => {
      // Lo contrario de la prueba anterior: que las palabras esten escritas bien,
      // y no solo que no esten escritas mal.
      const todo = TODAS_LAS_FRASES.join(' ');

      expect(todo).toContain('mañana');
      expect(todo).toContain('día');
      expect(todo).toMatch(/[ñáéíóú¿¡]/u);
    });
  });

  describe('lo que no dicen', () => {
    it('ninguna habla de sintomas, diagnosticos ni tratamientos', () => {
      const salud =
        /ansiedad|depresi|trastorno|diagn[oó]s|s[ií]ntoma|tratamiento|terapia|medic|pastilla|f[aá]rmaco|enferm|dolor|insomnio|estr[eé]s|angusti|p[aá]nico|suicid|salud|psic[oó]|curar|sanar|hospital|cl[ií]nic|paciente|receta|dosis|apnea|bipolar|trauma|herida|agobi|ahog|adicci|calmante|dormir|sue[ñn]o|llorar|tristeza|deprim/iu;

      expect(ofensoras(salud)).toEqual([]);
    });

    it('ninguna manda, culpa ni mete prisa', () => {
      const presion =
        /(?<!\p{L})(debes|deber[ií]as|tienes que hacer|no olvides|no dejes de|nunca dejes|obligaci[oó]n|fracas|perdiste|vago|flojo|culpable|apúrate|ya mismo|de inmediato|cuanto antes)(?!\p{L})/iu;

      expect(ofensoras(presion)).toEqual([]);
    });

    it('no evaluan a la persona', () => {
      const juicio = /(?<!\p{L})(eres (un|una) |lo hiciste mal|mal hecho|malo|fallaste)/iu;

      expect(ofensoras(juicio)).toEqual([]);
    });
  });

  describe('sirven a cualquier avatar', () => {
    it('no nombran a ningun personaje ni lo que es solo suyo', () => {
      const propio =
        /fungito|sparky|chispa|(?<!\p{L})ori(?!\p{L})|gato|ojo de gato|obsidian|trama|hongo|seta|compost|telar|hilo|tej[ei]|pliegue|doblar|grulla|ámbar|faro|cristal|gólem|robot|biblioteca|gafas|ronronea|prrr|escudo|manta|tierra/iu;

      expect(ofensoras(propio)).toEqual([]);
    });

    it('no describen un cuerpo ni una accion fisica de un animal o un objeto', () => {
      const cuerpo = /cola|alas|patas|ronr|maull|vuelo|volar|brillo|brillar|pelaje|plumas|garras/iu;

      expect(ofensoras(cuerpo)).toEqual([]);
    });

    it('no dicen el genero de quien las lee, ni el de la mascota', () => {
      // "Tranquilo" o "cansada" dejan afuera a media poblacion. Se escribe con
      // sustantivos y verbos: "con calma", "a tu paso".
      const conGenero =
        /(?<!\p{L})(tranquil[oa]s?|content[oa]s?|cansad[oa]s?|list[oa]s?|bienvenid[oa]s?|orgullos[oa]s?|animad[oa]s?|motivad[oa]s?|agotad[oa]s?|preparad[oa]s?|solas?|segur[oa]s?|dispuest[oa]s?|ocupad[oa]s?|decidid[oa]s?|concentrad[oa]s?|emocionad[oa]s?|perdid[oa]s?|atrasad[oa]s?|encantad[oa]s?)(?!\p{L})/iu;

      expect(ofensoras(conGenero)).toEqual([]);
    });

    it('«perfecto» no se dice de quien lee: «ser perfecto» deja a alguien afuera', () => {
      expect(ofensoras(/(?<!\p{L})(ser|seas|eres|estar|estás|estés) perfect[oa]/iu)).toEqual([]);
    });
  });

  describe('los momentos tienen su tono', () => {
    it('la manana saluda y la noche se despide, sin mezclarse', () => {
      expect(
        FRASES_POR_MOMENTO.manana.some((frase) => /buen(os)? d[ií]as?|mañana/iu.test(frase)),
      ).toBe(true);
      expect(FRASES_POR_MOMENTO.noche.some((frase) => /noche|mañana/iu.test(frase))).toBe(true);
      expect(
        FRASES_POR_MOMENTO.manana.filter((frase) => /buenas noches|esta noche/iu.test(frase)),
      ).toEqual([]);
      expect(
        FRASES_POR_MOMENTO.noche.filter((frase) => /buenos días|esta mañana/iu.test(frase)),
      ).toEqual([]);
    });
  });
});
