import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import '../../../estilos/juegos.css';
import { BarraDeAccion, BotonPrincipal } from '../viva/BarraDeAccion.tsx';
import { BarraDeProgreso } from '../viva/BarraDeProgreso.tsx';
import { ACIERTO, ANIMO_TRAS_CASI, EN_EL_JUEGO, elegir } from '../viva/mensajes.ts';
import { PasosDeInicio } from '../viva/PasosDeInicio.tsx';
import { useMascotaDeLaPersona } from '../viva/mascotaDeLaPersona.ts';
import { VozDeLaMascota } from '../viva/VozDeLaMascota.tsx';
import {
  generarSecuenciaDeCasillas,
  marcaDeTiempo,
  puntajeSobreElMaximo,
  rondasAJugar,
  segundosDesde,
  siguienteLargo,
} from './cognicion.ts';
import { estiloDeLaCasilla } from './coloresDeCasillas.ts';
import { FormaDeCasilla } from './FormaDeCasilla.tsx';
import {
  leerSecuenciaDeCasillas,
  type ParametrosDeSecuenciaDeCasillas,
} from './parametrosDeLaSesion.ts';
import type { PropsDeMecanica } from './registro.tsx';
import { SinSesion } from './SinSesion.tsx';

/**
 * «Recuerda los colores»: unas casillas se iluminan una a una, se apagan y hay que tocarlas en el
 * mismo orden (SCRUM-209, ficha COG-01). Es el motor `secuencia` con casillas, no el de digitos.
 *
 * Son las rondas que diga la sesion, hasta siete (SCRUM-288). Empieza con el largo inicial; cada acierto
 * alarga la siguiente una casilla y cada fallo la acorta una, sin bajar del largo inicial. El puntaje
 * crudo es el numero de rondas acertadas, reescalado al maximo que declara la sesion. Como en los demas juegos, una casilla equivocada cierra la ronda como un
 * «casi»: se acompana, no se senala.
 *
 * ## Lo que dice la sesion
 *
 * Todo: las casillas (con su forma, nombre y color), el largo inicial, las rondas, cuanto dura la
 * iluminacion de cada una, cuanto pasa entre una y otra y la espera antes de la primera. Esta
 * pantalla **no tiene un respaldo**, a diferencia de las actividades de siempre: sin una sesion que
 * entienda no hay con que pintarla, y lo dice.
 *
 * ## Que no dependa del color (R10)
 *
 * Cada casilla lleva su forma y su nombre escrito, ademas del color. La que se ilumina se anuncia por
 * escrito a los lectores de pantalla y se lee su nombre a la vista. No hay sonido, y con movimiento
 * reducido la casilla cambia sin animarse: el tiempo es el mismo, porque es parte de la tarea.
 */

/** Un instante tras apagarse la ultima casilla, para que no se pise con el primer toque. */
const PAUSA_ANTES_DE_RESPONDER_MS = 300;

interface Ronda {
  readonly largo: number;
  readonly acerto: boolean;
}

type Fase =
  | { readonly tipo: 'inicio' }
  | { readonly tipo: 'mirando'; readonly secuencia: readonly number[] }
  | {
      readonly tipo: 'respondiendo';
      readonly secuencia: readonly number[];
      /** Cuantas lleva bien, en orden: una equivocada cierra la ronda. */
      readonly tocadas: number;
    }
  | { readonly tipo: 'revisada'; readonly secuencia: readonly number[]; readonly acerto: boolean };

export function SecuenciaDeCasillas({ sesion, ...props }: PropsDeMecanica) {
  const reglas = useMemo(() => leerSecuenciaDeCasillas(sesion?.parametros), [sesion]);

  if (reglas === null) {
    return <SinSesion />;
  }

  return <Juego {...props} reglas={reglas} />;
}

