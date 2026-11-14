import type { HitoDeLaEscalera } from '../infraestructura/api/racha.ts';

/**
 * Los hitos de la racha (SCRUM-243): nombre, escena y lo que cambia en cada uno.
 *
 * Que numeros son hitos lo decide el servidor (`HITOS_DE_LA_RACHA`, SCRUM-242) y llega ya armado en
 * la escalera de `GET /api/racha`. Aqui solo se le pone nombre y cara a cada uno, con la misma
 * escalera de colores de la llama de la barra (ascua, naranja, ambar, fuego, oro).
 */

/** Los hitos de la tabla del servidor; los de despues del primer ano son multiplos de 365. */
const DE_LA_TABLA = [3, 7, 14, 30, 50, 100, 200, 365] as const;

const DIAS_DE_UN_ANO = 365;

/** La escena de celebracion de cada hito. Del 365 en adelante, todos usan la del ano. */
export type EscenaDelHito =
  'chispa' | 'semana' | 'dosSemanas' | 'mes' | 'cincuenta' | 'cien' | 'doscientos' | 'ano';

const ESCENA_POR_HITO: Readonly<Record<(typeof DE_LA_TABLA)[number], EscenaDelHito>> = {
  3: 'chispa',
  7: 'semana',
  14: 'dosSemanas',
  30: 'mes',
  50: 'cincuenta',
  100: 'cien',
  200: 'doscientos',
  365: 'ano',
};

const NOMBRE_POR_HITO: Readonly<Record<(typeof DE_LA_TABLA)[number], string>> = {
  3: 'Primera chispa',
  7: 'Primera semana',
  14: 'Dos semanas',
  30: 'Un mes',
  50: 'Cincuenta días',
  100: 'Cien días',
  200: 'Doscientos días',
  365: 'Un año',
};

/** Lo que cambia en la escena de cada hito: describe la celebracion, no el nivel de la llama. */
const QUE_CAMBIA_POR_HITO: Readonly<Record<(typeof DE_LA_TABLA)[number], string>> = {
  3: 'Una ráfaga de chispas',
  7: 'Tu semana se funde en una sola barra',
  14: 'Dos barras que se unen y chispas que giran',
  30: 'Rayos de luz detrás de tu llama ámbar',
  50: 'Un halo de luz rodea a tu mascota',
  100: 'Fuegos artificiales sobre tu hoguera',
  200: 'Chispas doradas que suben sin parar',
  365: 'Estrella dorada y lluvia de confeti',
};

const NUMEROS_DE_LOS_ANOS = [
  '',
  '',
  'Dos',
  'Tres',
  'Cuatro',
  'Cinco',
  'Seis',
  'Siete',
  'Ocho',
  'Nueve',
  'Diez',
] as const;

function esDeLaTabla(hito: number): hito is (typeof DE_LA_TABLA)[number] {
  return (DE_LA_TABLA as readonly number[]).includes(hito);
}

function esUnAniversario(hito: number): boolean {
  return hito > DIAS_DE_UN_ANO && hito % DIAS_DE_UN_ANO === 0;
}

/** Cuantos anos cumple un aniversario: 730 son 2. */
export function anosDeUnAniversario(hito: number): number {
  return Math.round(hito / DIAS_DE_UN_ANO);
}

/** El mayor hito de la tabla que no pasa de `dias`; el primero si ninguno llega. */
function hitoDeLaTablaHasta(dias: number): (typeof DE_LA_TABLA)[number] {
  return [...DE_LA_TABLA].reverse().find((hito) => hito <= dias) ?? DE_LA_TABLA[0];
}

/** El nombre de un hito: «Primera semana», «Un mes», «Dos años». */
export function nombreDelHito(hito: number): string {
  if (esDeLaTabla(hito)) {
    return NOMBRE_POR_HITO[hito];
  }

  if (esUnAniversario(hito)) {
    const anos = anosDeUnAniversario(hito);

    return anos <= 10 ? `${NUMEROS_DE_LOS_ANOS[anos] ?? ''} años` : `${String(anos)} años`;
  }

  return `${String(hito)} días`;
}

/** La escena con la que se celebra un hito. */
export function escenaDelHito(hito: number): EscenaDelHito {
  if (esUnAniversario(hito)) {
    return 'ano';
  }

  return ESCENA_POR_HITO[hitoDeLaTablaHasta(hito)];
}

/** Lo que cambia al llegar a un hito, en una frase, para la escalera del panel. */
export function queCambiaEn(hito: number): string {
  if (esUnAniversario(hito)) {
    return QUE_CAMBIA_POR_HITO[365];
  }

  return QUE_CAMBIA_POR_HITO[hitoDeLaTablaHasta(hito)];
}

/** El mayor hito ya logrado, o 0: de ahi parte la barra de progreso hacia el siguiente. */
export function hitoAnteriorDe(escalera: readonly HitoDeLaEscalera[]): number {
  return escalera.reduce((mayor, hito) => (hito.logrado ? Math.max(mayor, hito.dias) : mayor), 0);
}
