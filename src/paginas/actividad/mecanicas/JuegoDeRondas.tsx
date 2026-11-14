import { useEffect, useRef, useState, type ReactNode } from 'react';

import '../../../estilos/juegos.css';
import '../../../estilos/juegosDeCognicion.css';
import type { Metadata } from '../../../infraestructura/api/resultados.ts';
import { BarraDeAccion, BotonPrincipal } from '../viva/BarraDeAccion.tsx';
import { BarraDeProgreso } from '../viva/BarraDeProgreso.tsx';
import { ACIERTO, ANIMO_TRAS_CASI, EN_EL_JUEGO, elegir } from '../viva/mensajes.ts';
import { PasosDeInicio } from '../viva/PasosDeInicio.tsx';
import { useMascotaDeLaPersona } from '../viva/mascotaDeLaPersona.ts';
import { VozDeLaMascota } from '../viva/VozDeLaMascota.tsx';
import { marcaDeTiempo, segundosDesde } from './cognicion.ts';
import type { PropsDeMecanica } from './registro.tsx';

/**
 * Un juego de rondas de una sola respuesta (SCRUM-225): una pregunta, unas opciones y una correcta, ronda tras
 * ronda, sin reloj. Lo comparten «La palabra que sobra» (COG-02), «Cuentas con calma» (COG-04) y las
 * preguntas de «Lo que vi» (COG-09).
 *
 * ## Tono de un juego (R3 a R5)
 *
 * Los juegos **celebran**: un acierto dice «¡Eso es!», y un fallo se acompana con «¡Casi!» y nunca se
 * senala: la opcion correcta se marca y la elegida se queda en un tono neutro (ambar, no rojo), con una
 * etiqueta que dice «tu eleccion». Nada se distingue **solo por el color** (R10): la correcta lleva una marca,
 * la elegida una palabra. No hay «tiempo restante» ni cuenta atras.
 *
 * ## Puntaje
 *
 * Una ronda acertada, un punto, sobre el maximo de la mecanica (`puntosMaximos`). El servidor es el unico que
 * interpreta el nivel: aqui solo se cuenta.
 */

export interface OpcionDeLaRonda {
  readonly texto: string;
  /** Un dibujo a la izquierda del texto, si lo hay. Es adorno: el texto es lo que se lee. */
  readonly adorno?: ReactNode;
}

export interface RondaDeOpciones {
  readonly clave: string;
  /** Lo que se pregunta. */
  readonly pregunta: string;
  readonly opciones: readonly OpcionDeLaRonda[];
  readonly correcta: number;
  /** Lo que se dice despues de responder, sea cual sea la respuesta (por ejemplo, la razon del intruso). */
  readonly despues?: string;
  /** Algo que se pinta sobre las opciones: por ejemplo, la cuadricula con el lugar marcado. */
  readonly contexto?: ReactNode;
  /** Lo que se dice en una ronda mal contestada, sin «te equivocaste». Por omision, «¡Casi!». */
  readonly alFallar?: string;
}

interface Respuesta {
  readonly clave: string;
  readonly elegida: number;
  readonly acerto: boolean;
}

export interface Introduccion {
  readonly pasos: readonly string[];
  readonly texto: string;
}

