import { useEffect, useRef, useState, type CSSProperties } from 'react';

import { Icono } from '../../panel/Icono.tsx';
import {
  generarTablero,
  ladoDeLaRonda,
  marcaDeTiempo,
  RONDAS_DE_DIFERENCIA as RONDAS,
  segundosDesde,
  SEGUNDOS_POR_RONDA,
  SIMBOLOS_DE_DIFERENCIA as SIMBOLOS,
  type Tablero,
} from './cognicion.ts';
import type { PropsDeMecanica } from './registro.tsx';

/**
 * "Encuentra la diferencia": dos tableros casi iguales; hay que tocar la
 * casilla que cambio, contra reloj (SCRUM-84).
 *
 * Son quince rondas de quince segundos. El tablero crece cada cinco: 3×3, 4×4
 * y 5×5. El puntaje crudo es el numero de diferencias encontradas a tiempo,
 * sobre quince. Tocar una casilla equivocada cierra la ronda como fallo: si no,
 * se podria encontrar la diferencia tocando todas.
 *
 * Las casillas del segundo tablero son botones, asi que se juega con teclado,
 * y cada una dice que simbolo tiene: un lector de pantalla puede comparar los
 * dos tableros casilla a casilla.
 */

/** Cuanto se ve la solucion antes de pasar a la siguiente ronda. */
const PAUSA_TRAS_RONDA_MS = 1200;

type Motivo = 'acierto' | 'fallo' | 'tiempo';

type Fase =
  | { readonly tipo: 'inicio' }
  | { readonly tipo: 'jugando'; readonly ronda: number; readonly tablero: Tablero }
  | {
      readonly tipo: 'revisada';
      readonly ronda: number;
      readonly tablero: Tablero;
      readonly elegida: number | null;
      readonly motivo: Motivo;
    };

/** Lo que se dice tras cada ronda. El «casi» acompana: no senala el fallo. */
const VEREDICTOS: Readonly<
  Record<Motivo, { readonly texto: string; readonly resultado: 'acierto' | 'casi' }>
> = {
  acierto: { texto: '¡Encontrada!', resultado: 'acierto' },
  fallo: { texto: '¡Casi! Esa no era, pero te marcamos la que cambió.', resultado: 'casi' },
  tiempo: {
    texto: 'Se acabó el tiempo, sin problema. Te marcamos la que cambió.',
    resultado: 'casi',
  },
};

function nombreDe(simbolo: number | undefined): string {
  return simbolo === undefined ? '' : (SIMBOLOS[simbolo]?.nombre ?? '');
}

