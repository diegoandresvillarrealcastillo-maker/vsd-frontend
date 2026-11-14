/**
 * Lo que la persona decidio sobre la analitica, guardado en su navegador
 * (SCRUM-161).
 *
 * Es lo unico que se guarda sobre esto: ni quien es, ni desde donde. Y es la
 * constancia de **su** eleccion, asi que vive solo en su navegador: no viaja a
 * ningun servidor.
 *
 * ## La version
 *
 * Si algun dia cambia lo que se mide, o quien lo recibe, lo que alguien acepto
 * antes ya no cubre lo nuevo. Subir `VERSION_DEL_CONSENTIMIENTO` hace que la
 * decision guardada deje de valer y se vuelva a preguntar. Rechazar tambien se
 * vuelve a preguntar: la nueva pregunta es otra.
 *
 * ## Si el almacenamiento falla
 *
 * Modo privado, datos del sitio bloqueados: guardar y leer pueden lanzar. Entonces
 * no hay decision guardada y se pregunta cada vez, que es el lado seguro: sin
 * constancia de un permiso, no se mide.
 */
export type Decision = 'aceptada' | 'rechazada';

export const CLAVE_DEL_CONSENTIMIENTO = 'vsd.analitica';

/** Subirla obliga a todo el mundo a decidir de nuevo. */
export const VERSION_DEL_CONSENTIMIENTO = 1;

interface Guardado {
  readonly version: number;
  readonly decision: Decision;
  /** Cuando se decidio, para quien revise: ISO 8601. */
  readonly en: string;
}

function esDecision(valor: unknown): valor is Decision {
  return valor === 'aceptada' || valor === 'rechazada';
}

/** La decision vigente, o `null` si no hay, no se puede leer o es de una version vieja. */
export function leerLaDecision(): Decision | null {
  try {
    const crudo = window.localStorage.getItem(CLAVE_DEL_CONSENTIMIENTO);

    if (crudo === null) {
      return null;
    }

    const guardado = JSON.parse(crudo) as Partial<Guardado> | null;

    if (
      guardado === null ||
      typeof guardado !== 'object' ||
      guardado.version !== VERSION_DEL_CONSENTIMIENTO ||
      !esDecision(guardado.decision)
    ) {
      return null;
    }

    return guardado.decision;
  } catch {
    return null;
  }
}

/** Guarda la decision. Si no se puede guardar, se pregunta de nuevo la proxima vez. */
export function guardarLaDecision(decision: Decision, ahora: Date = new Date()): void {
  const guardado: Guardado = {
    version: VERSION_DEL_CONSENTIMIENTO,
    decision,
    en: ahora.toISOString(),
  };

  try {
    window.localStorage.setItem(CLAVE_DEL_CONSENTIMIENTO, JSON.stringify(guardado));
  } catch {
    // Nada que hacer: la decision vale para esta visita, no para la siguiente.
  }
}
