import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useRef, type CSSProperties } from 'react';

import { alPulsarElFondo } from '../../componentes/alPulsarElFondo.ts';
import { useDialogo } from '../../componentes/useDialogo.ts';
import type { Modulo } from '../../infraestructura/api/cuenta.ts';
import { Icono } from './Icono.tsx';
import { MODULOS } from './modulos.ts';

/**
 * El aviso al desbloquear un modulo desde el dashboard (SCRUM-90).
 *
 * El texto cambia segun sea el segundo o el tercero. Celebra el paso sin
 * convertirlo en una meta: aqui no se mide a nadie, se le acompana.
 *
 * Es un dialogo de verdad: el foco entra al boton al abrirse, Tab no lo saca de
 * la ventana y vuelve a donde estaba al cerrar, se cierra con Escape o pulsando
 * fuera, y con
 * `prefers-reduced-motion` aparece sin animacion.
 */
const TEXTOS: Readonly<Record<number, { titulo: string; texto: string }>> = {
  2: {
    titulo: 'Desbloqueaste tu segundo módulo',
    texto: 'Tu plan diario suma un espacio más. Ve a tu ritmo: no hace falta hacerlo todo.',
  },
  3: {
    titulo: 'Ya tienes los tres módulos',
    texto: 'Cuerpo, mente y emociones en un solo lugar. Elige cada día lo que más te sirva.',
  },
};

const TEXTO_GENERAL = {
  titulo: 'Desbloqueaste un módulo nuevo',
  texto: 'Ya aparece en tu panel, con lo que te toca hoy.',
};

export function Celebracion({
  modulo,
  total,
  alCerrar,
}: {
  modulo: Modulo;
  total: number;
  alCerrar: () => void;
}) {
  const datos = MODULOS[modulo];
  const { titulo, texto } = TEXTOS[total] ?? TEXTO_GENERAL;
  const sinMovimiento = useReducedMotion() ?? false;
  const idDelTitulo = useId();
  const idDelTexto = useId();
  const boton = useRef<HTMLButtonElement>(null);

  // El foco vuelve a donde estaba al cerrar. Va antes de `useDialogo`: sus efectos corren en orden,
  // y este tiene que ver el foco antes de que el dialogo lo mueva adentro.
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;

    return () => anterior?.focus?.();
  }, []);

  const caja = useDialogo<HTMLDivElement>(alCerrar, boton);

  return (
    // Los colores del modulo van en el fondo y la caja los hereda: las
    // variables CSS no encajan en el tipo de `style` de Framer Motion.
    <div
      className="celebracion"
      style={{ '--modulo-fondo': datos.fondo, '--modulo-acento': datos.acento } as CSSProperties}
      role="presentation"
      onClick={alPulsarElFondo(alCerrar)}
    >
      <motion.div
        ref={caja}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idDelTitulo}
        aria-describedby={idDelTexto}
        className="celebracion__caja"
        initial={sinMovimiento ? false : { opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={
          sinMovimiento ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 26 }
        }
      >
        <motion.span
          className="celebracion__icono"
          initial={sinMovimiento ? false : { rotate: -12, scale: 0.6 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={
            sinMovimiento ? { duration: 0 } : { delay: 0.12, type: 'spring', stiffness: 260 }
          }
        >
          <Icono nombre={datos.icono} tamano={32} />
        </motion.span>

        <p className="app__antetitulo celebracion__modulo">{datos.titulo}</p>
        <h2 id={idDelTitulo} className="celebracion__titulo">
          {titulo}
        </h2>
        <p id={idDelTexto} className="celebracion__texto">
          {texto}
        </p>

        <button
          ref={boton}
          type="button"
          className="app__boton celebracion__boton"
          onClick={alCerrar}
        >
          Seguir
          <Icono nombre="arrow" tamano={16} />
        </button>
      </motion.div>
    </div>
  );
}
