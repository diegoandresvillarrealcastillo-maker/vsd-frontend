import { useMemo, useRef, useState } from 'react';

import '../../../estilos/juegos.css';
import '../../../estilos/juegosDeCognicion.css';
import { BarraDeAccion, BotonPrincipal, BotonSecundario } from '../viva/BarraDeAccion.tsx';
import { ACIERTO, EN_EL_JUEGO, elegir } from '../viva/mensajes.ts';
import { PasosDeInicio } from '../viva/PasosDeInicio.tsx';
import { useMascotaDeLaPersona } from '../viva/mascotaDeLaPersona.ts';
import { VozDeLaMascota } from '../viva/VozDeLaMascota.tsx';
import { marcaDeTiempo, segundosDesde } from './cognicion.ts';
import { leerPuntos, type ParametrosDePuntos } from './parametrosDeLaCognicion.ts';
import type { PropsDeMecanica } from './registro.tsx';
import { SinSesion } from './SinSesion.tsx';

/**
 * «Une los puntos en orden» (SCRUM-225, ficha COG-08): puntos repartidos por la pantalla que se tocan en orden,
 * del primero al ultimo; en el nivel 3 se alternan numeros y letras (1, A, 2, B...).
 *
 * Es el motor `tocar_el_objetivo` en su modo `puntos`. Se parece a una **prueba neuropsicologica conocida**, y
 * por eso **no se mide el tiempo, no se interpreta y no se presenta como evaluacion** (R13): la ficha pide una
 * revision ligera de que no se confunda con una prueba. No hay reloj de ningun tipo.
 *
 * - Un punto equivocado no resta ni se senala como un fallo: es «otro intento», y la pantalla recuerda cual
 *   toca. Cuenta aparte, en `metadata`.
 * - «Dejarlo aqui» esta siempre: se puede parar cuando se quiera, y lo que se hizo cuenta. El puntaje es lo
 *   completado: `puntosMaximos x puntos tocados / puntos`.
 * - Cada punto es un boton de al menos 44 px (R10): la sesion garantiza que ninguno queda a menos de 14 puntos
 *   de otro. Los tocados se unen con una linea, que es solo un apoyo para quien ve.
 */

export function UnirLosPuntos({ sesion, ...props }: PropsDeMecanica) {
  const reglas = useMemo(() => leerPuntos(sesion?.parametros), [sesion]);

  if (reglas === null) {
    return <SinSesion />;
  }

  return <Tablero {...props} reglas={reglas} />;
}

function Tablero({
  alTerminar,
  enviando,
  reglas,
}: Omit<PropsDeMecanica, 'sesion'> & { readonly reglas: ParametrosDePuntos }) {
  const mascota = useMascotaDeLaPersona();
  const { indicacion, puntos, puntosMaximos } = reglas;
  const [empezo, setEmpezo] = useState(false);
  const [hechos, setHechos] = useState(0);
  const [otrosIntentos, setOtrosIntentos] = useState(0);
  const [termino, setTermino] = useState(false);
  const inicio = useRef(0);
  const terminada = useRef(false);

  const completo = hechos === puntos.length;
  const siguiente = puntos[hechos];
  const puntaje = Math.round((hechos / puntos.length) * puntosMaximos * 100) / 100;

  function tocar(posicion: number) {
    if (termino || completo) {
      return;
    }

    if (posicion === hechos) {
      const nuevos = hechos + 1;

      setHechos(nuevos);

      if (nuevos === puntos.length) {
        setTermino(true);
      }

      return;
    }

    // Un punto que no toca: no resta ni se senala, solo se cuenta aparte.
    if (posicion > hechos) {
      setOtrosIntentos((antes) => antes + 1);
    }
  }

  function terminar() {
    if (terminada.current) {
      return;
    }

    terminada.current = true;

    alTerminar({
      score: Math.min(puntaje, puntosMaximos),
      metadata: {
        tocados: hechos,
        puntos: puntos.length,
        otrosIntentos,
        segundos: segundosDesde(inicio.current),
      },
    });
  }

  if (!empezo) {
    return (
      <div className="juego">
        <VozDeLaMascota mascota={mascota} mensaje={elegir(EN_EL_JUEGO, 0)} expresion="feliz" />

        <PasosDeInicio
          pasos={['Busca el primer punto.', 'Toca en orden.', 'Para cuando quieras.']}
        />

        <p className="actividad__texto">
          {indicacion} Son {String(puntos.length)} puntos. No hay cronómetro: al ritmo que quieras,
          y puedes dejarlo cuando quieras. No es una prueba ni mide nada.
        </p>

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

  const mensaje = termino
    ? completo
      ? elegir(ACIERTO, hechos)
      : 'Gracias por intentarlo. Lo que hiciste cuenta.'
    : siguiente === undefined
      ? ''
      : `Busca el ${siguiente.etiqueta}.`;

  return (
    <div className="juego">
      <VozDeLaMascota
        mascota={mascota}
        mensaje={mensaje}
        {...(termino && completo ? { resultado: 'acierto' as const } : {})}
        expresion={termino && completo ? 'celebrando' : 'normal'}
        latido={hechos}
      />

      <p className="juego__marcador" aria-live="polite">
        Llevas {hechos} de {puntos.length}.
      </p>

      <div className="juego__tablero" role="group" aria-label="Puntos para unir">
        <svg
          className="juego__lineas"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {puntos.slice(1, hechos).map((punto, i) => (
            <line
              key={punto.etiqueta}
              x1={puntos[i]?.x}
              y1={puntos[i]?.y}
              x2={punto.x}
              y2={punto.y}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        {puntos.map((punto, posicion) => (
          <button
            key={punto.etiqueta}
            type="button"
            className="juego__punto"
            style={{ left: `${String(punto.x)}%`, top: `${String(punto.y)}%` }}
            data-hecho={posicion < hechos ? '' : undefined}
            disabled={termino}
            aria-label={posicion < hechos ? `${punto.etiqueta}, ya tocado` : punto.etiqueta}
            onClick={() => {
              tocar(posicion);
            }}
          >
            {punto.etiqueta}
          </button>
        ))}
      </div>

      <BarraDeAccion>
        {termino ? (
          <BotonPrincipal alPulsar={terminar} deshabilitado={enviando}>
            {enviando ? 'Guardando…' : 'Terminar'}
          </BotonPrincipal>
        ) : (
          <BotonSecundario
            alPulsar={() => {
              setTermino(true);
            }}
          >
            Dejarlo aquí
          </BotonSecundario>
        )}
      </BarraDeAccion>
    </div>
  );
}
