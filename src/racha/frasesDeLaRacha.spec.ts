import { describe, expect, it } from 'vitest';

import {
  BANCOS_DE_LA_RACHA,
  SITUACIONES_DE_LA_RACHA,
  fraseDeLaRacha,
  fraseDelHito,
  type SituacionDeLaRacha,
} from './frasesDeLaRacha.ts';

/**
 * Las frases de la racha (SCRUM-243).
 *
 * Mismos criterios que el banco de la mascota (`frasesDeLaMascota.spec.ts`, SCRUM-129): nada de
 * salud, nada que mande o culpe, sin genero hacia quien las lee, cortas y con sus tildes. Y una regla
 * propia: **el riesgo solo existe en los dos bancos de riesgo**, para que una frase que habla de lo
 * que esta en juego no pueda salir donde no es verdad.
 */

/** Los valores con los que se prueba cada frase: los extremos de lo que puede llegar. */
const CASOS = [
  { dias: 1, faltan: 1, hito: 3 },
  { dias: 12, faltan: 2, hito: 14 },
  { dias: 29, faltan: 1, hito: 30 },
  { dias: 365, faltan: 3, hito: 730 },
  { dias: 1000, faltan: 3, hito: 1095 },
];

/** Cada frase del banco ya con sus valores, junto con su situacion para que un fallo diga de donde viene. */
const TODAS = SITUACIONES_DE_LA_RACHA.flatMap((situacion) =>
  BANCOS_DE_LA_RACHA[situacion].flatMap((_plantilla, indice) =>
    CASOS.map((caso) => ({
      situacion,
      indice,
      frase: fraseDeLaRacha(situacion, { ...caso, variante: indice }),
    })),
  ),
);

const DE_LOS_HITOS = [3, 7, 14, 30, 50, 100, 200, 365, 730, 1095, 3650].map((hito) => ({
  situacion: `hito ${String(hito)}`,
  frase: fraseDelHito(hito),
}));

function ofensoras(patron: RegExp): string[] {
  return [...TODAS, ...DE_LOS_HITOS]
    .filter(({ frase }) => patron.test(frase))
    .map(({ situacion, frase }) => `[${situacion}] ${frase}`);
}

describe('los bancos de la racha', () => {
  it('estan las seis situaciones', () => {
    expect([...SITUACIONES_DE_LA_RACHA].sort()).toEqual(
      [
        'cercaDelHito',
        'diaNormal',
        'primerDia',
        'regreso',
        'riesgoConCongelamientos',
        'riesgoSinCongelamientos',
      ].sort(),
    );
  });

  it.each(SITUACIONES_DE_LA_RACHA)('«%s» tiene al menos seis frases distintas', (situacion) => {
    const banco = BANCOS_DE_LA_RACHA[situacion];

    expect(banco.length).toBeGreaterThanOrEqual(6);
    expect(new Set(banco).size).toBe(banco.length);
  });

  it('ninguna frase se repite entre situaciones', () => {
    const todas = SITUACIONES_DE_LA_RACHA.flatMap((situacion) => BANCOS_DE_LA_RACHA[situacion]);

    expect(new Set(todas).size).toBe(todas.length);
  });
});

describe('fraseDeLaRacha', () => {
  it('elige por los dias, sin azar: la misma racha dice siempre lo mismo', () => {
    const una = fraseDeLaRacha('diaNormal', { dias: 12 });
    const otra = fraseDeLaRacha('diaNormal', { dias: 12 });

    expect(una).toBe(otra);
  });

  it('un dia mas dice otra frase', () => {
    expect(fraseDeLaRacha('diaNormal', { dias: 12 })).not.toBe(
      fraseDeLaRacha('diaNormal', { dias: 13 }),
    );
  });

  it('con la variante pedida usa esa frase', () => {
    expect(fraseDeLaRacha('diaNormal', { dias: 12, variante: 0 })).toBe(
      fraseDeLaRacha('diaNormal', { dias: 12, variante: BANCOS_DE_LA_RACHA.diaNormal.length }),
    );
  });

  it('los dias se dicen con su unidad: «1 día» y «12 días»', () => {
    const conDias = BANCOS_DE_LA_RACHA.diaNormal.findIndex((plantilla) =>
      plantilla.includes('{dias}'),
    );

    expect(fraseDeLaRacha('diaNormal', { dias: 1, variante: conDias })).toContain('1 día');
    expect(fraseDeLaRacha('diaNormal', { dias: 1, variante: conDias })).not.toContain('1 días');
    expect(fraseDeLaRacha('diaNormal', { dias: 12, variante: conDias })).toContain('12 días');
  });

  it('lo que falta para el hito se dice con su unidad y sin «1 días»', () => {
    for (const indice of BANCOS_DE_LA_RACHA.cercaDelHito.keys()) {
      const frase = fraseDeLaRacha('cercaDelHito', {
        dias: 13,
        faltan: 1,
        hito: 14,
        variante: indice,
      });

      expect(frase).not.toContain('1 días');
      expect(frase).not.toContain('{');
    }
  });

  it('no deja ninguna marca sin sustituir', () => {
    expect(TODAS.filter(({ frase }) => /[{}]/u.test(frase))).toEqual([]);
  });
});

describe('fraseDelHito', () => {
  it('cada hito de la tabla tiene la suya', () => {
    const frases = [3, 7, 14, 30, 50, 100, 200, 365].map(fraseDelHito);

    expect(new Set(frases).size).toBe(8);
  });

  it('la de dos semanas lo dice', () => {
    expect(fraseDelHito(14)).toMatch(/dos semanas/iu);
  });

  it('los aniversarios cuentan los anos: «Ya son 2 anos»', () => {
    expect(fraseDelHito(730)).toMatch(/2 años/u);
    expect(fraseDelHito(1095)).toMatch(/3 años/u);
  });
});

