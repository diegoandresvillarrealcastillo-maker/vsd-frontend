import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  avisosGraves,
  describir,
  evaluar,
  idDelAviso,
  leerLasAceptadas,
  pedirElInforme,
  principal,
} from './revisar-dependencias.mjs';

/** Un aviso como lo escribe `npm audit --json` dentro de `via`. */
function aviso(id, paquete, severity = 'high') {
  return {
    source: 1000,
    name: paquete,
    title: `Algo grave en ${paquete}`,
    url: `https://github.com/advisories/${id}`,
    severity,
  };
}

/** Un informe con los paquetes dados: cada uno con lo que lo afecta en `via`. */
function informe(vulnerabilidades) {
  return {
    vulnerabilities: Object.fromEntries(
      Object.entries(vulnerabilidades).map(([nombre, via]) => [nombre, { name: nombre, via }]),
    ),
  };
}

const DEEPMERGE = 'GHSA-ggr8-5vv4-36mx';
const MYSQL = 'GHSA-3f6p-5ww8-9rcr';

function aceptada(id, vence = '2026-12-31') {
  return { id, motivo: 'Motivo escrito con calma, de mas de veinte letras.', vence };
}

describe('idDelAviso', () => {
  it('es lo ultimo de la URL', () => {
    expect(idDelAviso(aviso(DEEPMERGE, 'deepmerge-ts'))).toBe(DEEPMERGE);
  });

  it('con una barra al final tambien', () => {
    expect(idDelAviso({ url: `https://github.com/advisories/${DEEPMERGE}/`, source: 1 })).toBe(
      DEEPMERGE,
    );
  });

  it('sin URL usa el numero del aviso', () => {
    expect(idDelAviso({ source: 1234 })).toBe('1234');
  });
});

describe('avisosGraves', () => {
  it('cuenta solo los high y los critical', () => {
    const graves = avisosGraves(
      informe({
        a: [aviso('GHSA-aaaa-aaaa-aaaa', 'a', 'low')],
        b: [aviso('GHSA-bbbb-bbbb-bbbb', 'b', 'moderate')],
        c: [aviso('GHSA-cccc-cccc-cccc', 'c', 'high')],
        d: [aviso('GHSA-dddd-dddd-dddd', 'd', 'critical')],
      }),
    );

    expect(graves.map((una) => una.id)).toEqual(['GHSA-cccc-cccc-cccc', 'GHSA-dddd-dddd-dddd']);
  });

  it('ignora los paquetes que solo arrastran el aviso de otro', () => {
    // `prisma` figura en el informe porque depende de `mysql2`, pero el aviso es
    // uno solo.
    const graves = avisosGraves(
      informe({
        mysql2: [aviso(MYSQL, 'mysql2')],
        prisma: ['mysql2'],
        '@prisma/client': ['prisma'],
      }),
    );

    expect(graves).toHaveLength(1);
    expect(graves[0]).toMatchObject({ id: MYSQL, paquete: 'mysql2', severidad: 'high' });
  });

  it('un mismo aviso en dos paquetes cuenta una vez', () => {
    const graves = avisosGraves(
      informe({ uno: [aviso(MYSQL, 'mysql2')], otro: [aviso(MYSQL, 'mysql2')] }),
    );

    expect(graves).toHaveLength(1);
  });

  it('un informe vacio no tiene avisos', () => {
    expect(avisosGraves({})).toEqual([]);
    expect(avisosGraves({ vulnerabilities: {} })).toEqual([]);
  });

  it('un paquete sin la lista via no rompe nada', () => {
    expect(avisosGraves({ vulnerabilities: { raro: { name: 'raro' } } })).toEqual([]);
  });
});

