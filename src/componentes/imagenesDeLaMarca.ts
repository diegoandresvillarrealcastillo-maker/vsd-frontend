/**
 * Los archivos de la marca y sus medidas (SCRUM-287), para que la pagina reserve el sitio al
 * cargar y no se mueva. Son las del archivo: `scripts/imagenes-de-la-marca.spec.ts` lo vigila.
 */

/** El loto solo, sin letras. */
export const IMAGEN_DEL_LOTO = { src: '/loto-vsd-health.webp', ancho: 192, alto: 130 } as const;

/** El loto con "VSD Health". */
export const IMAGEN_COMPLETA = { src: '/logo-completo.webp', ancho: 360, alto: 376 } as const;
