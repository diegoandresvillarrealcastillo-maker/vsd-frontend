import { motion, useReducedMotion } from 'framer-motion';
import { useId, useRef, useState } from 'react';

import { useDialogo } from '../componentes/useDialogo.ts';
import '../estilos/tutorial.css';
import { sprite } from '../mascota/sprites.ts';
import { marcarElTutorialComoVisto, tutorialVisto } from './memoriaDelTutorial.ts';
import { PASOS_DEL_TUTORIAL } from './pasos.ts';

/**
 * El tutorial de bienvenida con Fungito (SCRUM-187): un recorrido corto, por pasos.
 *
 * - **Siempre se puede omitir**: con el boton «Omitir» y con Escape. Omitirlo cuenta como
 *   visto: no vuelve a abrirse solo.
 * - Se ve **una sola vez por cuenta y equipo**, y se repite a voluntad desde el perfil.
 * - Pulsar el fondo **no** lo cierra: es la primera pantalla de una persona nueva y un toque
 *   de mas no deberia descartarla.
 * - Es un dialogo modal con nombre (el titulo del paso) y foco que entra al boton principal.
 *
 * Fungito es decorativo (`alt=""`): lo que se lee es el paso. Su movimiento es una respiracion
 * suave que se apaga con `prefers-reduced-motion`.
 */
export function TutorialDeFungito({
  cuenta,
  alCerrar,
}: {
  cuenta: string;
  /** Se llama al cerrarse, sea terminado u omitido: lo que va despues espera a esto. */
  alCerrar?: () => void;
}) {
  const [abierto, setAbierto] = useState(() => !tutorialVisto(cuenta));
  const [indice, setIndice] = useState(0);
  const sinMovimiento = useReducedMotion() ?? false;
  const principal = useRef<HTMLButtonElement>(null);
  const idDelTitulo = useId();
  const idDelTexto = useId();

  function cerrar() {
    marcarElTutorialComoVisto(cuenta);
    setAbierto(false);
    alCerrar?.();
  }

  const caja = useDialogo<HTMLDivElement>(cerrar, principal);

  if (!abierto) {
    return null;
  }

  const paso = PASOS_DEL_TUTORIAL[indice];

  if (paso === undefined) {
    return null;
  }

  const ultimo = indice === PASOS_DEL_TUTORIAL.length - 1;

  return (
    <div className="tutorial">
      <div
        ref={caja}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idDelTitulo}
        aria-describedby={idDelTexto}
        className="tutorial__caja"
      >
        <motion.img
          key={paso.expresion}
          className="tutorial__fungito"
          src={sprite('fungito', paso.expresion)}
          alt=""
          width={120}
          height={120}
          animate={sinMovimiento ? { y: 0 } : { y: [0, -5, 0] }}
          transition={
            sinMovimiento ? { duration: 0 } : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }
          }
        />

        <p className="tutorial__paso">
          Paso {indice + 1} de {PASOS_DEL_TUTORIAL.length}
        </p>
        <h2 id={idDelTitulo} className="tutorial__titulo">
          {paso.titulo}
        </h2>
        <p id={idDelTexto} className="tutorial__texto">
          {paso.texto}
        </p>

        <div className="tutorial__puntos" aria-hidden="true">
          {PASOS_DEL_TUTORIAL.map((uno, i) => (
            <span
              key={uno.id}
              className={`tutorial__punto${i === indice ? ' tutorial__punto--actual' : ''}`}
            />
          ))}
        </div>

        <div className="tutorial__acciones">
          <button type="button" className="tutorial__omitir" onClick={cerrar}>
            Omitir
          </button>

          <div className="tutorial__navegacion">
            {indice > 0 && (
              <button
                type="button"
                className="tutorial__boton"
                onClick={() => setIndice(indice - 1)}
              >
                Atrás
              </button>
            )}
            <button
              ref={principal}
              type="button"
              className="tutorial__boton tutorial__boton--principal"
              onClick={() => {
                if (ultimo) {
                  cerrar();
                  return;
                }

                setIndice(indice + 1);
              }}
            >
              {ultimo ? '¡Vamos!' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
