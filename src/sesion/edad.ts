import { diaEnLaZona } from '../tiempo/zonaHoraria.ts';

/**
 * La mayoria de edad, vista desde el formulario.
 *
 * ---------------------------------------------------------------------------
 * Esto es una cortesia, no una barrera
 * ---------------------------------------------------------------------------
 *
 * VSD Health es solo para mayores de 18 anos, y quien lo comprueba de verdad es
 * la API: calcula la edad en el servidor con el dia de la persona y rechaza con
 * `MENOR_DE_EDAD`. Lo de aqui existe para dos cosas:
 *
 * - Que un menor vea la pantalla de rechazo **al instante**, sin que ningun dato
 *   suyo salga del dispositivo y sin que se le cree una identidad que despues
 *   haya que borrar.
 * - Que una fecha mal escrita se corrija antes de enviar.
 *
 * Quien se salte esto llamando a la API directamente se encuentra con la misma
 * regla del otro lado. La logica es la misma que la de `FechaDeNacimiento` en el
 * backend, a proposito: si las dos se separaran, el formulario dejaria pasar lo
 * que la API rechaza o rechazaria lo que la API admite.
 */

/** Edad minima para usar VSD Health. */
export const EDAD_MINIMA = 18;

/** Mas que esto no vive nadie: una fecha mas vieja es un error de escritura. */
const ANOS_MAXIMOS = 120;

const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Lo que se puede decir de lo que la persona escribio. */
export type EvaluacionDeLaFecha = 'vacia' | 'invalida' | 'menor' | 'mayor';

/** Si el texto es un dia real con formato AAAA-MM-DD: "2026-02-30" no lo es. */
function esUnDiaReal(texto: string): boolean {
  const partes = FORMATO.exec(texto);

  if (!partes) {
    return false;
  }

  const fecha = new Date(Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3])));

  return fecha.toISOString().slice(0, 10) === texto;
}

/**
 * Los anos cumplidos a `hoy`. Los nacidos un 29 de febrero cumplen el 1 de marzo
 * en los anos que no son bisiestos, como en el servidor.
 */
export function edadEn(nacimiento: string, hoy: string): number {
  const [anioN, mesN, diaN] = nacimiento.split('-').map(Number) as [number, number, number];
  const [anioH, mesH, diaH] = hoy.split('-').map(Number) as [number, number, number];
  const cumplioEsteAnio = mesH > mesN || (mesH === mesN && diaH >= diaN);

  return anioH - anioN - (cumplioEsteAnio ? 0 : 1);
}

/**
 * Que hacer con la fecha escrita.
 *
 * @param hoy El dia de la persona, por defecto el de su zona horaria: con el de
 *   UTC, quien cumple 18 por la noche en Colombia seguiria siendo menor hasta
 *   el dia siguiente.
 */
export function evaluarLaFecha(
  texto: string,
  hoy: string = diaEnLaZona(new Date()),
): EvaluacionDeLaFecha {
  if (texto.trim() === '') {
    return 'vacia';
  }

  // Una fecha de hoy o del futuro no es de alguien que ya nacio.
  if (!esUnDiaReal(texto) || texto >= hoy || edadEn(texto, hoy) > ANOS_MAXIMOS) {
    return 'invalida';
  }

  return edadEn(texto, hoy) >= EDAD_MINIMA ? 'mayor' : 'menor';
}

/** El primer dia que admite el campo de fecha: hace 120 anos. */
export function fechaMinimaDelCampo(hoy: string = diaEnLaZona(new Date())): string {
  const [anio, mes, dia] = hoy.split('-') as [string, string, string];

  return `${Number(anio) - ANOS_MAXIMOS}-${mes}-${dia}`;
}

/** El ultimo dia que admite el campo de fecha: ayer. */
export function fechaMaximaDelCampo(hoy: string = diaEnLaZona(new Date())): string {
  const ayer = new Date(`${hoy}T00:00:00Z`);

  ayer.setUTCDate(ayer.getUTCDate() - 1);

  return ayer.toISOString().slice(0, 10);
}
