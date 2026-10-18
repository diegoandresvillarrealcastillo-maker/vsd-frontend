import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import '../../../estilos/ambientaciones.css';
import '../../../estilos/respiracion.css';
import { BarraDeAccion, BotonPrincipal, BotonSecundario } from '../viva/BarraDeAccion.tsx';
import { vibrar } from '../viva/haptico.ts';
import { INICIO, elegir } from '../viva/mensajes.ts';
import { useMascotaDeLaPersona } from '../viva/mascotaDeLaPersona.ts';
import { VozDeLaMascota } from '../viva/VozDeLaMascota.tsx';
import { marcaDeTiempo } from './cognicion.ts';
import {
  leerGuiaDeRespiracion,
  type ParametrosDeGuiaDeRespiracion,
} from './parametrosDeLaSesion.ts';
import type { PropsDeMecanica } from './registro.tsx';
import {
  cuantosCiclos,
  duracionDelCiclo,
  formatearElTiempo,
  puntoDeLaRespiracion,
  type Etapa,
} from './respiracion.ts';
import { SinSesion } from './SinSesion.tsx';

/**
 * «Respiracion guiada»: un circulo que se abre y se cierra al ritmo del patron de la sesion, con la
 * palabra de la etapa y la cuenta en texto (SCRUM-210, ficha BIE-01). Es el motor
 * `guia_paso_a_paso` en su primera mecanica.
 *
 * Es una actividad **sin puntaje y de bienestar**: lo que mas importa es lo que no hace.
 *
 * - **La advertencia va a la vista y antes de empezar**, en una tarjeta y no en letra pequena:
 *   «si te mareas o te incomoda, suelta el patron y respira como siempre». Siempre se puede parar.
 * - **No se presenta como un tratamiento**, no promete nada ni dice si se respira bien o mal. El
 *   agradecimiento al final no depende de nada: tambien si se paro a la mitad.
 * - **Ninguna retencion larga ni ritmos rapidos**: lo impone el contrato de la sesion (pausa de
 *   hasta 4 s; inhalar y exhalar de 3 s como minimo), y esta pantalla no tiene respaldo: sin una
 *   sesion que entienda, lo dice.
 * - **Con movimiento reducido** el circulo no se anima: quedan la palabra, la cuenta en texto y la
 *   barra, que no se desliza. Asi lo pide la ficha.
 * - **Para un lector de pantalla** se anuncia el cambio de etapa («Inhala», «Exhala»), no cada
 *   segundo: la cuenta en texto es adorno de quien ve.
 *
 * ## El tiempo
 *
 * El ritmo es una funcion pura del tiempo transcurrido (`respiracion.ts`); esta pantalla solo mira
 * el reloj cada cuarto de segundo y pinta lo que esa funcion dice. La sesion termina siempre al
 * cerrar un ciclo, nunca a mitad de una exhalacion.
 */

const PALABRA: Readonly<Record<Etapa, string>> = {
  inhala: 'Inhala',
  pausa: 'Pausa',
  exhala: 'Exhala',
};

/** Cuanto se abre el circulo: lleno al inhalar y en la pausa, recogido al exhalar y en reposo. */
const ESCALA: Readonly<Record<Etapa | 'reposo', number>> = {
  inhala: 1,
  pausa: 1,
  exhala: 0.55,
  reposo: 0.55,
};

/** Cada cuanto se mira el reloj. */
const CADA_MS = 250;

/** Si la sesion no trae frases, la mascota no se queda callada. */
const FRASES_DE_SIEMPRE: readonly string[] = ['Sin prisa.'];

const AGRADECIMIENTO = 'Gracias por darte este rato.';

type Fase =
  | { readonly tipo: 'inicio' }
  | { readonly tipo: 'respirando' }
  | {
      readonly tipo: 'terminada';
      readonly completa: boolean;
      readonly segundos: number;
      /** Los ciclos que se alcanzaron a hacer enteros. */
      readonly ciclos: number;
    };

function segundosEnPalabras(n: number): string {
  return `${String(n)} ${n === 1 ? 'segundo' : 'segundos'}`;
}

export function GuiaDeRespiracion({ sesion, ...props }: PropsDeMecanica) {
  const reglas = useMemo(() => leerGuiaDeRespiracion(sesion?.parametros), [sesion]);

  if (reglas === null) {
    return <SinSesion />;
  }

  return <Guia {...props} reglas={reglas} />;
}

