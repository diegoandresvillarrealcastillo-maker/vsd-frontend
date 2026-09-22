import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'framer-motion';
import type { MouseEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { Logo } from '../../componentes/Logo.tsx';
import { ID_DEL_CONTENIDO } from '../../componentes/SaltoAlContenido.tsx';
import '../../estilos/autenticacion.css';
import { ACOMPANADO, ENTRADA } from '../../estilos/movimiento.ts';
import { RUTAS } from '../../rutas/rutas.ts';
import { SelectorDeTema } from '../../tema/SelectorDeTema.tsx';

interface Props {
  titulo: string;
  entradilla: string;
  children: ReactNode;
  /** Enlaces a las otras pantallas. */
  pie?: ReactNode;
}

/**
 * El lienzo que comparten las cuatro pantallas de acceso.
 *
 * Registro, inicio de sesion y recuperacion **no son tres paginas**: son un
 * mismo panel que se transforma. El `layoutId` es lo que lo consigue — Framer
 * Motion reconoce la tarjeta como el mismo elemento entre rutas y anima el
 * cambio de tamano en vez de cortar a negro y volver a aparecer.
 *
 * Es la diferencia entre sentir que cambias de sitio y sentir que el sitio se
 * reacomoda para lo que vas a hacer.
 */
export function LienzoDeAcceso({ titulo, entradilla, children, pie }: Props) {
  const sinMovimiento = useReducedMotion();

  // La posicion del cursor dentro de la tarjeta, para el resplandor que la
  // sigue. Son valores de movimiento y no estado de React: cambiar estado en
  // cada pixel repintaria el arbol entero sesenta veces por segundo.
  const x = useMotionValue(-400);
  const y = useMotionValue(-400);

  // El resorte hace que el resplandor persiga al cursor con un retraso
  // minimo, en lugar de ir pegado. Pegado se siente mecanico; con inercia
  // parece que hay algo detras del cristal.
  const xSuave = useSpring(x, { stiffness: 220, damping: 28, mass: 0.6 });
  const ySuave = useSpring(y, { stiffness: 220, damping: 28, mass: 0.6 });

  const resplandor = useMotionTemplate`radial-gradient(220px circle at ${xSuave}px ${ySuave}px, var(--resplandor), transparent 70%)`;

  function seguirAlCursor(evento: MouseEvent<HTMLElement>) {
    const caja = evento.currentTarget.getBoundingClientRect();

    x.set(evento.clientX - caja.left);
    y.set(evento.clientY - caja.top);
  }

  function soltarElCursor() {
    // Lejos de la tarjeta, para que el resplandor se apague al salir en vez de
    // quedarse clavado en el ultimo punto.
    x.set(-400);
    y.set(-400);
  }

  return (
    // `tabIndex={-1}` no lo mete en el orden de tabulacion: lo hace capaz de
    // recibir el foco cuando alguien usa el enlace de salto. Sin eso, el
    // navegador mueve el desplazamiento pero deja el foco atras, y quien usa
    // lector de pantalla sigue oyendo la navegacion.
    <main className="acceso" id={ID_DEL_CONTENIDO} tabIndex={-1}>
      {/* Decorativo: no aporta informacion y no debe leerse en voz alta. */}
      <div className="acceso__respiro" aria-hidden="true" />

      {/* La marca tambien aqui. Desaparecer justo al registrarte o al
          recuperar la contrasena deja sin saber en que aplicacion estas, que
          es cuando mas importa.

          El logo lleva a la portada, pero eso hay que saberlo: nadie pulsa un
          logo esperando salir de donde esta. Por eso debajo va el enlace
          escrito. */}
      <Logo className="acceso__marca" />

      <motion.section
        layoutId="tarjeta-de-acceso"
        className="acceso__tarjeta"
        transition={ACOMPANADO}
        {...(sinMovimiento ? {} : { onMouseMove: seguirAlCursor, onMouseLeave: soltarElCursor })}
      >
        {!sinMovimiento && (
          <motion.div
            className="acceso__resplandor"
            aria-hidden="true"
            style={{ background: resplandor }}
          />
        )}

        {/* Dentro de la tarjeta y no flotando sobre la ventana: en estas
            pantallas la tarjeta es lo unico que hay, y un control pegado al
            borde de la pantalla no pertenece a nada. */}
        <SelectorDeTema variante="incrustado" />

        {/* La entrada escalonada: unos 40 ms entre elementos. Casi no se
            percibe y hace que la pantalla se sienta viva en lugar de aparecer
            de golpe. */}
        <motion.div
          className="acceso__contenido"
          initial="oculto"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
          }}
        >
          <Aparece>
            <h1 className="acceso__titulo">{titulo}</h1>
          </Aparece>

          <Aparece>
            <p className="acceso__entradilla">{entradilla}</p>
          </Aparece>

          {children}

          {pie !== undefined && (
            <Aparece>
              <div className="acceso__pie">{pie}</div>
            </Aparece>
          )}
        </motion.div>
      </motion.section>

      {/* La salida. Sin esto, quien abre el acceso desde un enlace se queda
          encerrado en la tarjeta: no hay menu, no hay atras, y el unico camino
          de vuelta es un logo que nadie sabe que es un enlace. */}
      <Link className="acceso__volver" to={RUTAS.INICIO}>
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
          <path
            d="M14 6l-6 6 6 6"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Volver al inicio
      </Link>
    </main>
  );
}

/**
 * Un elemento del escalonado.
 *
 * Se desplaza ocho pixeles, no veinte. El movimiento tiene que notarse sin
 * llamar la atencion; a partir de cierto recorrido deja de acompanar y empieza
 * a distraer.
 */
export function Aparece({ children }: { children: ReactNode }) {
  return (
    <motion.div
      variants={{
        oculto: { opacity: 0, y: 8 },
        visible: { opacity: 1, y: 0 },
      }}
      transition={ENTRADA}
    >
      {children}
    </motion.div>
  );
}
