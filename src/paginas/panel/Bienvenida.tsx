import { useId, useState, type CSSProperties, type FormEvent } from 'react';

import { ExigeConexion } from '../../componentes/ExigeConexion.tsx';
import type { Cuenta, Modulo } from '../../infraestructura/api/cuenta.ts';
import { Icono } from './Icono.tsx';
import { MODULOS, ORDEN } from './modulos.ts';

/**
 * La bienvenida despues de crear la cuenta (SCRUM-90).
 *
 * Pregunta dos cosas y nada mas: como quiere que la llamemos y con que modulos
 * empieza. Empezar con uno o dos es a proposito: recibir los tres de golpe es
 * mucha informacion para el primer dia, y los demas se desbloquean despues
 * desde el dashboard.
 *
 * Se ve una sola vez. Al guardar, la cuenta deja de tener la lista de modulos
 * vacia y el panel pasa al dashboard; despues todo se cambia desde el perfil.
 */
export function Bienvenida({
  cuenta,
  alTerminar,
}: {
  cuenta: Cuenta;
  alTerminar: (eleccion: { nombre: string; modulos: readonly Modulo[] }) => Promise<void>;
}) {
  const [nombre, setNombre] = useState(cuenta.nombre ?? '');
  const [elegidos, setElegidos] = useState<readonly Modulo[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const idDelNombre = useId();
  const idDeLaAyuda = useId();

  function alternar(modulo: Modulo) {
    setElegidos((antes) =>
      antes.includes(modulo) ? antes.filter((uno) => uno !== modulo) : [...antes, modulo],
    );
  }

  async function alEnviar(evento: FormEvent) {
    evento.preventDefault();

    if (elegidos.length === 0) {
      setFallo('Elige al menos un módulo para empezar.');
      return;
    }

    setEnviando(true);
    setFallo(null);

    try {
      await alTerminar({ nombre, modulos: ORDEN.filter((modulo) => elegidos.includes(modulo)) });
    } catch {
      setFallo('No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.');
      setEnviando(false);
    }
  }

  return (
    <section className="bienvenida" aria-labelledby="titulo-bienvenida">
      <p className="app__antetitulo">Antes de empezar</p>
      <h1 id="titulo-bienvenida" className="app__saludo">
        Te damos la bienvenida.
        <br />
        <span className="app__saludo-pregunta">¿Por dónde quieres empezar?</span>
      </h1>

      <form
        className="bienvenida__formulario"
        onSubmit={(evento) => void alEnviar(evento)}
        noValidate
      >
        <div className="bienvenida__campo">
          <label htmlFor={idDelNombre} className="bienvenida__etiqueta">
            ¿Cómo quieres que te llamemos?
          </label>
          <input
            id={idDelNombre}
            className="bienvenida__entrada"
            value={nombre}
            onChange={(evento) => setNombre(evento.target.value)}
            maxLength={100}
            autoComplete="given-name"
            placeholder="Tu nombre o un apodo"
          />
        </div>

        <fieldset className="bienvenida__modulos" aria-describedby={idDeLaAyuda}>
          <legend className="bienvenida__etiqueta">Elige uno, dos o los tres</legend>
          <p id={idDeLaAyuda} className="app__nota">
            Puedes empezar con poco: los demás se desbloquean después desde tu panel.
          </p>

          <div className="app__modulos">
            {ORDEN.map((modulo) => {
              const datos = MODULOS[modulo];
              const marcado = elegidos.includes(modulo);

              return (
                <button
                  key={modulo}
                  type="button"
                  role="checkbox"
                  aria-checked={marcado}
                  className={`tarjeta-modulo bienvenida__opcion${marcado ? ' tarjeta-modulo--elegida' : ''}`}
                  style={
                    {
                      '--modulo-fondo': datos.fondo,
                      '--modulo-acento': datos.acento,
                    } as CSSProperties
                  }
                  onClick={() => alternar(modulo)}
                >
                  <span className="tarjeta-modulo__arriba">
                    <span className="tarjeta-modulo__icono">
                      <Icono nombre={datos.icono} tamano={24} />
                    </span>
                    <span
                      className={`bienvenida__marca${marcado ? ' bienvenida__marca--activa' : ''}`}
                      aria-hidden="true"
                    >
                      {marcado && <Icono nombre="check" tamano={16} />}
                    </span>
                  </span>

                  <span className="tarjeta-modulo__cuerpo">
                    <span className="tarjeta-modulo__titulo">{datos.titulo}</span>
                    <span className="tarjeta-modulo__texto">{datos.descripcion}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {fallo !== null && (
          <p className="bienvenida__fallo" role="alert">
            {fallo}
          </p>
        )}

        {/* Guardar la eleccion cambia la cuenta: sin conexion se puede elegir, pero no empezar
            (SCRUM-142). Lo elegido no se pierde. */}
        <ExigeConexion>
          <button type="submit" className="app__boton bienvenida__empezar" disabled={enviando}>
            {enviando ? 'Preparando tu espacio…' : 'Empezar'}
            {!enviando && <Icono nombre="arrow" tamano={16} />}
          </button>
        </ExigeConexion>
      </form>
    </section>
  );
}