describe('evaluar', () => {
  const HOY = '2026-10-08';
  const conMysql = informe({ mysql2: [aviso(MYSQL, 'mysql2')] });

  it('sin avisos graves, pasa', () => {
    expect(evaluar(informe({}), [], HOY).ok).toBe(true);
  });

  it('un aviso grave que nadie acepto hace fallar', () => {
    const resultado = evaluar(conMysql, [], HOY);

    expect(resultado.ok).toBe(false);
    expect(resultado.sinResolver.map((una) => una.id)).toEqual([MYSQL]);
  });

  it('uno aceptado y vigente pasa, y queda anotado', () => {
    const resultado = evaluar(conMysql, [aceptada(MYSQL)], HOY);

    expect(resultado.ok).toBe(true);
    expect(resultado.vigentes).toHaveLength(1);
    expect(resultado.vigentes[0]).toMatchObject({ id: MYSQL, vence: '2026-12-31' });
  });

  it('la aceptacion vale hasta su fecha, inclusive', () => {
    expect(evaluar(conMysql, [aceptada(MYSQL, HOY)], HOY).ok).toBe(true);
    expect(evaluar(conMysql, [aceptada(MYSQL, '2026-10-07')], HOY).ok).toBe(false);
  });

  it('una aceptacion vencida hace fallar, y no cuenta como sin resolver', () => {
    const resultado = evaluar(conMysql, [aceptada(MYSQL, '2026-01-01')], HOY);

    expect(resultado.ok).toBe(false);
    expect(resultado.vencidas.map((una) => una.id)).toEqual([MYSQL]);
    expect(resultado.sinResolver).toEqual([]);
  });

  it('aceptar un aviso no acepta otro del mismo paquete', () => {
    // El aviso nuevo de mysql2 de la semana siguiente tiene que fallar aunque
    // el de hoy este aceptado.
    const dos = informe({
      mysql2: [aviso(MYSQL, 'mysql2'), aviso('GHSA-nuev-0000-aaaa', 'mysql2')],
    });
    const resultado = evaluar(dos, [aceptada(MYSQL)], HOY);

    expect(resultado.ok).toBe(false);
    expect(resultado.sinResolver.map((una) => una.id)).toEqual(['GHSA-nuev-0000-aaaa']);
  });

  it('un aceptado que ya no aparece no hace fallar, pero se avisa', () => {
    const resultado = evaluar(informe({}), [aceptada(DEEPMERGE)], HOY);

    expect(resultado.ok).toBe(true);
    expect(resultado.sobrantes.map((una) => una.id)).toEqual([DEEPMERGE]);
  });
});

describe('describir', () => {
  const HOY = '2026-10-08';

  it('los errores salen como anotaciones del CI', () => {
    const texto = describir(evaluar(informe({ mysql2: [aviso(MYSQL, 'mysql2')] }), [], HOY));

    expect(texto).toContain(`::error::${MYSQL} (high) en mysql2`);
    expect(texto).toContain('vulnerabilidades-aceptadas.json');
  });

  it('una aceptacion vencida dice cuando vencio', () => {
    const texto = describir(
      evaluar(informe({ mysql2: [aviso(MYSQL, 'mysql2')] }), [aceptada(MYSQL, '2026-01-01')], HOY),
    );

    expect(texto).toContain('vencio el 2026-01-01');
  });

  it('si todo esta bien, lo dice', () => {
    expect(describir(evaluar(informe({}), [], HOY))).toContain('Sin avisos graves');
  });

  it('un aviso aceptado y vigente se anota con su fecha, sin ser un error', () => {
    const texto = describir(
      evaluar(informe({ mysql2: [aviso(MYSQL, 'mysql2')] }), [aceptada(MYSQL)], HOY),
    );

    expect(texto).toContain(`Aceptado hasta 2026-12-31: ${MYSQL} en mysql2.`);
    expect(texto).not.toContain('::error::');
  });

  it('un aceptado que ya no aparece pide quitarlo de la lista', () => {
    const texto = describir(evaluar(informe({}), [aceptada(DEEPMERGE)], HOY));

    expect(texto).toContain(`::warning::${DEEPMERGE} esta en vulnerabilidades-aceptadas.json`);
    expect(texto).toContain('quitalo');
  });
});

