import { useId } from 'react';

import '../../../estilos/viva.css';
import { vibrar } from './haptico.ts';

/**
 * Un numero que se sube y se baja con dos botones grandes (SCRUM-173).
 *
 * Escribir un numero en un telefono es incomodo; tocar «+» no. El campo sigue siendo un
 * `<input type="number">` de verdad, con su etiqueta: quien prefiera teclear puede, y los
 * lectores de pantalla lo leen como siempre. Los botones solo lo mueven de a `paso` dentro
 * de `minimo` y `maximo`.
 */
export function Contador({
  etiqueta,
  valor,
  alCambiar,
  minimo,
  maximo,
  paso = 1,
  unidad,
}: {
  etiqueta: string;
  valor: number;
  alCambiar: (nuevo: number) => void;
  minimo: number;
  maximo: number;
  paso?: number;
  unidad?: string;
}) {
  const id = useId();

  function mover(delta: number) {
    const siguiente = Math.round((valor + delta) * 100) / 100;

    if (siguiente < minimo || siguiente > maximo) {
      return;
    }

    vibrar(8);
    alCambiar(siguiente);
  }

  return (
    <div className="viva-contador">
      <label className="viva-contador__etiqueta" htmlFor={id}>
        {etiqueta}
      </label>

      <div className="viva-contador__controles">
        <button
          type="button"
          className="viva-contador__boton"
          aria-label={`Menos: ${etiqueta}`}
          disabled={valor - paso < minimo}
          onClick={() => mover(-paso)}
        >
          <span aria-hidden="true">−</span>
        </button>

        <div className="viva-contador__valor">
          <input
            id={id}
            className="viva-contador__campo"
            type="number"
            inputMode="decimal"
            min={minimo}
            max={maximo}
            step={paso}
            value={valor}
            onChange={(evento) => alCambiar(Number(evento.target.value))}
          />
          {unidad !== undefined && <span className="viva-contador__unidad">{unidad}</span>}
        </div>

        <button
          type="button"
          className="viva-contador__boton"
          aria-label={`Más: ${etiqueta}`}
          disabled={valor + paso > maximo}
          onClick={() => mover(paso)}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
    </div>
  );
}
