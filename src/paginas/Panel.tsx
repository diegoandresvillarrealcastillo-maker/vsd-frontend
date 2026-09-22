import { Link } from 'react-router-dom';

import { Logo } from '../componentes/Logo.tsx';
import { ID_DEL_CONTENIDO } from '../componentes/SaltoAlContenido.tsx';
import '../estilos/panel.css';
import { RUTAS } from '../rutas/rutas.ts';
import { useSesion } from '../sesion/useSesion.ts';
import { SelectorDeTema } from '../tema/SelectorDeTema.tsx';

/**
 * Primera pantalla despues de entrar. Provisional.
 *
 * Existe para que las rutas protegidas tengan a donde llevar y para poder
 * comprobar que la sesion llega hasta aqui. El panel de verdad es la epica
 * SCRUM-12.
 *
 * La barra de arriba no es provisional: la marca a la izquierda y el selector
 * de tema a la derecha son lo que va a quedar cuando esta pantalla se llene.
 * El logo lleva al panel y no a la portada: estando dentro, pulsar la marca
 * tiene que devolver a casa, no sacar de la cuenta.
 */
export function Panel() {
  const { correo, salir } = useSesion();

  return (
    <div className="panel">
      <header className="panel__barra">
        <Logo to={RUTAS.PANEL} className="panel__marca" />

        {/* El logo lleva al panel, que estando dentro es la casa. La portada
            es otro sitio y necesita su propio enlace: sin el, entrar a la
            cuenta es un camino de ida. */}
        <Link className="panel__salida" to={RUTAS.INICIO}>
          Ir a la página principal
        </Link>

        {/* Incrustado en la barra, no flotando sobre la ventana: aqui si hay
            una barra a la que pertenecer, y queda igual de arriba y a la
            derecha sin tener que tapar el contenido. */}
        <SelectorDeTema variante="incrustado" />
      </header>

      <main id={ID_DEL_CONTENIDO} tabIndex={-1} className="panel__contenido">
        <div className="panel__caja">
          <h1>Ya estás dentro</h1>
          <p className="panel__correo">{correo}</p>

          <button type="button" className="pildora pildora--fantasma" onClick={() => void salir()}>
            Cerrar sesión
          </button>
        </div>
      </main>
    </div>
  );
}
