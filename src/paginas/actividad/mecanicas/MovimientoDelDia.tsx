import { useState, type FormEvent } from 'react';

import type { PropsDeMecanica } from './registro.tsx';

/**
 * "Movimiento del dia": si te moviste hoy, como y cuanto (SCRUM-93).
 *
 * Es una **bitacora sin puntaje**. Nunca manda `score`: la actividad es
 * `sin_puntaje` y la API responderia 400. Ponerle nota a si alguien salio a
 * caminar convertiria un registro en un examen.
 *
 * "Hoy no me movi" es una respuesta tan valida como cualquier otra, y se
 * registra igual: sin ella, la bitacora solo guardaria los dias buenos y no
 * contaria como van de verdad las semanas.
 *
 * El tiempo va por tramos y no en minutos exactos: nadie cronometra una
 * caminata, y pedir un numero preciso invita a inventarlo.
 */

const TIPOS = [
  { clave: 'caminar', texto: 'Caminar' },
  { clave: 'ejercicio', texto: 'Deporte o ejercicio' },
  { clave: 'bicicleta', texto: 'Bicicleta' },
  { clave: 'baile', texto: 'Baile' },
  { clave: 'estiramientos', texto: 'Estiramientos o yoga' },
  { clave: 'tareas', texto: 'Tareas que te hicieron moverte' },
  { clave: 'otro', texto: 'Otro' },
] as const;

const DURACIONES = [
  { clave: 'menos-de-15', texto: 'Menos de 15 minutos' },
  { clave: '15-a-30', texto: 'De 15 a 30 minutos' },
  { clave: '30-a-60', texto: 'De 30 minutos a una hora' },
  { clave: 'mas-de-60', texto: 'Más de una hora' },
] as const;

type Tipo = (typeof TIPOS)[number]['clave'];
type Duracion = (typeof DURACIONES)[number]['clave'];

export function MovimientoDelDia({ alTerminar, enviando }: PropsDeMecanica) {
  const [seMovio, setSeMovio] = useState<boolean | null>(null);
  const [tipos, setTipos] = useState<readonly Tipo[]>([]);
  const [duracion, setDuracion] = useState<Duracion | null>(null);
  const [falta, setFalta] = useState<string | null>(null);

  function alternarTipo(tipo: Tipo) {
    setFalta(null);
    setTipos((antes) =>
      antes.includes(tipo) ? antes.filter((uno) => uno !== tipo) : [...antes, tipo],
    );
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();

    if (seMovio === null) {
      setFalta('Cuéntanos si te moviste hoy.');
      return;
    }

    if (!seMovio) {
      alTerminar({ metadata: { seMovio: false } });
      return;
    }

    if (tipos.length === 0) {
      setFalta('Elige al menos un tipo de movimiento.');
      return;
    }

    if (duracion === null) {
      setFalta('Elige más o menos cuánto tiempo.');
      return;
    }

    // En el orden de la lista y no en el que se marcaron: asi dos registros
    // iguales quedan iguales.
    alTerminar({
      metadata: {
        seMovio: true,
        tipos: TIPOS.map(({ clave }) => clave).filter((clave) => tipos.includes(clave)),
        duracion,
      },
    });
  }

  return (
    <form className="actividad__formulario" onSubmit={enviar} noValidate>
      <fieldset className="actividad__pregunta">
        <legend>¿Te moviste hoy?</legend>

        <div className="actividad__opciones">
          {[
            { valor: true, texto: 'Sí' },
            { valor: false, texto: 'Hoy no' },
          ].map(({ valor, texto }) => (
            <label
              key={texto}
              className={`actividad__opcion${seMovio === valor ? ' actividad__opcion--elegida' : ''}`}
            >
              <input
                type="radio"
                name="seMovio"
                checked={seMovio === valor}
                onChange={() => {
                  setFalta(null);
                  setSeMovio(valor);
                }}
              />
              {texto}
            </label>
          ))}
        </div>
      </fieldset>

      {seMovio === false && (
        <p className="actividad__texto actividad__indicacion">
          También cuenta. Registrarlo ayuda a ver cómo van tus semanas, sin metas que cumplir.
        </p>
      )}

      {seMovio === true && (
        <>
          <fieldset className="actividad__pregunta">
            <legend>¿Qué tipo de movimiento?</legend>

            <div className="actividad__opciones">
              {TIPOS.map(({ clave, texto }) => (
                <label
                  key={clave}
                  className={`actividad__opcion${tipos.includes(clave) ? ' actividad__opcion--elegida' : ''}`}
                >
                  <input
                    type="checkbox"
                    name="tipos"
                    value={clave}
                    checked={tipos.includes(clave)}
                    onChange={() => alternarTipo(clave)}
                  />
                  {texto}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="actividad__pregunta">
            <legend>¿Cuánto tiempo, más o menos?</legend>

            <div className="actividad__opciones">
              {DURACIONES.map(({ clave, texto }) => (
                <label
                  key={clave}
                  className={`actividad__opcion${duracion === clave ? ' actividad__opcion--elegida' : ''}`}
                >
                  <input
                    type="radio"
                    name="duracion"
                    value={clave}
                    checked={duracion === clave}
                    onChange={() => {
                      setFalta(null);
                      setDuracion(clave);
                    }}
                  />
                  {texto}
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}

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
