import { useMemo, useRef, useState } from 'react';

import '../../../estilos/juegos.css';
import '../../../estilos/juegosDeCognicion.css';
import { BarraDeAccion, BotonPrincipal } from '../viva/BarraDeAccion.tsx';
import { ACIERTO, ANIMO_TRAS_CASI, EN_EL_JUEGO, elegir } from '../viva/mensajes.ts';
import { PasosDeInicio } from '../viva/PasosDeInicio.tsx';
import { useMascotaDeLaPersona } from '../viva/mascotaDeLaPersona.ts';
import { VozDeLaMascota } from '../viva/VozDeLaMascota.tsx';
import { barajar, marcaDeTiempo, segundosDesde } from './cognicion.ts';
import { leerLaLista, type ParametrosDeLista } from './parametrosDeLaCognicion.ts';
import type { PropsDeMecanica } from './registro.tsx';
import { SinSesion } from './SinSesion.tsx';
import { VistaConTiempo } from './VistaConTiempo.tsx';

/**
 * «Recuerda la lista» (SCRUM-225, ficha COG-06): se ve una lista unos segundos, se oculta y se eligen los
 * elementos entre ellos y unos distractores.
 *
 * Es el motor `ver_ocultar_recordar` en su modo `lista`. El tiempo a la vista es parte del juego, no una
 * amenaza (R4), y siempre se puede pasar antes. Se eligen **hasta tantos como tenia la lista**; no hace falta
 * llegar al tope, y «Listo» sirve con los que se recuerden. Cada elemento acertado vale
 * `puntosMaximos / elementos` (un punto sobre el maximo de la mecanica); elegir uno de mas no resta.
 *
 * Al revisar se dice cuales eran, sin senalar lo que se eligio de mas: lo que no estaba se queda en un tono
 * neutro. Nada se distingue solo por el color (R10): lo recordado lleva una marca y lo que faltaba, una palabra.
 */

export function RecuerdaLaLista({ sesion, ...props }: PropsDeMecanica) {
  const reglas = useMemo(() => leerLaLista(sesion?.parametros), [sesion]);

  if (reglas === null) {
    return <SinSesion />;
  }

  return <Lista {...props} reglas={reglas} />;
}

type Fase = 'inicio' | 'mirando' | 'eligiendo' | 'revisada';