function Guia({
  alTerminar,
  enviando,
  reglas,
}: Omit<PropsDeMecanica, 'sesion'> & { readonly reglas: ParametrosDeGuiaDeRespiracion }) {
  const mascota = useMascotaDeLaPersona();
  const { advertenciaInicial, patron, duracionSegundos, ambientacion, frases, haptico } = reglas;
  const ciclos = cuantosCiclos(duracionSegundos, patron);
  const totalSegundos = ciclos * duracionDelCiclo(patron);
  const [fase, setFase] = useState<Fase>({ tipo: 'inicio' });
  /** Los segundos que lleva respirando, al ultimo cuarto de segundo. */
  const [transcurrido, setTranscurrido] = useState(0);
  const terminada = useRef(false);

  const punto = puntoDeLaRespiracion(transcurrido, patron, ciclos);

  // El reloj: cada cuarto de segundo, hasta que se acaba o se para. Al cumplirse los ciclos termina,
  // y siempre al cerrar uno: lo decide el propio reloj, no un efecto que mire el estado.
  useEffect(() => {
    if (fase.tipo !== 'respirando') {
      return undefined;
    }

    const empezo = marcaDeTiempo();
    const reloj = setInterval(() => {
      const segundos = (marcaDeTiempo() - empezo) / 1000;

      if (puntoDeLaRespiracion(segundos, patron, ciclos).terminada) {
        setFase({ tipo: 'terminada', completa: true, segundos: totalSegundos, ciclos });
      } else {
        setTranscurrido(segundos);
      }
    }, CADA_MS);

    return () => clearInterval(reloj);
  }, [fase.tipo, patron, ciclos, totalSegundos]);

  // Una vibracion suave al empezar y al cambiar de etapa, solo si la sesion la pide.
  const etapaDeAhora = fase.tipo === 'respirando' ? punto.etapa : null;

  useEffect(() => {
    if (haptico && etapaDeAhora !== null) {
      vibrar(30);
    }
  }, [haptico, etapaDeAhora]);

  function empezar() {
    setFase({ tipo: 'respirando' });
  }

  function parar() {
    // Lo que se alcanzo a hacer: los ciclos enteros, sin contar el que iba a medias.
    setFase({
      tipo: 'terminada',
      completa: false,
      segundos: Math.round(transcurrido),
      ciclos: punto.ciclo,
    });
  }

  function terminar() {
    if (fase.tipo !== 'terminada' || terminada.current) {
      return;
    }

    terminada.current = true;

    alTerminar({
      metadata: { segundos: fase.segundos, ciclos: fase.ciclos, completa: fase.completa },
    });
  }

  const respirando = fase.tipo === 'respirando';
  const etapa: Etapa | 'reposo' = respirando ? punto.etapa : 'reposo';
  // El contrato pide al menos 60 s, y el redondeo a ciclos enteros no baja de unos 50: nunca es 0.
  const minutos = Math.round(totalSegundos / 60);
  const estiloDelCirculo = {
    '--escala': String(ESCALA[etapa]),
    '--dur': respirando ? `${String(patron[`${punto.etapa}Segundos`])}s` : '0s',
  } as CSSProperties;

  const mensaje =
    fase.tipo === 'inicio'
      ? elegir(INICIO, 0)
      : fase.tipo === 'terminada'
        ? AGRADECIMIENTO
        : elegir(frases.length > 0 ? frases : FRASES_DE_SIEMPRE, punto.ciclo);

  return (
    <div className="respiracion" data-ambientacion={ambientacion}>
      <VozDeLaMascota
        mascota={mascota}
        mensaje={mensaje}
        expresion={fase.tipo === 'inicio' || fase.tipo === 'terminada' ? 'feliz' : 'normal'}
        latido={fase.tipo === 'terminada' ? 1 : 0}
      />

      {fase.tipo === 'inicio' && (
        <>
          <section className="respiracion__aviso" role="note" aria-labelledby="respiracion-aviso">
            <h2 id="respiracion-aviso" className="respiracion__aviso-titulo">
              Antes de empezar
            </h2>
            <p className="respiracion__aviso-texto">{advertenciaInicial}</p>
          </section>

          <p className="actividad__texto respiracion__intro">
            Vas a seguir un círculo que se abre y se cierra. Inhalas{' '}
            {segundosEnPalabras(patron.inhalaSegundos)} y exhalas{' '}
            {segundosEnPalabras(patron.exhalaSegundos)}
            {patron.pausaSegundos > 0
              ? `, con una pausa de ${segundosEnPalabras(patron.pausaSegundos)} en medio`
              : ''}
            . Dura {minutos} {minutos === 1 ? 'minuto' : 'minutos'} y puedes parar cuando quieras.
          </p>
        </>
      )}

      <div className="respiracion__escenario">
        <div className="respiracion__circulo" data-etapa={etapa} style={estiloDelCirculo}>
          <span className="respiracion__palabra">{respirando ? PALABRA[punto.etapa] : ''}</span>
          <span className="respiracion__cuenta" aria-hidden="true">
            {respirando ? String(punto.restanSegundos) : ''}
          </span>
        </div>
      </div>

      {/* Lo que se anuncia es la etapa, no cada segundo: la cuenta es adorno de quien ve. */}
      <p className="solo-lectores" aria-live="polite" data-anuncio="">
        {respirando ? PALABRA[punto.etapa] : ''}
      </p>

      {respirando && (
        <div className="respiracion__tiempo">
          <p className="respiracion__quedan">
            Quedan {formatearElTiempo(totalSegundos - transcurrido)}
          </p>
          <div
            className="respiracion__barra"
            role="progressbar"
            aria-label="Avance de la respiración"
            aria-valuemin={0}
            aria-valuemax={ciclos}
            aria-valuenow={punto.ciclo}
          >
            <span
              className="respiracion__barra-relleno"
              style={{ width: `${String((transcurrido / totalSegundos) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <BarraDeAccion>
        {fase.tipo === 'inicio' && (
          <BotonPrincipal alPulsar={empezar} conFlecha>
            Empezar
          </BotonPrincipal>
        )}

        {respirando && <BotonSecundario alPulsar={parar}>Parar</BotonSecundario>}

        {fase.tipo === 'terminada' && (
          <BotonPrincipal alPulsar={terminar} deshabilitado={enviando}>
            {enviando ? 'Guardando…' : 'Terminar'}
          </BotonPrincipal>
        )}
      </BarraDeAccion>
    </div>
  );
}
