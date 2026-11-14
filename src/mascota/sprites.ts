import type { Expresion, Personaje } from './personajes.ts';

/**
 * La direccion de cada dibujo.
 *
 * Se importan con Vite y no desde `public/`: asi llevan huella en el nombre y
 * el navegador los guarda sin miedo a quedarse con una version vieja. Pesan unos
 * 15 KB cada uno y solo se piden los del personaje que se muestra.
 */
const ARCHIVOS = import.meta.glob<string>('./sprites/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});

export function sprite(personaje: Personaje, expresion: Expresion): string {
  return ARCHIVOS[`./sprites/${personaje}-${expresion}.webp`] ?? '';
}
