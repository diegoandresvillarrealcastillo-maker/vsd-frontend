import { anosDeUnAniversario } from './hitos.ts';

/**
 * Lo que dice la mascota de la racha (SCRUM-243): al terminar una actividad, al abrir el panel de la
 * llama y por la tarde.
 *
 * Son aparte del banco general de la mascota (`frasesDeLaMascota.ts`): aquellas no saben cuantos dias
 * lleva la persona y estas si, porque la racha las llena con lo que dijo el servidor.
 *
 * ## Como se escriben
 *
 * - **Sin genero** hacia quien las lee, sin salud, sin mandar ni culpar: lo mismo que el banco general.
 * - **Cortas**: caben en un globo (90 caracteres, ya con los numeros).
 * - **Marcas** que se sustituyen: `{dias}` y `{faltan}` ya llevan su unidad («1 dia», «12 dias»), asi
 *   que la frase no se preocupa del singular; `{hito}` es solo el numero.
 * - **El riesgo solo vive en dos bancos** y cada uno dice algo verdadero (ADR 0024, addendum de
 *   SCRUM-242): con congelamientos disponibles, una actividad evita gastar uno; sin ellos, la racha
 *   esta en juego. «Perdiste» no existe: una racha que se corta descansa.
 *
 * No hay azar: la frase sale de los dias, asi que la misma racha dice siempre lo mismo y las pruebas no
 * dependen de la suerte.
 */

export type SituacionDeLaRacha =
  | 'primerDia'
  | 'diaNormal'
  | 'cercaDelHito'
  | 'regreso'
  | 'riesgoConCongelamientos'
  | 'riesgoSinCongelamientos';

export const SITUACIONES_DE_LA_RACHA: readonly SituacionDeLaRacha[] = [
  'primerDia',
  'diaNormal',
  'cercaDelHito',
  'regreso',
  'riesgoConCongelamientos',
  'riesgoSinCongelamientos',
];

export const BANCOS_DE_LA_RACHA: Readonly<Record<SituacionDeLaRacha, readonly string[]>> = {
  /** El primer dia de una racha nueva. */
  primerDia: [
    '¡Tu llama se encendió! Hoy empieza algo bueno.',
    'Un día ya cuenta. Qué bien empezar.',
    'Primer día de tu racha. Un paso a la vez.',
    'Así empieza una racha: con un día como hoy.',
    'Tu llama ya está encendida. Cuídala a tu ritmo.',
    'Hoy sumaste el primer día. Me alegra acompañarte.',
    '¡Qué bonito empezar! Tu llama lo agradece.',
    'Un día, y ya hay una llama. Eso es lo que cuenta.',
  ],

  /** Un dia mas de una racha que sigue. */
  diaNormal: [
    '¡Hoy también cuenta! Llevas {dias}.',
    'Otro día más a tu racha: llevas {dias}.',
    'Llevas {dias} y tu llama sigue creciendo.',
    'Constancia a tu manera: ya son {dias}.',
    '¡Así se hace! Tu llama ya lleva {dias}.',
    'Un paso más cada día: tu llama suma {dias}.',
    'Seguir viniendo suma: ya son {dias}.',
    'Hoy también estuviste aquí. Son {dias}.',
  ],

  /** Faltan uno, dos o tres dias para el proximo hito. */
  cercaDelHito: [
    'Solo {faltan} más y llegas a {hito} días.',
    'Ya casi: {faltan} más para los {hito} días.',
    'Tu próximo hito está cerca: {hito} días, con {faltan} más.',
    '¡Qué cerca! {faltan} más y tu llama lo celebra.',
    'Falta poco para los {hito} días: {faltan} más.',
    'Con {faltan} más celebras {hito} días.',
    'Cada día te acerca: {faltan} más hasta los {hito}.',
    'Se viene algo bonito: {faltan} más y son {hito} días.',
  ],

  /**
   * La llama descansa (el panel). Quien nunca ha tenido una racha tambien ve la llama en descanso,
   * asi que ninguna frase supone que la persona ya estuvo aqui antes.
   */
  regreso: [
    'Qué bueno tenerte aquí. Hoy empieza una racha nueva.',
    'Tu llama espera. Con una actividad se enciende.',
    'Siempre se puede empezar: hoy se enciende la llama.',
    'Hoy tu llama despierta con un día nuevo.',
    'Sin cuentas ni reproches: hoy es un buen día para empezar.',
    'Tu llama descansa y hoy puede despertar.',
    'Un día basta para encender el camino.',
    'Qué gusto verte. Una actividad y la llama despierta.',
  ],

  /** Hoy no hubo actividad y todavia quedan congelamientos: no hay nada que perder, y se dice asi. */
  riesgoConCongelamientos: [
    'Con una actividad hoy mantienes tu racha sin usar un congelamiento.',
    'Una actividad hoy y no gastas un congelamiento. Sin prisa.',
    'Tu racha de {dias} sigue aquí. Una actividad hoy y la cuidas.',
    'Todavía hay tiempo hoy para sumar y no usar un congelamiento.',
    'Aunque hoy no puedas, un congelamiento te cubre. Con una actividad, no lo usas.',
    'Tu llama de {dias} te espera. Una actividad hoy y sigue igual.',
    'Un rato hoy y tu racha de {dias} sigue sin gastar congelamientos.',
    'Hoy puedes sumar, o dejar que un congelamiento te cubra. Tú eliges.',
  ],

  /** Hoy no hubo actividad y ya no quedan congelamientos: la racha si esta en juego, y es verdad. */
  riesgoSinCongelamientos: [
    'Tu racha de {dias} está en juego hoy. Una actividad la mantiene.',
    'Hoy tu racha de {dias} depende de una actividad. Sin prisa.',
    'Ya usaste los congelamientos del mes. Una actividad hoy mantiene tu racha de {dias}.',
    'Tu llama de {dias} te espera hoy: una actividad la mantiene.',
    'Sin congelamientos este mes, una actividad hoy cuida tu racha de {dias}.',
    'Una actividad hoy y tu racha de {dias} sigue en pie.',
    'Tu racha de {dias} está en juego. Un rato hoy alcanza.',
    'Este mes no quedan congelamientos: hoy una actividad mantiene tu racha.',
  ],
};

