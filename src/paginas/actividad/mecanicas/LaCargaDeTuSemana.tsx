import { useRef, useState, type FormEvent } from 'react';

import type { PropsDeMecanica } from './registro.tsx';

/**
 * "La carga de tu semana": cinco preguntas sobre como viene la semana en
 * estudio, tiempo propio y descanso (SCRUM-93).
 *
 * Es un cuestionario con la escala **al reves** que "Como dormiste": aqui un
 * puntaje alto significa una semana mas cargada, y el servidor lo interpreta
 * con `mayor_requiere_atencion`. Por eso todas las preguntas estan redactadas
 * en el mismo sentido: responder "Mucho" siempre suma carga. Si una pregunta
 * fuera al reves, la suma mezclaria las dos direcciones y el nivel no diria
 * nada.
 *
 * Las preguntas hablan de la semana, no de la persona: no nombran sintomas ni
 * estados de animo. Orientan, no evaluan.
 */

/** Cinco preguntas de 0 a 4. Tiene que coincidir con el maximo del catalogo. */
const MAXIMO = 20;

const PREGUNTAS = [
  { clave: 'pendientes', texto: '¿Cuánto trabajo o estudio pendiente sientes que tienes?' },
  { clave: 'horario', texto: '¿Qué tan apretado ha estado tu horario?' },
  {
    clave: 'tiempoPropio',
    texto: '¿Cuánto te ha faltado tiempo para ti: descansar, tus aficiones, la gente que quieres?',
  },
  { clave: 'desconectar', texto: '¿Cuánto te ha costado desconectarte al terminar el día?' },
  { clave: 'loQueViene', texto: '¿Cuánto te pesa lo que viene en los próximos días?' },
] as const;

type Clave = (typeof PREGUNTAS)[number]['clave'];

const OPCIONES = [
  { valor: 0, texto: 'Nada' },
  { valor: 1, texto: 'Poco' },
  { valor: 2, texto: 'Algo' },
  { valor: 3, texto: 'Bastante' },
  { valor: 4, texto: 'Mucho' },
] as const;

export function LaCargaDeTuSemana({ alTerminar, enviando }: PropsDeMecanica) {
  const [respuestas, setRespuestas] = useState<Partial<Record<Clave, number>>>({});
  const [falta, setFalta] = useState<string | null>(null);
  const formulario = useRef<HTMLFormElement>(null);

  function responder(clave: Clave, valor: number) {
    setFalta(null);
    setRespuestas((antes) => ({ ...antes, [clave]: valor }));
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();

    const sinResponder = PREGUNTAS.filter(({ clave }) => respuestas[clave] === undefined);

    if (sinResponder.length > 0) {
      setFalta(
        sinResponder.length === 1
          ? 'Te falta responder una pregunta.'
          : `Te faltan ${sinResponder.length} preguntas por responder.`,
      );
      // Lleva a la primera sin responder, para no tener que buscarla.
      formulario.current
        ?.querySelector<HTMLInputElement>(`input[name="${sinResponder[0]?.clave ?? ''}"]`)
        ?.focus();

      return;
    }

    const score = PREGUNTAS.reduce((suma, { clave }) => suma + (respuestas[clave] ?? 0), 0);

    alTerminar({
      score: Math.min(score, MAXIMO),
      // Cada respuesta por separado: el puntaje es una lectura de esto, y con
      // las respuestas se puede ver despues que es lo que mas pesa.
      metadata: { respuestas },
    });
  }

  return (
    <form ref={formulario} className="actividad__formulario" onSubmit={enviar} noValidate>
      <p className="actividad__texto actividad__indicacion">
        Piensa en los últimos siete días. No hay respuestas buenas ni malas.
      </p>

      {PREGUNTAS.map(({ clave, texto }) => (
        <fieldset key={clave} className="actividad__pregunta">
          <legend>{texto}</legend>

          <div className="actividad__opciones">
            {OPCIONES.map(({ valor, texto: etiqueta }) => (
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
