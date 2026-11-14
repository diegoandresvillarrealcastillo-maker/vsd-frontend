import type { PalabraDelJuego } from './parametrosDeLaCognicion.ts';

/** Sin tildes, en minusculas y sin espacios, pero **conservando la enie**: ella es otra letra. */
export function normalizarLaPalabra(texto: string): string {
  const ENIE = '\u0001';

  return texto
    .trim()
    .toLowerCase()
    .replaceAll('ñ', ENIE)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replaceAll(ENIE, 'ñ');
}

/** Si lo escrito es la palabra, con o sin tilde. En `completar`, solo se miran las letras que faltaban. */
export function esLaPalabra(
  palabra: PalabraDelJuego,
  modo: 'completar' | 'anagrama',
  escrito: readonly string[],
): boolean {
  if (modo === 'anagrama') {
    return normalizarLaPalabra(escrito[0] ?? '') === normalizarLaPalabra(palabra.palabra);
  }

  const letras = [...palabra.palabra];

  return (palabra.faltan ?? []).every(
    (posicion, lugar) =>
      normalizarLaPalabra(escrito[lugar] ?? '') === normalizarLaPalabra(letras[posicion] ?? ''),
  );
}
