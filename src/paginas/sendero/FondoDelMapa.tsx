import type { CSSProperties } from 'react';

import type { Modulo } from '../../infraestructura/api/cuenta.ts';
import { Icono } from '../panel/Icono.tsx';
import { FORMA_QUE_FLOTA } from '../panel/modulos.ts';

/**
 * Donde sube cada forma y a que ritmo. Es una tabla fija y no azar: pintar dos veces lo mismo da lo
 * mismo, y las pruebas no dependen de la suerte. Los retrasos son negativos para que, al abrir el
 * mapa, las formas ya vayan por la mitad del camino y no salgan todas de abajo a la vez.
 */
const FORMAS = [
  { x: '8%', tam: 20, dur: 21, ret: -4 },
  { x: '24%', tam: 28, dur: 26, ret: -15 },
  { x: '41%', tam: 18, dur: 19, ret: -9 },
  { x: '57%', tam: 24, dur: 28, ret: -21 },
  { x: '74%', tam: 30, dur: 23, ret: -6 },
  { x: '90%', tam: 22, dur: 25, ret: -12 },
] as const;

/**
 * El fondo animado detras del arbol de un modulo (SCRUM-310): el tinte del modulo, dos manchas de luz
 * que se desplazan muy despacio y unas formas que suben flotando, cada modulo a lo suyo. Bienestar
 * mece hojas, Cognicion hace titilar destellos y Emociones late con corazones.
 *
 * Va fuera de la ventana que se desplaza, asi que se queda quieto mientras los dias pasan por
 * encima. Es solo adorno: no recibe toques ni lo lee un lector de pantalla, y con
 * `prefers-reduced-motion` todo se queda quieto (`panelVivo.css`).
 *
 * Los colores los hereda de quien lo pinta (`--modulo-fondo` y `--modulo-acento`).
 */
export function FondoDelMapa({ modulo }: { modulo: Modulo }) {
  return (
    <div className={`mapa-fondo mapa-fondo--${modulo}`} aria-hidden="true">
      <span className="mapa-fondo__mancha" />
      <span className="mapa-fondo__mancha" />

      {FORMAS.map(({ x, tam, dur, ret }) => (
        <span
          key={x}
          className="mapa-fondo__forma"
          style={
            {
              '--x': x,
              '--tam': `${String(tam)}px`,
              '--dur': `${String(dur)}s`,
              '--ret': `${String(ret)}s`,
            } as CSSProperties
          }
        >
          <Icono nombre={FORMA_QUE_FLOTA[modulo]} tamano={tam} />
        </span>
      ))}
    </div>
  );
}
