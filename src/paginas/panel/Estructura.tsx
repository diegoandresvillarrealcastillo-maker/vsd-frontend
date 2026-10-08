import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { ConfirmarSalida } from '../../componentes/ConfirmarSalida.tsx';
import { MarcaDeLaApp } from '../../componentes/MarcaDeLaApp.tsx';
import { IndicadorDeConexion } from '../../conexion/IndicadorDeConexion.tsx';
import { useFotoDePerfil } from '../../foto/fotoDePerfil.ts';
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

const SECCIONES: readonly { href: string; texto: string; icono: NombreDeIcono }[] = [
  { href: '#inicio', texto: 'Inicio', icono: 'home' },
  { href: '#programas', texto: 'Explorar', icono: 'book' },
  { href: '#progreso', texto: 'Progreso', icono: 'activity' },
];

/**
 * La barra de arriba. `conSecciones` muestra los enlaces a las secciones del
 * dashboard; en cualquier otra pantalla no llevarian a ningun sitio.
 */
export function BarraSuperior({ conSecciones }: { conSecciones: boolean }) {
  return (
    <header className="app__barra">
      <div className="app__barra-interior">
        <MarcaDeLaApp />

        {conSecciones ? (
          <nav className="app__nav" aria-label="Secciones">
            {SECCIONES.map((seccion, indice) => (
              <a
                key={seccion.href}
                className={`app__enlace${indice === 0 ? ' app__enlace--activo' : ''}`}
                href={seccion.href}
              >
                <Icono nombre={seccion.icono} tamano={18} />
                {seccion.texto}
              </a>
            ))}
            <Link className="app__enlace" to={RUTAS.DIARIO}>
              <Icono nombre="calendar" tamano={18} />
              Mi diario
            </Link>
          </nav>
        ) : (
          // Mantiene la marca a la izquierda y la cuenta a la derecha.
          <span aria-hidden="true" />
        )}

        <div className="app__acciones">
          {/* Si hay conexion y cuanto sigue guardado en este equipo (SCRUM-137). */}
          <IndicadorDeConexion />
          {/* Volvio con el modo claro (SCRUM-112). */}
          <SelectorDeTema variante="barra" />
          <MenuDeCuenta />
        </div>
      </div>
    </header>
  );
}

/**
 * El boton redondo de la derecha: con que correo se entro, el perfil, la
 * portada y salir.
 *
 * **Salir pregunta si hay cambios sin enviar** (SCRUM-142): cerrar sesion olvida todo lo
 * guardado en este equipo, y eso incluye lo que todavia no llego al servidor. Sin nada
 * pendiente, sale de una vez, como siempre.
 */
function MenuDeCuenta() {
  const { correo, salir } = useSesion();
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
          <Link className="app__menu-opcion" to={RUTAS.PERFIL}>
            Tu perfil
          </Link>
          <Link className="app__menu-opcion" to={RUTAS.DIARIO}>
            Mi diario
          </Link>
          <Link className="app__menu-opcion" to={RUTAS.INICIO}>
            Ir a la página principal
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

/** La seccion del dashboard que esta a la vista, la que cruza el centro. */
function useSeccionALaVista(ids: readonly string[]): [string, (id: string) => void] {
  const [activa, setActiva] = useState(ids[0] ?? '');

  useEffect(() => {
    const secciones = ids
      .map((id) => document.getElementById(id))
      .filter((seccion): seccion is HTMLElement => seccion !== null);

    if (secciones.length === 0) {
      return undefined;
    }

    const observador = new IntersectionObserver(
      (entradas) => {
        const visible = entradas.find((entrada) => entrada.isIntersecting);

        if (visible !== undefined) {
          setActiva(visible.target.id);
        }
      },
      // Una franja en el centro de la pantalla: cuenta la seccion que la cruza.
      { rootMargin: '-45% 0px -50% 0px' },
    );

    secciones.forEach((seccion) => observador.observe(seccion));

    return () => observador.disconnect();
  }, [ids]);

  return [activa, setActiva];
}

const IDS_DE_SECCIONES = SECCIONES.map((seccion) => seccion.href.slice(1));

/**
 * El dock flotante del movil (SCRUM-114). Solo tiene sentido en el
 * dashboard.
 *
 * - Una pildora compacta y centrada, despegada del borde y de la zona segura
 *   del iPhone, de vidrio como lo demas que flota (SCRUM-113).
 * - La seccion a la vista se marca con una pastilla que se desliza de una a
 *   otra.
 * - Al bajar se aparta, y vuelve al subir, al detenerse o si recibe el foco.
 * - Con `prefers-reduced-motion`, sin deslizamientos.
 */
export function NavegacionInferior() {
  const [activa, setActiva] = useSeccionALaVista(IDS_DE_SECCIONES);
  const [oculto, setOculto] = useOcultarAlBajar();
  const sinMovimiento = useReducedMotion() ?? false;

  return (
    <nav
      className={`app__nav-inferior${oculto ? ' app__nav-inferior--oculto' : ''}`}
      aria-label="Secciones"
      // Quien llega con el teclado no tiene que desplazarse para verlo.
      onFocus={() => setOculto(false)}
    >
      {SECCIONES.map((seccion) => {
        const id = seccion.href.slice(1);
        const esLaActiva = id === activa;

        return (
          <a
            key={seccion.href}
            className={`app__nav-inferior-enlace${esLaActiva ? ' app__nav-inferior-enlace--activo' : ''}`}
            href={seccion.href}
            aria-current={esLaActiva ? 'location' : undefined}
            onClick={() => setActiva(id)}
          >
            {esLaActiva && (
              <motion.span
                className="app__nav-inferior-pastilla"
                layoutId="pastilla-del-dock"
                transition={
                  sinMovimiento ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }
                }
              />
            )}
            <span className="app__nav-inferior-icono">
              <Icono nombre={seccion.icono} tamano={19} />
            </span>
            <span className="app__nav-inferior-texto">{seccion.texto}</span>
          </a>
        );
      })}
      <Link className="app__nav-inferior-enlace" to={RUTAS.DIARIO}>
        <span className="app__nav-inferior-icono">
          <Icono nombre="calendar" tamano={19} />
        </span>
        <span className="app__nav-inferior-texto">Mi diario</span>
      </Link>
    </nav>
  );
}
