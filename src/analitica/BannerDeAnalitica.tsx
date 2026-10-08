import { useEffect, useId } from 'react';
import { Link } from 'react-router-dom';

import '../estilos/analitica.css';
import { RUTAS } from '../rutas/rutas.ts';
import { useAnalitica } from './useAnalitica.ts';

/**
 * El banner donde la persona decide si se cuentan sus visitas (SCRUM-161).
 *
 * ## Que tiene que cumplir, y por que
 *
 * - **Aceptar y rechazar pesan lo mismo.** Mismo tamano, mismo estilo, mismo sitio
 *   en la fila. Un rechazo escondido detras de un enlace o de un color apagado no
 *   es una eleccion libre, y en una aplicacion de salud mental menos.
 * - **No bloquea nada.** Es una region y no un dialogo: se puede seguir leyendo,
 *   navegar y usar la aplicacion sin contestar. Tampoco roba el foco al aparecer.
 * - **No pide nada que no haga.** El texto dice lo que se cuenta y lo que no, y
 *   lleva a la pagina de cookies para el detalle.
 * - **Se puede cambiar de idea** desde los pies y desde la pagina de cookies, y
 *   entonces tambien se puede cerrar sin cambiar nada (Escape o «Cerrar»).
 *
 * Va el primero del documento, justo despues del salto al contenido, aunque se vea
 * abajo: quien navega con teclado lo alcanza en la segunda parada y no al final de
 * la pagina entera.
 */
export function BannerDeAnalitica() {
  const { preguntando, decision, aceptar, rechazar, cerrar } = useAnalitica();
  const idDelTitulo = useId();
  const idDelTexto = useId();
  const reabierto = preguntando && decision !== null;

  // Reabierto, Escape lo cierra sin cambiar lo elegido, este donde este el foco: el
  // banner se abrio desde un boton del pie, asi que el foco casi nunca esta dentro.
  // En la primera visita no hay nada elegido que conservar: seguir preguntando es
  // lo correcto.
  useEffect(() => {
    if (!reabierto) {
      return;
    }

    function alPulsarUnaTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        cerrar();
      }
    }

    document.addEventListener('keydown', alPulsarUnaTecla);

    return () => {
      document.removeEventListener('keydown', alPulsarUnaTecla);
    };
  }, [reabierto, cerrar]);

  if (!preguntando) {
    return null;
  }

  return (
    <section className="analitica" aria-labelledby={idDelTitulo} aria-describedby={idDelTexto}>
      <div className="analitica__tarjeta">
        <p className="analitica__titulo" id={idDelTitulo}>
          ¿Nos ayudas a saber qué pantallas se usan?
        </p>

        <p className="analitica__texto" id={idDelTexto}>
          Con tu permiso usamos Google Analytics para contar las visitas a las pantallas de VSD
          Health. No sabe quién eres: no ve tu cuenta, ni tus respuestas, ni tu diario, y no se usa
          para anuncios. Puedes cambiar de idea cuando quieras.{' '}
          <Link className="analitica__enlace" to={`${RUTAS.COOKIES}#analitica`}>
            Más información
          </Link>
        </p>

        {decision !== null && (
          <p className="analitica__actual">
            Ahora mismo: {decision === 'aceptada' ? 'aceptada' : 'rechazada'}.
          </p>
        )}

        <div className="analitica__acciones">
          <button type="button" className="analitica__boton" onClick={aceptar}>
            Aceptar
          </button>
          <button type="button" className="analitica__boton" onClick={rechazar}>
            Rechazar
          </button>
          {decision !== null && (
            <button
              type="button"
              className="analitica__boton analitica__boton--discreto"
              onClick={cerrar}
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
