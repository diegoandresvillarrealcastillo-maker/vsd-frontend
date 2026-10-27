import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';

import '../../../estilos/juegos.css';
import { BarraDeAccion, BotonPrincipal } from '../viva/BarraDeAccion.tsx';
import { BarraDeProgreso } from '../viva/BarraDeProgreso.tsx';
import { ACIERTO, ANIMO_TRAS_CASI, EN_EL_JUEGO, elegir } from '../viva/mensajes.ts';
import { PasosDeInicio } from '../viva/PasosDeInicio.tsx';
import { useMascotaDeLaPersona } from '../viva/mascotaDeLaPersona.ts';
import { VozDeLaMascota } from '../viva/VozDeLaMascota.tsx';
import {
  generarSecuencia,
  marcaDeTiempo,
  puntajeSobreElMaximo,
  rondasAJugar,
  SECUENCIA_DE_SIEMPRE,
  segundosDesde,
  siguienteLargo,
  tiempoAlaVista,
} from './cognicion.ts';
import { leerSecuenciaDeNumeros } from './parametrosDeLaSesion.ts';
import type { PropsDeMecanica } from './registro.tsx';

/**
 * "Secuencia de numeros": se muestra una secuencia, se oculta y hay que
 * escribirla (SCRUM-84).
 *
 * Son siete rondas (SCRUM-288: el catalogo dice doce, y se juegan siete). Empieza con tres digitos;
 * cada acierto alarga la siguiente un digito, y cada fallo la acorta uno, sin bajar de tres. El
 * puntaje crudo es el numero de rondas acertadas, reescalado a los doce del catalogo
 * (`puntajeSobreElMaximo`).
 *
 * Esos numeros (rondas, largo inicial, tiempo a la vista) son los de siempre; si el servidor
 * entrega la sesion de hoy (SCRUM-208, ADR 0030) se usan los de la sesion, que en la Fase 0 son
 * los mismos. Si la sesion no llega o no se entiende, se usan los de siempre.
 *
 * Acortar al fallar, en vez de terminar la partida, es lo que hace util el
 * resultado: con "al primer fallo se acaba", casi todo el mundo se quedaria en
 * cuatro o cinco aciertos y el nivel no distinguiria un buen dia de uno malo.
 * Asi, cada persona juega cerca de su propio limite.
 *
 * Mientras la secuencia esta a la vista se anuncia tambien a los lectores de
 * pantalla, y la respuesta se escribe en un campo normal: se juega igual con
 * teclado.
 *
 * ## Como se ve (SCRUM-173)
 *
 * Cada digito es una ficha de color que aparece con su retraso, y una barra se vacia para
 * mostrar cuanto falta para que se oculten. Al escribir, las fichas de abajo se van llenando.
 * La mascota acompana en cada fase y, tras cada ronda, dice lo suyo: celebra el acierto o anima
 * tras un «casi» sin senalarlo. Las fichas son adorno (`aria-hidden`, con el numero dibujado por
 * CSS): lo que leen los lectores de pantalla es el texto de siempre.
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

/** Las fichas de una secuencia. Solo adorno: el texto lo lleva otro elemento. */
function Fichas({ digitos }: { digitos: string }) {
  return (
    <div className="juego__digitos" aria-hidden="true">
      {digitos.split('').map((digito, indice) => (
        <span
          key={indice}
          className="juego__digito"
          style={{ '--i': indice } as CSSProperties}
          data-d={digito}
        />
      ))}
    </div>
  );
}

/** Un hueco por cada digito que falta escribir; se llena con cada digito tecleado. */
function Huecos({ largo, escrito }: { largo: number; escrito: string }) {
  return (
    <div className="juego__digitos" aria-hidden="true">
      {Array.from({ length: largo }, (_, indice) => {
        const digito = escrito[indice];

        return (
          <span
            key={indice}
            className={`juego__digito ${digito === undefined ? 'juego__digito--hueco' : 'juego__digito--lleno'}`}
            data-d={digito ?? ''}
          />
        );
      })}
    </div>
  );
}