describe('pedirElInforme', () => {
  /** Un `spawnSync` de mentira: devuelve lo que se le diga y recuerda como lo llamaron. */
  const npmDice = (stdout, stderr = '') => vi.fn(() => ({ stdout, stderr }));

  it('devuelve el informe que imprime npm', () => {
    const ejecutar = npmDice(JSON.stringify(informe({ mysql2: [aviso(MYSQL, 'mysql2')] })));

    expect(avisosGraves(pedirElInforme(ejecutar))).toHaveLength(1);
  });

  it('lo pide como una sola orden y con shell (en Windows npm es un .cmd)', () => {
    const ejecutar = npmDice(JSON.stringify(informe({})));

    pedirElInforme(ejecutar);

    expect(ejecutar).toHaveBeenCalledWith(
      'npm audit --omit=dev --json',
      expect.objectContaining({ shell: true, encoding: 'utf8' }),
    );
  });

  it('si npm no imprime un informe, lanza con lo que dijo npm', () => {
    expect(() => pedirElInforme(npmDice('esto no es json', 'se cayo el registro'))).toThrow(
      /npm audit no devolvio un informe[\s\S]*se cayo el registro/,
    );
  });

  it('si npm responde con un error en vez de un informe, no pasa en silencio', () => {
    // Sin red, creer que no hay vulnerabilidades seria no haber mirado.
    const sinRed = JSON.stringify({ error: { code: 'ENOTFOUND', summary: 'sin red' } });

    expect(() => pedirElInforme(npmDice(sinRed))).toThrow(/npm audit no pudo revisar: sin red/);
  });

  it('si el error no trae resumen, dice el codigo', () => {
    const solo = JSON.stringify({ error: { code: 'ENOTFOUND' } });

    expect(() => pedirElInforme(npmDice(solo))).toThrow(/no pudo revisar: ENOTFOUND/);
  });
});

