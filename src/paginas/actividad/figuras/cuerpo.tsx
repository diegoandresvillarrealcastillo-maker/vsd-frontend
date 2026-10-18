import type { ReactNode } from 'react';

import { desde, trazo, type Punto, type TrazoConPunta } from './geometria.ts';

/**
 * Las piezas con las que se dibujan las figuras de estiramiento (SCRUM-226): una persona sentada, vista de
 * frente o de perfil, y los trazos que la acompanan.
 *
 * Es un dibujo de palitos a proposito: **el texto de cada paso es lo que dice que hacer** y la figura es
 * adorno para quien ve (`aria-hidden`), asi que basta con que se reconozca el gesto y hacia donde va. Las
 * flechas son lo que dice la direccion; la figura esta de frente, como en un espejo: la «derecha» de un paso es
 * la derecha de la pantalla.
 *
 * Todo cabe en un lienzo de 64 x 64 y se pinta con `currentColor`; las flechas toman el color del modulo
 * (`.fig-marca`, `.fig-punta` en `figuras.css`).
 */

export const SUELO = 56;

/** Un trazo con su punta (flecha o arco), listo para el lienzo. */
export function marca(trazoConPunta: TrazoConPunta, llave: string): ReactNode {
  return (
    <g key={llave}>
      <path className="fig-marca" d={trazoConPunta.d} />
      <path className="fig-punta" d={trazoConPunta.punta} />
    </g>
  );
}

/** Rayitas sueltas (ondas, destellos): solo trazo, sin punta. */
export function rayas(d: string, llave: string): ReactNode {
  return <path key={llave} className="fig-marca" d={d} />;
}

/** Los dos angulos de un brazo: el de arriba (hombro a codo) y el de abajo (codo a mano), de 0 hacia abajo. */
export type Brazo = readonly [arriba: number, abajo: number];

export interface PoseDeFrente {
  readonly cabeza?: { inclina?: number; gira?: number; baja?: number; sube?: number };
  readonly torso?: { inclina?: number; gira?: number };
  /** Cuanto se mueve cada hombro en vertical: negativo sube. */
  readonly hombros?: { i?: number; d?: number };
  readonly brazoI?: Brazo;
  readonly brazoD?: Brazo;
  readonly marcas?: readonly ReactNode[];
}

const CADERA_DE_FRENTE: Punto = [32, 42];
const LARGO_DEL_TRONCO = 22;
const BRAZO: readonly [number, number] = [9, 8];

function brazos(hombro: Punto, brazo: Brazo): ReactNode {
  const codo = desde(hombro, BRAZO[0], brazo[0]);
  const mano = desde(codo, BRAZO[1], brazo[1]);

  return (
    <g>
      <path d={trazo(hombro, codo, mano)} />
      <circle cx={mano[0]} cy={mano[1]} r="1.9" className="fig-relleno" />
    </g>
  );
}

function silla(deLado: boolean): ReactNode {
  return deLado ? (
    <path
      className="fig-suave"
      d={`M12 ${String(SUELO)} V30 M12 43.5 H34 M33 43.5 V${String(SUELO)}`}
    />
  ) : (
    <path
      className="fig-suave"
      d={`M18 43.5 H46 M19 43.5 V${String(SUELO)} M45 43.5 V${String(SUELO)}`}
    />
  );
}

/** Una persona sentada, de frente. */
export function frente({
  cabeza,
  torso,
  hombros,
  brazoI,
  brazoD,
  marcas = [],
}: PoseDeFrente): ReactNode {
  const inclinaTorso = torso?.inclina ?? 0;
  const estrecha = torso?.gira ?? 0;
  const cuello = desde(CADERA_DE_FRENTE, LARGO_DEL_TRONCO, 180 - inclinaTorso);
  const ancho = 9 * (1 - 0.5 * estrecha);
  const hombroI = desde(cuello, ancho, -90 - inclinaTorso);
  const hombroD = desde(cuello, ancho, 90 - inclinaTorso);
  const subeI: Punto = [hombroI[0], hombroI[1] + (hombros?.i ?? 0)];
  const subeD: Punto = [hombroD[0], hombroD[1] + (hombros?.d ?? 0)];

  const gira = cabeza?.gira ?? 0;
  const baja = cabeza?.baja ?? 0;
  const sube = cabeza?.sube ?? 0;
  const centro: Punto = [cuello[0], cuello[1] - 9 + baja * 2 - sube];
  const alto = 6.4 - baja * 1.3;
  const girada = inclinaTorso + (cabeza?.inclina ?? 0);

  return (
    <g>
      {silla(false)}
      <path
        className="fig-suave"
        d={`M28 ${String(CADERA_DE_FRENTE[1])} V${String(SUELO)} M36 ${String(CADERA_DE_FRENTE[1])} V${String(SUELO)} M25 ${String(SUELO)} H28 M36 ${String(SUELO)} H39`}
      />
      <path className="fig-grueso" d={trazo(CADERA_DE_FRENTE, cuello)} />
      <path d={trazo(subeI, cuello, subeD)} />
      {brazos(subeI, brazoI ?? [-9, -4])}
      {brazos(subeD, brazoD ?? [9, 4])}
      <g transform={`rotate(${String(girada)} ${String(cuello[0])} ${String(cuello[1])})`}>
        <path d={trazo(cuello, [centro[0], centro[1] + alto])} />
        <ellipse cx={centro[0]} cy={centro[1]} rx="6.4" ry={alto} />
        <circle
          cx={centro[0] - 2.5 + gira * 3.2}
          cy={centro[1] - 0.2 + baja * 0.8}
          r="0.9"
          className="fig-relleno"
        />
        <circle
          cx={centro[0] + 2.5 + gira * 3.2}
          cy={centro[1] - 0.2 + baja * 0.8}
          r="0.9"
          className="fig-relleno"
        />
      </g>
      {marcas}
    </g>
  );
}

