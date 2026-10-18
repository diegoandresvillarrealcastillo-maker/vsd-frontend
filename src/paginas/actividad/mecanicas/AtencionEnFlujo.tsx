import { useEffect, useMemo, useRef, useState } from 'react';

import '../../../estilos/juegos.css';
import '../../../estilos/juegosDeCognicion.css';
import { Pictograma } from '../pictogramas/Pictograma.tsx';
import { BarraDeAccion, BotonPrincipal } from '../viva/BarraDeAccion.tsx';
import { ACIERTO, ANIMO_TRAS_CASI, EN_EL_JUEGO, elegir } from '../viva/mensajes.ts';
import { PasosDeInicio } from '../viva/PasosDeInicio.tsx';
import { useMascotaDeLaPersona } from '../viva/mascotaDeLaPersona.ts';
import { VozDeLaMascota } from '../viva/VozDeLaMascota.tsx';
import { marcaDeTiempo, segundosDesde } from './cognicion.ts';
import { leerFlujo, type ParametrosDeFlujo } from './parametrosDeLaCognicion.ts';
import type { PropsDeMecanica } from './registro.tsx';
import { SinSesion } from './SinSesion.tsx';

/**
 * «Toca solo lo que cambia» (SCRUM-225, ficha COG-05): unos simbolos aparecen de uno en uno y se toca solo
 * cuando sale el objetivo.
 *
 * Es el motor `tocar_el_objetivo` en su modo `flujo`. Cada toque acertado vale un punto; la sesion trae toda la
 * secuencia (la escribio quien la sembro: no hay azar aqui) y dice cuantos objetivos tiene.
 *
 * ## Las barandas de la ficha
 *
 * - **Nunca mas de un estimulo por segundo y nunca parpadea** (R10, fotosensibilidad): cada simbolo se queda
 *   quieto `msPorEstimulo` (el contrato exige mil o mas) y el siguiente lo reemplaza sin destello, sin
 *   desvanecerse y sin moverse. Con movimiento reducido es igual: el tiempo es parte de la tarea.
 * - **Sin barra de tiempo** ni «tiempo restante» (R4). El objetivo se queda a la vista todo el rato, para no
 *   cargar la memoria.
 * - **Los toques de mas no son un error**: se cuentan aparte como «otros intentos» y no restan nada. Tocar de
 *   mas tampoco se senala.
 *
 * Es una tarea de reaccion visual: cada simbolo se anuncia por escrito a los lectores de pantalla, y hay muchas
 * otras actividades para quien prefiera no hacerla.
 */

export function AtencionEnFlujo({ sesion, ...props }: PropsDeMecanica) {
  const reglas = useMemo(() => leerFlujo(sesion?.parametros), [sesion]);

  if (reglas === null) {
    return <SinSesion />;
  }

  return <Flujo {...props} reglas={reglas} />;
}

type Fase = 'inicio' | 'corriendo' | 'fin';

