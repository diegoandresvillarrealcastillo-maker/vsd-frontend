import { Link } from 'react-router-dom';

import { RUTAS } from '../../rutas/rutas.ts';
import { PaginaLegal, type SeccionLegal } from './PaginaLegal.tsx';

/**
 * Lo que VSD Health guarda en el navegador de cada persona.
 *
 * La lista sale del codigo, no de memoria: cada fila corresponde a una clave
 * que la aplicacion escribe de verdad. Si se anade una, se anade aqui (y si es
 * para medir o para publicidad, antes hay que pedir permiso y actualizar la
 * pagina: hoy no hay ninguna de esas).
 *
 * La version de esta pagina no la acepta nadie con una casilla: no autoriza
 * ningun tratamiento, solo informa. Por eso no tiene version en la API.
 */
interface Elemento {
  readonly nombre: string;
  readonly paraQue: string;
  readonly cuanto: string;
  readonly esencial: boolean;
}

const ELEMENTOS: readonly Elemento[] = [
  {
    nombre: 'vsd.sesion',
    paraQue:
      'Mantiene tu sesión abierta (la credencial que nos entrega nuestro proveedor de acceso).',
    cuanto: 'Hasta que cierres sesión, o hasta 30 días.',
    esencial: true,
  },
  {
    nombre: 'workbox-precache-…',
    paraQue:
      'Los archivos de la aplicación, tipografías incluidas, para que abra más rápido y se pueda abrir sin conexión.',
    cuanto: 'Hasta que haya una versión nueva o borres los datos del sitio.',
    esencial: true,
  },
  {
    nombre: 'vsd-llavero y vsd-sincronizacion',
    paraQue:
      'Guardan, cifradas, las copias de lo que haces sin conexión hasta que se envían, y la clave para leerlas.',
    cuanto: 'Hasta que se envían o cierres sesión.',
    esencial: true,
  },
  {
    nombre: 'vsd.tema',
    paraQue: 'Recuerda si prefieres el tema claro o el oscuro.',
    cuanto: 'Hasta que borres los datos del sitio.',
    esencial: false,
  },
  {
    nombre: 'vsd.invitacion-cerrada',
    paraQue: 'Recuerda que cerraste la invitación a entrar de la portada.',
    cuanto: 'Mientras la pestaña esté abierta.',
    esencial: false,
  },
  {
    nombre: 'vsd-h:mascota-… y vsd-h:semaforo-…',
    paraQue:
      'Recuerdan dónde dejaste la mascota, sus saludos y si ya viste la introducción del semáforo.',
    cuanto: 'Hasta que borres los datos del sitio.',
    esencial: false,
  },
];

const SECCIONES: readonly SeccionLegal[] = [
  {
    id: 'que-usamos',
    titulo: 'Qué usamos',
    cuerpo: (
      <>
        <p>
          <strong>
            VSD Health no usa cookies de publicidad ni de seguimiento, y hoy no tiene herramientas
            de analítica.
          </strong>{' '}
          Lo que sí usa es el almacenamiento de tu propio navegador (localStorage, sessionStorage e
          IndexedDB) para que la aplicación funcione y recuerde lo que prefieres.
        </p>
        <p>
          Si algún día añadimos algo para medir el uso del sitio, lo diremos aquí antes y te
          pediremos permiso.
        </p>
      </>
    ),
  },
  {
    id: 'lista',
    titulo: 'Lista de lo que guardamos',
    cuerpo: (
      <>
        <p>
          <em>Esencial</em> quiere decir que sin eso no podemos darte el servicio, así que no se
          puede desactivar desde aquí.
        </p>
        {/* Se desplaza de lado en pantallas angostas, asi que tiene que poder
            recibir el foco: sin eso, quien usa teclado no puede ver las columnas
            que quedan fuera. */}
        <div
          className="legal__tabla-envoltorio"
          role="group"
          aria-label="Tabla de elementos, se puede desplazar de lado"
          // Una region con barra de desplazamiento debe poder recibir el foco (WCAG 2.1.1; axe: scrollable-region-focusable).
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
        >
          <table className="legal__tabla">
            <caption className="legal__tabla-titulo">
              Elementos que VSD Health guarda en tu navegador
            </caption>
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Para qué sirve</th>
                <th scope="col">Cuánto dura</th>
                <th scope="col">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {ELEMENTOS.map((elemento) => (
                <tr key={elemento.nombre}>
                  <th scope="row">
                    <code>{elemento.nombre}</code>
                  </th>
                  <td>{elemento.paraQue}</td>
                  <td>{elemento.cuanto}</td>
                  <td>{elemento.esencial ? 'Esencial' : 'De preferencias'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: 'terceros',
    titulo: 'Lo que ponen terceros',
    cuerpo: (
      <>
        <ul>
          <li>
            <strong>Google</strong>: solo si eliges entrar con Google. Esa pantalla es de Google y
            puede usar sus propias cookies en su dominio. Las tipografías del sitio ya no se piden a
            Google: viajan con la aplicación, desde nuestro dominio.
          </li>
          <li>
            <strong>Nuestros proveedores</strong> (Supabase, Render, Vercel) pueden registrar datos
            técnicos de la conexión para que el servicio funcione, como explica el{' '}
            <Link to={RUTAS.PRIVACIDAD}>aviso de privacidad</Link>.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'controlarlas',
    titulo: 'Cómo borrarlas',
    cuerpo: (
      <>
        <p>
          Puedes borrar los datos del sitio desde la configuración de tu navegador, en cualquier
          momento. Ten en cuenta que, al hacerlo:
        </p>
        <ul>
          <li>Se cierra tu sesión.</li>
          <li>Pierdes lo que hiciste sin conexión y todavía no se había enviado.</li>
          <li>Se olvidan tus preferencias, como el tema.</li>
        </ul>
        <p>Tu cuenta y tus datos en nuestros servidores no se borran por eso.</p>
      </>
    ),
  },
];

export function Cookies() {
  return (
    <PaginaLegal
      ruta={RUTAS.COOKIES}
      titulo="Cookies y almacenamiento local"
      entradilla="Qué guardamos en tu navegador, para qué y cómo puedes borrarlo."
      secciones={SECCIONES}
    />
  );
}
