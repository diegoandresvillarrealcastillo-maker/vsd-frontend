import type { CSSProperties } from 'react';

import '../../../estilos/viva.css';
import type { Modulo } from '../../../infraestructura/api/cuenta.ts';
import { Icono } from '../../panel/Icono.tsx';
import { FORMA_QUE_FLOTA } from '../../panel/modulos.ts';

/**
 * Donde sube cada forma y a que ritmo. Es una tabla fija y no azar: pintar dos veces lo mismo da
 * lo mismo, y las pruebas no dependen de la suerte. Los retrasos son negativos para que, al
 * abrir la pantalla, las formas ya vayan por la mitad del camino y no salgan todas de abajo a la
 * vez.
 */
const FORMAS = [
  { x: '6%', tam: 22, dur: 19, ret: -3 },
  { x: '19%', tam: 30, dur: 24, ret: -14 },
  { x: '31%', tam: 18, dur: 17, ret: -8 },
  { x: '45%', tam: 26, dur: 26, ret: -20 },
  { x: '58%', tam: 20, dur: 18, ret: -11 },
  { x: '70%', tam: 32, dur: 23, ret: -5 },
  { x: '82%', tam: 19, dur: 20, ret: -16 },
  { x: '92%', tam: 27, dur: 25, ret: -9 },
] as const;

/**
 * El fondo de la pantalla de una actividad (SCRUM-173): el tinte del modulo, tres manchas de luz
 * que se desplazan muy despacio y unas formas del modulo (hojas, destellos o corazones) que suben
 * flotando. Da vida sin pedir atencion.
 *
 * Es solo adorno: no recibe toques ni lo lee un lector de pantalla, y con
 * `prefers-reduced-motion` todo se queda quieto.
 */
export function FondoVivo({ modulo }: { modulo?: Modulo | undefined }) {
  const forma = modulo === undefined ? 'sparkles' : FORMA_QUE_FLOTA[modulo];

  return (
    <div className="viva-fondo" aria-hidden="true">
      <span className="viva-fondo__mancha" />
      <span className="viva-fondo__mancha" />
      <span className="viva-fondo__mancha" />

      {FORMAS.map(({ x, tam, dur, ret }) => (
        <span
          key={x}
          className="viva-fondo__flota"
          style={
            {
              '--x': x,
              '--tam': `${String(tam)}px`,
              '--dur': `${String(dur)}s`,
              '--ret': `${String(ret)}s`,
            } as CSSProperties
          }
        >
          <Icono nombre={forma} tamano={tam} />
        </span>
      ))}
    </div>
  );
}
