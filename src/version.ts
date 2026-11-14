/**
 * La version de la aplicacion que se esta usando (SCRUM-234).
 *
 * Existe para poder contestar una pregunta que antes no tenia respuesta: «¿esto que veo es la version
 * nueva?». El 18/10, al probar PRE en un telefono, no se veia nada de lo nuevo, la version nueva estaba
 * desplegada y nadie podia saber cual corria el telefono: la aplicacion no lo decia.
 *
 * Es lo que Vite incrusta al compilar (`vite.config.ts`): cuando se compilo y que commit era. **Nada de la
 * persona**: ni cuenta ni dispositivo.
 */
export interface VersionDeLaApp {
  /** Cuando se compilo, en ISO 8601, o `null` en desarrollo. */
  readonly compiladaEl: string | null;
  /** El identificador corto del commit, o `null` si no se conoce. */
  readonly commit: string | null;
}

/**
 * Lo que dejo la compilacion. Fuera de una compilacion (desarrollo, pruebas) no existe, y se dice asi en lugar
 * de inventar una fecha.
 */
export const VERSION_DE_LA_APP: VersionDeLaApp =
  typeof __VSD_VERSION__ === 'undefined' ? { compiladaEl: null, commit: null } : __VSD_VERSION__;

/**
 * La version como se lee en la pantalla: «Versión del 21/10/2026 · 3fa3577».
 *
 * La fecha es la de **Colombia**, no la de Greenwich: una compilacion de las diez de la noche tiene que caer en
 * el dia en que se hizo.
 */
export function describirLaVersion(version: VersionDeLaApp): string {
  const fecha = version.compiladaEl === null ? null : new Date(version.compiladaEl);

  if (fecha === null || Number.isNaN(fecha.getTime())) {
    return 'Versión de desarrollo';
  }

  const dia = new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Bogota',
  }).format(fecha);

  return version.commit === null ? `Versión del ${dia}` : `Versión del ${dia} · ${version.commit}`;
}
