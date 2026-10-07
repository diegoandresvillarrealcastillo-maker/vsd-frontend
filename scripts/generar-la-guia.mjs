// Genera `public/guia-de-la-mascota-propia.pdf` (SCRUM-122).
//
// Se corre con `npm run guia-de-la-mascota` cuando cambia el contenido de la
// guia (`src/paginas/perfil/contenidoDeLaGuia.ts`). Node 24 lee el TypeScript de
// `src/` tal cual: no hay nada que compilar ni que instalar.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { generarLaGuiaEnPdf } from '../src/paginas/perfil/guiaEnPdf.ts';

const destino = fileURLToPath(new URL('../public/guia-de-la-mascota-propia.pdf', import.meta.url));

// El PDF es ASCII puro: latin1 y utf8 dan los mismos bytes.
writeFileSync(destino, generarLaGuiaEnPdf(), 'latin1');

console.log(`Guia escrita en ${destino}`);