export type Pierna = readonly [muslo: number, pierna: number, pie: number];

export interface PoseDePerfil {
  readonly torso?: { inclina?: number; curva?: number };
  /** Cuanto se inclina la cabeza respecto del tronco; positivo mira hacia abajo. */
  readonly cabeza?: number;
  readonly brazoA?: Brazo;
  readonly brazoB?: Brazo;
  readonly piernaA?: Pierna;
  readonly piernaB?: Pierna;
  readonly marcas?: readonly ReactNode[];
}

const CADERA_DE_PERFIL: Punto = [24, 42];
const MUSLO = 15;
const PANTORRILLA = 13;

/** Donde queda cada pieza de una pierna de perfil: la rodilla, el tobillo y la punta del pie. */
export function posicionDeLaPierna(
  [muslo, pierna, pie]: Pierna,
  cadera: Punto = CADERA_DE_PERFIL,
): { rodilla: Punto; tobillo: Punto; punta: Punto } {
  const rodilla = desde(cadera, MUSLO, muslo);
  const tobillo = desde(rodilla, PANTORRILLA, pierna);

  return { rodilla, tobillo, punta: desde(tobillo, 6, 90 + pie) };
}

function piernaDePerfil(pierna: Pierna, atras = false): ReactNode {
  const cadera: Punto = atras ? [CADERA_DE_PERFIL[0] - 4, CADERA_DE_PERFIL[1]] : CADERA_DE_PERFIL;
  const { rodilla, tobillo, punta } = posicionDeLaPierna(pierna, cadera);

  return (
    <path className={atras ? 'fig-atras' : undefined} d={trazo(cadera, rodilla, tobillo, punta)} />
  );
}

/** Una persona sentada, de perfil, mirando hacia la derecha. */
export function perfil({
  torso,
  cabeza = 0,
  brazoA,
  brazoB,
  piernaA = [90, 0, 0],
  piernaB,
  marcas = [],
}: PoseDePerfil): ReactNode {
  const inclina = torso?.inclina ?? 0;
  const curva = torso?.curva ?? 0;
  const cuello = desde(CADERA_DE_PERFIL, LARGO_DEL_TRONCO, 180 - inclina);
  // El tronco es una curva: el punto de control se corre hacia adelante (espalda arqueada) o hacia atras.
  const medio = desde(CADERA_DE_PERFIL, LARGO_DEL_TRONCO / 2, 180 - inclina);
  const control = desde(medio, curva, 90 - inclina);
  const centro: Punto = [cuello[0], cuello[1] - 8.6];
  const girada = inclina + cabeza;

  return (
    <g>
      {silla(true)}
      {piernaDePerfil(piernaB ?? [90, 0, 0], true)}
      {piernaDePerfil(piernaA)}
      <path
        className="fig-grueso"
        d={`M${String(CADERA_DE_PERFIL[0])} ${String(CADERA_DE_PERFIL[1])} Q${String(control[0])} ${String(control[1])} ${String(cuello[0])} ${String(cuello[1])}`}
      />
      {brazoB !== undefined && <g className="fig-atras">{brazos(cuello, brazoB)}</g>}
      {brazos(cuello, brazoA ?? [3, 12])}
      <g transform={`rotate(${String(girada)} ${String(cuello[0])} ${String(cuello[1])})`}>
        <path d={trazo(cuello, [centro[0], centro[1] + 6.4])} />
        <circle cx={centro[0]} cy={centro[1]} r="6.4" />
        <circle cx={centro[0] + 2.6} cy={centro[1] - 0.6} r="0.9" className="fig-relleno" />
        <path
          d={trazo(
            [centro[0] + 6.4, centro[1] + 0.4],
            [centro[0] + 8, centro[1] + 1.8],
            [centro[0] + 6.4, centro[1] + 2.4],
          )}
        />
      </g>
      {marcas}
    </g>
  );
}
