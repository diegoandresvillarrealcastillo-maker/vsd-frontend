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
 *
 * ## Un solo resultado no es una semana dificil (SCRUM-200)
 *
 * `acompanar` es lo que el servidor decidio (`sugiereAcompanamiento`): hay un patron de la semana
 * (4 de 7 dias con atencion, ADR 0029 de `vsd-backend`) o una senal en lo escrito. Un nivel que
 * requiere atencion **sin** eso es un resultado aislado: el servidor lo registra pero no acompana,
 * y lo que se lee aqui tiene que ser neutro. Decir «conviene prestarle atencion» por un juego que
 * no salio o por un dia flojo es leer de mas.
 *
 * Los otros dos niveles no cambian: no hay nada duro que posponer.
 */
export function textoDelNivel(nivel: NivelOrientativo, acompanar: boolean): string {
  if (nivel === 'favorable') {
    return 'Vas bien. Sigue así.';
  }

  if (nivel === 'en_seguimiento') {
    return 'Va razonable, con margen para mejorar.';
  }

  return acompanar
    ? 'Conviene prestarle atención estos días.'
    : 'Quedó registrado. Un día es solo un día.';
}
