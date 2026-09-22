import { motion } from 'framer-motion';
import { useState } from 'react';

import { ACOMPANADO, INMEDIATO } from '../estilos/movimiento.ts';
import { ponerTema, temaActual, type Tema } from './tema.ts';

/**
 * Los dos temas, en una capsula pequena.
 *
 * ---------------------------------------------------------------------------
 * Por que dos botones y no un interruptor
 * ---------------------------------------------------------------------------
 *
 * Un interruptor de encender y apagar obliga a saber que significa estar
 * apagado. Aqui los dos destinos estan a la vista y el que manda esta marcado:
 * se pulsa el que se quiere, no el contrario del que hay.
 *
 * ---------------------------------------------------------------------------
 * Por que la pastilla se desliza
 * ---------------------------------------------------------------------------
 *
 * Es un solo elemento que cambia de sitio, no dos que se encienden y se
 * apagan. Con `layoutId`, Framer Motion lo reconoce entre los dos botones y lo
 * mueve; sin el, el cambio seria un corte y habria que buscar con la vista
 * donde quedo la marca.
 */

const OPCIONES: readonly { tema: Tema; nombre: string }[] = [
  { tema: 'claro', nombre: 'Tema claro' },
  { tema: 'oscuro', nombre: 'Tema oscuro' },
];

function Sol() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth={1.8} />
      <path
        d="M12 2.6v2.1M12 19.3v2.1M21.4 12h-2.1M4.7 12H2.6M18.6 5.4l-1.5 1.5M6.9 17.1l-1.5 1.5M18.6 18.6l-1.5-1.5M6.9 6.9 5.4 5.4"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

function Luna() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
      <path
        d="M20 14.2A8.3 8.3 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface Props {
  /**
   * Donde vive el control.
   *
   * - `flotante`: pegado a la esquina de la ventana. Es lo que corresponde
   *   cuando no hay ningun recuadro al que pertenecer: la portada y el panel
   *   de la cuenta.
   * - `incrustado`: dentro de la tarjeta de acceso, en su esquina. Flotando
   *   sobre esas pantallas quedaba suelto en mitad de la nada, porque ahi lo
   *   unico que hay es la tarjeta.
   */
  readonly variante?: 'flotante' | 'incrustado';
}

export function SelectorDeTema({ variante = 'flotante' }: Props) {
  // Se lee una sola vez al montar. A partir de ahi el estado de aqui y la
  // marca del documento cambian juntos, asi que no hay nada que resincronizar.
  const [tema, setTema] = useState<Tema>(temaActual);

  function elegir(nuevo: Tema) {
    setTema(nuevo);
    ponerTema(nuevo);
  }

  return (
    <div
      className={variante === 'incrustado' ? 'tema tema--incrustado' : 'tema'}
      role="group"
      aria-label="Tema de la aplicación"
    >
      {OPCIONES.map((opcion) => {
        const activo = tema === opcion.tema;

        return (
          <motion.button
            key={opcion.tema}
            type="button"
            className="tema__opcion"
            // `aria-pressed` es lo que anuncia cual de los dos esta puesto.
            // Sin el, un lector de pantalla lee dos botones iguales y no hay
            // forma de saber en que tema se esta.
            aria-pressed={activo}
            onClick={() => elegir(opcion.tema)}
            whileTap={{ scale: 0.92 }}
            transition={INMEDIATO}
          >
            <span className="solo-lectores">{opcion.nombre}</span>

            {activo && (
              <motion.span
                className="tema__pastilla"
                layoutId="pastilla-del-tema"
                transition={ACOMPANADO}
              />
            )}

            <span className="tema__icono">{opcion.tema === 'claro' ? <Sol /> : <Luna />}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