function Lista({
  alTerminar,
  enviando,
  reglas,
}: Omit<PropsDeMecanica, 'sesion'> & { readonly reglas: ParametrosDeLista }) {
  const mascota = useMascotaDeLaPersona();
  const { contexto, segundosVista, elementos, distractores, puntosMaximos } = reglas;
  const [fase, setFase] = useState<Fase>('inicio');
  const [elegidas, setElegidas] = useState<readonly string[]>([]);
  const inicio = useRef(0);
  const terminada = useRef(false);
  // El orden de las opciones se decide una vez, al abrir la actividad: no cambia al elegir.
  const opciones = useMemo(
    () => barajar([...elementos, ...distractores]),
    [elementos, distractores],
  );
  const clavesDeLaLista = useMemo(
    () => new Set(elementos.map((elemento) => elemento.clave)),
    [elementos],
  );

  const aciertos = elegidas.filter((clave) => clavesDeLaLista.has(clave)).length;
  const llenas = elegidas.length >= elementos.length;
  // Un elemento vale lo mismo que los demas: el maximo de la mecanica entre los que tenia la lista.
  const puntaje = Math.min(
    Math.round((aciertos / elementos.length) * puntosMaximos * 100) / 100,
    puntosMaximos,
  );

  function alternar(clave: string) {
    setElegidas((antes) =>
      antes.includes(clave)
        ? antes.filter((otra) => otra !== clave)
        : antes.length >= elementos.length
          ? antes
          : [...antes, clave],
    );
  }

  function terminar() {
    if (terminada.current) {
      return;
    }

    terminada.current = true;

    alTerminar({
      score: puntaje,
      metadata: {
        aciertos,
        elementos: elementos.length,
        elegidas: elegidas.length,
        segundos: segundosDesde(inicio.current),
      },
    });
  }

  if (fase === 'inicio') {
    return (
      <div className="juego">
        <VozDeLaMascota mascota={mascota} mensaje={elegir(EN_EL_JUEGO, 0)} expresion="feliz" />

        <PasosDeInicio pasos={['Mira la lista.', 'Se oculta.', 'Elige lo que había.']} />

        <p className="actividad__texto">
          Verás una lista durante unos {segundosVista} segundos. Cuando se oculte, elige entre
          varias opciones lo que había. No hace falta recordarlo todo, y puedes pasar antes si ya la
          tienes.
        </p>

        <BarraDeAccion>
          <BotonPrincipal
            alPulsar={() => {
              inicio.current = marcaDeTiempo();
              setFase('mirando');
            }}
            conFlecha
          >
            Empezar
          </BotonPrincipal>
        </BarraDeAccion>
      </div>
    );
  }

  if (fase === 'mirando') {
    return (
      <div className="juego">
        <VozDeLaMascota mascota={mascota} mensaje="Mira con calma." />

        <VistaConTiempo
          segundos={segundosVista}
          alAcabar={() => {
            setFase('eligiendo');
          }}
          textoDelBoton="Ya la tengo"
        >
          <section className="juego__lista" aria-label={contexto}>
            <h2 className="juego__lista-titulo">{contexto}</h2>
            <ul>
              {elementos.map((elemento) => (
                <li key={elemento.clave}>{elemento.nombre}</li>
              ))}
            </ul>
          </section>
        </VistaConTiempo>
      </div>
    );
  }

  const revisada = fase === 'revisada';
  const mensaje = !revisada
    ? `Elige hasta ${String(elementos.length)}: lo que recuerdes.`
    : aciertos >= Math.ceil(elementos.length * 0.75)
      ? elegir(ACIERTO, aciertos)
      : '¡Casi! Vas por buen camino.';

  return (
    <div className="juego">
      <VozDeLaMascota
        mascota={mascota}
        mensaje={mensaje}
        {...(revisada && aciertos < Math.ceil(elementos.length * 0.75)
          ? { ademas: elegir(ANIMO_TRAS_CASI, aciertos) }
          : {})}
        {...(revisada
          ? {
              resultado:
                aciertos >= Math.ceil(elementos.length * 0.75)
                  ? ('acierto' as const)
                  : ('casi' as const),
            }
          : {})}
        expresion={
          revisada && aciertos >= Math.ceil(elementos.length * 0.75) ? 'celebrando' : 'normal'
        }
        latido={revisada ? 1 : elegidas.length}
      />

      <h2 className="juego__pregunta" id="lista-pregunta">
        {revisada ? `Esto traía la lista: ${contexto}` : `¿Qué había en la lista? ${contexto}`}
      </h2>

      <p className="juego__marcador" aria-live="polite">
        {revisada
          ? `Recordaste ${String(aciertos)} de ${String(elementos.length)}.`
          : `Llevas ${String(elegidas.length)} de ${String(elementos.length)}.`}
      </p>

      <div
        className="juego__opciones"
        role="group"
        aria-labelledby="lista-pregunta"
        data-columnas="2"
      >
        {opciones.map((opcion) => {
          const marcada = elegidas.includes(opcion.clave);
          const estaba = clavesDeLaLista.has(opcion.clave);
          const estado = !revisada
            ? undefined
            : estaba && marcada
              ? 'correcta'
              : estaba
                ? 'faltaba'
                : marcada
                  ? 'elegida'
                  : 'otra';

          return (
            <button
              key={opcion.clave}
              type="button"
              className="juego__opcion"
              aria-pressed={marcada}
              data-marcada={marcada ? '' : undefined}
              {...(estado === undefined ? {} : { 'data-estado': estado })}
              disabled={revisada || (llenas && !marcada)}
              onClick={() => {
                alternar(opcion.clave);
              }}
            >
              <span className="juego__opcion-texto">{opcion.nombre}</span>
              {estado === 'correcta' && (
                <span className="juego__opcion-marca">
                  <span aria-hidden="true">✓</span>
                  <span className="solo-lectores"> (estaba en la lista)</span>
                </span>
              )}
              {estado === 'faltaba' && (
                <span className="juego__opcion-marca">estaba en la lista</span>
              )}
              {estado === 'elegida' && <span className="juego__opcion-marca">tu elección</span>}
              {!revisada && marcada && (
                <span className="juego__opcion-marca" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>

      <BarraDeAccion>
        {!revisada ? (
          <BotonPrincipal
            alPulsar={() => {
              setFase('revisada');
            }}
            conFlecha
          >
            Listo
          </BotonPrincipal>
        ) : (
          <BotonPrincipal alPulsar={terminar} deshabilitado={enviando}>
            {enviando ? 'Guardando…' : 'Terminar'}
          </BotonPrincipal>
        )}
      </BarraDeAccion>
    </div>
  );
}
