import { useRef, useState, type FormEvent } from 'react';

import type { PropsDeMecanica } from './registro.tsx';

/**
 * Un cuestionario de preguntas cerradas que suma un puntaje.
 *
 * Lo comparten "La carga de tu semana" (SCRUM-93) y "Como te sientes hoy"
 * (SCRUM-94). Cada una pone sus preguntas, sus opciones y su maximo; esto pone
 * lo que tienen en comun:
 *
 * - todas las preguntas son obligatorias, y si falta alguna se dice cuantas y
 *   se lleva el foco a la primera, para no tener que buscarla;
 * - el puntaje es la suma de los valores elegidos, sin pasar del maximo;
 * - cada respuesta viaja por separado en `metadata`: el puntaje es una lectura
 *   de ellas, y con ellas se puede ver despues que es lo que mas pesa.
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

export function Cuestionario({
  indicacion,
  preguntas,
  opciones,
  maximo,
  alTerminar,
  enviando,
}: PropsDeCuestionario) {
  const [respuestas, setRespuestas] = useState<Readonly<Record<string, number>>>({});
  const [falta, setFalta] = useState<string | null>(null);
  const formulario = useRef<HTMLFormElement>(null);

  function responder(clave: string, valor: number) {
    setFalta(null);
    setRespuestas((antes) => ({ ...antes, [clave]: valor }));
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();

    const sinResponder = preguntas.filter(({ clave }) => respuestas[clave] === undefined);

    if (sinResponder.length > 0) {
      setFalta(
        sinResponder.length === 1
          ? 'Te falta responder una pregunta.'
          : `Te faltan ${sinResponder.length} preguntas por responder.`,
      );
      formulario.current
        ?.querySelector<HTMLInputElement>(`input[name="${sinResponder[0]?.clave ?? ''}"]`)
        ?.focus();

      return;
    }

    const score = preguntas.reduce((suma, { clave }) => suma + (respuestas[clave] ?? 0), 0);

    alTerminar({ score: Math.min(score, maximo), metadata: { respuestas } });
  }

  return (
    <form ref={formulario} className="actividad__formulario" onSubmit={enviar} noValidate>
      <p className="actividad__texto actividad__indicacion">{indicacion}</p>

      {preguntas.map(({ clave, texto }) => (
        <fieldset key={clave} className="actividad__pregunta">
          <legend>{texto}</legend>

          <div className="actividad__opciones">
            {opciones.map(({ valor, texto: etiqueta }) => (
              <label
                key={valor}
                className={`actividad__opcion${respuestas[clave] === valor ? ' actividad__opcion--elegida' : ''}`}
              >
                <input
                  type="radio"
                  name={clave}
                  value={valor}
                  checked={respuestas[clave] === valor}
                  onChange={() => responder(clave, valor)}
                />
                {etiqueta}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      {falta !== null && (
        <p className="actividad__falta" role="alert">
          {falta}
        </p>
      )}

      <button type="submit" className="pildora" disabled={enviando}>
        {enviando ? 'Guardando…' : 'Terminar'}
      </button>
    </form>
  );
}
