import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useRef, type CSSProperties } from 'react';

import type { Modulo } from '../../infraestructura/api/cuenta.ts';
import { Icono } from './Icono.tsx';
import { MODULOS } from './modulos.ts';

/**
 * El aviso al desbloquear un modulo desde el dashboard (SCRUM-90).
 *
 * El texto cambia segun sea el segundo o el tercero. Celebra el paso sin
 * convertirlo en una meta: aqui no se mide a nadie, se le acompana.
 *
 * Es un dialogo de verdad: el foco entra al boton al abrirse y vuelve a donde
 * estaba al cerrar, se cierra con Escape o pulsando fuera, y con
 * `prefers-reduced-motion` aparece sin animacion.
 */
const TEXTOS: Readonly<Record<number, { titulo: string; texto: string }>> = {
  2: {
    titulo: 'Desbloqueaste tu segundo módulo',
    texto:
      'Ahora tu plan de cada día suma un espacio más. Ve a tu ritmo: no hace falta hacerlo todo.',
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
  // En una referencia para que el efecto corra una sola vez al abrir, aunque
  // quien lo usa pase una funcion nueva en cada pintado.
  const cerrar = useRef(alCerrar);

  useEffect(() => {
    cerrar.current = alCerrar;
  });

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;

    boton.current?.focus();

    function alPulsarTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        cerrar.current();
      }
    }

    document.addEventListener('keydown', alPulsarTecla);

    return () => {
      document.removeEventListener('keydown', alPulsarTecla);
      anterior?.focus?.();
    };
  }, []);

  return (
    // Los colores del modulo van en el fondo y la caja los hereda: las
    // variables CSS no encajan en el tipo de `style` de Framer Motion.
    <div
      className="celebracion"
      style={{ '--modulo-fondo': datos.fondo, '--modulo-acento': datos.acento } as CSSProperties}
      onClick={alCerrar}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idDelTitulo}
        aria-describedby={idDelTexto}
        className="celebracion__caja"
        onClick={(evento) => evento.stopPropagation()}
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
