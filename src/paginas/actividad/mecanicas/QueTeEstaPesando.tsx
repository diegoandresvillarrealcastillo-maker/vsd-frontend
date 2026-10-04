import { useState, type FormEvent } from 'react';

import type { PropsDeMecanica } from './registro.tsx';

/**
 * "Que te esta pesando": marcar lo que esta costando estos dias (SCRUM-94).
 *
 * Se puede marcar varias cosas o ninguna. Terminar sin marcar nada es una
 * respuesta valida, y la mejor que puede tener esta actividad.
 *
 * ---------------------------------------------------------------------------
 * Por que cada cosa vale 3 y el maximo es 15
 * ---------------------------------------------------------------------------
 *
 * Los textos de nivel del catalogo hablan de **cuantas** cosas se juntan:
 * "no hay mucho pesandote", "un par de cosas", "varias cosas a la vez". El
 * puntaje tiene que contar lo mismo que dicen.
 *
 * Con 3 puntos por cosa y los umbrales de la actividad (0,30 y 0,60 sobre 15):
 *
 * | Marcadas | Puntaje | Nivel             |
 * | -------- | ------- | ----------------- |
 * | 0 o 1    | 0 o 3   | favorable         |
 * | 2 o 3    | 6 o 9   | en seguimiento    |
 * | 4 o mas  | 12 o 15 | requiere atencion |
 *
 * A partir de cinco el puntaje se queda en 15. Pasar de ahi no diria nada
 * nuevo: ya son varias cosas a la vez. Las marcadas se guardan todas en
 * `metadata`, de modo que no se pierde ninguna.
 *
 * Es una lista de cosas de la vida, no de estados: nada de lo que hay aqui
 * nombra una condicion.
 */

const PUNTOS_POR_COSA = 3;
const MAXIMO = 15;

const COSAS = [
  { clave: 'estudios', texto: 'Los estudios' },
  { clave: 'trabajo', texto: 'El trabajo' },
  { clave: 'dinero', texto: 'El dinero' },
  { clave: 'familia', texto: 'La familia' },
  { clave: 'relaciones', texto: 'La pareja o las amistades' },
  { clave: 'salud', texto: 'La salud, la tuya o la de alguien cercano' },
  { clave: 'descanso', texto: 'El cansancio o el sueño' },
  { clave: 'futuro', texto: 'El futuro o una decisión pendiente' },
  { clave: 'soledad', texto: 'La soledad' },
  { clave: 'algoQuePaso', texto: 'Algo que pasó y sigue dando vueltas' },
  { clave: 'otra', texto: 'Otra cosa' },
] as const;

type Cosa = (typeof COSAS)[number]['clave'];

export function QueTeEstaPesando({ alTerminar, enviando }: PropsDeMecanica) {
  const [marcadas, setMarcadas] = useState<readonly Cosa[]>([]);

  function alternar(cosa: Cosa) {
    setMarcadas((antes) =>
      antes.includes(cosa) ? antes.filter((una) => una !== cosa) : [...antes, cosa],
    );
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();

    alTerminar({
      score: Math.min(marcadas.length * PUNTOS_POR_COSA, MAXIMO),
      // En el orden de la lista y no en el que se marcaron: asi dos registros
      // iguales quedan iguales.
      metadata: {
        marcadas: COSAS.map(({ clave }) => clave).filter((clave) => marcadas.includes(clave)),
      },
    });
  }

  return (
    <form className="actividad__formulario" onSubmit={enviar} noValidate>
      <fieldset className="actividad__pregunta">
        <legend>¿Qué te está costando estos días?</legend>

        <div className="actividad__opciones">
          {COSAS.map(({ clave, texto }) => (
            <label
              key={clave}
              className={`actividad__opcion${marcadas.includes(clave) ? ' actividad__opcion--elegida' : ''}`}
            >
              <input
                type="checkbox"
                name="marcadas"
                value={clave}
                checked={marcadas.includes(clave)}
                onChange={() => alternar(clave)}
              />
              {texto}
            </label>
          ))}
        </div>
      </fieldset>

      {marcadas.length === 0 && (
        <p className="actividad__texto actividad__indicacion">
          Si ahora mismo no hay nada, puedes terminar sin marcar.
        </p>
      )}

      <button type="submit" className="pildora" disabled={enviando}>
        {enviando ? 'Guardando…' : 'Terminar'}
      </button>
    </form>
  );
}
