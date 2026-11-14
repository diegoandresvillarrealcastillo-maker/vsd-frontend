/**
 * Lo que se lee mientras la aplicacion carga (SCRUM-283): un dato curioso o algo de VSD Health, uno a
 * la vez, cada pocos segundos. La pantalla de carga no se queda vacia, y quien espera ve que la
 * aplicacion tiene algo que contarle.
 *
 * Es la misma lista que esta escrita a mano en el `index.html`, que pinta la pantalla antes de que
 * baje ningun modulo: la prueba de `PantallaDeCarga.spec.tsx` comprueba que sean iguales, en el mismo
 * orden. Si se cambia una, se cambia la otra.
 *
 * ## Que entra y que no
 *
 * - **Datos curiosos**: cultura general, comprobable y sin relacion con la salud. Ninguno es un
 *   consejo ni habla de sintomas, diagnosticos o tratamientos (ver `DatoCurioso` en el backend).
 * - **De VSD Health**: lo que la aplicacion de verdad hace hoy. No se promete nada que no este.
 * - Cortos: caben en tres lineas en un telefono angosto (`LARGO_MAXIMO`).
 * - **Siempre ocho, uno de cada tipo por turno**: la animacion del `index.html` reparte el tiempo en
 *   ocho partes iguales. Cambiar el numero obliga a cambiar los cuadros de `vsd-carga-dato`.
 */

export type TipoDeDato = 'curioso' | 'app';

export interface DatoDeLaCarga {
  readonly tipo: TipoDeDato;
  readonly texto: string;
}

/** Lo que dice la etiqueta que va encima de cada uno. */
export const ETIQUETAS_DE_LA_CARGA: Readonly<Record<TipoDeDato, string>> = {
  curioso: 'Dato curioso',
  app: 'Sobre VSD Health',
};

/** Cuanto puede medir un texto para que no pase de tres lineas en una pantalla de 320 px. */
export const LARGO_MAXIMO_DE_UN_DATO = 110;

export const DATOS_DE_LA_CARGA: readonly DatoDeLaCarga[] = [
  { tipo: 'curioso', texto: 'Los pulpos tienen tres corazones.' },
  { tipo: 'app', texto: 'Tu diario es solo tuyo: nadie más lo lee.' },
  { tipo: 'curioso', texto: 'Un día en Venus dura más que un año en Venus.' },
  {
    tipo: 'app',
    texto: 'Puedes usar VSD Health sin conexión: lo que hagas se envía cuando vuelva la red.',
  },
  { tipo: 'curioso', texto: 'Colombia es el país con más especies de aves del planeta.' },
  {
    tipo: 'app',
    texto: 'Puedes cambiar de mascota y ponerle nombre cuando quieras, desde tu perfil.',
  },
  {
    tipo: 'curioso',
    texto:
      'Las nutrias marinas duermen a veces tomadas de la mano para no separarse mientras flotan.',
  },
  {
    tipo: 'app',
    texto: 'VSD Health acompaña tu bienestar: no diagnostica ni reemplaza la atención profesional.',
  },
];