export function JuegoDeRondas({
  alTerminar,
  enviando,
  rondas,
  puntosMaximos,
  introduccion,
  etiquetaDeRonda = 'Ronda',
  columnas,
  metadata,
}: Omit<PropsDeMecanica, 'sesion'> & {
  readonly rondas: readonly RondaDeOpciones[];
  readonly puntosMaximos: number;
  /** Si falta, el juego empieza directamente en la primera ronda. */
  readonly introduccion?: Introduccion;
  readonly etiquetaDeRonda?: string;
  /** Cuantas columnas tienen las opciones. Por omision, dos si son cuatro o mas y una si no. */
  readonly columnas?: 1 | 2;
  /** Lo que se agrega a lo que el juego manda al terminar. */
  readonly metadata?: (respuestas: readonly Respuesta[]) => Metadata;
}) {
  const mascota = useMascotaDeLaPersona();
  const [empezo, setEmpezo] = useState(introduccion === undefined);
  const [respuestas, setRespuestas] = useState<readonly Respuesta[]>([]);
  const [elegida, setElegida] = useState<number | null>(null);
  const inicio = useRef(marcaDeTiempo());
  const siguiente = useRef<HTMLButtonElement>(null);
  const terminada = useRef(false);

  const total = rondas.length;
  // La respuesta se guarda al pulsar «Siguiente»: mientras se ve la ronda (antes o despues de elegir) es la `+ 1`.
  const numero = respuestas.length + 1;
  const ronda = rondas[Math.min(respuestas.length, total - 1)];
  const aciertos = respuestas.filter((respuesta) => respuesta.acerto).length;
  const revisada = elegida !== null;
  const esLaUltima = respuestas.length === total - 1 && revisada;

  // El foco va al boton de seguir cuando la ronda se revisa.
  useEffect(() => {
    if (revisada) {
      siguiente.current?.focus();
    }
  }, [revisada]);

  if (ronda === undefined) {
    return null;
  }

  function responder(indice: number) {
    if (elegida !== null || ronda === undefined) {
      return;
    }

    setElegida(indice);
  }

  function seguir() {
    if (elegida === null || ronda === undefined || terminada.current) {
      return;
    }

    const acerto = elegida === ronda.correcta;
    const todas = [...respuestas, { clave: ronda.clave, elegida, acerto }];

    if (todas.length < total) {
      setRespuestas(todas);
      setElegida(null);

      return;
    }

    terminada.current = true;
    setRespuestas(todas);

    const buenas = todas.filter((respuesta) => respuesta.acerto).length;

    alTerminar({
      // Una ronda acertada, un punto: el maximo de la mecanica es el de sus rondas.
      score: Math.min(Math.round((buenas / total) * puntosMaximos * 100) / 100, puntosMaximos),
      metadata: {
        aciertos: buenas,
        rondas: total,
        segundos: segundosDesde(inicio.current),
        ...(metadata === undefined ? {} : metadata(todas)),
      },
    });
  }

  if (!empezo && introduccion !== undefined) {
    return (
      <div className="juego">
        <VozDeLaMascota mascota={mascota} mensaje={elegir(EN_EL_JUEGO, 0)} expresion="feliz" />

        <PasosDeInicio pasos={introduccion.pasos} />

        <p className="actividad__texto">{introduccion.texto}</p>

        <BarraDeAccion>
          <BotonPrincipal
            alPulsar={() => {
              inicio.current = marcaDeTiempo();
              setEmpezo(true);
            }}
            conFlecha
          >
            Empezar
          </BotonPrincipal>
        </BarraDeAccion>
      </div>
    );
  }

  const acerto = elegida === ronda.correcta;
  const veredicto = revisada
    ? acerto
      ? { mensaje: elegir(ACIERTO, respuestas.length), resultado: 'acierto' as const }
      : {
          mensaje: ronda.alFallar ?? '¡Casi! Vas por buen camino.',
          ademas: elegir(ANIMO_TRAS_CASI, respuestas.length),
          resultado: 'casi' as const,
        }
    : { mensaje: 'Tómate el tiempo que necesites.' };

  const enColumnas = columnas ?? (ronda.opciones.length >= 4 ? 2 : 1);

  return (
    <div className="juego">
      <BarraDeProgreso
        paso={numero}
        total={total}
        hechos={respuestas.length + (revisada ? 1 : 0)}
        estrellas={aciertos + (revisada && acerto ? 1 : 0)}
        etiqueta={etiquetaDeRonda}
      />

      <p className="solo-lectores">
        {etiquetaDeRonda} {numero} de {total}. Aciertos: {aciertos}.
      </p>

      <VozDeLaMascota
        mascota={mascota}
        mensaje={veredicto.mensaje}
        {...('ademas' in veredicto ? { ademas: veredicto.ademas } : {})}
        {...('resultado' in veredicto ? { resultado: veredicto.resultado } : {})}
        expresion={revisada && acerto ? 'celebrando' : 'normal'}
        latido={revisada ? respuestas.length + 1 : 0}
      />

      {ronda.contexto !== undefined && <div className="juego__contexto">{ronda.contexto}</div>}

      <h2 className="juego__pregunta" id={`pregunta-${ronda.clave}`}>
        {ronda.pregunta}
      </h2>

      <div
        className="juego__opciones"
        role="group"
        aria-labelledby={`pregunta-${ronda.clave}`}
        data-columnas={enColumnas}
      >
        {ronda.opciones.map((opcion, indice) => {
          const estado = !revisada
            ? undefined
            : indice === ronda.correcta
              ? 'correcta'
              : indice === elegida
                ? 'elegida'
                : 'otra';

          return (
            <button
              key={`${ronda.clave}-${String(indice)}`}
              type="button"
              className="juego__opcion"
              {...(estado === undefined ? {} : { 'data-estado': estado })}
              disabled={revisada}
              aria-pressed={indice === elegida}
              onClick={() => responder(indice)}
            >
              {opcion.adorno !== undefined && (
                <span className="juego__opcion-adorno" aria-hidden="true">
                  {opcion.adorno}
                </span>
              )}
              <span className="juego__opcion-texto">{opcion.texto}</span>
              {estado === 'correcta' && (
                <span className="juego__opcion-marca">
                  <span aria-hidden="true">✓</span>
                  <span className="solo-lectores"> (la correcta)</span>
                </span>
              )}
              {estado === 'elegida' && <span className="juego__opcion-marca">tu elección</span>}
            </button>
          );
        })}
      </div>

      {revisada && ronda.despues !== undefined && (
        <p className="juego__despues" role="status">
          {ronda.despues}
        </p>
      )}

      {revisada && (
        <BarraDeAccion>
          <BotonPrincipal
            referencia={siguiente}
            alPulsar={seguir}
            deshabilitado={enviando}
            conFlecha={!esLaUltima}
          >
            {esLaUltima ? (enviando ? 'Guardando…' : 'Terminar') : 'Siguiente'}
          </BotonPrincipal>
        </BarraDeAccion>
      )}
    </div>
  );
}