function Juego({
  alTerminar,
  enviando,
  reglas,
}: Omit<PropsDeMecanica, 'sesion'> & { readonly reglas: ParametrosDeSecuenciaDeCasillas }) {
  const mascota = useMascotaDeLaPersona();
  const {
    casillas,
    largoInicial,
    rondas: rondasDeLaSesion,
    msPorElemento,
    msDeMargen,
    msDestello,
  } = reglas;
  const TOTAL = rondasAJugar(rondasDeLaSesion);
  const [fase, setFase] = useState<Fase>({ tipo: 'inicio' });
  const [historial, setHistorial] = useState<readonly Ronda[]>([]);
  /** La casilla que esta iluminada ahora. */
  const [activa, setActiva] = useState<number | null>(null);
  const inicio = useRef(0);
  const siguiente = useRef<HTMLButtonElement>(null);
  const terminada = useRef(false);

  // La secuencia: una casilla tras otra, y al final toca responder.
  useEffect(() => {
    if (fase.tipo !== 'mirando') {
      return undefined;
    }

    const { secuencia } = fase;
    const temporizadores: ReturnType<typeof setTimeout>[] = [];

    secuencia.forEach((casilla, posicion) => {
      const empieza = msDeMargen + posicion * msPorElemento;

      temporizadores.push(setTimeout(() => setActiva(casilla), empieza));
      temporizadores.push(setTimeout(() => setActiva(null), empieza + msDestello));
    });

    const termina =
      msDeMargen +
      (secuencia.length - 1) * msPorElemento +
      msDestello +
      PAUSA_ANTES_DE_RESPONDER_MS;

    temporizadores.push(
      setTimeout(() => setFase({ tipo: 'respondiendo', secuencia, tocadas: 0 }), termina),
    );

    return () => {
      temporizadores.forEach(clearTimeout);
      setActiva(null);
    };
  }, [fase, msDeMargen, msPorElemento, msDestello]);

  // El foco va al boton de seguir cuando la ronda termina.
  useEffect(() => {
    if (fase.tipo === 'revisada') {
      siguiente.current?.focus();
    }
  }, [fase.tipo]);

  function empezarRonda(largoDeLaRonda: number) {
    setFase({
      tipo: 'mirando',
      secuencia: generarSecuenciaDeCasillas(largoDeLaRonda, casillas.length),
    });
  }

  function empezar() {
    inicio.current = marcaDeTiempo();
    empezarRonda(largoInicial);
  }

  function cerrarRonda(secuencia: readonly number[], acerto: boolean) {
    setHistorial((antes) => [...antes, { largo: secuencia.length, acerto }]);
    setFase({ tipo: 'revisada', secuencia, acerto });
  }

  function tocar(indice: number) {
    if (fase.tipo !== 'respondiendo') {
      return;
    }

    if (indice !== fase.secuencia[fase.tocadas]) {
      cerrarRonda(fase.secuencia, false);
      return;
    }

    const tocadas = fase.tocadas + 1;

    if (tocadas === fase.secuencia.length) {
      cerrarRonda(fase.secuencia, true);
      return;
    }

    setFase({ ...fase, tocadas });
  }

  function seguir() {
    if (terminada.current) {
      return;
    }

    if (historial.length < TOTAL) {
      const ultima = historial.at(-1);

      empezarRonda(
        ultima === undefined
          ? largoInicial
          : siguienteLargo(ultima.largo, ultima.acerto, largoInicial),
      );
      return;
    }

    terminada.current = true;

    const aciertos = historial.filter((ronda) => ronda.acerto).length;

    alTerminar({
      score: puntajeSobreElMaximo(aciertos, TOTAL, rondasDeLaSesion),
      metadata: {
        aciertos,
        rondas: historial.map(({ largo, acerto }) => ({ largo, acerto })),
        largoMaximo: Math.max(0, ...historial.filter((r) => r.acerto).map((r) => r.largo)),
        segundos: segundosDesde(inicio.current),
      },
    });
  }

  const numeroDeRonda = Math.min(historial.length + (fase.tipo === 'revisada' ? 0 : 1), TOTAL);
  const aciertos = historial.filter((ronda) => ronda.acerto).length;

  if (fase.tipo === 'inicio') {
    return (
      <div className="juego">
        <VozDeLaMascota mascota={mascota} mensaje={elegir(EN_EL_JUEGO, 0)} expresion="feliz" />

        <PasosDeInicio
          pasos={['Mira cómo se iluminan.', 'Se apagan una a una.', 'Tócalas en el mismo orden.']}
        />

        <p className="actividad__texto">
          Verás cómo se iluminan unas casillas, una a una. Cuando se apaguen, tócalas en el mismo
          orden. Son {TOTAL} rondas: si aciertas, la siguiente tiene una casilla más; si no, una
          menos.
        </p>

        <BarraDeAccion>
          <BotonPrincipal alPulsar={empezar} conFlecha>
            Empezar
          </BotonPrincipal>
        </BarraDeAccion>
      </div>
    );
  }

  const nombres = (secuencia: readonly number[]) =>
    secuencia.map((indice) => casillas[indice]?.nombre ?? '').join(', ');

  const veredicto =
    fase.tipo === 'revisada'
      ? fase.acerto
        ? { mensaje: '¡Bien! Era esa.', ademas: elegir(ACIERTO, historial.length) }
        : {
            mensaje: `¡Casi! Era ${nombres(fase.secuencia)}. Probemos otra, sin prisa.`,
            ademas: elegir(ANIMO_TRAS_CASI, historial.length),
          }
      : undefined;

  const quePasa =
    veredicto ??
    (fase.tipo === 'mirando'
      ? { mensaje: 'Mira con calma.' }
      : { mensaje: 'Tócalas en el mismo orden.' });

  // Dos columnas con pocas casillas y tres con muchas: caben en un telefono sin hacerse minusculas.
  const columnas = casillas.length <= 4 ? 2 : 3;
  const nombreDeLaActiva = activa === null ? '' : (casillas[activa]?.nombre ?? '');

  return (
    <div className="juego">
      <BarraDeProgreso
        paso={numeroDeRonda}
        total={TOTAL}
        hechos={historial.length}
        estrellas={aciertos}
        etiqueta="Ronda"
      />

      <p className="solo-lectores">
        Ronda {numeroDeRonda} de {TOTAL}. Aciertos: {aciertos}.
      </p>

      <VozDeLaMascota
        mascota={mascota}
        mensaje={quePasa.mensaje}
        {...('ademas' in quePasa ? { ademas: quePasa.ademas } : {})}
        {...(fase.tipo === 'revisada' ? { resultado: fase.acerto ? 'acierto' : 'casi' } : {})}
        expresion={fase.tipo === 'revisada' && fase.acerto ? 'celebrando' : 'normal'}
        latido={fase.tipo === 'revisada' ? historial.length : 0}
      />

      {/* Lo que se ilumina se dice por escrito: la forma y el color no llegan a quien no ve. */}
      <p className="solo-lectores" aria-live="polite" data-anuncio="">
        {nombreDeLaActiva}
      </p>

      <p className="juego__nombre-activa" aria-hidden="true">
        {nombreDeLaActiva === '' ? ' ' : nombreDeLaActiva}
      </p>

      <div
        className="juego__casillas"
        role="group"
        aria-label="Casillas"
        style={{ '--columnas': columnas } as CSSProperties}
      >
        {casillas.map((casilla, indice) => (
          <button
            key={casilla.clave}
            type="button"
            className={`juego__ficha juego__simbolo${activa === indice ? ' juego__ficha--activa' : ''}`}
            style={estiloDeLaCasilla(casilla.color)}
            data-clave={casilla.clave}
            data-activa={activa === indice ? 'true' : 'false'}
            disabled={fase.tipo !== 'respondiendo'}
            onClick={() => tocar(indice)}
          >
            <FormaDeCasilla {...(casilla.forma === undefined ? {} : { forma: casilla.forma })} />
            <span className="juego__ficha-nombre">{casilla.nombre}</span>
          </button>
        ))}
      </div>

      {fase.tipo === 'respondiendo' && (
        <p className="juego__marcador">
          Llevas {fase.tocadas} de {fase.secuencia.length}.
        </p>
      )}

      {fase.tipo === 'revisada' && (
        <>
          <div
            className={`juego__repaso juego__repaso--${fase.acerto ? 'acierto' : 'casi'}`}
            aria-hidden="true"
          >
            {fase.secuencia.map((indice, posicion) => (
              <span
                key={posicion}
                className="juego__repaso-ficha juego__simbolo"
                style={estiloDeLaCasilla(casillas[indice]?.color)}
              >
                <FormaDeCasilla
                  tamano={28}
                  {...(casillas[indice]?.forma === undefined
                    ? {}
                    : { forma: casillas[indice].forma })}
                />
              </span>
            ))}
          </div>

          <BarraDeAccion>
            <BotonPrincipal
              referencia={siguiente}
              alPulsar={seguir}
              deshabilitado={enviando}
              conFlecha={historial.length < TOTAL}
            >
              {historial.length < TOTAL ? 'Siguiente ronda' : enviando ? 'Guardando…' : 'Terminar'}
            </BotonPrincipal>
          </BarraDeAccion>
        </>
      )}
    </div>
  );
}
