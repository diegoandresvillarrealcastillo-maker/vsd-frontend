import { useId, useMemo, useState, type FormEvent } from 'react';

import { BarraDeAccion, BotonPrincipal, BotonSecundario } from '../viva/BarraDeAccion.tsx';
import { useMascotaDeLaPersona } from '../viva/mascotaDeLaPersona.ts';
import { VozDeLaMascota } from '../viva/VozDeLaMascota.tsx';
import {
  leerEscrituraDeUnCampo,
  type ParametrosDeEscrituraDeUnCampo,
} from './parametrosDeLaSesion.ts';
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

/** Ideas para empezar, a un toque. Se suman al texto: no lo reemplazan ni lo califican. */
const IDEAS = [
  'Un café a buena hora',
  'Una conversación bonita',
  'Algo salió mejor de lo esperado',
  'Un rato de descanso',
  'Algo rico para comer',
] as const;

/**
 * Lo de siempre: la pregunta, las cinco ideas, los 500 caracteres y el boton de «hoy no me sale
 * ninguno». Es lo mismo que lleva la sesion de la Fase 0 (SCRUM-207, SCRUM-208), y es lo que se usa
 * si la sesion no llega o no se entiende.
 */
const DE_SIEMPRE: ParametrosDeEscrituraDeUnCampo = {
  invitacion: '¿Qué estuvo bien hoy?',
  ideas: IDEAS,
  largoMaximo: LARGO_MAXIMO,
  permiteNingunaHoy: true,
};

/**
 * El ejemplo gris del campo. Habla de lo mismo que la pregunta de siempre, asi que solo se pone con
 * ella: con otra invitacion («¿Qué probaste hoy?») contradiria lo que se pide, y el contrato de la
 * sesion no tiene un texto propio para el campo.
 */
const EJEMPLO_DEL_CAMPO =
  'Un café a buena hora, una conversación, algo que salió mejor de lo que esperabas…';

export function UnMomentoBueno({ alTerminar, enviando, sesion }: PropsDeMecanica) {
  const mascota = useMascotaDeLaPersona();
  const { invitacion, ideas, largoMaximo, permiteNingunaHoy } = useMemo(
    () => leerEscrituraDeUnCampo(sesion?.parametros) ?? DE_SIEMPRE,
    [sesion],
  );
  const ejemplo = invitacion === DE_SIEMPRE.invitacion ? EJEMPLO_DEL_CAMPO : undefined;
  const [texto, setTexto] = useState('');
  const [falta, setFalta] = useState<string | null>(null);
  // Sube cada vez que se toca una idea: hace saltar a la mascota.
  const [latido, setLatido] = useState(0);
  const idDelCampo = useId();

  function sumar(idea: string) {
    setFalta(null);
    setLatido((antes) => antes + 1);
    setTexto((antes) => {
      const base = antes.trim();
      const siguiente = base === '' ? idea : `${base}. ${idea}`;

      return siguiente.slice(0, largoMaximo);
    });
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();

    const limpio = texto.trim();

    if (limpio === '') {
      setFalta('Escribe algo, aunque sea pequeño.');
      return;
    }

    alTerminar({ metadata: { encontroUno: true, texto: limpio } });
  }

  // Lo que dice no valora lo que se escribio: solo agradece que se escriba algo. Un texto libre
  // puede ser cualquier cosa, y «que bonito» no le queda bien a todo.
  const mensaje =
    texto.trim() === ''
      ? 'Puede ser algo muy pequeño. Aquí cuenta todo.'
      : 'Gracias por compartirlo. Tómate tu tiempo.';

  return (
    <form className="viva" onSubmit={enviar} noValidate>
      <VozDeLaMascota
        mascota={mascota}
        mensaje={mensaje}
        expresion={texto.trim() === '' ? 'feliz' : 'normal'}
        latido={latido}
      />

      <section className="viva-paso">
        <label className="viva-paso__titulo" htmlFor={idDelCampo}>
          {invitacion}
        </label>

        {ideas.length > 0 && (
          <div className="viva-atajos">
            {ideas.map((idea) => (
              <button key={idea} type="button" className="viva-atajo" onClick={() => sumar(idea)}>
                {idea}
              </button>
            ))}
          </div>
        )}

        <textarea
          id={idDelCampo}
          className="viva-texto"
          rows={4}
          maxLength={largoMaximo}
          value={texto}
          {...(ejemplo === undefined ? {} : { placeholder: ejemplo })}
          onChange={(evento) => {
            setFalta(null);
            setTexto(evento.target.value);
          }}
        />
        <p className="viva-texto__cuenta" aria-hidden="true">
          {texto.length} / {largoMaximo}
        </p>
      </section>

      {falta !== null && (
        <p className="viva-falta" role="alert">
          {falta}
        </p>
      )}

      {/* Fuera de la franja de abajo: esa es para el gesto principal, y asi no tapa el texto. */}
      {permiteNingunaHoy && (
        <div className="viva-salida">
          <BotonSecundario
            deshabilitado={enviando}
            alPulsar={() => alTerminar({ metadata: { encontroUno: false } })}
          >
            Hoy no me sale ninguno
          </BotonSecundario>
        </div>
      )}

      <BarraDeAccion>
        <BotonPrincipal tipo="submit" deshabilitado={enviando}>
          {enviando ? 'Guardando…' : 'Terminar'}
        </BotonPrincipal>
      </BarraDeAccion>
    </form>
  );
}
