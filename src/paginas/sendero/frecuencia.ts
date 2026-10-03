import type { Frecuencia } from '../../infraestructura/api/progreso.ts';

/** 1 es lunes y 7 domingo, como en la API. */
const DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/**
 * "Diaria", "Lun · Jue" o "Una vez".
 *
 * Sin frecuencia no hay etiqueta: una API anterior a SCRUM-92 no la manda.
 */
export function etiquetaDeFrecuencia(frecuencia: Frecuencia | undefined): string | undefined {
  if (frecuencia === undefined) {
    return undefined;
  }

  switch (frecuencia.tipo) {
    case 'diaria':
      return 'Diaria';
    case 'unica':
      return 'Una vez';
    case 'semanal': {
      const dias = frecuencia.dias
        .map((dia) => DIAS[dia])
        .filter((dia) => dia !== undefined && dia !== '')
        .join(' · ');

      return dias === '' ? undefined : dias;
    }
  }
}