function Flujo({
  alTerminar,
  enviando,
  reglas,
}: Omit<PropsDeMecanica, 'sesion'> & { readonly reglas: ParametrosDeFlujo }) {
  const mascota = useMascotaDeLaPersona();
  const { objetivos, otros, secuencia, msPorEstimulo, puntosMaximos } = reglas;
  const [fase, setFase] = useState<Fase>('inicio');
  /** El estimulo que se ve ahora; -1 mientras la persona se prepara. */
  const [indice, setIndice] = useState(-1);
  const [resumen, setResumen] = useState({ aciertos: 0, otrosIntentos: 0 });
  const aciertos = useRef(0);
  const otrosIntentos = useRef(0);
  const yaTocado = useRef(false);
  const inicio = useRef(0);
  const terminada = useRef(false);

  const simbolos = useMemo(
    () => new Map([...objetivos, ...otros].map((simbolo) => [simbolo.clave, simbolo])),
    [objetivos, otros],
  );
  const clavesDelObjetivo = useMemo(() => new Set(objetivos.map((o) => o.clave)), [objetivos]);
  const nombresDelObjetivo = objetivos.map((objetivo) => objetivo.nombre).join(' y ');

  // El reloj: un estimulo cada `msPorEstimulo`, el primero tras la espera de la preparacion.
  useEffect(() => {
    if (fase !== 'corriendo') {
      return undefined;
    }

    let siguiente = -1;
    const reloj = setInterval(() => {
      siguiente += 1;

      if (siguiente >= secuencia.length) {
        clearInterval(reloj);
        setResumen({ aciertos: aciertos.current, otrosIntentos: otrosIntentos.current });
        setFase('fin');

        return;
      }

      yaTocado.current = false;
      setIndice(siguiente);
    }, msPorEstimulo);

    return () => {
      clearInterval(reloj);
    };
  }, [fase, msPorEstimulo, secuencia.length]);

  function tocar() {
    if (fase !== 'corriendo' || indice < 0) {
      return;
    }

    const claveDeAhora = secuencia[indice];

    if (claveDeAhora !== undefined && clavesDelObjetivo.has(claveDeAhora) && !yaTocado.current) {
      yaTocado.current = true;
      aciertos.current += 1;
    } else {
      // Un toque de mas no resta ni se senala: es otro intento.
      otrosIntentos.current += 1;
    }
  }

  function empezar() {
    inicio.current = marcaDeTiempo();
    aciertos.current = 0;
    otrosIntentos.current = 0;
    setIndice(-1);
    setFase('corriendo');
  }

  function terminar() {
    if (terminada.current) {
      return;
    }

    terminada.current = true;

    alTerminar({
      score: Math.min(resumen.aciertos, puntosMaximos),
      metadata: {
        aciertos: resumen.aciertos,
        objetivos: puntosMaximos,
        otrosIntentos: resumen.otrosIntentos,
        segundos: segundosDesde(inicio.current),
      },
    });
  }

  if (fase === 'inicio') {
    return (
      <div className="juego">
        <VozDeLaMascota mascota={mascota} mensaje={elegir(EN_EL_JUEGO, 0)} expresion="feliz" />

        <PasosDeInicio
          pasos={[
            'Mira el símbolo.',
            `Toca solo si es ${nombresDelObjetivo}.`,
            'Deja pasar los demás.',
          ]}
        />

        <p className="actividad__texto">
          Irán apareciendo símbolos, uno tras otro, sin prisa. Toca la pantalla solo cuando salga{' '}
          <strong>{nombresDelObjetivo}</strong>. Si tocas de más no pasa nada: es otro intento. Son
          unos {Math.round((secuencia.length * msPorEstimulo) / 1000)} segundos.
        </p>

        <div className="juego__objetivo" aria-label={`Tu objetivo: ${nombresDelObjetivo}`}>
          {objetivos.map((objetivo) => (
            <span key={objetivo.clave} className="juego__objetivo-ficha">
              <Pictograma clave={objetivo.pictograma} tamano={48} />
              <span>{objetivo.nombre}</span>
            </span>
          ))}
        </div>

        <BarraDeAccion>
          <BotonPrincipal alPulsar={empezar} conFlecha>
            Empezar
          </BotonPrincipal>
        </BarraDeAccion>
      </div>
    );
  }

  if (fase === 'fin') {
    const bien = resumen.aciertos >= Math.ceil(puntosMaximos * 0.75);

    return (
      <div className="juego">
        <VozDeLaMascota
          mascota={mascota}
          mensaje={bien ? elegir(ACIERTO, resumen.aciertos) : '¡Casi! Vas por buen camino.'}
          {...(bien ? {} : { ademas: elegir(ANIMO_TRAS_CASI, resumen.aciertos) })}
          resultado={bien ? 'acierto' : 'casi'}
          expresion={bien ? 'celebrando' : 'normal'}
          latido={1}
        />

        <p className="juego__marcador" role="status">
          Tocaste {resumen.aciertos} de {puntosMaximos} veces que salió {nombresDelObjetivo}.
          {resumen.otrosIntentos > 0 ? ` Otros intentos: ${String(resumen.otrosIntentos)}.` : ''}
        </p>

        <BarraDeAccion>
          <BotonPrincipal alPulsar={terminar} deshabilitado={enviando}>
            {enviando ? 'Guardando…' : 'Terminar'}
          </BotonPrincipal>
        </BarraDeAccion>
      </div>
    );
  }

  const claveDeAhora = indice >= 0 ? secuencia[indice] : undefined;
  const simboloDeAhora = claveDeAhora === undefined ? undefined : simbolos.get(claveDeAhora);

  return (
    <div className="juego">
      <VozDeLaMascota
        mascota={mascota}
        mensaje={`Toca solo si es ${nombresDelObjetivo}.`}
        anunciar={false}
      />

      <div className="juego__objetivo juego__objetivo--fijo">
        <span className="juego__objetivo-titulo">Tu objetivo</span>
        {objetivos.map((objetivo) => (
          <span key={objetivo.clave} className="juego__objetivo-ficha">
            <Pictograma clave={objetivo.pictograma} tamano={32} />
            <span>{objetivo.nombre}</span>
          </span>
        ))}
      </div>

      {/* Cada simbolo que sale se anuncia por escrito: la figura no llega a quien no ve. */}
      <p className="solo-lectores" aria-live="polite" data-anuncio="">
        {simboloDeAhora?.nombre ?? ''}
      </p>

      <button
        type="button"
        className="juego__estimulo"
        onClick={tocar}
        aria-label={`Tocar si el símbolo es ${nombresDelObjetivo}`}
      >
        {simboloDeAhora === undefined ? (
          <span className="juego__estimulo-espera">Prepárate…</span>
        ) : (
          <>
            <Pictograma clave={simboloDeAhora.pictograma} tamano={120} />
            <span className="juego__estimulo-nombre" aria-hidden="true">
              {simboloDeAhora.nombre}
            </span>
          </>
        )}
      </button>
    </div>
  );
}