/** «1 día» o «12 días». */
function conUnidad(cantidad: number): string {
  return `${String(cantidad)} ${cantidad === 1 ? 'día' : 'días'}`;
}

/**
 * La frase de una situacion, con los numeros puestos.
 *
 * Elige por los dias (o por `variante`, si la pantalla quiere otra): sin azar.
 */
export function fraseDeLaRacha(
  situacion: SituacionDeLaRacha,
  valores: { dias: number; faltan?: number; hito?: number; variante?: number },
): string {
  const banco = BANCOS_DE_LA_RACHA[situacion];
  const posicion =
    (((valores.variante ?? valores.dias) % banco.length) + banco.length) % banco.length;
  const plantilla = banco[posicion] ?? banco[0] ?? '';

  return plantilla
    .replaceAll('{dias}', conUnidad(valores.dias))
    .replaceAll('{faltan}', conUnidad(valores.faltan ?? 1))
    .replaceAll('{hito}', String(valores.hito ?? valores.dias));
}

/** Lo que dice la mascota al llegar a un hito. */
const FRASE_POR_HITO: Readonly<Record<number, string>> = {
  3: '¡Primera chispa! Tu llama ya está encendida de verdad.',
  7: '¡Una semana entera! Qué constancia.',
  14: '¡Dos semanas seguidas! Tu constancia ya se nota.',
  30: '¡Un mes completo! Tu llama es cada vez más fuerte.',
  50: '¡Cincuenta días! Esto ya es un camino tuyo.',
  100: '¡Cien días! Esto ya es un hábito tuyo.',
  200: '¡Doscientos días! Qué camino llevas.',
  365: '¡Un año de constancia! Gracias por quedarte.',
};

export function fraseDelHito(hito: number): string {
  const deLaTabla = FRASE_POR_HITO[hito];

  if (deLaTabla !== undefined) {
    return deLaTabla;
  }

  if (hito > 365 && hito % 365 === 0) {
    return `¡Ya son ${String(anosDeUnAniversario(hito))} años de constancia! Gracias por quedarte.`;
  }

  return '¡Otro hito en tu camino! Qué constancia.';
}