export function SecuenciaDeNumeros({ alTerminar, enviando, sesion }: PropsDeMecanica) {
  const mascota = useMascotaDeLaPersona();
  const reglas = useMemo(
    () => leerSecuenciaDeNumeros(sesion?.parametros) ?? SECUENCIA_DE_SIEMPRE,
    [sesion],
  );
  const { largoInicial, rondas: rondasDelCatalogo, msPorElemento, msDeMargen } = reglas;
  const RONDAS = rondasAJugar(rondasDelCatalogo);
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
      tiempoAlaVista(fase.secuencia.length, msPorElemento, msDeMargen),
    );

    return () => clearTimeout(temporizador);
  }, [fase, msPorElemento, msDeMargen]);

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
    empezarRonda(largoInicial);
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
        ultima === undefined
          ? largoInicial
          : siguienteLargo(ultima.largo, ultima.acerto, largoInicial),
      );
      return;
    }

    terminada.current = true;

    const aciertos = rondas.filter((ronda) => ronda.acerto).length;

    alTerminar({
      score: puntajeSobreElMaximo(aciertos, RONDAS, rondasDelCatalogo),
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
        <VozDeLaMascota mascota={mascota} mensaje={elegir(EN_EL_JUEGO, 0)} expresion="feliz" />

        <PasosDeInicio
          pasos={['Mira los números.', 'Se ocultan en unos segundos.', 'Escríbelos en orden.']}
        />

        <p className="actividad__texto">
          Verás una secuencia de números durante unos segundos. Cuando se oculte, escríbela. Son{' '}
          {RONDAS} rondas: si aciertas, la siguiente tiene un número más; si no, uno menos.
        </p>

        <BarraDeAccion>
          <BotonPrincipal alPulsar={empezar} conFlecha>
            Empezar
          </BotonPrincipal>
        </BarraDeAccion>
      </div>
    );
  }

  const veredicto =
    fase.tipo === 'revisada'
      ? fase.acerto
        ? { mensaje: '¡Bien! Era esa.', ademas: elegir(ACIERTO, rondas.length) }
        : {
            mensaje: `¡Casi! Era ${separada(fase.secuencia)}. Probemos otra, sin prisa.`,
            ademas: elegir(ANIMO_TRAS_CASI, rondas.length),
          }
      : undefined;

  const quePasa =
    veredicto ??
    (fase.tipo === 'mirando'
      ? { mensaje: 'Memoriza con calma.' }
      : { mensaje: 'Ahora escríbelos en orden. Tú puedes.' });

  return (
    <div className="juego">
      <BarraDeProgreso
        paso={numeroDeRonda}
        total={RONDAS}
        hechos={rondas.length}
        estrellas={aciertos}
        etiqueta="Ronda"
      />

      <p className="solo-lectores">
        Ronda {numeroDeRonda} de {RONDAS}. Aciertos: {aciertos}.
      </p>

      <VozDeLaMascota
        mascota={mascota}
        mensaje={quePasa.mensaje}
        {...('ademas' in quePasa ? { ademas: quePasa.ademas } : {})}
        {...(fase.tipo === 'revisada' ? { resultado: fase.acerto ? 'acierto' : 'casi' } : {})}
        expresion={fase.tipo === 'revisada' && fase.acerto ? 'celebrando' : 'normal'}
        latido={fase.tipo === 'revisada' ? rondas.length : 0}
      />

      {fase.tipo === 'mirando' && (
        <div className="juego__pizarra" aria-live="polite">
          <p className="solo-lectores">Memoriza esta secuencia:</p>
          <p className="solo-lectores">{separada(fase.secuencia)}</p>

          <p className="juego__etiqueta" aria-hidden="true">
            Memoriza
          </p>
          <Fichas digitos={fase.secuencia} />
          <div className="juego__tiempo" aria-hidden="true">
            <span
              style={
                {
                  '--duracion': `${String(tiempoAlaVista(fase.secuencia.length, msPorElemento, msDeMargen))}ms`,
                } as CSSProperties
              }
            />
          </div>
        </div>
      )}

      {fase.tipo === 'respondiendo' && (
        <form className="viva" onSubmit={comprobar}>
          <div className="viva-tarjeta">
            <label className="viva-tarjeta__titulo" htmlFor="secuencia">
              Escribe la secuencia
            </label>

            <input
              ref={campo}
              id="secuencia"
              className="juego__entrada"
              inputMode="numeric"
              autoComplete="off"
              value={respuesta}
              onChange={(evento) => setRespuesta(evento.target.value)}
            />

            <Huecos largo={fase.secuencia.length} escrito={respuesta.replace(/\D/g, '')} />
          </div>

          <BarraDeAccion>
            <BotonPrincipal tipo="submit" conFlecha>
              Comprobar
            </BotonPrincipal>
          </BarraDeAccion>
        </form>
      )}

      {fase.tipo === 'revisada' && (
        <>
          <div className={`juego__pizarra juego__pizarra--${fase.acerto ? 'acierto' : 'casi'}`}>
            <Fichas digitos={fase.secuencia} />
          </div>

          <BarraDeAccion>
            <BotonPrincipal
              referencia={siguiente}
              alPulsar={seguir}
              deshabilitado={enviando}
              conFlecha={rondas.length < RONDAS}
            >
              {rondas.length < RONDAS ? 'Siguiente ronda' : enviando ? 'Guardando…' : 'Terminar'}
            </BotonPrincipal>
          </BarraDeAccion>
        </>
      )}
    </div>
  );
}
