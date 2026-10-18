import { useMemo, useState, type CSSProperties } from 'react';

import '../../../estilos/juegosDeCognicion.css';
import { Pictograma } from '../pictogramas/Pictograma.tsx';
import { BarraDeAccion, BotonPrincipal } from '../viva/BarraDeAccion.tsx';
import { EN_EL_JUEGO, elegir } from '../viva/mensajes.ts';
import { PasosDeInicio } from '../viva/PasosDeInicio.tsx';
import { useMascotaDeLaPersona } from '../viva/mascotaDeLaPersona.ts';
import { VozDeLaMascota } from '../viva/VozDeLaMascota.tsx';
import { JuegoDeRondas } from './JuegoDeRondas.tsx';
import { leerLaEscena, type ParametrosDeEscena } from './parametrosDeLaCognicion.ts';
import type { PropsDeMecanica } from './registro.tsx';
import { SinSesion } from './SinSesion.tsx';
import { VistaConTiempo } from './VistaConTiempo.tsx';

/**
 * «Lo que vi» (SCRUM-225, ficha COG-09): se ven unos pictogramas en una cuadricula, se ocultan y se pregunta
 * que habia en cinco de los lugares.
 *
 * Es el motor `ver_ocultar_recordar` en su modo `escena`. Tres tiempos: una presentacion, la escena unos
 * segundos (con «Ya la tengo» para pasar antes) y las preguntas, que se juegan con `JuegoDeRondas`: un acierto,
 * un punto. Cada pregunta marca el lugar en una cuadricula vacia y escribe su fila y su columna, asi que se
 * contesta igual sin ver el color ni la forma. Distinta de «Encuentra la diferencia»: aqui se **ocultan**.
 *
 * Cada figura lleva su nombre escrito debajo (R10). Sin escenas con personas.
 */

function Cuadricula({
  reglas,
  marcada,
}: {
  reglas: ParametrosDeEscena;
  marcada?: { fila: number; columna: number };
}) {
  const estilo = { '--filas': reglas.filas, '--columnas': reglas.columnas } as CSSProperties;
  const lugares = Array.from({ length: reglas.filas * reglas.columnas }, (_, i) => ({
    fila: Math.floor(i / reglas.columnas) + 1,
    columna: (i % reglas.columnas) + 1,
  }));

  return (
    <div
      className="juego__escena"
      style={estilo}
      role="img"
      aria-label={
        marcada === undefined
          ? `Escena de ${String(reglas.filas)} filas por ${String(reglas.columnas)} columnas, con ${reglas.celdas.map((celda) => `${celda.nombre} en la fila ${String(celda.fila)}, columna ${String(celda.columna)}`).join('; ')}`
          : `Cuadrícula de ${String(reglas.filas)} filas por ${String(reglas.columnas)} columnas. El lugar marcado es la fila ${String(marcada.fila)}, columna ${String(marcada.columna)}.`
      }
    >
      {lugares.map((lugar) => {
        const celda =
          marcada === undefined
            ? reglas.celdas.find((c) => c.fila === lugar.fila && c.columna === lugar.columna)
            : undefined;
        const esLaMarcada = marcada?.fila === lugar.fila && marcada.columna === lugar.columna;

        return (
          <div
            key={`${String(lugar.fila)}-${String(lugar.columna)}`}
            className="juego__celda"
            {...(celda === undefined ? {} : { 'data-con-figura': '' })}
            {...(esLaMarcada ? { 'data-marcada': '' } : {})}
          >
            {celda !== undefined && (
              <>
                <Pictograma clave={celda.pictograma} tamano={40} />
                <span className="juego__celda-nombre">{celda.nombre}</span>
              </>
            )}
            {esLaMarcada && <span aria-hidden="true">?</span>}
          </div>
        );
      })}
    </div>
  );
}

export function LoQueVi({ sesion, ...props }: PropsDeMecanica) {
  const reglas = useMemo(() => leerLaEscena(sesion?.parametros), [sesion]);

  if (reglas === null) {
    return <SinSesion />;
  }

  return <Escena {...props} reglas={reglas} />;
}

function Escena({
  alTerminar,
  enviando,
  reglas,
}: Omit<PropsDeMecanica, 'sesion'> & { readonly reglas: ParametrosDeEscena }) {
  const mascota = useMascotaDeLaPersona();
  const [fase, setFase] = useState<'inicio' | 'mirando' | 'preguntas'>('inicio');

  if (fase === 'inicio') {
    return (
      <div className="juego">
        <VozDeLaMascota mascota={mascota} mensaje={elegir(EN_EL_JUEGO, 0)} expresion="feliz" />

        <PasosDeInicio pasos={['Mira la escena.', 'Se oculta.', 'Contesta qué había.']} />

        <p className="actividad__texto">
          Verás unas figuras en una cuadrícula durante unos {reglas.segundosVista} segundos. Cuando
          se oculten, te preguntaremos qué había en {String(reglas.preguntas.length)} de los
          lugares. Si quieres, puedes pasar antes.
        </p>

        <BarraDeAccion>
          <BotonPrincipal
            alPulsar={() => {
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
          segundos={reglas.segundosVista}
          alAcabar={() => {
            setFase('preguntas');
          }}
          textoDelBoton="Ya la tengo"
        >
          <Cuadricula reglas={reglas} />
        </VistaConTiempo>
      </div>
    );
  }

  return (
    <JuegoDeRondas
      alTerminar={alTerminar}
      enviando={enviando}
      puntosMaximos={reglas.puntosMaximos}
      etiquetaDeRonda="Pregunta"
      columnas={1}
      rondas={reglas.preguntas.map((pregunta, indice) => ({
        clave: `p${String(indice + 1)}`,
        pregunta: pregunta.texto,
        contexto: (
          <Cuadricula
            reglas={reglas}
            marcada={{ fila: pregunta.fila, columna: pregunta.columna }}
          />
        ),
        opciones: pregunta.opciones.map((figura) => ({
          texto: figura.nombre,
          adorno: <Pictograma clave={figura.pictograma} tamano={32} />,
        })),
        correcta: pregunta.correcta,
        despues: `Ahí había: ${pregunta.opciones[pregunta.correcta]?.nombre ?? ''}.`,
        alFallar: '¡Casi! Los detalles se escapan, es normal.',
      }))}
    />
  );
}