describe('principal', () => {
  const HOY = '2026-10-08';
  const conMysql = informe({ mysql2: [aviso(MYSQL, 'mysql2')] });
  const archivo = (...aceptadas) => JSON.stringify({ aceptadas });

  /** Corre `principal` con todo lo del sistema reemplazado y devuelve el codigo y lo que dijo. */
  function correr({ informeDeNpm = informe({}), aceptadas = archivo(), ...resto } = {}) {
    const dicho = [];
    const codigo = principal({
      hoy: HOY,
      pedir: () => informeDeNpm,
      leer: () => aceptadas,
      salida: { log: (texto) => dicho.push(texto), error: (texto) => dicho.push(texto) },
      ...resto,
    });

    return { codigo, salida: dicho.join('\n') };
  }

  it('sin avisos graves sale con 0 y lo dice', () => {
    const { codigo, salida } = correr();

    expect(codigo).toBe(0);
    expect(salida).toContain('Sin avisos graves');
  });

  it('con un aviso aceptado y vigente sale con 0', () => {
    const { codigo, salida } = correr({
      informeDeNpm: conMysql,
      aceptadas: archivo(aceptada(MYSQL)),
    });

    expect(codigo).toBe(0);
    expect(salida).toContain(`Aceptado hasta 2026-12-31: ${MYSQL}`);
  });

  it('con un aviso grave que nadie acepto sale con 1', () => {
    const { codigo, salida } = correr({ informeDeNpm: conMysql });

    expect(codigo).toBe(1);
    expect(salida).toContain(`::error::${MYSQL} (high) en mysql2`);
  });

  it('con la aceptacion vencida sale con 1', () => {
    const { codigo, salida } = correr({
      informeDeNpm: conMysql,
      aceptadas: archivo(aceptada(MYSQL, '2026-01-01')),
    });

    expect(codigo).toBe(1);
    expect(salida).toContain('vencio el 2026-01-01');
  });

  it('lee las aceptadas de vulnerabilidades-aceptadas.json', () => {
    const leer = vi.fn(() => archivo());

    correr({ leer });

    expect(leer).toHaveBeenCalledWith('vulnerabilidades-aceptadas.json', 'utf8');
  });

  it('si ese archivo esta mal escrito, sale con 1 y lo dice como error del CI', () => {
    const { codigo, salida } = correr({ aceptadas: 'esto no es json' });

    expect(codigo).toBe(1);
    expect(salida).toBe('::error::vulnerabilidades-aceptadas.json no es un JSON valido.');
  });

  it('si npm no pudo revisar, sale con 1: no pasa en silencio', () => {
    const { codigo, salida } = correr({
      pedir: () => {
        throw new Error('npm audit no pudo revisar: sin red');
      },
    });

    expect(codigo).toBe(1);
    expect(salida).toBe('::error::npm audit no pudo revisar: sin red');
  });

  it('sin otra fecha usa la de hoy: una aceptacion de 2020 ya vencio', () => {
    const codigo = principal({
      pedir: () => conMysql,
      leer: () => archivo(aceptada(MYSQL, '2020-01-01')),
      salida: { log: () => undefined, error: () => undefined },
    });

    expect(codigo).toBe(1);
  });

  it('lanzado de verdad, un archivo de aceptadas roto lo para con codigo 1', () => {
    // Es la unica que arranca el archivo como lo hace el CI (`node scripts/...`) y
    // vigila que el codigo de salida llegue a quien lo lanza. Con el archivo roto
    // se detiene antes de llamar a npm, asi que no necesita red.
    const carpeta = mkdtempSync(join(tmpdir(), 'dependencias-'));

    try {
      writeFileSync(join(carpeta, 'vulnerabilidades-aceptadas.json'), 'esto no es json');

      const resultado = spawnSync(process.execPath, [resolve('scripts/revisar-dependencias.mjs')], {
        cwd: carpeta,
        encoding: 'utf8',
      });

      expect(resultado.status).toBe(1);
      expect(resultado.stderr).toContain('::error::vulnerabilidades-aceptadas.json no es un JSON');
    } finally {
      rmSync(carpeta, { recursive: true, force: true });
    }
  });

  it('el archivo de aceptadas del repositorio esta bien escrito', () => {
    // Sin reemplazar `leer`: lee el de verdad, el que mira el CI. Un error de sintaxis
    // ahi pararia el CI de todas las ramas.
    const { codigo, salida } = correr({ leer: undefined });

    expect(salida).not.toContain('::error::');
    expect(codigo).toBe(0);
  });
});

describe('leerLasAceptadas', () => {
  const entrada = (cambios = {}) => ({
    id: MYSQL,
    motivo: 'Un motivo que explica de verdad por que se acepta.',
    vence: '2026-12-31',
    ...cambios,
  });
  const leer = (contenido) => leerLasAceptadas(JSON.stringify(contenido));

  it('lee una lista valida', () => {
    expect(leer({ aceptadas: [entrada()] })).toHaveLength(1);
    expect(leer({ aceptadas: [] })).toEqual([]);
  });

  it.each([
    ['no es JSON', 'esto no es json', /no es un JSON valido/],
    ['no trae la lista', '{}', /lista "aceptadas"/],
  ])('rechaza si %s', (_caso, texto, mensaje) => {
    expect(() => leerLasAceptadas(texto)).toThrow(mensaje);
  });

  it.each([
    ['un id que no es GHSA', { id: 'CVE-2026-1234' }, /GHSA/],
    ['sin motivo', { motivo: '' }, /motivo/],
    ['un motivo de relleno', { motivo: 'porque si' }, /motivo/],
    ['sin fecha', { vence: undefined }, /fecha/],
    ['una fecha mal escrita', { vence: '31/12/2026' }, /fecha/],
    ['una fecha que no existe', { vence: '2026-13-45' }, /fecha/],
  ])('rechaza una entrada con %s', (_caso, cambios, mensaje) => {
    expect(() => leer({ aceptadas: [entrada(cambios)] })).toThrow(mensaje);
  });

  it('el error dice cual entrada es', () => {
    expect(() => leer({ aceptadas: [entrada(), entrada({ vence: 'pronto' })] })).toThrow(
      /aceptadas\[1\]/,
    );
  });
});
