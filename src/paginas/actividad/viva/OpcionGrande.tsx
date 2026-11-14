import type { ReactNode } from 'react';

import '../../../estilos/viva.css';
import { Chispas } from './Chispas.tsx';
import { vibrar } from './haptico.ts';

/**
 * Una opcion grande, para tocar con el pulgar (SCRUM-173).
 *
 * Es un radio o una casilla de verdad —`<input>` dentro de un `<label>`—, asi que el teclado,
 * los lectores de pantalla y los formularios funcionan igual que siempre. Lo que cambia es
 * como se ve: una tarjeta alta con «peldano» que se hunde al tocarla, un adorno opcional a la
 * izquierda y una marca. Al elegirla se pinta entera del color del modulo, da un rebote, abre un
 * aro y suelta chispas desde la marca, y el telefono vibra un instante si puede.
 *
 * Lo elegido se distingue por el relleno, la marca y el borde, no solo por el color. Todo el
 * movimiento es CSS: con `prefers-reduced-motion` la opcion cambia sin animarse.
 */
export function OpcionGrande({
  tipo,
  nombre,
  valor,
  marcada,
  alCambiar,
  texto,
  adorno,
  deshabilitada = false,
}: {
  tipo: 'radio' | 'checkbox';
  nombre: string;
  valor: string;
  marcada: boolean;
  alCambiar: () => void;
  texto: string;
  adorno?: ReactNode;
  deshabilitada?: boolean;
}) {
  return (
    <label
      className={`viva-opcion${marcada ? ' viva-opcion--marcada' : ''}${deshabilitada ? ' viva-opcion--deshabilitada' : ''}`}
    >
      <input
        className="viva-opcion__entrada"
        type={tipo}
        name={nombre}
        value={valor}
        checked={marcada}
        disabled={deshabilitada}
        onChange={() => {
          vibrar();
          alCambiar();
        }}
      />

      {marcada && <span className="viva-opcion__onda" aria-hidden="true" />}

      {adorno !== undefined && (
        <span className="viva-opcion__adorno" aria-hidden="true">
          {adorno}
        </span>
      )}

      <span className="viva-opcion__texto">{texto}</span>

      <span className="viva-opcion__marca" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="m5 12.5 4.5 4.5L19 7.5"
            stroke="currentColor"
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {marcada && <Chispas />}
      </span>
    </label>
  );
}
