import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link, useMatch } from 'react-router-dom';

import { AvisoDeAcompanamiento } from '../../acompanamiento/AvisoDeAcompanamiento.tsx';
import { ConfirmarSalida } from '../../componentes/ConfirmarSalida.tsx';
import { MarcaDeLaApp } from '../../componentes/MarcaDeLaApp.tsx';
import { IndicadorDeConexion } from '../../conexion/IndicadorDeConexion.tsx';
import { useFotoDePerfil } from '../../foto/fotoDePerfil.ts';
import { LlamaDeLaBarra } from '../../racha/LlamaDeRacha.tsx';
import { RUTAS } from '../../rutas/rutas.ts';
import { useSesion } from '../../sesion/useSesion.ts';
import { sincronizarAhora } from '../../sincronizacion/estado.ts';
import { cuantosCambiosSinEnviar } from '../../sincronizacion/loGuardadoEnEsteEquipo.ts';
import { SelectorDeTema } from '../../tema/SelectorDeTema.tsx';
import { Icono, type NombreDeIcono } from './Icono.tsx';

/**
 * Lo que comparten las pantallas de la aplicacion despues de entrar: la barra
 * de arriba, el menu de la cuenta y la navegacion inferior del movil.
 *
 * Vive aparte del dashboard porque ahora lo usan dos pantallas, el panel y el
 * perfil (SCRUM-101), y tienen que verse como una sola aplicacion.
 */

/**
 * Las tres paginas de la navegacion (SCRUM-296): Inicio es el panel, «Mi actividad» lo que la
 * persona ha hecho y «Mi diario» lo que escribe. «Progreso» ya no es un enlace: era un ancla del
 * panel y su lugar es ahora una pantalla propia.
 *
 * «Explorar» tampoco esta (SCRUM-182): era un enlace a `#programas`, y esa seccion **sigue en el
 * panel** porque tiene las tarjetas de los modulos, que son la entrada a cada sendero. Lo que se
 * quito es el enlace, no el contenido; el boton «Ver los modulos» sigue apuntando a ellas.
 */
export type PaginaDeLaNavegacion = 'inicio' | 'actividad' | 'diario';

/** Las paginas que no son el panel: las que se pasan a la barra y al dock para marcar donde se esta. */
export type OtraPagina = Exclude<PaginaDeLaNavegacion, 'inicio'>;

const ENLACES: readonly { pagina: PaginaDeLaNavegacion; texto: string; icono: NombreDeIcono }[] = [
  { pagina: 'inicio', texto: 'Inicio', icono: 'home' },
  { pagina: 'actividad', texto: 'Mi actividad', icono: 'activity' },
  { pagina: 'diario', texto: 'Mi diario', icono: 'calendar' },
];

/** Desde otra pagina, Inicio lleva al panel y el panel baja solo a su ancla al llegar. */
const DESTINOS = {
  inicio: { pathname: RUTAS.PANEL, hash: '#inicio' },
  actividad: RUTAS.MI_ACTIVIDAD,
  diario: RUTAS.DIARIO,
} as const;

/** El resorte de la pastilla: el mismo en la barra de arriba y en el dock del movil (SCRUM-284). */
const RESORTE_DE_LA_PASTILLA = { type: 'spring', stiffness: 420, damping: 34 } as const;

/**
 * La pastilla que se desliza hasta la pagina de ahora. **Una sola pieza para la barra de arriba y para el
 * dock** (SCRUM-284): antes solo el dock la tenia, y en el computador la marca era fija. Cada una lleva su
 * `id` porque las dos estan en el documento a la vez (una se esconde con CSS segun el ancho), y con el mismo
 * `layoutId` la pastilla de una intentaria viajar a la de la otra.
 *
 * Con `prefers-reduced-motion`, sin deslizamientos: aparece donde toca.
 */
