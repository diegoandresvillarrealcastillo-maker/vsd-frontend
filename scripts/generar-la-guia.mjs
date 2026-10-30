// Genera `public/guia-de-la-mascota-propia.pdf` (SCRUM-122).
//
// Se corre con `npm run guia-de-la-mascota` cuando cambia el contenido de la
// guia (`src/paginas/perfil/contenidoDeLaGuia.ts`). Node 24 lee el TypeScript de
// `src/` tal cual: no hay nada que compilar ni que instalar.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { generarLaGuiaEnPdf } from '../src/paginas/perfil/guiaEnPdf.ts';

const DESTINO = join(import.meta.dirname, '..', 'public', 'guia-de-la-mascota-propia.pdf');

/**
 * Escribe la guia en `destino` y lo cuenta por `salida`. Recibe las dos para que las
 * pruebas la llamen sin tocar `public/`.
 *
 * @param {string} destino
 * @param {{ log: (texto: string) => void }} salida
 */
export function escribirLaGuia(destino = DESTINO, salida = console) {
  // El PDF es ASCII puro: latin1 y utf8 dan los mismos bytes.
  writeFileSync(destino, generarLaGuiaEnPdf(), 'latin1');

  salida.log(`Guia escrita en ${destino}`);
}

// Solo al ejecutarlo (`npm run guia-de-la-mascota`), no al importarlo.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  escribirLaGuia();
}
