import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ACOMPANADO, REACCION_SUAVE } from '../../estilos/movimiento.ts';
import { RUTAS } from '../../rutas/rutas.ts';
import { useSesion } from '../../sesion/useSesion.ts';

/**
 * La tarjeta que sube cuando se lleva un rato leyendo.
 *
 * ---------------------------------------------------------------------------
 * Por que no es una ventana modal
 * ---------------------------------------------------------------------------
 *
 * Un modal tapa la pagina, atrapa el foco y obliga a cerrarlo antes de seguir.
 * Aparecer asi a mitad de lectura, sin que nadie lo pidiera, es una encerrona.
 *
 * Esto es una tarjeta anclada abajo: quien la ignora sigue leyendo, quien la
 * quiere la pulsa, y quien la cierra no la vuelve a ver en toda la visita.
 *
 * ---------------------------------------------------------------------------
 * Cuando aparece
 * ---------------------------------------------------------------------------
 *
 * Al dejar atras el heroe. Antes seria interrumpir a quien todavia no sabe
 * que es esto; mucho despues, aparecer cuando ya se decidio.
 *
 * Se probo con pantalla y media y era demasiado tarde: la portada es corta a
 * proposito, y entre ese punto y el bloque que la tarjeta no puede tapar solo
 * quedaban unos ciento cuarenta pixeles de recorrido. La tarjeta salia y se
 * iba casi en el mismo gesto.
 *
 * Se mide en pixeles recorridos y no en porcentaje de la pagina. El porcentaje
 * se calcula contra el alto total, y ese alto todavia no es el definitivo
 * mientras la tipografia carga: la primera medida daba un avance completo y la
 * tarjeta salia encima del heroe, antes de que nadie hubiera bajado nada.
 */

function umbral(): number {
  return window.innerHeight * 0.9;
}

/** Cerrarla vale para toda la visita, no para siempre. */
const CLAVE_CERRADA = 'vsd.invitacion-cerrada';

function yaSeCerro(): boolean {
  try {
    return sessionStorage.getItem(CLAVE_CERRADA) === 'si';
  } catch {
    // En navegacion privada o con el almacenamiento bloqueado, leer lanza.
    // Que la tarjeta aparezca de mas es mucho menos grave que una portada
    // que no carga.
    return false;
  }
}

function recordarQueSeCerro(): void {
  try {
    sessionStorage.setItem(CLAVE_CERRADA, 'si');
  } catch {
    // Si no se puede recordar, se vuelve a ver al recargar. Aceptable.
  }
}

interface Props {
  /**
   * Id de la seccion que esta tarjeta no puede tapar nunca.
   *
   * La portada la usa para el bloque de lo que la aplicacion **no** hace, que
   * termina con los telefonos de atencion en crisis. Una invitacion a crear
   * una cuenta encima de un numero al que alguien puede necesitar llamar no es
   * un problema de diseno: es un dano concreto, y por eso la regla vive aqui y
   * no en una hoja de estilos.
   */
  readonly noTapar: string;
}

export function InvitacionAlEntrar({ noTapar }: Props) {
  const { sesion, cargando } = useSesion();
  const { scrollY } = useScroll();

  const [bajoLoSuficiente, setBajoLoSuficiente] = useState(false);
  const [cerrada, setCerrada] = useState(yaSeCerro);
  const [estorbando, setEstorbando] = useState(false);

  useMotionValueEvent(scrollY, 'change', (recorrido) => {
    // Solo sube: una vez alcanzado el punto, la tarjeta no desaparece al
    // volver arriba. Aparecer y esconderse siguiendo el dedo es mareante.
    if (recorrido >= umbral()) {
      setBajoLoSuficiente(true);
    }
  });

  useEffect(() => {
    const seccion = document.getElementById(noTapar);

    if (!seccion) {
      return;
    }

    const vigia = new IntersectionObserver(
      ([entrada]) => {
        setEstorbando(entrada?.isIntersecting ?? false);
      },
      // Se considera que estorba en cuanto asoma un poco, no cuando ya esta
      // media seccion dentro: para entonces ya tapo lo que importaba.
      { threshold: 0 },
    );

    vigia.observe(seccion);

    return () => {
      vigia.disconnect();
    };
  }, [noTapar]);

  function cerrar() {
    setCerrada(true);
    recordarQueSeCerro();
  }

  // A quien ya entro no se le ofrece entrar. Y mientras no se sabe, no se
  // ensena nada: es preferible tardar que ofrecerle una cuenta a quien ya
  // tiene una.
  const visible = bajoLoSuficiente && !cerrada && !estorbando && !cargando && !sesion;

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          className="invitacion"
          aria-label="Crear cuenta o entrar"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={ACOMPANADO}
        >
          <button
            type="button"
            className="invitacion__cerrar"
            onClick={cerrar}
            aria-label="Cerrar esta invitación"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
              />
            </svg>
          </button>

          <h2 className="invitacion__titulo">Empieza cuando quieras</h2>
          <p className="invitacion__texto">
            Crear la cuenta te toma menos de un minuto y solo te pedimos lo necesario.
          </p>

          <div className="invitacion__acciones">
            <motion.span {...REACCION_SUAVE}>
              <Link className="pildora pildora--fuerte" to={RUTAS.REGISTRO}>
                Crear cuenta
              </Link>
            </motion.span>

            <motion.span {...REACCION_SUAVE}>
              <Link className="pildora pildora--fantasma" to={RUTAS.ACCESO}>
                Ya tengo cuenta
              </Link>
            </motion.span>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
