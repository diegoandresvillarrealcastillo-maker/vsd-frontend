import type { Racha } from '../infraestructura/api/racha.ts';

/**
 * Lo que se celebra al terminar una actividad (SCRUM-243).
 *
 * - `dia`: hoy sumo un dia a la racha.
 * - `hito`: ademas, llego a un hito de la escalera; `hito` es el mas alto que cruzo.
 */
export type MomentoDeLaRacha =
  { readonly tipo: 'dia' } | { readonly tipo: 'hito'; readonly hito: number };

/**
 * Compara lo que se sabia de la racha con lo que acaba de decir el servidor.
 *
 * El cliente no cuenta dias: solo hay momento cuando hoy pasa de «sin hacer» a «hecho», que es la
 * primera actividad del dia. La segunda no celebra otra vez. Si en ese salto se cruzo mas de un hito
 * (una sincronizacion sin conexion puede sumar varios dias de golpe), se celebra solo el mas alto.
 *
 * Sin una racha anterior no se celebra nada: no se sabe si hoy ya habia sumado.
 *
 * No distingue «primera vez» de «volvio despues de un descanso»: una llama que descansaba y suma su
 * primer dia es, para quien la ve, una racha que empieza, y las frases de ese dia no suponen otra cosa.
 */
export function momentoDeLaRacha(antes: Racha | null, ahora: Racha): MomentoDeLaRacha | null {
  if (antes === null || antes.hechoHoy || !ahora.hechoHoy) {
    return null;
  }

  const hito = ahora.escalera.reduce(
    (mayor, uno) => (uno.logrado && uno.dias > antes.dias ? Math.max(mayor, uno.dias) : mayor),
    0,
  );

  return hito > 0 ? { tipo: 'hito', hito } : { tipo: 'dia' };
}
