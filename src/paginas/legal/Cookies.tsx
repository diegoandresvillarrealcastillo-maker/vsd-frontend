import { Link } from 'react-router-dom';

import { useAnalitica } from '../../analitica/useAnalitica.ts';
import '../../estilos/analitica.css';
import { RUTAS } from '../../rutas/rutas.ts';
import { PaginaLegal, PorDefinir, type SeccionLegal } from './PaginaLegal.tsx';
import { LO_QUE_NO_SE_CUENTA, LO_QUE_SE_CUENTA } from './TextosDeAnalitica.tsx';

/**
 * Lo que VSD Health guarda en el navegador de cada persona.
 *
 * La lista sale del codigo, no de memoria: cada fila corresponde a una clave
 * que la aplicacion escribe de verdad. Si se anade una, se anade aqui (y si es
 * para medir o para publicidad, antes hay que pedir permiso y actualizar la
 * pagina).
 *
 * La analitica (SCRUM-161) solo aparece donde existe: con identificador de
 * medicion. Donde no, esta pagina sigue diciendo, y es cierto, que no hay
 * herramientas de analitica.
 *
 * La version de esta pagina no la acepta nadie con una casilla: no autoriza
 * ningun tratamiento, solo informa. Por eso no tiene version en la API.
 */
type Tipo = 'esencial' | 'preferencias' | 'analitica';

interface Elemento {
  readonly nombre: string;
  readonly paraQue: string;
  readonly cuanto: string;
  readonly tipo: Tipo;
}

const ETIQUETA_DEL_TIPO: Record<Tipo, string> = {
  esencial: 'Esencial',
  preferencias: 'De preferencias',
  analitica: 'De analítica, solo si aceptas',
};

const ELEMENTOS: readonly Elemento[] = [
  {
    nombre: 'vsd.sesion',
    paraQue:
      'Mantiene tu sesión abierta (la credencial que nos entrega nuestro proveedor de acceso).',
    cuanto: 'Hasta que cierres sesión, o hasta 30 días.',
    tipo: 'esencial',
  },
  {
    nombre: 'workbox-precache-…',
    paraQue:
      'Los archivos de la aplicación, tipografías incluidas, para que abra más rápido y se pueda abrir sin conexión.',
    cuanto: 'Hasta que haya una versión nueva o borres los datos del sitio.',
    tipo: 'esencial',
  },
  {
    nombre: 'vsd-llavero y vsd-sincronizacion',
    paraQue:
      'Guardan, cifradas, las copias de lo que haces sin conexión hasta que se envían, y la clave para leerlas.',
    cuanto: 'Hasta que se envían o cierres sesión.',
    tipo: 'esencial',
  },
  {
    nombre: 'vsd.tema',
    paraQue: 'Recuerda si prefieres el tema claro o el oscuro.',
    cuanto: 'Hasta que borres los datos del sitio.',
    tipo: 'preferencias',
  },
  {
    nombre: 'vsd.invitacion-cerrada',
    paraQue: 'Recuerda que cerraste la invitación a entrar de la portada.',
    cuanto: 'Mientras la pestaña esté abierta.',
    tipo: 'preferencias',
  },
  {
    nombre: 'vsd-h:mascota-… y vsd-h:semaforo-…',
    paraQue:
      'Recuerdan dónde dejaste la mascota, sus saludos y si ya viste la introducción del semáforo.',
    cuanto: 'Hasta que borres los datos del sitio.',
    tipo: 'preferencias',
  },
];

/** Lo que se suma cuando hay analitica: la eleccion, y las cookies de Google si aceptas. */
function elementosDeLaAnalitica(id: string): readonly Elemento[] {
  return [
    {
      nombre: 'vsd.analitica',
      paraQue: 'Recuerda si aceptaste o rechazaste la analítica, para no volver a preguntarte.',
      cuanto: 'Hasta que borres los datos del sitio.',
      tipo: 'preferencias',
    },
    {
      nombre: '_ga',
      paraQue: 'Google Analytics: distingue un navegador de otro para contar las visitas.',
      cuanto: '90 días.',
      tipo: 'analitica',
    },
    {
      nombre: `_ga_${id.slice(2)}`,
      paraQue: 'Google Analytics: lleva la cuenta de la sesión de visita.',
      cuanto: '90 días.',
      tipo: 'analitica',
    },
  ];
}