function PastillaDeLaNavegacion({ id }: { id: string }) {
  const sinMovimiento = useReducedMotion() ?? false;

  return (
    <motion.span
      className="app__pastilla"
      layoutId={id}
      transition={sinMovimiento ? { duration: 0 } : RESORTE_DE_LA_PASTILLA}
    />
  );
}

/**
 * Un enlace de la barra o del dock: la pagina de ahora lleva la pastilla y se anuncia como tal.
 *
 * Inicio, estando en el panel, es un ancla del mismo documento (`location`); todo lo demas es un enlace
 * del enrutador (`page`). **«Mi diario» lleva la marca del tutorial** (SCRUM-201, SCRUM-249): se senala
 * donde se ve, en la barra de arriba en el computador y en el dock del movil.
 */
function EnlaceDeLaNavegacion({
  pagina,
  actual,
  clase,
  pastilla,
  children,
}: {
  pagina: PaginaDeLaNavegacion;
  actual: PaginaDeLaNavegacion | undefined;
  clase: string;
  pastilla: ReactNode;
  children: ReactNode;
}) {
  const esLaActual = pagina === actual;
  const propiedades = {
    className: `${clase}${esLaActual ? ` ${clase}--activo` : ''}`,
    'aria-current': esLaActual ? (pagina === 'inicio' ? 'location' : 'page') : undefined,
    ...(pagina === 'diario' ? { 'data-tutorial': 'diario' } : {}),
  } as const;
  const contenido = (
    <>
      {esLaActual && pastilla}
      {children}
    </>
  );

  return pagina === 'inicio' && esLaActual ? (
    <a {...propiedades} href="#inicio">
      {contenido}
    </a>
  ) : (
    <Link {...propiedades} to={DESTINOS[pagina]}>
      {contenido}
    </Link>
  );
}

/**
 * La barra de arriba. `conSecciones` es el panel: Inicio es la pagina de ahora. `pagina` es «Mi
 * actividad» o «Mi diario»: los mismos tres enlaces, con esa como pagina actual, igual que el dock del
 * movil. En cualquier otra pantalla no lleva navegacion, porque no llevaria a ningun sitio.
 *
 * **«Mi diario» ya no esta en el menu de la cuenta** (SCRUM-296): vive aqui y en el dock.
 */
export function BarraSuperior({
  conSecciones,
  pagina,
}: {
  conSecciones: boolean;
  pagina?: OtraPagina;
}) {
  const actual = pagina ?? (conSecciones ? 'inicio' : undefined);

  return (
    <>
      <header className="app__barra">
        <div className="app__barra-interior">
          <MarcaDeLaApp />

          {actual !== undefined ? (
            <nav className="app__nav" aria-label="Secciones">
              {ENLACES.map(({ pagina: destino, texto, icono }) => (
                <EnlaceDeLaNavegacion
                  key={destino}
                  pagina={destino}
                  actual={actual}
                  clase="app__enlace"
                  pastilla={<PastillaDeLaNavegacion id="pastilla-de-la-barra" />}
                >
                  <Icono nombre={icono} tamano={18} />
                  <span className="app__enlace-texto">{texto}</span>
                </EnlaceDeLaNavegacion>
              ))}
            </nav>
          ) : (
            // Mantiene la marca a la izquierda y la cuenta a la derecha.
            <span aria-hidden="true" />
          )}

          <div className="app__acciones">
            {/* La llama de la racha (SCRUM-186), a la izquierda del indicador de conexion. */}
            <LlamaDeLaBarra />
            {/* Si hay conexion y cuanto sigue guardado en este equipo (SCRUM-137). */}
            <IndicadorDeConexion />
            {/* Volvio con el modo claro (SCRUM-112). */}
            <SelectorDeTema variante="barra" />
            <MenuDeCuenta />
          </div>
        </div>
      </header>

      {/* El acompanamiento por dias seguidos con atencion (SCRUM-177): en cada pantalla con barra. */}
      <AvisoDeAcompanamiento />
    </>
  );
}

