/**
 * El juego acotado de colores, letras y tamanos del diario (SCRUM-96).
 *
 * Acotado a proposito: un selector de color libre deja escribir en amarillo
 * claro sobre fondo blanco, y eso se lee mal justo cuando se relee.
 *
 * Los colores se guardan como **variables del tema**, no como un color fijo:
 * `var(--tinta-verde)` cambia de tono en claro y en oscuro (`diario.css`), asi
 * que lo escrito se lee bien en los dos.
 *
 * Estas listas son tambien las que deja pasar `DocumentoLeido`: un valor que
 * no este aqui no se pinta, venga de donde venga.
 */

export const COLORES = [
  { nombre: 'Verde', valor: 'var(--tinta-verde)' },
  { nombre: 'Azul', valor: 'var(--tinta-azul)' },
  { nombre: 'Morado', valor: 'var(--tinta-morado)' },
  { nombre: 'Ámbar', valor: 'var(--tinta-ambar)' },
  { nombre: 'Rojo', valor: 'var(--tinta-rojo)' },
] as const;

export const LETRAS = [
  { nombre: 'Con serifa', valor: 'var(--letra-diario-serifa)' },
  { nombre: 'Monoespaciada', valor: 'var(--letra-diario-mono)' },
] as const;

export const TAMANOS = [
  { nombre: 'Pequeña', valor: '0.875em' },
  { nombre: 'Grande', valor: '1.25em' },
  { nombre: 'Muy grande', valor: '1.5em' },
] as const;

export const COLORES_PERMITIDOS: ReadonlySet<string> = new Set(COLORES.map(({ valor }) => valor));
export const LETRAS_PERMITIDAS: ReadonlySet<string> = new Set(LETRAS.map(({ valor }) => valor));
export const TAMANOS_PERMITIDOS: ReadonlySet<string> = new Set(TAMANOS.map(({ valor }) => valor));
