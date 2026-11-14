import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * Las versiones de dependencias que corrigen un aviso y que ningun control mas vigila (SCRUM-297).
 *
 * `revisar-dependencias.mjs` solo falla con avisos `high` o `critical`, y estos dos son `low`: si
 * alguien quita el override de `katex` o regenera el lockfile desde cero y vuelve a salir la version
 * vieja, nada avisaria. Esta prueba lo hace. Los avisos sin version corregida (deepmerge, picomatch,
 * uri-js) no estan aqui: se llevan en `docs/avisos-de-dependencias.md`.
 */
const CORREGIDAS = [
  { paquete: 'katex', desde: '0.18.2', aviso: 'GHSA-238p-pmpm-9mq7' },
  { paquete: 'serialize-javascript', desde: '7.1.3', aviso: 'GHSA-m5mm-p8h7-m29v' },
];

/** `1.2.3` -> `[1, 2, 3]`. Alcanza para comparar las versiones del lockfile, que no traen etiquetas. */
function partes(version) {
  return version.split('.').map(Number);
}

function esMenor(version, minima) {
  const a = partes(version);
  const b = partes(minima);

  for (let i = 0; i < b.length; i += 1) {
    if (a[i] !== b[i]) {
      return a[i] < b[i];
    }
  }

  return false;
}

const lockfile = JSON.parse(readFileSync('package-lock.json', 'utf8'));

/** Todas las copias instaladas de un paquete, esten donde esten en el arbol. */
function copiasDe(paquete) {
  return Object.entries(lockfile.packages)
    .filter(
      ([ruta]) => ruta === `node_modules/${paquete}` || ruta.endsWith(`/node_modules/${paquete}`),
    )
    .map(([ruta, datos]) => ({ ruta, version: datos.version }));
}

describe('versiones que corrigen un aviso', () => {
  it.each(CORREGIDAS)('$paquete queda en $desde o mas ($aviso)', ({ paquete, desde }) => {
    const copias = copiasDe(paquete);

    expect(copias.length).toBeGreaterThan(0);
    expect(copias.filter(({ version }) => esMenor(version, desde))).toEqual([]);
  });

  it('esMenor compara por partes y no por texto', () => {
    expect(esMenor('0.16.47', '0.18.2')).toBe(true);
    expect(esMenor('0.18.10', '0.18.2')).toBe(false);
    expect(esMenor('7.1.2', '7.1.3')).toBe(true);
    expect(esMenor('7.1.3', '7.1.3')).toBe(false);
  });
});
