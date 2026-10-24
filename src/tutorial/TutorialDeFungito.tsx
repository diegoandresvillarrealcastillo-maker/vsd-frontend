import { motion, useReducedMotion } from 'framer-motion';
import { useId, useLayoutEffect, useRef, useState } from 'react';

import { useDialogo } from '../componentes/useDialogo.ts';
import '../estilos/tutorial.css';
import { sprite } from '../mascota/sprites.ts';
import { marcarElTutorialComoVisto, tutorialVisto } from './memoriaDelTutorial.ts';
import { PASOS_DEL_TUTORIAL, type AnclaDelTutorial } from './pasos.ts';
import {
  buscarAncla,
  huecoAlrededorDe,
  ladoDeLaCaja,
  quedaTodoElHueco,
  type Hueco,
} from './spotlight.ts';

/** Donde va el hueco y de que lado va la caja, o `null` si el paso se ve centrado. */
interface Spotlight {
  readonly hueco: Hueco;
  readonly lado: 'arriba' | 'abajo';
}

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
 *
 * ## El spotlight (SCRUM-201)
 *
 * Cuando el paso tiene `ancla` y ese elemento esta en la pantalla y se ve, la pantalla se atenua
 * **menos en el elemento**: un hueco con su margen, y la caja de Fungito va arriba o abajo, donde
 * hay mas sitio, sin taparlo. Si el elemento no esta, no se ve o ocupa casi toda la pantalla, el
 * paso se ve centrado como antes: el recorrido no depende de que el elemento este.
 *
 * El hueco es solo un dibujo (`aria-hidden`, sin puntero): el fondo sigue atrapando todo, asi que
 * ni se toca lo de atras ni se cierra por accidente. Lo que lee un lector de pantalla es el
 * dialogo, igual que sin spotlight. Se vuelve a medir al cambiar el tamano o al desplazar.
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
  const nombreDelAncla = PASOS_DEL_TUTORIAL[indice]?.ancla;

  // Lo medido guarda de que paso es: al cambiar de paso, lo del anterior deja de valer sin tener
  // que borrarlo, y el paso nuevo se ve centrado hasta que se mide (antes de pintar).
  const [medido, setMedido] = useState<{
    readonly ancla: AnclaDelTutorial;
    readonly spotlight: Spotlight | null;
  } | null>(null);
  const spotlight =
    nombreDelAncla !== undefined && medido?.ancla === nombreDelAncla ? medido.spotlight : null;

  // Al cambiar de paso: llevar el elemento a la vista y medirlo. Se mide otra vez al cambiar el
  // tamano de la ventana o al desplazar (en cualquier contenedor, de ahi la captura).
  useLayoutEffect(() => {
    if (!abierto || nombreDelAncla === undefined) {
      return undefined;
    }

    const ancla = nombreDelAncla;
    // El que se ve primero: el diario, en la barra de arriba (escritorio) o en el dock (movil).
    const encontrar = () => buscarAncla(ancla);

    function medir() {
      const elemento = encontrar();

      if (elemento === null) {
        setMedido({ ancla, spotlight: null });

        return;
      }

      const ventana = { ancho: window.innerWidth, alto: window.innerHeight };
      const hueco = huecoAlrededorDe(elemento.getBoundingClientRect(), ventana);

      setMedido({
        ancla,
        spotlight: quedaTodoElHueco(hueco, ventana)
          ? { hueco, lado: ladoDeLaCaja(hueco, ventana) }
          : null,
      });
    }

    // `instant`: con `scroll-behavior: smooth` en la hoja, medir justo despues cogeria el
    // elemento a medio camino.
    encontrar()?.scrollIntoView({ block: 'center', behavior: 'instant' });
    medir();

    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);

    return () => {
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir, true);
    };
  }, [abierto, nombreDelAncla]);

  if (!abierto) {
    return null;
  }

  const paso = PASOS_DEL_TUTORIAL[indice];

  if (paso === undefined) {
    return null;
  }

  const ultimo = indice === PASOS_DEL_TUTORIAL.length - 1;

  return (
    <div
      className={
        spotlight === null ? 'tutorial' : `tutorial tutorial--spotlight tutorial--${spotlight.lado}`
      }
    >
      {spotlight !== null && (
        <div
          className="tutorial__hueco"
          aria-hidden="true"
          style={{
            left: spotlight.hueco.x,
            top: spotlight.hueco.y,
            width: spotlight.hueco.ancho,
            height: spotlight.hueco.alto,
          }}
        />
      )}
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
            {/* Siempre esta, para que los botones no cambien de sitio; apagado en el primer paso. */}
            <button
              type="button"
              className="tutorial__boton"
              disabled={indice === 0}
              onClick={() => setIndice(indice - 1)}
            >
              Atrás
            </button>
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
