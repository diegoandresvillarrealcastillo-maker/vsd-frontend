import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { Logo } from '../../componentes/Logo.tsx';
import { ACOMPANADO, ENTRADA } from '../../estilos/movimiento.ts';
import { RUTAS } from '../../rutas/rutas.ts';
import { useSesion } from '../../sesion/useSesion.ts';

/**
 * La cápsula que flota sobre la portada.
 *
 * Flota y no se pega al borde por una razón concreta: una barra pegada parte
 * la pantalla en dos y se lleva por delante la sensación de que el fondo
 * continúa. Una cápsula deja ver que hay algo debajo de ella.
 *
 * ---------------------------------------------------------------------------
 * La burbuja que se desplaza
 * ---------------------------------------------------------------------------
 *
 * Hay una sola burbuja para los cuatro elementos, y se mueve de uno a otro en
 * lugar de encenderse y apagarse. Con `layoutId`, Framer Motion la reconoce
 * como el mismo objeto y anima el recorrido; sin eso, el cambio sería un corte
 * y habría que buscar con la vista dónde quedó.
 *
 * Dónde está no lo decide el clic, lo decide en qué sección estás. Así la
 * burbuja también se mueve cuando bajas con la rueda, y la cápsula pasa a ser
 * un mapa de dónde te encuentras en vez de un menú que recuerda tu último
 * clic. Arriba del todo, sin ninguna sección a la vista, vuelve al botón de
 * crear cuenta, que es lo que la portada quiere que hagas.
 */

interface Seccion {
  readonly id: string;
  readonly texto: string;
}

const SECCIONES: readonly Seccion[] = [
  { id: 'que-hace', texto: 'Qué hace' },
  { id: 'como-funciona', texto: 'Cómo funciona' },
  { id: 'limite', texto: 'Lo que no hace' },
];

/** La burbuja cuando no hay ninguna sección a la vista. */
const EN_EL_BOTON = null;

export function NavegacionFlotante() {
  const { sesion, cargando } = useSesion();
  const [activa, setActiva] = useState<string | null>(EN_EL_BOTON);

  useEffect(() => {
    const secciones = SECCIONES.map((s) => document.getElementById(s.id)).filter(
      (elemento): elemento is HTMLElement => elemento !== null,
    );

    if (secciones.length === 0) {
      return;
    }

    const aLaVista = new Set<string>();

    const vigia = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting) {
            aLaVista.add(entrada.target.id);
          } else {
            aLaVista.delete(entrada.target.id);
          }
        }

        // Si hay dos a la vez, manda la primera en el orden de la página: es
        // la que se está terminando de leer.
        const primera = SECCIONES.find((s) => aLaVista.has(s.id));
        setActiva(primera?.id ?? EN_EL_BOTON);
      },
      {
        // Solo cuenta la franja de arriba. Sin recortar por abajo, la sección
        // siguiente se daría por activa en cuanto asomara un dedo por el
        // borde inferior, y la burbuja iría siempre una por delante.
        rootMargin: '-100px 0px -60% 0px',
      },
    );

    for (const seccion of secciones) {
      vigia.observe(seccion);
    }

    return () => {
      vigia.disconnect();
    };
  }, []);

  return (
    <motion.nav
      className="navegacion"
      aria-label="Principal"
      initial={{ opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={ENTRADA}
    >
      <Logo className="navegacion__marca" />

      <div className="navegacion__enlaces">
        {SECCIONES.map((seccion) => (
          <a
            key={seccion.id}
            className="navegacion__enlace"
            href={`#${seccion.id}`}
            // Anuncia cuál es la sección en la que estás, que es lo que la
            // burbuja dice visualmente.
            aria-current={activa === seccion.id ? 'true' : undefined}
          >
            {activa === seccion.id && (
              <motion.span
                className="navegacion__burbuja"
                layoutId="burbuja-del-menu"
                transition={ACOMPANADO}
              />
            )}
            <span className="navegacion__texto">{seccion.texto}</span>
          </a>
        ))}
      </div>

      {/* Mientras no se sabe si hay sesión no se enseña ningún botón. Poner
          "Crear cuenta" y cambiarlo medio segundo después es un parpadeo que
          hace dudar de si se pulsó bien. */}
      {!cargando &&
        (sesion ? (
          /* A quien ya entró no se le ofrece crear una cuenta ni entrar: ya
             hizo las dos cosas. Lo que necesita es saber que sigue dentro y
             poder volver a lo suyo, y eso no pide un botón de llamada. Por eso
             tampoco recibe la burbuja: sería darle el peso de una acción a un
             cartel que solo informa. */
          <Link className="navegacion__sesion" to={RUTAS.PANEL}>
            <span className="navegacion__punto" aria-hidden="true" />
            Sesión activa
          </Link>
        ) : (
          <Link
            className="navegacion__accion"
            to={RUTAS.REGISTRO}
            data-activa={activa === EN_EL_BOTON ? 'si' : undefined}
          >
            {activa === EN_EL_BOTON && (
              <motion.span
                className="navegacion__burbuja"
                layoutId="burbuja-del-menu"
                transition={ACOMPANADO}
              />
            )}
            <span className="navegacion__texto">Crear cuenta</span>
          </Link>
        ))}
    </motion.nav>
  );
}
