import { useState, type FormEvent } from 'react';

import { BarraDeAccion, BotonPrincipal, BotonSecundario } from '../viva/BarraDeAccion.tsx';
import { BarraDeProgreso } from '../viva/BarraDeProgreso.tsx';
import { mensajeAlElegir, mensajeDelPaso } from '../viva/mensajes.ts';
import { OpcionGrande } from '../viva/OpcionGrande.tsx';
import { PasoAnimado } from '../viva/PasoAnimado.tsx';
import { useMascotaDeLaPersona } from '../viva/mascotaDeLaPersona.ts';
import { VozDeLaMascota } from '../viva/VozDeLaMascota.tsx';
import type { PropsDeMecanica } from './registro.tsx';

/**
 * Un cuestionario de preguntas cerradas que suma un puntaje.
 *
 * Lo comparten "La carga de tu semana" (SCRUM-93) y "Como te sientes hoy"
 * (SCRUM-94). Cada una pone sus preguntas, sus opciones y su maximo; esto pone
 * lo que tienen en comun:
 *
 * - **una pregunta a la vez** (SCRUM-173), con una barra que dice cuanto falta, opciones
 *   grandes para el pulgar y la mascota acompanando: nadie se pierde en una pagina larga;
 * - no se avanza sin contestar, y el boton lo dice sin regañar: se queda apagado hasta
 *   que se elige algo, y un texto al lado explica por que;
 * - el puntaje es la suma de los valores elegidos, sin pasar del maximo;
 * - cada respuesta viaja por separado en `metadata`: el puntaje es una lectura
 *   de ellas, y con ellas se puede ver despues que es lo que mas pesa.
 *
 * ## Lo que dice la mascota
 *
 * Nada de lo que dice depende de lo que se contesto (ver `viva/mensajes.ts`): agradece, anima
 * y cuenta cuanto falta. Aqui no hay respuestas buenas ni malas, y celebrar una opcion
 * sobre otra seria calificarla. Por lo mismo, solo sonrie al dar la bienvenida: una cara
 * contenta tras decir que costo arrancar el dia no le queda bien a nadie. Despues salta y
 * agradece, con la cara serena.
 *
 * Quien lo usa tiene que redactar todas las preguntas **en el mismo
 * sentido**. Si una fuera al reves, la suma mezclaria dos direcciones y el
 * nivel no diria nada.
 */
export interface Pregunta {
  readonly clave: string;
  readonly texto: string;
}

export interface Opcion {
  readonly valor: number;
  readonly texto: string;
}

interface PropsDeCuestionario extends PropsDeMecanica {
  readonly indicacion: string;
  readonly preguntas: readonly Pregunta[];
  readonly opciones: readonly Opcion[];

  /** Tiene que coincidir con el maximo del catalogo, o la API responde 400. */
  readonly maximo: number;
}

/**
 * Unas barritas que suben: «Nada» las deja vacias y la ultima opcion las llena. Es una
 * escala, no un semaforo: ningun color dice que una respuesta sea mejor que otra.
 */
function Escala({ nivel, de }: { nivel: number; de: number }) {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
      {Array.from({ length: de }, (_, indice) => {
        const alto = 6 + (indice * 14) / Math.max(1, de - 1);

        return (
          <rect
            key={indice}
            x={2 + indice * (22 / de)}
            y={24 - alto}
            width={Math.max(3, 22 / de - 2)}
            height={alto}
            rx="1.5"
            fill="currentColor"
            opacity={indice < nivel ? 1 : 0.22}
          />
        );
      })}
    </svg>
  );
}

export function Cuestionario({
  indicacion,
  preguntas,
  opciones,
  maximo,
  alTerminar,
  enviando,
}: PropsDeCuestionario) {
  const mascota = useMascotaDeLaPersona();
  const [respuestas, setRespuestas] = useState<Readonly<Record<string, number>>>({});
  const [paso, setPaso] = useState(0);
  const [direccion, setDireccion] = useState<1 | -1>(1);
  // Sube con cada eleccion: es lo que hace saltar a la mascota.
  const [latido, setLatido] = useState(0);

  const pregunta = preguntas[paso];
  const esLaUltima = paso === preguntas.length - 1;
  const contestadas = preguntas.filter(({ clave }) => respuestas[clave] !== undefined).length;
  const elegida = pregunta === undefined ? undefined : respuestas[pregunta.clave];

  function responder(clave: string, valor: number) {
    setRespuestas((antes) => ({ ...antes, [clave]: valor }));
    setLatido((antes) => antes + 1);
  }

  function volver() {
    setLatido((antes) => antes + 1);
    setDireccion(-1);
    setPaso((antes) => Math.max(0, antes - 1));
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();

    if (elegida === undefined) {
      return;
    }

    if (!esLaUltima) {
      setLatido((antes) => antes + 1);
      setDireccion(1);
      setPaso((antes) => antes + 1);
      return;
    }

    const score = preguntas.reduce((suma, { clave }) => suma + (respuestas[clave] ?? 0), 0);

    alTerminar({ score: Math.min(score, maximo), metadata: { respuestas } });
  }

  if (pregunta === undefined) {
    return null;
  }

  return (
    <form className="viva" onSubmit={enviar} noValidate>
      <BarraDeProgreso
        paso={paso + 1}
        total={preguntas.length}
        hechos={contestadas}
        etiqueta="Pregunta"
      />

      <VozDeLaMascota
        mascota={mascota}
        mensaje={
          elegida === undefined ? mensajeDelPaso(paso, preguntas.length) : mensajeAlElegir(paso)
        }
        expresion={paso === 0 && elegida === undefined ? 'feliz' : 'normal'}
        latido={latido}
      />

      <PasoAnimado
        clave={pregunta.clave}
        direccion={direccion}
        titulo={pregunta.texto}
        {...(paso === 0 ? { ayuda: indicacion } : {})}
      >
        <div
          className="viva-opciones"
          role="radiogroup"
          aria-labelledby={`viva-titulo-${pregunta.clave}`}
        >
          {opciones.map(({ valor, texto }, indice) => (
            <OpcionGrande
              key={valor}
              tipo="radio"
              nombre={pregunta.clave}
              valor={String(valor)}
              marcada={elegida === valor}
              alCambiar={() => responder(pregunta.clave, valor)}
              texto={texto}
              adorno={<Escala nivel={indice} de={Math.max(2, opciones.length - 1)} />}
            />
          ))}
        </div>
      </PasoAnimado>

      {elegida === undefined && (
        <p className="viva-falta" id="viva-pista">
          Elige una opción para continuar.
        </p>
      )}

      <BarraDeAccion>
        {paso > 0 && <BotonSecundario alPulsar={volver}>Atrás</BotonSecundario>}

        <BotonPrincipal
          tipo="submit"
          conFlecha={!esLaUltima}
          deshabilitado={elegida === undefined || enviando}
          {...(elegida === undefined ? { descritoPor: 'viva-pista' } : {})}
        >
          {enviando ? 'Guardando…' : esLaUltima ? 'Terminar' : 'Continuar'}
        </BotonPrincipal>
      </BarraDeAccion>
    </form>
  );
}