/**
 * El boton redondo de la derecha: con que correo se entro, el perfil (o, estando en el perfil,
 * «Ir a mi panel»), el inicio (la portada) y salir.
 *
 * **Salir pregunta si hay cambios sin enviar** (SCRUM-142): cerrar sesion olvida todo lo
 * guardado en este equipo, y eso incluye lo que todavia no llego al servidor. Sin nada
 * pendiente, sale de una vez, como siempre.
 */
function MenuDeCuenta() {
  const { correo, salir } = useSesion();
  const enElPerfil = useMatch(RUTAS.PERFIL) !== null;
  // La foto de la persona, si la tiene (SCRUM-120). Es decorativa: el boton ya
  // se llama «Abrir el menu de tu cuenta».
  const foto = useFotoDePerfil();
  const [abierto, setAbierto] = useState(false);
  // Cuantos cambios sin enviar hay, mientras se pregunta si salir; `null` si no se pregunta.
  const [sinEnviar, setSinEnviar] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const idDelMenu = useId();
  const contenedor = useRef<HTMLDivElement>(null);
  const avatar = useRef<HTMLButtonElement>(null);

  async function pedirSalir() {
    const cuantos = await cuantosCambiosSinEnviar();

    if (cuantos === 0) {
      await salir();

      return;
    }

    setAbierto(false);
    setSinEnviar(cuantos);
  }

  function esperar() {
    setSinEnviar(null);
    // El boton del menu sigue ahi: el foco vuelve a donde estaba.
    avatar.current?.focus();
  }

  async function enviarYSalir() {
    setEnviando(true);

    try {
      await sincronizarAhora();

      const quedan = await cuantosCambiosSinEnviar();

      // Si ya no queda nada sin enviar, se sale: era lo que la persona queria.
      if (quedan === 0) {
        setSinEnviar(null);
        await salir();

        return;
      }

      setSinEnviar(quedan);
    } finally {
      setEnviando(false);
    }
  }

  useEffect(() => {
    if (!abierto) {
      return;
    }

    function alPulsarFuera(evento: MouseEvent) {
      if (!contenedor.current?.contains(evento.target as Node)) {
        setAbierto(false);
      }
    }

    function alPulsarTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        setAbierto(false);
      }
    }

    document.addEventListener('mousedown', alPulsarFuera);
    document.addEventListener('keydown', alPulsarTecla);

    return () => {
      document.removeEventListener('mousedown', alPulsarFuera);
      document.removeEventListener('keydown', alPulsarTecla);
    };
  }, [abierto]);

  return (
    <div className="app__cuenta" ref={contenedor}>
      <button
        ref={avatar}
        type="button"
        className="app__avatar"
        aria-label="Abrir el menú de tu cuenta"
        aria-expanded={abierto}
        aria-controls={idDelMenu}
        onClick={() => setAbierto((antes) => !antes)}
      >
        {foto === null ? (
          <Icono nombre="user" />
        ) : (
          <img className="app__avatar-foto" src={foto} alt="" />
        )}
      </button>

      {abierto && (
        <div id={idDelMenu} className="app__menu">
          <p className="app__menu-correo">{correo}</p>
          {/* Dentro del perfil «Tu perfil» no llevaria a ningun sitio: se ofrece volver al panel
              (SCRUM-314). La barra es fija, asi que se alcanza sin subir a mano. */}
          {enElPerfil ? (
            <Link className="app__menu-opcion" to={RUTAS.PANEL}>
              Ir a mi panel
            </Link>
          ) : (
            <Link className="app__menu-opcion" to={RUTAS.PERFIL}>
              Tu perfil
            </Link>
          )}
          <Link className="app__menu-opcion" to={RUTAS.INICIO}>
            Ir al inicio
          </Link>
          <button
            type="button"
            className="app__menu-opcion"
            onClick={() => {
              void pedirSalir();
            }}
          >
            Cerrar sesión
          </button>
        </div>
      )}

      {sinEnviar !== null && (
        <ConfirmarSalida
          cambios={sinEnviar}
          enviando={enviando}
          alEsperar={esperar}
          alEnviar={() => {
            void enviarYSalir();
          }}
          alSalir={() => {
            setSinEnviar(null);
            void salir();
          }}
        />
      )}
    </div>
  );
}

