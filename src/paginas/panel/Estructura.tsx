import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { RUTAS } from '../../rutas/rutas.ts';
import { useSesion } from '../../sesion/useSesion.ts';
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
        <Link to={RUTAS.PANEL} className="app__marca" aria-label="VSD-H, inicio">
          <span className="app__marca-icono">
            <Icono nombre="sparkles" />
          </span>
          <span className="app__marca-texto">VSD-H</span>
        </Link>

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
 */
function MenuDeCuenta() {
  const { correo, salir } = useSesion();
  const [abierto, setAbierto] = useState(false);
  const idDelMenu = useId();
  const contenedor = useRef<HTMLDivElement>(null);

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
        type="button"
        className="app__avatar"
        aria-label="Abrir el menú de tu cuenta"
        aria-expanded={abierto}
        aria-controls={idDelMenu}
        onClick={() => setAbierto((antes) => !antes)}
      >
        <Icono nombre="user" />
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
          <button type="button" className="app__menu-opcion" onClick={() => void salir()}>
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

/** La navegacion flotante del movil. Solo tiene sentido en el dashboard. */
export function NavegacionInferior() {
  return (
    <nav className="app__nav-inferior" aria-label="Secciones">
      {SECCIONES.map((seccion, indice) => (
        <a
          key={seccion.href}
          className={`app__nav-inferior-enlace${indice === 0 ? ' app__nav-inferior-enlace--activo' : ''}`}
          href={seccion.href}
        >
          <Icono nombre={seccion.icono} tamano={19} />
          {seccion.texto}
        </a>
      ))}
      <Link className="app__nav-inferior-enlace" to={RUTAS.DIARIO}>
        <Icono nombre="calendar" tamano={19} />
        Mi diario
      </Link>
    </nav>
  );
}
