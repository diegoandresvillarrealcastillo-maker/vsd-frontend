import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

import '../../estilos/autenticacion.css';

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
  return (
    <main className="acceso">
      {/* Decorativo: no aporta informacion y no debe leerse en voz alta. */}
      <div className="acceso__respiro" aria-hidden="true" />

      <motion.section
        layoutId="tarjeta-de-acceso"
        className="acceso__tarjeta"
        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      >
        {/* La entrada escalonada: unos 40 ms entre elementos. Casi no se
            percibe y hace que la pantalla se sienta viva en lugar de aparecer
            de golpe. */}
        <motion.div
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
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
