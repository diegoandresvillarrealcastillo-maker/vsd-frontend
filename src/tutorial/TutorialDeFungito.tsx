import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

import { ENFOCABLES, enfocablesDe } from '../componentes/useDialogo.ts';
import '../estilos/tutorial.css';
import { sprite } from '../mascota/sprites.ts';
import { marcarElTutorialComoVisto, tutorialVisto } from './memoriaDelTutorial.ts';
import { PASOS_DEL_TUTORIAL, type AnclaDelTutorial } from './pasos.ts';
import {
  buscarAncla,
  colocarElGlobo,
  huecoAlrededorDe,
  ladoDeLaCaja,
  quedaTodoElHueco,
  type Colocacion,
  type Hueco,
  type Ventana,
} from './spotlight.ts';

/** Lo ultimo que se midio del elemento que senala el paso: su hueco, o `null` si va centrado. */
interface Medida {
  readonly ancla: AnclaDelTutorial;
  readonly hueco: Hueco | null;
  readonly ventana: Ventana;
}

function mismaMedida(una: Medida | null, otra: Medida): boolean {
  if (
    una?.ancla !== otra.ancla ||
    una.ventana.ancho !== otra.ventana.ancho ||
    una.ventana.alto !== otra.ventana.alto
  ) {
    return false;
  }

  if (una.hueco === null || otra.hueco === null) {
    return una.hueco === otra.hueco;
  }

  return (
    una.hueco.x === otra.hueco.x &&
    una.hueco.y === otra.hueco.y &&
    una.hueco.ancho === otra.hueco.ancho &&
    una.hueco.alto === otra.hueco.alto
  );
}

/** Lo que se enfoca del elemento senalado: el mismo, si es un enlace o un boton, o lo primero de dentro. */
function enfocableDe(elemento: HTMLElement | null): HTMLElement | null {
  if (elemento === null) {
    return null;
  }

  return elemento.matches(ENFOCABLES) ? elemento : elemento.querySelector<HTMLElement>(ENFOCABLES);
}