export function EncuentraLaDiferencia({ alTerminar, enviando }: PropsDeMecanica) {
  const [fase, setFase] = useState<Fase>({ tipo: 'inicio' });
  const [resultados, setResultados] = useState<readonly Motivo[]>([]);
  const [restantes, setRestantes] = useState(SEGUNDOS_POR_RONDA);
  const inicio = useRef(0);
  const terminada = useRef(false);
  const tableroAhora = useRef<HTMLDivElement>(null);

  function empezarRonda(ronda: number) {
    setRestantes(SEGUNDOS_POR_RONDA);
    setFase({ tipo: 'jugando', ronda, tablero: generarTablero(ladoDeLaRonda(ronda)) });
  }

  function cerrarRonda(elegida: number | null) {
    if (fase.tipo !== 'jugando') {
      return;
    }

    const motivo: Motivo =
      elegida === null ? 'tiempo' : elegida === fase.tablero.cambio ? 'acierto' : 'fallo';

    setResultados((antes) => [...antes, motivo]);
    setFase({ ...fase, tipo: 'revisada', elegida, motivo });
  }

  // El reloj de la ronda. Al llegar a cero, la ronda se cierra sin respuesta.
  useEffect(() => {
    if (fase.tipo !== 'jugando') {
      return undefined;
    }

    const empezo = marcaDeTiempo();
    const reloj = setInterval(() => {
      const quedan = SEGUNDOS_POR_RONDA - Math.floor((marcaDeTiempo() - empezo) / 1000);

      if (quedan > 0) {
        setRestantes(quedan);
        return;
      }

      clearInterval(reloj);
      setRestantes(0);
      setResultados((antes) => [...antes, 'tiempo']);
      setFase({ ...fase, tipo: 'revisada', elegida: null, motivo: 'tiempo' });
    }, 250);

    return () => clearInterval(reloj);
  }, [fase]);

  // Con la ronda ya revisada, un momento para ver la solucion y a la siguiente.
  useEffect(() => {
    if (fase.tipo !== 'revisada') {
      return undefined;
    }

    const temporizador = setTimeout(() => {
      if (fase.ronda < RONDAS) {
        setRestantes(SEGUNDOS_POR_RONDA);
        setFase({
          tipo: 'jugando',
          ronda: fase.ronda + 1,
          tablero: generarTablero(ladoDeLaRonda(fase.ronda + 1)),
        });
        return;
      }

      if (terminada.current) {
        return;
      }

      terminada.current = true;

      const aciertos = resultados.filter((motivo) => motivo === 'acierto').length;

      alTerminar({
        score: Math.min(aciertos, RONDAS),
        metadata: {
          aciertos,
          fallos: resultados.filter((motivo) => motivo === 'fallo').length,
          sinTiempo: resultados.filter((motivo) => motivo === 'tiempo').length,
          rondas: RONDAS,
          segundos: segundosDesde(inicio.current),
        },
      });
    }, PAUSA_TRAS_RONDA_MS);

    return () => clearTimeout(temporizador);
  }, [fase, resultados, alTerminar]);

  // Cada ronda nueva empieza con el foco en el tablero, para jugar con teclado.
  const rondaEnJuego = fase.tipo === 'jugando' ? fase.ronda : null;

  useEffect(() => {
    if (rondaEnJuego !== null) {
      tableroAhora.current?.querySelector('button')?.focus();
    }
  }, [rondaEnJuego]);

  if (fase.tipo === 'inicio') {
    return (
      <div className="juego">
        <p className="actividad__texto">
          Verás dos tableros casi iguales. En el segundo cambió una casilla: tócala antes de que se
          acabe el tiempo. Son {RONDAS} rondas de {SEGUNDOS_POR_RONDA} segundos, y el tablero crece
          cada cinco.
        </p>
        <button
          type="button"
          className="pildora"
          onClick={() => {
            inicio.current = marcaDeTiempo();
            empezarRonda(1);
          }}
        >
          Empezar
        </button>
      </div>
    );
  }

  const { tablero, ronda } = fase;
  const aciertos = resultados.filter((motivo) => motivo === 'acierto').length;
  const estiloDelTablero = { '--lado': tablero.lado } as CSSProperties;

  const veredicto = fase.tipo === 'revisada' ? VEREDICTOS[fase.motivo] : undefined;

  return (
    <div className="juego">
      <p className="juego__marcador">
        <span>
          Ronda {ronda} de {RONDAS}
        </span>
        <span>Aciertos: {aciertos}</span>
        <span>Quedan {fase.tipo === 'jugando' ? restantes : 0} s</span>
      </p>

      <p className="juego__indicacion">Toca en «Ahora» la casilla que cambió.</p>

      <div className="juego__tableros">
        <div className="juego__tablero-caja">
          <p className="juego__tablero-titulo" id="tablero-antes">
            Antes
          </p>
          <div
            className="juego__tablero"
            style={estiloDelTablero}
            role="list"
            aria-labelledby="tablero-antes"
          >
            {tablero.antes.map((simbolo, indice) => (
              <span
                key={indice}
                role="listitem"
                className="juego__casilla"
                aria-label={`Casilla ${indice + 1}: ${nombreDe(simbolo)}`}
              >
                <Icono nombre={SIMBOLOS[simbolo]?.icono ?? 'leaf'} tamano={22} />
              </span>
            ))}
          </div>
        </div>

        <div className="juego__tablero-caja">
          <p className="juego__tablero-titulo" id="tablero-ahora">
            Ahora
          </p>
          <div
            ref={tableroAhora}
            className="juego__tablero"
            style={estiloDelTablero}
            role="group"
            aria-labelledby="tablero-ahora"
          >
            {tablero.ahora.map((simbolo, indice) => {
              const marcada =
                fase.tipo === 'revisada'
                  ? indice === tablero.cambio
                    ? ' juego__casilla--cambio'
                    : indice === fase.elegida
                      ? ' juego__casilla--equivocada'
                      : ''
                  : '';

              return (
                <button
                  key={indice}
                  type="button"
                  className={`juego__casilla juego__casilla--boton${marcada}`}
                  aria-label={`Casilla ${indice + 1}: ${nombreDe(simbolo)}`}
                  disabled={fase.tipo !== 'jugando'}
                  onClick={() => cerrarRonda(indice)}
                >
                  <Icono nombre={SIMBOLOS[simbolo]?.icono ?? 'leaf'} tamano={22} />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p
        className="juego__veredicto"
        data-resultado={veredicto === undefined ? undefined : veredicto.resultado}
        role="status"
      >
        {veredicto === undefined ? '' : veredicto.texto}
      </p>

      {enviando && (
        <p className="actividad__cargando" role="status">
          Guardando…
        </p>
      )}
    </div>
  );
}
