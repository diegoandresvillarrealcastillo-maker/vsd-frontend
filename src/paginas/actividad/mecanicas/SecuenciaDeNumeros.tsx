import { useEffect, useRef, useState, type FormEvent } from 'react';

import {
  generarSecuencia,
  LARGO_INICIAL,
  marcaDeTiempo,
  RONDAS_DE_SECUENCIA as RONDAS,
  segundosDesde,
  siguienteLargo,
  tiempoAlaVista,
} from './cognicion.ts';
import type { PropsDeMecanica } from './registro.tsx';

/**
 * "Secuencia de numeros": se muestra una secuencia, se oculta y hay que
 * escribirla (SCRUM-84).
 *
 * Son doce rondas. Empieza con tres digitos; cada acierto alarga la siguiente
 * un digito, y cada fallo la acorta uno, sin bajar de tres. El puntaje crudo es
 * el numero de rondas acertadas, sobre doce.
 *
 * Acortar al fallar, en vez de terminar la partida, es lo que hace util el
 * resultado: con "al primer fallo se acaba", casi todo el mundo se quedaria en
 * cuatro o cinco aciertos y el nivel no distinguiria un buen dia de uno malo.
 * Asi, cada persona juega cerca de su propio limite.
 *
 * Mientras la secuencia esta a la vista se anuncia tambien a los lectores de
 * pantalla, y la respuesta se escribe en un campo normal: se juega igual con
 * teclado.
 */

interface Ronda {
  readonly largo: number;
  readonly acerto: boolean;
}

type Fase =
  | { readonly tipo: 'inicio' }
  | { readonly tipo: 'mirando'; readonly secuencia: string }
  | { readonly tipo: 'respondiendo'; readonly secuencia: string }
  | { readonly tipo: 'revisada'; readonly secuencia: string; readonly acerto: boolean };

/** "4 7 1": separada, se lee mejor y un lector de pantalla la dice digito a digito. */
function separada(secuencia: string): string {
  return secuencia.split('').join(' ');
}

export function SecuenciaDeNumeros({ alTerminar, enviando }: PropsDeMecanica) {
  const [fase, setFase] = useState<Fase>({ tipo: 'inicio' });
  const [rondas, setRondas] = useState<readonly Ronda[]>([]);
  const [respuesta, setRespuesta] = useState('');
  const inicio = useRef(0);
  const campo = useRef<HTMLInputElement>(null);
  const siguiente = useRef<HTMLButtonElement>(null);
  const terminada = useRef(false);

  // Pasado el tiempo, la secuencia se oculta y toca escribirla.
  useEffect(() => {
    if (fase.tipo !== 'mirando') {
      return undefined;
    }

    const temporizador = setTimeout(
      () => setFase({ tipo: 'respondiendo', secuencia: fase.secuencia }),
      tiempoAlaVista(fase.secuencia.length),
    );

    return () => clearTimeout(temporizador);
  }, [fase]);

  // El foco va a donde toca: al campo para responder, al boton para seguir.
  useEffect(() => {
    if (fase.tipo === 'respondiendo') {
      campo.current?.focus();
    }

    if (fase.tipo === 'revisada') {
      siguiente.current?.focus();
    }
  }, [fase.tipo]);

  function empezarRonda(largoDeLaRonda: number) {
    setRespuesta('');
    setFase({ tipo: 'mirando', secuencia: generarSecuencia(largoDeLaRonda) });
  }

  function empezar() {
    inicio.current = marcaDeTiempo();
    empezarRonda(LARGO_INICIAL);
  }

  function comprobar(evento: FormEvent) {
    evento.preventDefault();

    if (fase.tipo !== 'respondiendo') {
      return;
    }

    const acerto = respuesta.replace(/\s/g, '') === fase.secuencia;

    setRondas((antes) => [...antes, { largo: fase.secuencia.length, acerto }]);
    setFase({ tipo: 'revisada', secuencia: fase.secuencia, acerto });
  }

  function seguir() {
    if (terminada.current) {
      return;
    }

    if (rondas.length < RONDAS) {
      const ultima = rondas.at(-1);

      empezarRonda(
        ultima === undefined ? LARGO_INICIAL : siguienteLargo(ultima.largo, ultima.acerto),
      );
      return;
    }

    terminada.current = true;

    const aciertos = rondas.filter((ronda) => ronda.acerto).length;

    alTerminar({
      score: Math.min(aciertos, RONDAS),
      metadata: {
        aciertos,
        rondas: rondas.map(({ largo: digitos, acerto }) => ({ digitos, acerto })),
        largoMaximo: Math.max(0, ...rondas.filter((r) => r.acerto).map((r) => r.largo)),
        segundos: segundosDesde(inicio.current),
      },
    });
  }

  const numeroDeRonda = Math.min(rondas.length + (fase.tipo === 'revisada' ? 0 : 1), RONDAS);
  const aciertos = rondas.filter((ronda) => ronda.acerto).length;

  if (fase.tipo === 'inicio') {
    return (
      <div className="juego">
        <p className="actividad__texto">
          Verás una secuencia de números durante unos segundos. Cuando se oculte, escríbela. Son{' '}
          {RONDAS} rondas: si aciertas, la siguiente tiene un número más; si no, uno menos.
        </p>
        <button type="button" className="pildora" onClick={empezar}>
          Empezar
        </button>
      </div>
    );
  }

  return (
    <div className="juego">
      <p className="juego__marcador">
        <span>
          Ronda {numeroDeRonda} de {RONDAS}
        </span>
        <span>Aciertos: {aciertos}</span>
      </p>

      {fase.tipo === 'mirando' && (
        <div className="juego__pizarra" aria-live="polite">
          <p className="solo-lectores">Memoriza esta secuencia:</p>
          <p className="juego__secuencia">{separada(fase.secuencia)}</p>
        </div>
      )}

      {fase.tipo === 'respondiendo' && (
        <form className="actividad__formulario juego__respuesta" onSubmit={comprobar}>
          <p className="actividad__campo">
            <label htmlFor="secuencia">Escribe la secuencia</label>
            <input
              ref={campo}
              id="secuencia"
              inputMode="numeric"
              autoComplete="off"
              value={respuesta}
              onChange={(evento) => setRespuesta(evento.target.value)}
            />
          </p>
          <button type="submit" className="pildora">
            Comprobar
          </button>
        </form>
      )}

      {fase.tipo === 'revisada' && (
        <div className="juego__revision">
          <p className="juego__veredicto" role="status">
            {fase.acerto ? '¡Bien! Era esa.' : `Era ${separada(fase.secuencia)}.`}
          </p>
          <button
            ref={siguiente}
            type="button"
            className="pildora"
            onClick={seguir}
            disabled={enviando}
          >
            {rondas.length < RONDAS ? 'Siguiente ronda' : enviando ? 'Guardando…' : 'Terminar'}
          </button>
        </div>
      )}
    </div>
  );
}
