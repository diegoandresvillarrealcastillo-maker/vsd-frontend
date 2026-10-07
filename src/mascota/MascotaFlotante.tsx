import { motion, useReducedMotion, type TargetAndTransition } from 'framer-motion';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';

import { Asistente } from '../asistente/Asistente.tsx';
import { marcoDelAsistente, puntoDeLaMascota } from '../asistente/marco.ts';
import { useEscribiendo } from '../componentes/useEscribiendo.ts';
import { useMascotaPropia } from '../foto/mascotaPropia.ts';
import type { Mascota } from '../infraestructura/api/cuenta.ts';
import { ESPACIO_DEL_SEMAFORO } from '../semaforo/medidas.ts';
import { momentoDeLaFrase, siguienteFrase } from './bancoDeFrases.ts';
import type { Momento } from './frasesDeLaMascota.ts';
import { movimientoDeLaPropia } from './movimientoDeLaPropia.ts';
import {
  FORMA_DE_LA_MASCOTA_PROPIA,
  mascotaParaMostrar,
  PERSONAJES,
  type Expresion,
} from './personajes.ts';
import { sprite } from './sprites.ts';
import { useExpresion } from './useExpresion.ts';

/**
 * La mascota que flota sobre la aplicacion (SCRUM-99).
 *
 * - Se arrastra con el raton o el dedo y, al soltarla, se pega al borde
 *   izquierdo o derecho, el mas cercano.
 * - Con teclado: las flechas arriba y abajo la mueven, y izquierda y derecha la
 *   cambian de lado. Enter muestra una frase.
 * - Al tocarla dice una frase del banco (SCRUM-129): una al azar, sin repetir
 *   hasta agotar las de su momento, que sale de la hora de la persona o de lo
 *   que pide la pantalla. Cada personaje suma ademas las suyas.
 * - Nunca baja de la barra superior ni pisa la navegacion inferior del movil.
 *   A la derecha tampoco baja hasta el boton del semaforo (SCRUM-98): comparten
 *   esquina sin solaparse.
 *   Mientras se escribe se aparta y deja de recibir toques, para no tapar el
 *   campo; mientras se desplaza la pantalla, se encoge.
 * - Con `prefers-reduced-motion` no se anima: cambia de cara y de sitio sin
 *   transiciones.
 *
 * Abre VSD IA (SCRUM-100) al mantenerla pulsada, o desde el boton de su globo,
 * que es el camino para el teclado. Al abrirlo vuela a la esquina de arriba a
 * la izquierda del asistente mientras este se despliega, y al cerrarlo vuelve
 * a su sitio.
 */

type Lado = 'izquierda' | 'derecha';

/** `y` va de 0 (arriba del todo) a 1 (abajo del todo) del espacio libre. */
interface Posicion {
  readonly lado: Lado;
  readonly y: number;
}

interface Punto {
  readonly x: number;
  readonly y: number;
}

/** Donde la deja cada persona. Es una comodidad de este navegador, no un dato personal. */
const CLAVE_DE_POSICION = 'vsd-h:mascota-posicion';
const POSICION_INICIAL: Posicion = { lado: 'izquierda', y: 0.85 };

const MARGEN = 12;
/** Debajo de la barra superior, que mide 76 px. */
const ARRIBA = 84;
/** Se considera arrastre a partir de este desplazamiento; menos es un toque. */
const UMBRAL_DE_ARRASTRE = 6;
const PASO_DE_TECLADO = 40;
const FRASE_MS = 8_000;
const QUIETUD_TRAS_DESPLAZAR_MS = 700;
/** Lo que hay que mantenerla pulsada para abrir VSD IA. */
export const PULSACION_LARGA_MS = 500;

const ES_MOVIL = '(max-width: 767px)';

/**
 * El espacio por el que se mueve. Con `ladoElegido` a la derecha, el de abajo
 * se queda tambien sin la esquina del semaforo; sin lado, vale el mas amplio,
 * que es el que se usa mientras se arrastra.
 */
function limites(ladoElegido?: Lado) {
  const movil = window.matchMedia(ES_MOVIL).matches;
  const lado = movil ? 72 : 96;
  // En el movil, abajo flota la navegacion de secciones: se deja libre.
  const libre = movil ? 96 : 16;
  const semaforo = movil ? ESPACIO_DEL_SEMAFORO.movil : ESPACIO_DEL_SEMAFORO.escritorio;
  const abajo = ladoElegido === 'derecha' ? Math.max(libre, semaforo) : libre;

  return {
    lado,
    minX: MARGEN,
    maxX: Math.max(MARGEN, window.innerWidth - lado - MARGEN),
    minY: ARRIBA,
    maxY: Math.max(ARRIBA, window.innerHeight - lado - abajo),
  };
}

