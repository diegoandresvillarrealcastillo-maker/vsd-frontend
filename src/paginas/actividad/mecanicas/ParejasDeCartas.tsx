import { useEffect, useRef, useState } from 'react';

import { Icono } from '../../panel/Icono.tsx';
import {
  marcaDeTiempo,
  PAREJAS,
  puntajeDeParejas,
  repartir,
  segundosDesde,
  SIMBOLOS_DE_PAREJAS,
  type Carta,
} from './cognicion.ts';
import type { PropsDeMecanica } from './registro.tsx';

/**
 * "Parejas de cartas": doce cartas boca abajo, seis parejas (SCRUM-84).
 *
 * Se voltean de dos en dos. Si coinciden, se quedan a la vista; si no, vuelven
 * boca abajo al momento. Termina al encontrar las seis. El puntaje lo calcula
 * `puntajeDeParejas` a partir de los intentos.
 *
 * Cada carta es un boton: se juega igual con teclado (Tab y Enter) que con el
 * raton, y un lector de pantalla dice que hay en cada una al voltearla.
 */

/** Cuanto se dejan ver dos cartas que no coinciden antes de volver boca abajo. */
const ESPERA_AL_FALLAR_MS = 900;

function nombreDe(carta: Carta): string {
  return SIMBOLOS_DE_PAREJAS[carta.simbolo]?.nombre ?? '';
}

export function ParejasDeCartas({ alTerminar, enviando }: PropsDeMecanica) {
  const [cartas] = useState(repartir);
  const [volteadas, setVolteadas] = useState<readonly number[]>([]);
  const [encontradas, setEncontradas] = useState<ReadonlySet<number>>(() => new Set());
  const [intentos, setIntentos] = useState(0);
  const [aviso, setAviso] = useState('');
  // El reloj empieza con la primera carta, no al abrir la pantalla.
  const inicio = useRef<number | null>(null);
  const terminada = useRef(false);

  // Dos cartas distintas a la vista: se dejan ver un momento y vuelven.
  useEffect(() => {
    if (volteadas.length !== 2) {
      return undefined;
    }

    const temporizador = setTimeout(() => setVolteadas([]), ESPERA_AL_FALLAR_MS);

    return () => clearTimeout(temporizador);
  }, [volteadas]);

  function voltear(carta: Carta) {
    if (
      terminada.current ||
      volteadas.length === 2 ||
      volteadas.includes(carta.id) ||
      encontradas.has(carta.simbolo)
    ) {
      return;
    }

    inicio.current ??= marcaDeTiempo();

    const primera = cartas.find((una) => una.id === volteadas[0]);

    if (primera === undefined) {
      setVolteadas([carta.id]);
      setAviso(`Volteaste ${nombreDe(carta)}.`);
      return;
    }

    const intentosAhora = intentos + 1;

    setIntentos(intentosAhora);

    if (primera.simbolo !== carta.simbolo) {
      setVolteadas([primera.id, carta.id]);
      setAviso(`No coinciden: ${nombreDe(primera)} y ${nombreDe(carta)}.`);
      return;
    }

    const nuevas = new Set(encontradas).add(carta.simbolo);

    setEncontradas(nuevas);
    setVolteadas([]);
    setAviso(`Pareja encontrada: ${nombreDe(carta)}.`);

    if (nuevas.size === PAREJAS) {
      terminada.current = true;
      alTerminar({
        score: puntajeDeParejas(intentosAhora),
        metadata: {
          intentos: intentosAhora,
          parejas: PAREJAS,
          segundos: segundosDesde(inicio.current),
        },
      });
    }
  }

  return (
    <div className="juego">
      <p className="juego__marcador">
        <span>
          Parejas: {encontradas.size} de {PAREJAS}
        </span>
        <span>Intentos: {intentos}</span>
      </p>

      <div className="juego__cartas" role="group" aria-label="Cartas">
        {cartas.map((carta, indice) => {
          const encontrada = encontradas.has(carta.simbolo);
          const aLaVista = encontrada || volteadas.includes(carta.id);
          const simbolo = SIMBOLOS_DE_PAREJAS[carta.simbolo];

          return (
            <button
              key={carta.id}
              type="button"
              className={`juego__carta${aLaVista ? ' juego__carta--a-la-vista' : ''}${encontrada ? ' juego__carta--encontrada' : ''}`}
              aria-label={
                aLaVista
                  ? `Carta ${indice + 1}: ${simbolo?.nombre ?? ''}${encontrada ? ', pareja encontrada' : ''}`
                  : `Carta ${indice + 1}, boca abajo`
              }
              aria-disabled={encontrada}
              onClick={() => voltear(carta)}
            >
              {aLaVista && simbolo !== undefined && <Icono nombre={simbolo.icono} tamano={28} />}
            </button>
          );
        })}
      </div>

      <p className="solo-lectores" aria-live="polite">
        {aviso}
      </p>

      {enviando && (
        <p className="actividad__cargando" role="status">
          Guardando…
        </p>
      )}
    </div>
  );
}
