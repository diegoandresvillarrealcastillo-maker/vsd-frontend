import { useId, useState, type FormEvent } from 'react';

import type { PropsDeMecanica } from './registro.tsx';

/**
 * "Un momento bueno del dia": una sola cosa que estuviera bien (SCRUM-94).
 *
 * Es **texto libre y sin puntaje**. Nunca manda `score`: la actividad es
 * `sin_puntaje` y la API responderia 400.
 *
 * ---------------------------------------------------------------------------
 * Lo que se escribe aqui
 * ---------------------------------------------------------------------------
 *
 * El servidor pasa el texto por la misma deteccion de riesgo del asistente. Si
 * aparece una senal, el resultado vuelve con `sugiereAcompanamiento` y las
 * lineas de atencion, y la pantalla final las ensena. Esa deteccion no se
 * repite aqui: una sola lista, revisable, en un solo sitio.
 *
 * El texto no se guarda en el navegador ni se escribe en la consola. Sale del
 * formulario directo a la peticion.
 *
 * ---------------------------------------------------------------------------
 * "Hoy no me sale ninguno"
 * ---------------------------------------------------------------------------
 *
 * Hay dias en que no aparece nada bueno, y obligar a escribir algo esos dias
 * convierte la actividad en una exigencia. Esa respuesta se registra igual,
 * como en "Movimiento del dia": un dia sin momento bueno tambien cuenta como
 * van las semanas.
 */

/** Una sola cosa, no un diario: el diario llega con SCRUM-95. */
const LARGO_MAXIMO = 500;

export function UnMomentoBueno({ alTerminar, enviando }: PropsDeMecanica) {
  const [texto, setTexto] = useState('');
  const [falta, setFalta] = useState<string | null>(null);
  const idDelCampo = useId();

  function enviar(evento: FormEvent) {
    evento.preventDefault();

    const limpio = texto.trim();

    if (limpio === '') {
      setFalta('Escribe algo, aunque sea pequeño.');
      return;
    }

    alTerminar({ metadata: { encontroUno: true, texto: limpio } });
  }

  return (
    <form className="actividad__formulario" onSubmit={enviar} noValidate>
      <div className="actividad__campo">
        <label htmlFor={idDelCampo}>¿Qué estuvo bien hoy?</label>
        <textarea
          id={idDelCampo}
          className="actividad__texto-libre"
          rows={4}
          maxLength={LARGO_MAXIMO}
          value={texto}
          placeholder="Un café a buena hora, una conversación, algo que salió mejor de lo que esperabas…"
          onChange={(evento) => {
            setFalta(null);
            setTexto(evento.target.value);
          }}
        />
      </div>

      {falta !== null && (
        <p className="actividad__falta" role="alert">
          {falta}
        </p>
      )}

      <div className="actividad__acciones">
        <button type="submit" className="pildora" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Terminar'}
        </button>

        <button
          type="button"
          className="pildora pildora--fantasma"
          disabled={enviando}
          onClick={() => alTerminar({ metadata: { encontroUno: false } })}
        >
          Hoy no me sale ninguno
        </button>
      </div>
    </form>
  );
}