function TablaDeElementos({ elementos }: { elementos: readonly Elemento[] }) {
  return (
    <>
      <p>
        <em>Esencial</em> quiere decir que sin eso no podemos darte el servicio, así que no se puede
        desactivar desde aquí.
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
            {elementos.map((elemento) => (
              <tr key={elemento.nombre}>
                <th scope="row">
                  <code>{elemento.nombre}</code>
                </th>
                <td>{elemento.paraQue}</td>
                <td>{elemento.cuanto}</td>
                <td>{ETIQUETA_DEL_TIPO[elemento.tipo]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Lo que se ve en esta pagina para decidir, con aceptar y rechazar pesando lo mismo. */
function ControlesDeLaAnalitica() {
  const { decision, aceptar, rechazar } = useAnalitica();

  const actual =
    decision === null
      ? 'todavía no has elegido'
      : decision === 'aceptada'
        ? 'aceptada'
        : 'rechazada';

  return (
    <div className="legal__analitica-controles">
      <p>
        Ahora mismo: <strong>{actual}</strong>.
      </p>
      <div className="analitica__acciones">
        <button type="button" className="analitica__boton" onClick={aceptar}>
          Aceptar
        </button>
        <button type="button" className="analitica__boton" onClick={rechazar}>
          Rechazar
        </button>
      </div>
    </div>
  );
}

function seccionesDe(idDeMedicion: string | null): readonly SeccionLegal[] {
  const conAnalitica = idDeMedicion !== null;

  return [
    {
      id: 'que-usamos',
      titulo: 'Qué usamos',
      cuerpo: conAnalitica ? (
        <>
          <p>
            <strong>
              VSD Health no usa cookies de publicidad. Solo si tú lo aceptas, cuenta las visitas a
              sus pantallas con Google Analytics.
            </strong>{' '}
            Lo demás que usa es el almacenamiento de tu propio navegador (localStorage,
            sessionStorage e IndexedDB) para que la aplicación funcione y recuerde lo que prefieres.
          </p>
          <p>
            Sin tu permiso no se carga nada de Google ni se crea ninguna cookie de analítica. Si
            rechazas, la aplicación funciona exactamente igual.
          </p>
        </>
      ) : (
        <>
          <p>
            <strong>
              VSD Health no usa cookies de publicidad ni de seguimiento, y hoy no tiene herramientas
              de analítica.
            </strong>{' '}
            Lo que sí usa es el almacenamiento de tu propio navegador (localStorage, sessionStorage
            e IndexedDB) para que la aplicación funcione y recuerde lo que prefieres.
          </p>
          <p>
            Si algún día añadimos algo para medir el uso del sitio, lo diremos aquí antes y te
            pediremos permiso.
          </p>
        </>
      ),
    },
    ...(conAnalitica
      ? [
          {
            id: 'analitica',
            titulo: 'Analítica (opcional)',
            cuerpo: (
              <>
                <p>
                  Con tu permiso usamos <strong>Google Analytics 4</strong> para contar cuántas
                  veces se visita cada pantalla. Nos sirve para decidir qué mejorar.
                </p>
                <ul>
                  <li>
                    <strong>Qué cuenta:</strong> {LO_QUE_SE_CUENTA}
                  </li>
                  <li>
                    <strong>Qué no cuenta:</strong> {LO_QUE_NO_SE_CUENTA}
                  </li>
                  <li>
                    <strong>Quién lo recibe:</strong> Google LLC, que puede tratarlo fuera de
                    Colombia, como explica el <Link to={RUTAS.PRIVACIDAD}>aviso de privacidad</Link>
                    .
                  </li>
                  <li>
                    <strong>Cuánto se conserva:</strong> las cookies duran 90 días, y en Google
                    Analytics los datos se conservan 2 meses.{' '}
                    <PorDefinir que="confirmar que la retención en Google Analytics quedó en 2 meses" />
                  </li>
                </ul>
                <p>
                  Puedes cambiar de idea cuando quieras: aquí, o desde «Preferencias de analítica»,
                  al pie de las pantallas. Si la retiras, dejamos de contar y borramos las cookies
                  de Google Analytics en ese momento.
                </p>
                <ControlesDeLaAnalitica />
              </>
            ),
          } satisfies SeccionLegal,
        ]
      : []),
    {
      id: 'lista',
      titulo: 'Lista de lo que guardamos',
      cuerpo: (
        <TablaDeElementos
          elementos={
            idDeMedicion === null
              ? ELEMENTOS
              : [...ELEMENTOS, ...elementosDeLaAnalitica(idDeMedicion)]
          }
        />
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
              puede usar sus propias cookies en su dominio. Las tipografías del sitio ya no se piden
              a Google: viajan con la aplicación, desde nuestro dominio.
            </li>
            {conAnalitica && (
              <li>
                <strong>Google Analytics</strong>: solo si aceptas la analítica, como se explica
                arriba.
              </li>
            )}
            <li>
              <strong>Nuestros proveedores</strong> (Supabase, Render, Vercel) pueden registrar
              datos técnicos de la conexión para que el servicio funcione, como explica el{' '}
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
            <li>
              Se olvidan tus preferencias, como el tema
              {conAnalitica ? ' y lo que elegiste sobre la analítica' : ''}.
            </li>
          </ul>
          <p>Tu cuenta y tus datos en nuestros servidores no se borran por eso.</p>
        </>
      ),
    },
  ];
}

export function Cookies() {
  const { idDeMedicion } = useAnalitica();

  return (
    <PaginaLegal
      ruta={RUTAS.COOKIES}
      titulo="Cookies y almacenamiento local"
      entradilla="Qué guardamos en tu navegador, para qué y cómo puedes borrarlo."
      secciones={seccionesDe(idDeMedicion)}
    />
  );
}
