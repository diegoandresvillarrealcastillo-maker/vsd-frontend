import { evaluarLaFecha } from './edad.ts';

/**
 * La fecha de nacimiento que se escribio al crear la cuenta, guardada **en este dispositivo**
 * hasta el primer ingreso (SCRUM-189, decision D4).
 *
 * ## Por que existe
 *
 * Al registrarse con correo la fecha se pide, pero **no se manda a Supabase** (ADR 0021): no hace
 * falta para crear la identidad y no tiene por que quedar en un sitio que no sea nuestra base. Eso
 * obligaba a pedirla **otra vez** en «Completa tu registro», al confirmar el correo. Ahora se
 * recuerda aqui, solo en el dispositivo, y esa pantalla no la vuelve a preguntar.
 *
 * ## Lo que NO es
 *
 * - **No es una barrera.** La API sigue calculando la edad con la fecha que recibe y rechaza con
 *   `MENOR_DE_EDAD`; esto solo ahorra escribirla de nuevo (ver `edad.ts`).
 * - **No sale del dispositivo** hasta que «Completa tu registro» la manda a nuestra API, igual que
 *   si la hubiera escrito alli.
 *
 * ## Lo que se vigila
 *
 * - **De un solo correo**: otra persona que entre desde el mismo equipo no la hereda.
 * - **Caduca**: tres dias, que es lo que razonablemente tarda en abrirse un enlace de
 *   confirmacion. Una fecha de nacimiento no se queda en un navegador para siempre.
 * - **Nunca guarda a un menor** ni algo que no sea una fecha real y pasada: un menor ve el rechazo
 *   al instante y «no se guarda nada».
 * - **Se olvida** al terminar el registro, al ser rechazado y al elegir no continuar.
 * - Si el almacenamiento no esta (modo privado, sin espacio) no pasa nada: se pedira otra vez.
 *
 * Si el enlace de confirmacion se abre en **otro equipo**, aqui no hay nada y se pide de nuevo.
 */

export const CLAVE_DE_LA_FECHA_DEL_REGISTRO = 'vsd-h:fecha-del-registro';

/** Tres dias. */
export const VIGENCIA_DE_LA_FECHA_DEL_REGISTRO_EN_MS = 3 * 24 * 60 * 60 * 1000;

interface Guardada {
  readonly correo: string;
  readonly fecha: string;
  readonly guardadaEn: number;
}

/** Como se compara un correo aqui: sin espacios ni mayusculas, como en el acceso. */
function normalizado(correo: string): string {
  return correo.trim().toLowerCase();
}

/** Lo que se guarda, solo si es una fecha de un mayor. Si no, nada. */
export function guardarLaFechaDelRegistro(
  correo: string,
  fecha: string,
  ahora: number = Date.now(),
): void {
  if (evaluarLaFecha(fecha) !== 'mayor') {
    return;
  }

  const guardada: Guardada = { correo: normalizado(correo), fecha, guardadaEn: ahora };

  try {
    localStorage.setItem(CLAVE_DE_LA_FECHA_DEL_REGISTRO, JSON.stringify(guardada));
  } catch {
    // Sin almacenamiento: se pedira de nuevo al entrar, que es lo de siempre.
  }
}

function esGuardada(valor: unknown): valor is Guardada {
  if (typeof valor !== 'object' || valor === null) {
    return false;
  }

  const candidata = valor as Partial<Record<keyof Guardada, unknown>>;

  return (
    typeof candidata.correo === 'string' &&
    typeof candidata.fecha === 'string' &&
    typeof candidata.guardadaEn === 'number' &&
    Number.isFinite(candidata.guardadaEn)
  );
}

/** Borra lo que haya guardado, sea de quien sea. */
export function olvidarLaFechaDelRegistro(): void {
  try {
    localStorage.removeItem(CLAVE_DE_LA_FECHA_DEL_REGISTRO);
  } catch {
    // Nada que olvidar, o no se puede: la vigencia la acota de todos modos.
  }
}

/**
 * La fecha guardada para este correo, o `null` si no hay, es de otro correo, caduco o no sirve.
 * Lo que esta caducado o roto se borra al leerlo.
 */
export function leerLaFechaDelRegistro(
  correo: string | undefined,
  ahora: number = Date.now(),
): string | null {
  let crudo: string | null;

  try {
    crudo = localStorage.getItem(CLAVE_DE_LA_FECHA_DEL_REGISTRO);
  } catch {
    return null;
  }

  if (crudo === null) {
    return null;
  }

  let guardada: unknown;

  try {
    guardada = JSON.parse(crudo);
  } catch {
    guardada = null;
  }

  if (
    !esGuardada(guardada) ||
    ahora - guardada.guardadaEn >= VIGENCIA_DE_LA_FECHA_DEL_REGISTRO_EN_MS ||
    evaluarLaFecha(guardada.fecha) !== 'mayor'
  ) {
    olvidarLaFechaDelRegistro();

    return null;
  }

  // De otro correo no es de quien pregunta, pero tampoco se borra: es de quien se registro.
  return correo !== undefined && normalizado(correo) === guardada.correo ? guardada.fecha : null;
}