/** Cuanto hay que desplazarse de una vez para que cuente como bajar o subir. */
const UMBRAL_DE_DESPLAZAMIENTO = 6;
/** Por encima de esto el dock no se esconde: arriba del todo siempre esta. */
const ALTURA_SIEMPRE_VISIBLE = 80;
/** Al dejar de desplazarse, el dock vuelve. */
const VUELVE_AL_DETENERSE_MS = 700;

/**
 * Si el dock deberia esconderse ahora: al bajar se aparta para dejar ver el
 * contenido, y vuelve al subir o al detenerse.
 */
function useOcultarAlBajar(): [boolean, (oculto: boolean) => void] {
  const [oculto, setOculto] = useState(false);

  useEffect(() => {
    let anterior = window.scrollY;
    let quieto: ReturnType<typeof setTimeout> | undefined;

    function alDesplazar() {
      const actual = window.scrollY;

      if (actual > anterior + UMBRAL_DE_DESPLAZAMIENTO && actual > ALTURA_SIEMPRE_VISIBLE) {
        setOculto(true);
      } else if (actual < anterior - UMBRAL_DE_DESPLAZAMIENTO) {
        setOculto(false);
      }

      anterior = actual;
      clearTimeout(quieto);
      quieto = setTimeout(() => setOculto(false), VUELVE_AL_DETENERSE_MS);
    }

    window.addEventListener('scroll', alDesplazar, { passive: true });

    return () => {
      clearTimeout(quieto);
      window.removeEventListener('scroll', alDesplazar);
    };
  }, []);

  return [oculto, setOculto];
}

/**
 * El dock flotante del movil (SCRUM-114). Vive en el dashboard y, desde SCRUM-182, tambien dentro de
 * Mi diario y de Mi actividad (SCRUM-296).
 *
 * - Una pildora compacta y centrada, despegada del borde y de la zona segura
 *   del iPhone, de vidrio como lo demas que flota (SCRUM-113).
 * - La pagina de ahora se marca con una pastilla que se desliza de una a otra.
 * - Al bajar se aparta, y vuelve al subir, al detenerse o si recibe el foco.
 * - Con `prefers-reduced-motion`, sin deslizamientos.
 *
 * **En el panel** Inicio es la pagina de ahora. **Dentro de Mi actividad o de Mi diario** lo es esa
 * pagina, e Inicio es un enlace al panel con su ancla (el panel baja solo a ella al llegar).
 */
export function NavegacionInferior({ pagina }: { pagina?: OtraPagina }) {
  const actual = pagina ?? 'inicio';
  const [oculto, setOculto] = useOcultarAlBajar();

  return (
    <nav
      className={`app__nav-inferior${oculto ? ' app__nav-inferior--oculto' : ''}`}
      aria-label="Secciones"
      // Quien llega con el teclado no tiene que desplazarse para verlo.
      onFocus={() => setOculto(false)}
    >
      {ENLACES.map(({ pagina: destino, texto, icono }) => (
        <EnlaceDeLaNavegacion
          key={destino}
          pagina={destino}
          actual={actual}
          clase="app__nav-inferior-enlace"
          pastilla={<PastillaDeLaNavegacion id="pastilla-del-dock" />}
        >
          <span className="app__nav-inferior-icono">
            <Icono nombre={icono} tamano={19} />
          </span>
          <span className="app__nav-inferior-texto">{texto}</span>
        </EnlaceDeLaNavegacion>
      ))}
    </nav>
  );
}