function entre(valor: number, minimo: number, maximo: number): number {
  return Math.min(maximo, Math.max(minimo, valor));
}

function aPixeles(posicion: Posicion): Punto {
  const { minX, maxX, minY, maxY } = limites(posicion.lado);

  return {
    x: posicion.lado === 'izquierda' ? minX : maxX,
    y: minY + posicion.y * (maxY - minY),
  };
}

function leerPosicion(): Posicion {
  try {
    const guardada = JSON.parse(localStorage.getItem(CLAVE_DE_POSICION) ?? 'null') as unknown;

    if (
      typeof guardada === 'object' &&
      guardada !== null &&
      'lado' in guardada &&
      'y' in guardada &&
      (guardada.lado === 'izquierda' || guardada.lado === 'derecha') &&
      typeof guardada.y === 'number'
    ) {
      return { lado: guardada.lado, y: entre(guardada.y, 0, 1) };
    }
  } catch {
    // Sin almacenamiento, o con algo raro guardado: se usa la de siempre.
  }

  return POSICION_INICIAL;
}

function guardarPosicion(posicion: Posicion): void {
  try {
    localStorage.setItem(CLAVE_DE_POSICION, JSON.stringify(posicion));
  } catch {
    // No poder recordarla no impide moverla.
  }
}

/** Si la pantalla se esta desplazando ahora mismo. */
function useDesplazando(): boolean {
  const [desplazando, setDesplazando] = useState(false);

  useEffect(() => {
    let temporizador: ReturnType<typeof setTimeout> | undefined;

    function alDesplazar() {
      setDesplazando(true);
      clearTimeout(temporizador);
      temporizador = setTimeout(() => setDesplazando(false), QUIETUD_TRAS_DESPLAZAR_MS);
    }

    window.addEventListener('scroll', alDesplazar, { passive: true, capture: true });

    return () => {
      clearTimeout(temporizador);
      window.removeEventListener('scroll', alDesplazar, { capture: true });
    };
  }, []);

  return desplazando;
}

/** Vuelve a pintar al cambiar el tamano de la ventana, para recolocarla. */
function useTamanoDeVentana(): void {
  const [, setVersion] = useState(0);

  useEffect(() => {
    function alCambiar() {
      setVersion((antes) => antes + 1);
    }

    window.addEventListener('resize', alCambiar);

    return () => window.removeEventListener('resize', alCambiar);
  }, []);
}

/** El movimiento de reposo de cada cara. Sin movimiento pedido, ninguno. */
function animacion(
  expresion: Expresion,
  sinMovimiento: boolean,
  propia: boolean,
): TargetAndTransition {
  // Una mascota propia (SCRUM-122) no tiene caras que cambiar: se mueve distinto.
  if (propia) {
    return movimientoDeLaPropia(expresion, sinMovimiento);
  }

  if (sinMovimiento) {
    return { y: 0, scale: 1 };
  }

  switch (expresion) {
    case 'celebrando':
      return {
        y: [0, -14, 0, -7, 0],
        scale: 1,
        transition: { duration: 1.1, repeat: Infinity, repeatDelay: 0.4, ease: 'easeOut' },
      };
    case 'dormida':
      return {
        y: 0,
        scale: [1, 1.03, 1],
        transition: { duration: 4.5, repeat: Infinity, ease: 'easeInOut' },
      };
    default:
      return {
        y: [0, -3, 0],
        scale: 1,
        transition: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' },
      };
  }
}

