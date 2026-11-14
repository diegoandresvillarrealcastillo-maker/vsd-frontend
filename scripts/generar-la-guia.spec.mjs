import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generarLaGuiaEnPdf } from '../src/paginas/perfil/guiaEnPdf.ts';
import { escribirLaGuia } from './generar-la-guia.mjs';

/**
 * El generador de `public/guia-de-la-mascota-propia.pdf` (SCRUM-122). Se prueba contra
 * una carpeta temporal: nunca toca el PDF de `public/`.
 */
let carpeta = '';

beforeEach(() => {
  carpeta = mkdtempSync(join(tmpdir(), 'guia-'));
});

afterEach(() => {
  rmSync(carpeta, { recursive: true, force: true });
});

describe('escribirLaGuia', () => {
  it('escribe el PDF de la guia donde se le diga', () => {
    const destino = join(carpeta, 'guia.pdf');

    escribirLaGuia(destino, { log: () => undefined });

    const bytes = readFileSync(destino);

    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(bytes.toString('latin1')).toBe(generarLaGuiaEnPdf());
  });

  it('dice donde la escribio', () => {
    const destino = join(carpeta, 'guia.pdf');
    const dicho = [];

    escribirLaGuia(destino, { log: (texto) => dicho.push(texto) });

    expect(dicho).toEqual([`Guia escrita en ${destino}`]);
  });
});
