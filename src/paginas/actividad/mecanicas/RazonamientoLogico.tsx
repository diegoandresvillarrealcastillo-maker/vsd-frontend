import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import '../../../estilos/juegos.css';
import '../../../estilos/juegosDeCognicion.css';
import '../../../estilos/cognicion365.css';
import '../../../estilos/razonamientoLogico.css';
import { BarraDeAccion, BotonPrincipal } from '../viva/BarraDeAccion.tsx';
import { PasosDeInicio } from '../viva/PasosDeInicio.tsx';
import { useMascotaDeLaPersona } from '../viva/mascotaDeLaPersona.ts';
import { VozDeLaMascota } from '../viva/VozDeLaMascota.tsx';
import { marcaDeTiempo, segundosDesde } from './cognicion.ts';
import { leerRazonamientoLogico } from './parametrosDeRazonamientoLogico.ts';
import type { PropsDeMecanica } from './registro.tsx';
import { SinSesion } from './SinSesion.tsx';

type Fase = 'inicio' | 'resolviendo' | 'revisada';

/** Deriva una conclusión necesaria desde premisas relacionadas, sin inferir datos que no aparecen. */
export function RazonamientoLogico({ sesion, ...props }: PropsDeMecanica) {
  const reglas = useMemo(() => leerRazonamientoLogico(sesion?.parametros), [sesion]);

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
  readonly reglas: NonNullable<ReturnType<typeof leerRazonamientoLogico>>;
}) {
  const mascota = useMascotaDeLaPersona();
  const [fase, setFase] = useState<Fase>('inicio');
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [acerto, setAcerto] = useState(false);
  const inicio = useRef(0);
  const botonFinal = useRef<HTMLButtonElement>(null);
  const enviada = useRef(false);

  useEffect(() => {
    if (fase === 'revisada') {
      botonFinal.current?.focus();
    }
  }, [fase]);

  function revisar() {
    if (seleccionada === null || fase !== 'resolviendo') {
      return;
    }

    const respuesta = reglas.opciones.find((opcion) => opcion.clave === seleccionada);
    setAcerto(respuesta?.correcta === true);
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
        mecanica: 'deduccion_logica',
      },
    });
  }

  if (fase === 'inicio') {
    return (
      <div className="juego cognicion365">
        <VozDeLaMascota mascota={mascota} mensaje="Leamos lo que sabemos." expresion="feliz" />
        <PasosDeInicio
          pasos={['Lee las premisas.', 'Conecta la información.', 'Elige una conclusión.']}
        />
        <p className="actividad__texto">
          Elige una idea que necesariamente se deduzca de las premisas.
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

  const solucion = reglas.opciones.find((opcion) => opcion.correcta);

  return (
    <div className="juego cognicion365">
      <VozDeLaMascota
        mascota={mascota}
        mensaje={
          fase === 'revisada'
            ? acerto
              ? '¡Bien conectado! La conclusión sí se deriva.'
              : 'Buen intento. Revisa qué dicen exactamente las premisas.'
            : '¿Qué conclusión se sostiene con estas ideas?'
        }
        expresion={fase === 'revisada' && acerto ? 'celebrando' : 'normal'}
        {...(fase === 'revisada' ? { resultado: acerto ? 'acierto' : 'casi' } : {})}
      />

      <section aria-labelledby="razonamiento-premisas-titulo" className="juego__contexto">
        <h2 className="juego__pregunta" id="razonamiento-premisas-titulo">
          Relaciona las premisas
        </h2>
        <ol className="viva-pasos razonamiento-logico__premisas">
          {reglas.premisas.map((premisa, indice) => (
            <li className="viva-pasos__paso" key={premisa}>
              <span aria-hidden="true" className="viva-pasos__numero">
                {indice + 1}
              </span>
              <span>{premisa}</span>
            </li>
          ))}
        </ol>
      </section>

      <div aria-label="Conclusiones posibles" className="juego__opciones">
        {reglas.opciones.map((opcion, indice) => {
          const elegida = seleccionada === opcion.clave;
          const esCorrecta = fase === 'revisada' && opcion.correcta;
          const estado = esCorrecta ? 'correcta' : elegida && !acerto ? 'elegida' : undefined;

          return (
            <button
              aria-pressed={elegida}
              className="juego__opcion cognicion365__opcion"
              data-marcada={elegida || undefined}
              data-estado={estado}
              disabled={fase === 'revisada' || enviando}
              key={opcion.clave}
              onClick={() => setSeleccionada(opcion.clave)}
              style={{ '--i': indice } as CSSProperties}
              type="button"
            >
              <span className="juego__opcion-texto">{opcion.texto}</span>
            </button>
          );
        })}
      </div>

      {fase === 'revisada' && (
        <p className="juego__despues" role="status">
          {reglas.explicacion}
          {solucion === undefined ? '' : ` La conclusión era: ${solucion.texto}`}
        </p>
      )}

      <BarraDeAccion>
        {fase === 'resolviendo' ? (
          <BotonPrincipal alPulsar={revisar} deshabilitado={seleccionada === null || enviando}>
            Revisar mi conclusión
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
