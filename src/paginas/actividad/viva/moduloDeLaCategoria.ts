import type { Modulo } from '../../../infraestructura/api/cuenta.ts';

const MODULOS: readonly Modulo[] = ['bienestar', 'cognicion', 'emociones'];

/**
 * El modulo al que pertenece una categoria del catalogo, a partir de su nombre (SCRUM-173).
 *
 * El catalogo llama a las categorias «Bienestar», «Cognición» y «Emociones»; la pantalla de la
 * actividad necesita la clave (`bienestar`, `cognicion`, `emociones`) para escoger la paleta.
 * Se compara sin acentos ni mayusculas, y devuelve `undefined` si la categoria no es de ningun
 * modulo conocido: en ese caso la actividad se ve con el color neutro de la aplicacion.
 */
export function moduloDeLaCategoria(nombre: string): Modulo | undefined {
  const limpio = nombre
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

  return MODULOS.find((modulo) => limpio.includes(modulo));
}
