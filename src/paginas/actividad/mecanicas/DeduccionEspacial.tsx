import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import '../../../estilos/juegos.css';
import '../../../estilos/juegosDeCognicion.css';
import '../../../estilos/cognicion365.css';
import '../../../estilos/deduccionEspacial.css';
import { BarraDeAccion, BotonPrincipal } from '../viva/BarraDeAccion.tsx';
import { PasosDeInicio } from '../viva/PasosDeInicio.tsx';
import { useMascotaDeLaPersona } from '../viva/mascotaDeLaPersona.ts';
import { VozDeLaMascota } from '../viva/VozDeLaMascota.tsx';
import { FormaDeCasilla } from './FormaDeCasilla.tsx';
import { marcaDeTiempo, segundosDesde } from './cognicion.ts';
import { estiloDeLaCasilla } from './coloresDeCasillas.ts';
import { leerDeduccionEspacial } from './parametrosDeDeduccionEspacial.ts';
import type { PropsDeMecanica } from './registro.tsx';
import { SinSesion } from './SinSesion.tsx';

type Fase = 'inicio' | 'resolviendo' | 'revisada';

/** Una cuadrícula de pistas: la persona cruza reglas de forma y posición y señala una única casilla. */
export function DeduccionEspacial({ sesion, ...props }: PropsDeMecanica) {
  const reglas = useMemo(() => leerDeduccionEspacial(sesion?.parametros), [sesion]);

  if (reglas === null) {
    return <SinSesion />;
  }

  return <Juego {...props} reglas={reglas} />;
}

function Juego({
  alTerminar,
  enviando,
  reglas,
}: Omit<PropsDeMecanica, 'sesion'> & {
  readonly reglas: NonNullable<ReturnType<typeof leerDeduccionEspacial>>;
}) {
  const mascota = useMascotaDeLaPersona();
  const [fase, setFase] = useState<Fase>('inicio');
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [acerto, setAcerto] = useState(false);
  const inicio = useRef(0);
  const botonFinal = useRef<HTMLButtonElement>(null);
  const enviada = useRef(false);
  const estilo = { '--columnas-deduccion': reglas.columnas } as CSSProperties;

  useEffect(() => {
    if (fase === 'revisada') {
      botonFinal.current?.focus();
    }
  }, [fase]);

  function revisar() {
    if (seleccionada === null || fase !== 'resolviendo') {
      return;
    }

    setAcerto(seleccionada === reglas.solucion);
    setFase('revisada');
  }

  function terminar() {
    if (enviada.current) {
      return;
    }

    enviada.current = true;
    alTerminar({
      score: acerto ? reglas.puntosMaximos : 0,
      metadata: {
        aciertos: acerto ? 1 : 0,
        rondas: 1,
        segundos: segundosDesde(inicio.current),
        mecanica: 'deduccion_espacial',
      },
    });
  }

  if (fase === 'inicio') {
    return (
      <div className="juego deduccion-espacial">
        <VozDeLaMascota
          mascota={mascota}
          mensaje="Miremos cada pista con calma."
          expresion="feliz"
        />
        <PasosDeInicio
          pasos={['Lee las pistas.', 'Cruza forma y posición.', 'Elige una casilla.']}
        />
        <p className="actividad__texto">
          Busca la única figura que cumple todas las pistas. Tómate el tiempo que necesites.
        </p>
        <BarraDeAccion>
          <BotonPrincipal
            alPulsar={() => {
              inicio.current = marcaDeTiempo();
              setFase('resolviendo');
            }}
            conFlecha
          >
            Empezar
          </BotonPrincipal>
        </BarraDeAccion>
      </div>
    );
  }

  const solucion = reglas.celdas.find((celda) => celda.clave === reglas.solucion);

  return (
    <div className="juego deduccion-espacial">
      <VozDeLaMascota
        mascota={mascota}
        mensaje={
          fase === 'revisada'
            ? acerto
              ? '¡Bien visto! Las pistas te llevaron hasta ahí.'
              : 'Buen intento. Mira cómo se cruzan las pistas.'
            : '¿Qué casilla cumple todas las pistas?'
        }
        expresion={fase === 'revisada' && acerto ? 'celebrando' : 'normal'}
        {...(fase === 'revisada' ? { resultado: acerto ? 'acierto' : 'casi' } : {})}
      />

      <section aria-labelledby="deduccion-pistas-titulo" className="deduccion-espacial__pistas">
        <h2 className="juego__pregunta" id="deduccion-pistas-titulo">
          Cruza las pistas
        </h2>
        <ol className="viva-pasos deduccion-espacial__pistas-lista">
          {reglas.pistas.map((pista, indice) => (
            <li className="viva-pasos__paso" key={pista}>
              <span aria-hidden="true" className="viva-pasos__numero">
                {indice + 1}
              </span>
              <span>{pista}</span>
            </li>
          ))}
        </ol>
      </section>

      <div
        aria-label="Cuadrícula de figuras"
        className="deduccion-espacial__tablero"
        role="group"
        style={estilo}
      >
        {reglas.celdas.map((celda, indice) => {
          const [forma, color] = celda.clave.split('-');
          const elegida = seleccionada === celda.clave;
          const esSolucion = fase === 'revisada' && celda.clave === reglas.solucion;
          const estado = esSolucion ? 'correcta' : elegida ? 'elegida' : undefined;

          return (
            <button
              aria-label={`Fila ${celda.fila}, columna ${celda.columna}: ${celda.etiqueta}${
                esSolucion ? ', respuesta correcta' : ''
              }`}
              aria-pressed={elegida}
              className="cognicion365__casilla deduccion-espacial__casilla juego__opcion"
              data-marcada={elegida || undefined}
              data-estado={estado}
              disabled={fase === 'revisada' || enviando}
              key={celda.clave}
              onClick={() => setSeleccionada(celda.clave)}
              style={{ '--i': indice } as CSSProperties}
              type="button"
            >
              <span
                aria-hidden="true"
                className="deduccion-espacial__forma"
                style={estiloDeLaCasilla(color)}
              >
                <FormaDeCasilla {...(forma === undefined ? {} : { forma })} tamano={32} />
              </span>
              <span>{celda.etiqueta}</span>
            </button>
          );
        })}
      </div>

      {fase === 'revisada' && (
        <p className="juego__despues" role="status">
          {reglas.explicacion}
          {solucion === undefined ? '' : ` La respuesta era ${solucion.etiqueta}.`}
        </p>
      )}

      <BarraDeAccion>
        {fase === 'resolviendo' ? (
          <BotonPrincipal alPulsar={revisar} deshabilitado={seleccionada === null || enviando}>
            Revisar mi elección
          </BotonPrincipal>
        ) : (
          <BotonPrincipal
            alPulsar={terminar}
            referencia={botonFinal}
            conFlecha
            deshabilitado={enviando}
          >
            Terminar
          </BotonPrincipal>
        )}
      </BarraDeAccion>
    </div>
  );
}
