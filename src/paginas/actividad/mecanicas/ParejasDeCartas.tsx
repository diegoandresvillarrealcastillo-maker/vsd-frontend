import { useEffect, useRef, useState, type CSSProperties } from 'react';

import '../../../estilos/juegos.css';
import { Icono } from '../../panel/Icono.tsx';
import { BarraDeProgreso } from '../viva/BarraDeProgreso.tsx';
import { Chispas } from '../viva/Chispas.tsx';
import { ACIERTO, CASI, elegir } from '../viva/mensajes.ts';
import { useMascotaDeLaPersona } from '../viva/mascotaDeLaPersona.ts';
import { VozDeLaMascota } from '../viva/VozDeLaMascota.tsx';
import { estiloDelSimbolo } from './coloresDeSimbolos.ts';
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
 *
 * ## Como se ve (SCRUM-173)
 *
 * Las cartas se reparten una tras otra y se voltean en 3D; la pareja encontrada se queda a la
 * vista con el color de su simbolo, suelta chispas y salta. La mascota acompana: dice que hacer
 * en cada momento, celebra las parejas y, ante un fallo, anima («¡Casi!») sin senalarlo. Lo
 * que la mascota dice no se anuncia a los lectores de pantalla (`anunciar={false}`): ya les llega
 * por el aviso de abajo, y leerlo dos veces estorba.
 */

/** Cuanto se dejan ver dos cartas que no coinciden antes de volver boca abajo. */
const ESPERA_AL_FALLAR_MS = 900;

interface LoQueDice {
  readonly mensaje: string;
  readonly ademas?: string;
  readonly resultado?: 'acierto' | 'casi';
}

const AL_EMPEZAR: LoQueDice = { mensaje: 'Toca una carta para empezar. Sin prisa.' };
const A_LA_BUSCA: LoQueDice = { mensaje: 'Ahora busca su pareja.' };

function nombreDe(carta: Carta): string {
  return SIMBOLOS_DE_PAREJAS[carta.simbolo]?.nombre ?? '';
}

export function ParejasDeCartas({ alTerminar, enviando }: PropsDeMecanica) {
  const mascota = useMascotaDeLaPersona();
  const [cartas] = useState(repartir);
  const [volteadas, setVolteadas] = useState<readonly number[]>([]);
  const [encontradas, setEncontradas] = useState<ReadonlySet<number>>(() => new Set());
  const [intentos, setIntentos] = useState(0);
  const [aviso, setAviso] = useState('');
  const [habla, setHabla] = useState<LoQueDice>(AL_EMPEZAR);
  // Sube con cada carta volteada: hace saltar a la mascota.
  const [latido, setLatido] = useState(0);
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
    setLatido((antes) => antes + 1);

    const primera = cartas.find((una) => una.id === volteadas[0]);

    if (primera === undefined) {
      setVolteadas([carta.id]);
      setAviso(`Volteaste ${nombreDe(carta)}.`);
      setHabla(A_LA_BUSCA);
      return;
    }

    const intentosAhora = intentos + 1;

    setIntentos(intentosAhora);

    if (primera.simbolo !== carta.simbolo) {
      setVolteadas([primera.id, carta.id]);
      setAviso(`No coinciden: ${nombreDe(primera)} y ${nombreDe(carta)}.`);
      setHabla({ mensaje: elegir(CASI, intentosAhora), resultado: 'casi' });
      return;
    }

    const nuevas = new Set(encontradas).add(carta.simbolo);

    setEncontradas(nuevas);
    setVolteadas([]);
    setAviso(`Pareja encontrada: ${nombreDe(carta)}.`);
    setHabla({
      mensaje: elegir(ACIERTO, nuevas.size),
      ademas: `Pareja de ${nombreDe(carta)}.`,
      resultado: 'acierto',
    });

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

  const fallando = volteadas.length === 2;

  return (
    <div className="juego">
      <BarraDeProgreso
        paso={encontradas.size}
        total={PAREJAS}
        hechos={encontradas.size}
        etiqueta="Parejas"
      />

      <VozDeLaMascota
        mascota={mascota}
        mensaje={habla.mensaje}
        {...(habla.ademas === undefined ? {} : { ademas: habla.ademas })}
        {...(habla.resultado === undefined ? {} : { resultado: habla.resultado })}
        expresion={habla.resultado === 'acierto' ? 'celebrando' : 'normal'}
        latido={latido}
        anunciar={false}
      />

      <div className="juego__cartas" role="group" aria-label="Cartas">
        {cartas.map((carta, indice) => {
          const encontrada = encontradas.has(carta.simbolo);
          const aLaVista = encontrada || volteadas.includes(carta.id);
          const simbolo = SIMBOLOS_DE_PAREJAS[carta.simbolo];

          return (
            <button
              key={carta.id}
              type="button"
              className={`juego__carta${aLaVista ? ' juego__carta--a-la-vista' : ''}${encontrada ? ' juego__carta--encontrada' : ''}${fallando && aLaVista && !encontrada ? ' juego__carta--fallo' : ''}`}
              style={
                {
                  '--i': indice,
                  ...(simbolo === undefined ? {} : estiloDelSimbolo(simbolo.icono)),
                } as CSSProperties
              }
              aria-label={
                aLaVista
                  ? `Carta ${indice + 1}: ${simbolo?.nombre ?? ''}${encontrada ? ', pareja encontrada' : ''}`
                  : `Carta ${indice + 1}, boca abajo`
              }
              aria-disabled={encontrada}
              onClick={() => voltear(carta)}
            >
              <span className="juego__carta-giro" aria-hidden="true">
                <span className="juego__carta-cara juego__carta-cara--atras">
                  <Icono nombre="sparkles" tamano={26} />
                </span>

                <span className="juego__carta-cara juego__carta-cara--frente juego__simbolo">
                  {simbolo !== undefined && <Icono nombre={simbolo.icono} tamano={36} />}
                  {encontrada && (
                    <span className="juego__carta-ok">
                      <Icono nombre="check" tamano={14} />
                    </span>
                  )}
                </span>
              </span>

              {encontrada && <Chispas alcance={0.8} />}
            </button>
          );
        })}
      </div>

      <p className="juego__intentos">Intentos: {intentos}</p>

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
