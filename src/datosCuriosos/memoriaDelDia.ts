import type { DatoCuriosoDelDia } from '../infraestructura/api/datosCuriosos.ts';

/**
 * El ultimo dato curioso que se supo, guardado en este equipo para verlo sin conexion
 * (SCRUM-185).
 *
 * Es lo que cumple «un dispositivo sin conexion muestra el mismo dato del dia»: el servidor
 * lo elige una vez por dia, y aqui queda copia, tambien al cerrar y volver a abrir la
 * aplicacion. Es texto de cultura general, no un dato de salud, pero lleva la cuenta a la que
 * pertenece: **nunca se muestra el de otra persona**, y se olvida al cerrar la sesion.
 *
 * Sin almacenamiento (un navegador en modo privado, o sin espacio) simplemente no se guarda:
 * se ve el dato mientras hay conexion y nada sin ella. No es un fallo que haya que contar.
 */

const CLAVE = 'vsd-h:dato-curioso-del-dia';

interface Guardado {
  readonly cuenta: string;
  readonly dia: string;
  readonly dato: NonNullable<DatoCuriosoDelDia['dato']>;
}

/** Lo ultimo que se supo de esa cuenta, o `null` si no hay nada o es de otra persona. */
export function datoGuardadoDe(cuenta: string): Guardado | null {
  try {
    const crudo = localStorage.getItem(CLAVE);

    if (crudo === null) {
      return null;
    }

    const guardado = JSON.parse(crudo) as Partial<Guardado> | null;

    if (
      guardado?.cuenta !== cuenta ||
      typeof guardado.dia !== 'string' ||
      typeof guardado.dato?.texto !== 'string'
    ) {
      return null;
    }

    return guardado as Guardado;
  } catch {
    return null;
  }
}

/** Deja el dato de hoy para verlo sin conexion. Si no hay dato, no se guarda nada. */
export function guardarElDato(cuenta: string, entregado: DatoCuriosoDelDia): void {
  if (entregado.dato === null) {
    return;
  }

  try {
    localStorage.setItem(
      CLAVE,
      JSON.stringify({ cuenta, dia: entregado.dia, dato: entregado.dato } satisfies Guardado),
    );
  } catch {
    // Sin espacio o sin almacenamiento: se vera cuando haya conexion. No es grave.
  }
}

/** Termina la sesion: lo de esa persona no se queda para la siguiente. */
export function olvidarElDatoGuardado(): void {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // Nada que olvidar.
  }
}
