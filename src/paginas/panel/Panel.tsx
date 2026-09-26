import { Link } from 'react-router-dom';

import { Logo } from '../../componentes/Logo.tsx';
import { ID_DEL_CONTENIDO } from '../../componentes/SaltoAlContenido.tsx';
import '../../estilos/panel.css';
import type { Cuenta } from '../../infraestructura/api/cuenta.ts';
import type { CategoriaDelCatalogo } from '../../infraestructura/api/catalogo.ts';
import { RUTAS } from '../../rutas/rutas.ts';
import { useSesion } from '../../sesion/useSesion.ts';
import { SelectorDeTema } from '../../tema/SelectorDeTema.tsx';
import { useDatosDelPanel } from './useDatosDelPanel.ts';

/**
 * Primera pantalla despues de entrar.
 *
 * Sigue siendo provisional como panel —el de verdad es la epica SCRUM-12— pero
 * ya no es un andamio: es el primer sitio donde la aplicacion **habla con
 * nuestra API**. Al entrar da de alta la cuenta de VSD Health y trae el
 * catalogo, y lo que pinta son los datos que devuelve el servidor.
 *
 * Eso importa mas de lo que parece. Hasta ahora el frontend solo hablaba con
 * Supabase para autenticar, asi que quien se registraba tenia identidad y no
 * tenia cuenta, y cualquier operacion suya habria respondido 403.
 *
 * La barra de arriba no es provisional: la marca a la izquierda y el selector
 * de tema a la derecha son lo que va a quedar cuando esta pantalla se llene.
 * El logo lleva al panel y no a la portada: estando dentro, pulsar la marca
 * tiene que devolver a casa, no sacar de la cuenta.
 */
export function Panel() {
  const { correo, salir } = useSesion();
  const { estado, reintentar } = useDatosDelPanel();

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

          {/* `role="status"` lo anuncia un lector de pantalla sin interrumpir.
              Sin esto, quien no ve la pantalla no sabe que se esta cargando
              algo y solo encuentra una caja vacia. */}
          {estado.fase === 'cargando' && (
            <p className="panel__cargando" role="status">
              Cargando tu cuenta y las actividades…
            </p>
          )}

          {/* `role="alert"` si interrumpe, y aqui corresponde: la persona tiene
              que enterarse de que algo fallo para poder reintentar. */}
          {estado.fase === 'error' && (
            <div className="panel__fallo" role="alert">
              <p className="panel__fallo-texto">{estado.mensaje}</p>

              <button type="button" className="pildora" onClick={reintentar}>
                Reintentar
              </button>
            </div>
          )}

          {estado.fase === 'listo' && (
            <>
              <TuCuenta cuenta={estado.cuenta} />
              <Actividades catalogo={estado.catalogo} />
            </>
          )}

          <button type="button" className="pildora pildora--fantasma" onClick={() => void salir()}>
            Cerrar sesión
          </button>
        </div>
      </main>
    </div>
  );
}

/**
 * Da formato a una fecha que llego como texto ISO.
 *
 * Si no se puede interpretar se devuelve tal cual en lugar de ensenar
 * "Invalid Date": un dato raro es mejor que una palabra en ingles que no
 * significa nada para quien la lee.
 */
function enCastellano(iso: string): string {
  const fecha = new Date(iso);

  if (Number.isNaN(fecha.getTime())) {
    return iso;
  }

  return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * La cuenta, tal como la devuelve la API.
 *
 * Se ensena el consentimiento con su version y su fecha porque es la prueba de
 * lo que la persona acepto y cuando, y tiene derecho a poder verla.
 */
function TuCuenta({ cuenta }: { cuenta: Cuenta }) {
  return (
    <section className="panel__seccion">
      <h2 className="panel__titulo">Tu cuenta</h2>

      <dl className="panel__datos">
        <dt>Correo</dt>
        <dd>{cuenta.correo}</dd>

        <dt>Rol</dt>
        <dd>{cuenta.rol}</dd>

        {cuenta.nombre !== undefined && (
          <>
            <dt>Nombre</dt>
            <dd>{cuenta.nombre}</dd>
          </>
        )}

        <dt>Aviso aceptado</dt>
        <dd>
          Versión {cuenta.consentimiento.versionPolitica}, el{' '}
          {enCastellano(cuenta.consentimiento.aceptadoEn)}
        </dd>
      </dl>
    </section>
  );
}

/**
 * El catalogo.
 *
 * Todavia no se puede completar ninguna: el motor de actividades es la epica
 * VSDH-E09. Se listan porque son lo que la API ofrece, y ensenarlas con un
 * boton que no lleva a ningun sitio seria prometer algo que no existe.
 */
function Actividades({ catalogo }: { catalogo: readonly CategoriaDelCatalogo[] }) {
  if (catalogo.length === 0) {
    return (
      <section className="panel__seccion">
        <h2 className="panel__titulo">Actividades</h2>
        <p className="panel__vacio">Todavía no hay actividades disponibles.</p>
      </section>
    );
  }

  return (
    <section className="panel__seccion">
      <h2 className="panel__titulo">Actividades disponibles</h2>

      {catalogo.map((categoria) => (
        <div key={categoria.id} className="panel__categoria">
          <h3 className="panel__categoria-nombre">{categoria.nombre}</h3>

          {categoria.descripcion !== undefined && (
            <p className="panel__categoria-texto">{categoria.descripcion}</p>
          )}

          <ul className="panel__actividades">
            {categoria.actividades.map((actividad) => (
              <li key={actividad.id} className="panel__actividad">
                <span className="panel__actividad-nombre">{actividad.nombre}</span>

                {actividad.tipo !== undefined && (
                  <span className="panel__actividad-tipo">{actividad.tipo}</span>
                )}

                {actividad.descripcion !== undefined && (
                  <span className="panel__actividad-texto">{actividad.descripcion}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
