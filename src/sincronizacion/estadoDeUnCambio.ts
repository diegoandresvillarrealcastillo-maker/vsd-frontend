import type { Operacion } from './cola.ts';

/**
 * Como se ve, para quien lo hizo, algo que sigue en la cola (SCRUM-139, SCRUM-140).
 *
 * - **en_este_equipo**: esta guardado aqui y todavia no se envia (sin conexion, o espera
 *   su turno o su reintento).
 * - **guardando**: se esta enviando ahora.
 * - **error**: la API no lo acepto y hace falta que la persona decida.
 * - **conflicto**: otro dispositivo cambio lo mismo (ADR 0009) y la persona tiene que elegir.
 */
export type EstadoDeUnCambio = 'en_este_equipo' | 'guardando' | 'error' | 'conflicto';

export function estadoDeUnCambio(
  operacion: Operacion,
  sincronizando: boolean,
  ahora: Date,
): EstadoDeUnCambio {
  switch (operacion.estado) {
    case 'conflicto':
      return 'conflicto';

    case 'requiere_atencion':
      return 'error';

    case 'enviando':
      return 'guardando';

    default: {
      // Una pendiente que espera su proximo reintento no se esta enviando aunque otra si.
      const lista =
        operacion.proximoIntento === null ||
        Date.parse(operacion.proximoIntento) <= ahora.getTime();

      return sincronizando && lista ? 'guardando' : 'en_este_equipo';
    }
  }
}
