/**
 * La zona horaria con la que la aplicacion decide que dia es y que hora es
 * (SCRUM-123).
 *
 * Antes todo se contaba en hora de Colombia, igual que el servidor. El servidor
 * ahora cuenta el dia en la zona de cada persona, y esto tiene que contarlo
 * igual: si la pantalla dijera "hoy" con una zona y la API guardara con otra,
 * el diario de alguien de viaje se veria corrido un dia.
 *
 * ---------------------------------------------------------------------------
 * De donde sale la zona
 * ---------------------------------------------------------------------------
 *
 * 1. **La de la cuenta**, en cuanto se conoce. Es la que el servidor usa, y es
 *    la que hay que usar aqui para coincidir con el.
 * 2. **La del dispositivo**, mientras la cuenta no se ha cargado: en la pantalla
 *    de acceso o el primer instante del panel.
 *
 * La del dispositivo es tambien la que se manda al servidor en cada entrada, de
 * modo que casi siempre las dos son la misma. Solo difieren si el servidor no
 * reconocio la zona del dispositivo y se quedo con la que ya tenia.
 *
 * Vive en un modulo y no en un contexto de React porque la usan funciones puras
 * que no estan dentro de ningun componente, y porque cambia como mucho una vez
 * por sesion, al cargar la cuenta.
 */

/** La de Colombia: la de todas las cuentas anteriores y el ultimo recurso. */
export const ZONA_POR_DEFECTO = 'America/Bogota';

let zonaDeLaCuenta: string | null = null;

/** La zona que informa este dispositivo, o la de Colombia si no la sabe decir. */
export function zonaDelDispositivo(): string {
  try {
    const zona = new Intl.DateTimeFormat().resolvedOptions().timeZone;

    return typeof zona === 'string' && zona.trim() !== '' ? zona : ZONA_POR_DEFECTO;
  } catch {
    return ZONA_POR_DEFECTO;
  }
}

/** Desde ahora, el dia y la hora se cuentan en esta zona: la que tiene la cuenta. */
export function fijarLaZonaDeLaCuenta(zona: string): void {
  zonaDeLaCuenta = zona;
}

/** Al salir, la zona de esa cuenta no se queda para la siguiente persona. */
export function olvidarLaZonaDeLaCuenta(): void {
  zonaDeLaCuenta = null;
}

/** La zona con la que contar ahora mismo. */
export function zonaActual(): string {
  return zonaDeLaCuenta ?? zonaDelDispositivo();
}

const formateadores = new Map<string, Intl.DateTimeFormat>();

/**
 * Un formateador de fechas en una zona, sin construirlo otra vez cada vez.
 *
 * Construir un `Intl.DateTimeFormat` cuesta, y se pide al pintar cada
 * anotacion del diario.
 *
 * Si la zona no es una que este navegador conozca, `Intl` lanza; en ese caso se
 * usa la de Colombia en lugar de romper la pantalla. Una hora corrida es mejor
 * que ninguna pantalla.
 */
export function formatoEn(
  zona: string,
  idioma: string,
  opciones: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const clave = `${idioma}|${zona}|${JSON.stringify(opciones)}`;
  const guardado = formateadores.get(clave);

  if (guardado !== undefined) {
    return guardado;
  }

  let nuevo: Intl.DateTimeFormat;

  try {
    nuevo = new Intl.DateTimeFormat(idioma, { ...opciones, timeZone: zona });
  } catch {
    nuevo = new Intl.DateTimeFormat(idioma, { ...opciones, timeZone: ZONA_POR_DEFECTO });
  }

  formateadores.set(clave, nuevo);

  return nuevo;
}

/** El dia de un instante en la zona de la persona, AAAA-MM-DD. */
export function diaEnLaZona(instante: Date): string {
  return formatoEn(zonaActual(), 'en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instante);
}

/**
 * Como se llama una zona en cristiano: "hora estandar de Colombia", "hora de
 * verano de Europa central". Para decirle a la persona en que hora se leen sus
 * avisos (SCRUM-127) sin ensenarle un identificador IANA como `America/Bogota`.
 *
 * Si el navegador no sabe nombrarla, se devuelve el identificador tal cual: es
 * feo pero exacto, y mejor que inventar o dejar la frase sin zona.
 */
export function nombreDeLaZona(zona: string = zonaActual(), instante: Date = new Date()): string {
  try {
    const nombre = new Intl.DateTimeFormat('es', { timeZone: zona, timeZoneName: 'long' })
      .formatToParts(instante)
      .find((parte) => parte.type === 'timeZoneName')?.value;

    return nombre === undefined || nombre === '' ? zona : nombre;
  } catch {
    return zona;
  }
}