describe('estan bien escritas', () => {
  it('empiezan con mayuscula o con signo de apertura, y terminan con punto o signo', () => {
    const mal = [...TODAS, ...DE_LOS_HITOS].filter(
      ({ frase }) => !/^[¡¿]?\p{Lu}/u.test(frase) || !/[.!?]$/u.test(frase),
    );

    expect(mal).toEqual([]);
  });

  it('no tienen espacios de mas', () => {
    expect(
      [...TODAS, ...DE_LOS_HITOS].filter(
        ({ frase }) => frase !== frase.trim() || /\s{2,}/u.test(frase),
      ),
    ).toEqual([]);
  });

  it('caben en un globo: ninguna pasa de 90 caracteres, ni con los numeros mas largos', () => {
    expect(
      [...TODAS, ...DE_LOS_HITOS]
        .filter(({ frase }) => frase.length > 90)
        .map(({ frase }) => frase),
    ).toEqual([]);
  });

  it('estan en Unicode normalizado', () => {
    expect(
      [...TODAS, ...DE_LOS_HITOS].filter(({ frase }) => frase !== frase.normalize('NFC')),
    ).toEqual([]);
  });

  it('ninguna palabra de las que siempre llevan tilde o ene esta sin ella', () => {
    // Formas sin tilde de palabras que casi nunca se escriben asi: una red para los descuidos comunes.
    const sinTilde =
      /(?<!\p{L})(dia|dias|manana|tambien|asi|aqui|ahi|despues|ademas|facil|util|ultimo|ultima|ano|anos|habito|numero|sera|estara|mas|accion|atencion|decision|emocion)(?!\p{L})/iu;

    expect(ofensoras(sinTilde)).toEqual([]);
  });

  it('lleva las tildes que debe', () => {
    const todo = [...TODAS, ...DE_LOS_HITOS].map(({ frase }) => frase).join(' ');

    expect(todo).toContain('días');
    expect(todo).toContain('hábito');
    expect(todo).toMatch(/[ñáéíóú¡]/u);
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
      /(?<!\p{L})(debes|deber[ií]as|tienes que hacer|no olvides|no dejes de|nunca dejes|obligaci[oó]n|fracas|vago|flojo|culpable|apúrate|ya mismo|de inmediato|cuanto antes|necesitas|tienes que)(?!\p{L})/iu;

    expect(ofensoras(presion)).toEqual([]);
  });

  it('ninguna dice que algo se perdio ni se rompio', () => {
    // «Perdiste» no existe en esta aplicacion: una racha que se corta descansa (ADR 0024).
    expect(
      ofensoras(/perdi|perder|pierd|rompi|fall[aeóo]|castig|error|racha rota|se acab/iu),
    ).toEqual([]);
  });

  it('no evaluan a la persona', () => {
    expect(ofensoras(/(?<!\p{L})(eres (un|una) |lo hiciste mal|mal hecho|malo)/iu)).toEqual([]);
  });

  it('no dicen el genero de quien las lee', () => {
    const conGenero =
      /(?<!\p{L})(tranquil[oa]s?|content[oa]s?|cansad[oa]s?|list[oa]s?|bienvenid[oa]s?|orgullos[oa]s?|animad[oa]s?|motivad[oa]s?|agotad[oa]s?|preparad[oa]s?|solas?|segur[oa]s?|dispuest[oa]s?|ocupad[oa]s?|decidid[oa]s?|concentrad[oa]s?|emocionad[oa]s?|perdid[oa]s?|atrasad[oa]s?|encantad[oa]s?)(?!\p{L})/iu;

    expect(ofensoras(conGenero)).toEqual([]);
  });
});

describe('el riesgo solo existe donde es verdad', () => {
  const DE_RIESGO: readonly SituacionDeLaRacha[] = [
    'riesgoConCongelamientos',
    'riesgoSinCongelamientos',
  ];
  const SIN_RIESGO = SITUACIONES_DE_LA_RACHA.filter((situacion) => !DE_RIESGO.includes(situacion));

  it.each(SIN_RIESGO)(
    '«%s» nunca habla de congelamientos ni de lo que esta en juego',
    (situacion) => {
      for (const plantilla of BANCOS_DE_LA_RACHA[situacion]) {
        expect(plantilla).not.toMatch(/congelamiento|en juego|mantien|mantener/iu);
      }
    },
  );

  it('«en juego» solo sale en el banco de quien ya no tiene congelamientos', () => {
    for (const plantilla of BANCOS_DE_LA_RACHA.riesgoConCongelamientos) {
      expect(plantilla).not.toMatch(/en juego/iu);
    }

    expect(
      BANCOS_DE_LA_RACHA.riesgoSinCongelamientos.some((plantilla) => /en juego/iu.test(plantilla)),
    ).toBe(true);
  });

  it('con congelamientos disponibles ninguna frase dice que la racha corre peligro', () => {
    for (const plantilla of BANCOS_DE_LA_RACHA.riesgoConCongelamientos) {
      expect(plantilla).not.toMatch(/peligro|riesgo|cortar|se corta|depende/iu);
    }
  });

  it('sin congelamientos, las frases dicen la razon o lo que se puede hacer', () => {
    for (const plantilla of BANCOS_DE_LA_RACHA.riesgoSinCongelamientos) {
      expect(plantilla).toMatch(/actividad|rato|congelamientos/iu);
    }
  });
});