/**
 * El tutorial de bienvenida con Fungito (SCRUM-187): un recorrido corto, por pasos.
 *
 * - **Siempre se puede omitir**: con el boton «Omitir» y con Escape. Omitirlo cuenta como
 *   visto: no vuelve a abrirse solo.
 * - Se ve **una sola vez por cuenta y equipo**, y se repite a voluntad desde el perfil.
 * - Pulsar el fondo **no** lo cierra: es la primera pantalla de una persona nueva y un toque
 *   de mas no deberia descartarla.
 *
 * Fungito es decorativo (`alt=""`): lo que se lee es el paso. Su movimiento es una respiracion
 * suave que se apaga con `prefers-reduced-motion`.
 *
 * ## Dos maneras de verse
 *
 * - **Centrado** (los pasos sin elemento, o cuando el elemento no esta, no se ve, ocupa casi toda
 *   la pantalla o el globo no cabe junto a el): un dialogo modal con la pantalla atenuada. El foco
 *   no sale de el.
 * - **Pegado a un elemento** (SCRUM-201, SCRUM-252): la pantalla se atenua menos en el elemento
 *   —un hueco con su margen— y el globo del paso va junto a el, con una flecha, del lado donde hay
 *   mas sitio. **El elemento se puede tocar**: lo de alrededor atrapa el puntero con cuatro
 *   paneles transparentes, y el hueco lo deja pasar. Como la pagina de detras sigue ahi, ya no es
 *   un dialogo modal: el foco da la vuelta entre el globo y el elemento, y Escape solo lo omite si
 *   el foco esta en el globo (con otra cosa abierta, Escape es de ella).
 *
 * ## Probar el elemento (SCRUM-252)
 *
 * Al tocar el elemento, el globo lo reconoce (`alProbar`, anunciado sin interrumpir) y se va al
 * borde de la pantalla contrario, para no tapar lo que el elemento abre (el panel de la llama). Lo
 * que el elemento abre queda por encima del tutorial mientras este abierto (`tutorial.css`), y
 * para seguir basta con «Siguiente». Si tocarlo llevaria a otra pantalla (el diario), el toque se
 * reconoce y no navega: nadie se sale del recorrido sin querer.
 *
 * Se vuelve a medir al cambiar el tamano o al desplazar.
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
  // Si en este paso se toco el elemento senalado.
  const [probado, setProbado] = useState(false);
  const sinMovimiento = useReducedMotion() ?? false;
  const caja = useRef<HTMLDivElement>(null);
  const principal = useRef<HTMLButtonElement>(null);
  const elementoSenalado = useRef<HTMLElement | null>(null);
  const idDelTitulo = useId();
  const idDelTexto = useId();

  function cerrar() {
    marcarElTutorialComoVisto(cuenta);
    setAbierto(false);
    alCerrar?.();
  }

  function irAlPaso(nuevo: number) {
    setIndice(nuevo);
    setProbado(false);
  }

  const paso = PASOS_DEL_TUTORIAL[indice];
  const nombreDelAncla = paso?.ancla;

  // Lo medido guarda de que paso es: al cambiar de paso, lo del anterior deja de valer sin tener
  // que borrarlo, y el paso nuevo se ve centrado hasta que se mide (antes de pintar).
  const [medido, setMedido] = useState<Medida | null>(null);
  const hueco =
    nombreDelAncla !== undefined && medido?.ancla === nombreDelAncla ? medido.hueco : null;
  const ventana = medido?.ventana ?? null;

  // Donde cabe el globo, medido ya pintado. Guarda el hueco para el que se calculo: si el hueco
  // cambia, esto deja de valer. `undefined` es «todavia no se midio»; `null`, «no cabe».
  const [puesto, setPuesto] = useState<{
    readonly hueco: Hueco;
    readonly colocacion: Colocacion | null;
  } | null>(null);
  const colocado = hueco !== null && puesto?.hueco === hueco ? puesto.colocacion : undefined;

  const centrado = hueco === null || ventana === null || (!probado && colocado === null);

  // Al cambiar de paso: llevar el elemento a la vista y medirlo. Se mide otra vez al cambiar el
  // tamano de la ventana o al desplazar (en cualquier contenedor, de ahi la captura).
  useLayoutEffect(() => {
    if (!abierto || nombreDelAncla === undefined) {
      elementoSenalado.current = null;

      return undefined;
    }

    const ancla = nombreDelAncla;

    function medir() {
      // El que se ve primero: el diario, en la barra de arriba (escritorio) o en el dock (movil).
      const elemento = buscarAncla(ancla);
      const ventanaAhora = { ancho: window.innerWidth, alto: window.innerHeight };

      elementoSenalado.current = elemento;

      let nuevo: Medida = { ancla, hueco: null, ventana: ventanaAhora };

      if (elemento !== null) {
        const medidoAhora = huecoAlrededorDe(elemento.getBoundingClientRect(), ventanaAhora);

        nuevo = {
          ancla,
          hueco: quedaTodoElHueco(medidoAhora, ventanaAhora) ? medidoAhora : null,
          ventana: ventanaAhora,
        };
      }

      // Sin cambios, el mismo objeto: no hay nada que volver a pintar ni a colocar.
      setMedido((antes) => (mismaMedida(antes, nuevo) ? antes : nuevo));
    }

    // `instant`: con `scroll-behavior: smooth` en la hoja, medir justo despues cogeria el
    // elemento a medio camino.
    buscarAncla(ancla)?.scrollIntoView({ block: 'center', behavior: 'instant' });
    medir();

    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);

    return () => {
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir, true);
    };
  }, [abierto, nombreDelAncla]);

  // Colocar el globo: hay que pintarlo para saber cuanto mide. Es antes de que se vea, asi que no
  // hay un instante con el globo mal puesto. Ya probado el elemento, el globo va al borde y no se
  // coloca junto a el.
  useLayoutEffect(() => {
    const elemento = caja.current;

    if (hueco === null || ventana === null || probado || elemento === null) {
      return;
    }

    const { width, height } = elemento.getBoundingClientRect();

    setPuesto({
      hueco,
      colocacion: colocarElGlobo(hueco, { ancho: width, alto: height }, ventana),
    });
  }, [hueco, ventana, probado, indice]);

  // Tocar el elemento senalado: el globo lo reconoce. Si tocarlo llevaria a otra pantalla, no
  // navega. Va en captura, antes de que lo vea quien maneja el clic (el enlace).
  useEffect(() => {
    const actual = PASOS_DEL_TUTORIAL[indice];

    if (!abierto || actual?.alProbar === undefined) {
      return undefined;
    }

    function alPulsar(evento: MouseEvent) {
      const elemento = elementoSenalado.current;

      if (
        elemento === null ||
        !(evento.target instanceof Node) ||
        !elemento.contains(evento.target)
      ) {
        return;
      }

      if (actual?.noNavega === true) {
        evento.preventDefault();
        evento.stopPropagation();
      }

      setProbado(true);
    }

    document.addEventListener('click', alPulsar, true);

    return () => {
      document.removeEventListener('click', alPulsar, true);
    };
  }, [abierto, indice]);

  // Lo que abre el elemento (el panel de la llama, el semaforo) pasa por encima del tutorial
  // mientras esta abierto: `tutorial.css`.
  useEffect(() => {
    if (!abierto) {
      return undefined;
    }

    document.body.classList.add('con-tutorial');

    return () => {
      document.body.classList.remove('con-tutorial');
    };
  }, [abierto]);

  // Ya probado el elemento, el cuerpo de la pagina dice cual era: la frase de la mascota, que es lo
  // que abre al tocarla, sube por encima del tutorial para poder pulsarla (`tutorial.css`).
  useEffect(() => {
    if (!abierto || !probado || nombreDelAncla === undefined) {
      return undefined;
    }

    document.body.dataset.tutorialProbando = nombreDelAncla;

    return () => {
      delete document.body.dataset.tutorialProbando;
    };
  }, [abierto, probado, nombreDelAncla]);

  // En cada paso el foco va al boton principal, para seguir con Intro.
  useEffect(() => {
    if (abierto) {
      principal.current?.focus();
    }
  }, [abierto, indice]);

  const cerrarElTutorial = useRef(cerrar);

  useEffect(() => {
    cerrarElTutorial.current = cerrar;
  });

  // El teclado. Centrado es un dialogo modal: el foco da la vuelta dentro y Escape cierra. Pegado
  // a un elemento la pagina sigue ahi: el foco da la vuelta entre el globo y el elemento, y solo
  // lo que pasa con el foco en alguno de los dos es cosa del tutorial.
  useEffect(() => {
    if (!abierto) {
      return undefined;
    }

    function alPulsarTecla(evento: KeyboardEvent) {
      const globo = caja.current;

      if (globo === null) {
        return;
      }

      const activo = document.activeElement;
      const dentro = globo.contains(activo);

      if (evento.key === 'Escape') {
        if (centrado || dentro) {
          evento.preventDefault();
          cerrarElTutorial.current();
        }

        return;
      }

      if (evento.key !== 'Tab') {
        return;
      }

      const objetivo = centrado ? null : enfocableDe(elementoSenalado.current);
      const lista = [...enfocablesDe(globo), ...(objetivo === null ? [] : [objetivo])];
      const inicio = lista[0];
      const fin = lista.at(-1);

      if (inicio === undefined || fin === undefined) {
        if (centrado) {
          evento.preventDefault();
        }

        return;
      }

      if (centrado && !dentro) {
        evento.preventDefault();
        inicio.focus();

        return;
      }

      const posicion = activo instanceof HTMLElement ? lista.indexOf(activo) : -1;

      if (posicion === -1) {
        // Algo que solo se enfoca a mano (el titulo): desde ahi, atras va al ultimo. Y con el foco
        // en otra cosa (lo que abrio el elemento), no es cosa del tutorial.
        if (centrado && dentro && evento.shiftKey) {
          evento.preventDefault();
          fin.focus();
        }

        return;
      }

      const destino = evento.shiftKey
        ? (lista[posicion - 1] ?? fin)
        : (lista[posicion + 1] ?? inicio);

      evento.preventDefault();
      destino.focus();
    }

    document.addEventListener('keydown', alPulsarTecla);

    return () => {
      document.removeEventListener('keydown', alPulsarTecla);
    };
  }, [abierto, centrado]);

  if (!abierto || paso === undefined) {
    return null;
  }

  const ultimo = indice === PASOS_DEL_TUTORIAL.length - 1;
  const pegado = !centrado && hueco !== null && ventana !== null;
  // El lado del globo. Ya probado, en el borde contrario al elemento; si no, donde se coloco.
  const lado = pegado
    ? probado
      ? ladoDeLaCaja(hueco, ventana)
      : (colocado?.lado ?? ladoDeLaCaja(hueco, ventana))
    : null;
  const globo = pegado && !probado;

  return (
    <div
      className={
        pegado && lado !== null
          ? `tutorial tutorial--spotlight tutorial--${lado}${probado ? ' tutorial--dock' : ''}`
          : 'tutorial'
      }
    >
      {pegado && (
        <>
          <div
            className="tutorial__hueco"
            aria-hidden="true"
            style={{
              left: hueco.x,
              top: hueco.y,
              width: hueco.ancho,
              height: hueco.alto,
            }}
          />
          {/* Cuatro paneles transparentes alrededor del hueco: atrapan el puntero y dejan pasar
              el toque al elemento. Un solo panel con un agujero no existe en CSS. */}
          <div
            className="tutorial__bloqueo"
            aria-hidden="true"
            style={{ left: 0, right: 0, top: 0, height: hueco.y }}
          />
          <div
            className="tutorial__bloqueo"
            aria-hidden="true"
            style={{ left: 0, right: 0, top: hueco.y + hueco.alto, bottom: 0 }}
          />
          <div
            className="tutorial__bloqueo"
            aria-hidden="true"
            style={{ left: 0, width: hueco.x, top: hueco.y, height: hueco.alto }}
          />
          <div
            className="tutorial__bloqueo"
            aria-hidden="true"
            style={{ left: hueco.x + hueco.ancho, right: 0, top: hueco.y, height: hueco.alto }}
          />
        </>
      )}
      <div
        ref={caja}
        role="dialog"
        aria-modal={centrado ? 'true' : undefined}
        aria-labelledby={idDelTitulo}
        aria-describedby={idDelTexto}
        className={
          globo && lado !== null
            ? `tutorial__caja tutorial__globo tutorial__globo--${lado}`
            : 'tutorial__caja'
        }
        // Mientras se mide, el globo se pinta sin verse: no hay otra forma de saber cuanto mide.
        style={
          globo
            ? colocado === undefined || colocado === null
              ? { visibility: 'hidden' }
              : { left: colocado.x, top: colocado.y }
            : undefined
        }
      >
        {globo && colocado !== undefined && colocado !== null && (
          <span className="tutorial__flecha" aria-hidden="true" style={{ left: colocado.flecha }} />
        )}

        <div className="tutorial__cabeza">
          <motion.img
            key={paso.expresion}
            className="tutorial__fungito"
            src={sprite('fungito', paso.expresion)}
            alt=""
            width={120}
            height={120}
            animate={sinMovimiento ? { y: 0 } : { y: [0, -5, 0] }}
            transition={
              sinMovimiento
                ? { duration: 0 }
                : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }
            }
          />

          <div className="tutorial__encabezado">
            <p className="tutorial__paso">
              Paso {indice + 1} de {PASOS_DEL_TUTORIAL.length}
            </p>
            <h2 id={idDelTitulo} className="tutorial__titulo">
              {paso.titulo}
            </h2>
          </div>
        </div>

        <p id={idDelTexto} className="tutorial__texto">
          {paso.texto}
        </p>

        {pegado && paso.alProbar !== undefined && (
          <>
            {!probado && (
              <p className="tutorial__invitacion">
                {paso.noNavega === true
                  ? 'Puedes tocarlo: el recorrido sigue aquí.'
                  : 'Puedes tocarlo para probarlo.'}
              </p>
            )}
            {/* Siempre esta, vacio hasta que se toca: un aviso que aparece ya lleno no siempre se anuncia. */}
            <p className="tutorial__probado" role="status">
              {probado ? paso.alProbar : ''}
            </p>
          </>
        )}

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
              onClick={() => irAlPaso(indice - 1)}
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

                irAlPaso(indice + 1);
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