export function MascotaFlotante({
  mascota,
  celebrar = false,
  momento,
}: {
  mascota: Mascota | null;
  /** La pantalla pide celebrar: plan del dia completo, modulo desbloqueado. */
  celebrar?: boolean;
  /**
   * El momento de las frases, si la pantalla lo sabe: la racha, el diario.
   * Celebrar ya pide las de despues de una actividad. Sin ninguno, manda la
   * hora de la persona.
   */
  momento?: Momento;
}) {
  const { personaje, nombre, propia } = mascotaParaMostrar(mascota);
  const dibujoPropio = useMascotaPropia();
  // La mascota propia se pinta cuando ya llego su dibujo. Mientras llega no se
  // pinta Fungito un instante para cambiarlo despues; y si no llega, se queda
  // con Fungito en lugar de quedarse sin mascota.
  const seDibujaLaPropia = propia && dibujoPropio.url !== null;
  const esperandoLaPropia = propia && dibujoPropio.url === null && dibujoPropio.cargando;
  // La mascota propia no trae frases propias: dice las del banco general.
  const frasesPropias = propia ? [] : PERSONAJES[personaje].frases;
  const { expresion, alTocar } = useExpresion(celebrar);
  const sinMovimiento = useReducedMotion() ?? false;
  const escribiendo = useEscribiendo();
  const desplazando = useDesplazando();
  useTamanoDeVentana();

  const [posicion, setPosicion] = useState<Posicion>(leerPosicion);
  const [arrastre, setArrastre] = useState<Punto | null>(null);
  const [frase, setFrase] = useState<string | null>(null);
  const gesto = useRef<{ id: number; inicio: Punto; origen: Punto; movido: boolean } | null>(null);
  const ignorarClic = useRef(false);
  const pulsacionLarga = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [conAsistente, setConAsistente] = useState(false);
  const volverAlBoton = useRef(false);
  const boton = useRef<HTMLButtonElement>(null);
  const idDeInstrucciones = useId();

  useEffect(() => {
    if (frase === null) {
      return undefined;
    }

    const temporizador = setTimeout(() => setFrase(null), FRASE_MS);

    return () => clearTimeout(temporizador);
  }, [frase]);

  useEffect(() => () => clearTimeout(pulsacionLarga.current), []);

  // Al cerrar VSD IA el foco vuelve a la mascota, que es de donde se abrio.
  useEffect(() => {
    if (volverAlBoton.current && !conAsistente) {
      volverAlBoton.current = false;
      boton.current?.focus();
    }
  });

  function abrirAsistente() {
    clearTimeout(pulsacionLarga.current);
    gesto.current = null;
    setArrastre(null);
    setFrase(null);
    alTocar();
    setConAsistente(true);
  }

  function cerrarAsistente() {
    volverAlBoton.current = true;
    setConAsistente(false);
  }

  function moverA(nueva: Posicion) {
    setPosicion(nueva);
    guardarPosicion(nueva);
  }

  function decirFrase() {
    alTocar();
    setFrase(
      siguienteFrase(momentoDeLaFrase(celebrar ? 'actividad' : momento, new Date()), frasesPropias),
    );
  }

  function alPresionar(evento: PointerEvent<HTMLButtonElement>) {
    if (!evento.isPrimary || evento.button !== 0) {
      return;
    }

    evento.currentTarget.setPointerCapture?.(evento.pointerId);
    ignorarClic.current = false;
    gesto.current = {
      id: evento.pointerId,
      inicio: { x: evento.clientX, y: evento.clientY },
      origen: aPixeles(posicion),
      movido: false,
    };

    // Mantenerla pulsada sin moverla abre VSD IA. El clic que llega al soltar
    // no es un toque.
    clearTimeout(pulsacionLarga.current);
    pulsacionLarga.current = setTimeout(() => {
      if (gesto.current !== null && !gesto.current.movido) {
        ignorarClic.current = true;
        abrirAsistente();
      }
    }, PULSACION_LARGA_MS);
  }

  function alMover(evento: PointerEvent<HTMLButtonElement>) {
    const actual = gesto.current;

    if (actual?.id !== evento.pointerId) {
      return;
    }

    const dx = evento.clientX - actual.inicio.x;
    const dy = evento.clientY - actual.inicio.y;

    if (!actual.movido && Math.hypot(dx, dy) < UMBRAL_DE_ARRASTRE) {
      return;
    }

    actual.movido = true;
    ignorarClic.current = true;
    clearTimeout(pulsacionLarga.current);
    setFrase(null);

    const { minX, maxX, minY, maxY } = limites();

    setArrastre({
      x: entre(actual.origen.x + dx, minX, maxX),
      y: entre(actual.origen.y + dy, minY, maxY),
    });
  }

  function alSoltar() {
    const actual = gesto.current;

    clearTimeout(pulsacionLarga.current);
    gesto.current = null;

    if (actual === null || !actual.movido || arrastre === null) {
      setArrastre(null);
      return;
    }

    const ladoNuevo: Lado =
      arrastre.x + limites().lado / 2 < window.innerWidth / 2 ? 'izquierda' : 'derecha';
    const { minY, maxY } = limites(ladoNuevo);

    moverA({
      lado: ladoNuevo,
      y: maxY === minY ? 0 : entre((arrastre.y - minY) / (maxY - minY), 0, 1),
    });
    setArrastre(null);
  }

  function alPulsarTecla(evento: KeyboardEvent<HTMLButtonElement>) {
    const { minY, maxY } = limites(posicion.lado);
    const paso = maxY === minY ? 0 : PASO_DE_TECLADO / (maxY - minY);
    const cambios: Partial<Record<string, Posicion>> = {
      ArrowUp: { ...posicion, y: entre(posicion.y - paso, 0, 1) },
      ArrowDown: { ...posicion, y: entre(posicion.y + paso, 0, 1) },
      ArrowLeft: { ...posicion, lado: 'izquierda' },
      ArrowRight: { ...posicion, lado: 'derecha' },
    };
    const nueva = cambios[evento.key];

    if (nueva !== undefined) {
      evento.preventDefault();
      moverA(nueva);
    }
  }

  function alPulsar() {
    // Un arrastre termina con un clic que no es un toque.
    if (ignorarClic.current) {
      ignorarClic.current = false;
      return;
    }

    decirFrase();
  }

  const { lado } = limites();
  const marco = marcoDelAsistente(
    window.innerWidth,
    window.innerHeight,
    window.matchMedia(ES_MOVIL).matches,
    lado,
  );
  const punto = conAsistente ? puntoDeLaMascota(marco, lado) : (arrastre ?? aPixeles(posicion));
  const globoArriba = punto.y > 220;
  const estiloDelGlobo: CSSProperties = {
    ...(posicion.lado === 'izquierda' ? { left: MARGEN } : { right: MARGEN }),
    ...(globoArriba ? { bottom: window.innerHeight - punto.y + 8 } : { top: punto.y + lado + 8 }),
  };

  // Con VSD IA abierto va encima del asistente, posada en su esquina; ni se
  // aparta al escribir en el chat ni se encoge.
  const clases = [
    'mascota',
    conAsistente ? 'mascota--con-asistente' : '',
    escribiendo && !conAsistente ? 'mascota--apartada' : '',
    desplazando && !conAsistente ? 'mascota--encogida' : '',
    arrastre === null ? '' : 'mascota--arrastrando',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      {conAsistente && (
        <Asistente
          marco={marco}
          ladoDeLaMascota={lado}
          nombreDeLaMascota={nombre}
          alCerrar={cerrarAsistente}
        />
      )}

      <div
        className={clases}
        data-personaje={seDibujaLaPropia ? FORMA_DE_LA_MASCOTA_PROPIA : personaje}
        data-expresion={expresion}
      >
        <motion.div
          className="mascota__cuerpo"
          style={{ width: lado, height: lado }}
          initial={false}
          animate={{ x: punto.x, y: punto.y }}
          transition={
            arrastre !== null || sinMovimiento
              ? { duration: 0 }
              : { type: 'spring', stiffness: 380, damping: 32 }
          }
          // Mientras acompana al asistente es solo un dibujo.
          aria-hidden={conAsistente || undefined}
        >
          <button
            ref={boton}
            type="button"
            className="mascota__boton"
            tabIndex={conAsistente ? -1 : undefined}
            aria-label={`${nombre}, tu mascota`}
            aria-describedby={idDeInstrucciones}
            onPointerDown={alPresionar}
            onPointerMove={alMover}
            onPointerUp={alSoltar}
            onPointerCancel={alSoltar}
            onKeyDown={alPulsarTecla}
            onClick={alPulsar}
            onContextMenu={(evento) => evento.preventDefault()}
          >
            <motion.img
              className={`mascota__dibujo${esperandoLaPropia ? ' mascota__dibujo--esperando' : ''}`}
              src={seDibujaLaPropia ? dibujoPropio.url : sprite(personaje, expresion)}
              alt=""
              draggable={false}
              animate={animacion(expresion, sinMovimiento, seDibujaLaPropia)}
              {...(sinMovimiento ? {} : { whileTap: { scale: 0.92 } })}
            />
          </button>

          {/* Una mascota propia no puede cerrar los ojos: duerme con unas «z». */}
          {seDibujaLaPropia && expresion === 'dormida' && (
            <span className="mascota__sueno" aria-hidden="true">
              z z
            </span>
          )}
        </motion.div>

        <span id={idDeInstrucciones} className="solo-lectores">
          Tócala para leer una frase; desde la frase puedes hablar con VSD IA. Arrástrala, o usa las
          flechas, para moverla.
        </span>

        {/* Siempre montada: una region viva que aparece ya llena no siempre se
          anuncia. Con aria-live y sin role="status", para no confundirse con
          los avisos de la pantalla. */}
        <p className="solo-lectores" aria-live="polite">
          {frase === null ? '' : `${nombre}: ${frase}`}
        </p>

        {frase !== null && (
          <div className="mascota__globo" style={estiloDelGlobo}>
            <button
              type="button"
              className="mascota__cerrar"
              aria-label="Cerrar la frase"
              onClick={() => setFrase(null)}
            >
              ×
            </button>
            <p className="mascota__quien">{nombre} te acompaña</p>
            <p className="mascota__frase">{frase}</p>
            <button type="button" className="mascota__hablar" onClick={abrirAsistente}>
              Hablar con VSD IA
            </button>
          </div>
        )}
      </div>
    </>
  );
}
