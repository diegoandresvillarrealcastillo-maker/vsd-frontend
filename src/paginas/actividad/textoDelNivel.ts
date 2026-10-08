import type { NivelOrientativo } from '../../sincronizacion/resumen.ts';

/**
 * El texto de cada nivel, en terminos orientativos (SCRUM-94).
 *
 * No es un diagnostico y no lo parece: "vas bien" acompana, "nivel 8 de 10" califica.
 * Nunca lleva un numero.
 *
 * Lo usan la pantalla de la actividad, cuando termina con conexion, y el aviso de
 * sincronizacion, cuando el resultado se hizo sin conexion y se ensena al sincronizar
 * (SCRUM-138): la persona lee lo mismo venga de donde venga.
 */
export function textoDelNivel(nivel: NivelOrientativo): string {
  if (nivel === 'favorable') {
    return 'Vas bien. Sigue así.';
  }

  if (nivel === 'en_seguimiento') {
    return 'Va razonable, con margen para mejorar.';
  }

  return 'Conviene prestarle atención estos días.';
}
