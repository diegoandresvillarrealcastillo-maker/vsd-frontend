import { useReducedMotion } from 'framer-motion';
import { useEffect, useId, useRef, useState } from 'react';

import { Confeti } from '../componentes/Confeti.tsx';
import '../estilos/racha-celebracion.css';
import type { Mascota } from '../infraestructura/api/cuenta.ts';
import type { NivelDeLaLlama, Racha } from '../infraestructura/api/racha.ts';
import { VozDeLaMascota } from '../paginas/actividad/viva/VozDeLaMascota.tsx';
import {
  EstrellaDorada,
  Estallido,
  FuegosArtificiales,
  LluviaDeChispas,
  OrbitaDeChispas,
} from './AdornosDeLaCelebracion.tsx';
import { DibujoDeLaLlama } from './DibujoDeLaLlama.tsx';
import { fraseDeLaRacha, fraseDelHito } from './frasesDeLaRacha.ts';
import { escenaDelHito, nombreDelHito, type EscenaDelHito } from './hitos.ts';
import type { MomentoDeLaRacha } from './momentoDeLaRacha.ts';
import { SemanaDeLaRacha } from './SemanaDeLaRacha.tsx';

/**
 * La celebracion de la racha (SCRUM-243): lo que se ve al terminar la primera actividad del dia.
 *
 * ## La secuencia
 *
 * Un dialogo a pantalla completa que se arma por partes, cada una a su tiempo: el fondo, la llama que
 * se enciende, el contador que sube de un dia menos a los de ahora, la semana que va marcando sus
 * dias, la mascota de la cuenta que entra celebrando con una frase, y el boton «Seguir». **Nada se
 * cierra solo**: quien lee despacio, o con un lector de pantalla, decide cuando seguir.
 *
 * ## Cada hito tiene su escena
 *
 * Las escenas se suman: un dia normal lleva la llama, el contador, la semana y la mascota; los hitos
 * agregan, de a poco, chispas, confeti, una orbita, rayos, un halo, fuegos artificiales, una lluvia de
 * estrellas y, al ano, una estrella dorada. Los colores son los de la llama de la barra.
 *
 * ## Movimiento reducido
 *
 * La misma informacion, quieta: el contador muestra ya el numero final y no hay confeti, chispas,
 * fuegos ni lluvia. Lo que es solo luz (halo, rayos, estrella) se queda, sin girar.
 *
 * ## Dialogo
 *
 * `role="dialog"` modal, nombrado por el titulo; el foco va a «Seguir» y vuelve a donde estaba al
 * cerrar; Escape cierra; Tab no saca el foco (es lo unico que se puede tocar). Mientras esta abierto
 * la pagina de atras no se desplaza.
 */

/** Las escenas de la mas sencilla a la mas rica: cada una suma a la anterior. */
const ORDEN_DE_LAS_ESCENAS = [
  'dia',
  'chispa',
  'semana',
  'dosSemanas',
  'mes',
  'cincuenta',
  'cien',
  'doscientos',
  'ano',
] as const;

type Escena = 'dia' | EscenaDelHito;

/** Cuando, en milisegundos, la mascota da su saltito de celebracion (despues de entrar). */
const LATIDO_DE_LA_MASCOTA_MS = 1_450;

/** Lo que dice la mascota: la del hito, o la del dia segun cuanto falte para el proximo. */
function fraseDeLaCelebracion(momento: MomentoDeLaRacha, racha: Racha): string {
  if (momento.tipo === 'hito') {
    return fraseDelHito(momento.hito);
  }

  const faltan = racha.proximoHito - racha.dias;

  if (racha.dias <= 1) {
    return fraseDeLaRacha('primerDia', { dias: racha.dias });
  }

  if (racha.proximoHito > racha.dias && faltan <= 3) {
    return fraseDeLaRacha('cercaDelHito', { dias: racha.dias, faltan, hito: racha.proximoHito });
  }

  return fraseDeLaRacha('diaNormal', { dias: racha.dias });
}

export function CelebracionDeLaRacha({
  momento,
  racha,
  mascota,
  alCerrar,
}: {
  momento: MomentoDeLaRacha;
  racha: Racha;
  mascota: Mascota | null;
  alCerrar: () => void;
}) {
  const sinMovimiento = useReducedMotion() ?? false;
  const idDelTitulo = useId();
  const boton = useRef<HTMLButtonElement>(null);
  const [latido, setLatido] = useState(0);

  const escena: Escena = momento.tipo === 'hito' ? escenaDelHito(momento.hito) : 'dia';
  const nivelDeLaEscena = ORDEN_DE_LAS_ESCENAS.indexOf(escena);
  const unDia = racha.dias === 1;
  // Con menos de 7 dias la barra muestra un ascua; en la celebracion la llama se enciende.
  const nivelDeLaLlama = Math.max(1, racha.nivel) as Exclude<NivelDeLaLlama, 0>;

  const tituloAccesible =
    momento.tipo === 'hito'
      ? `¡${String(racha.dias)} días! ${nombreDelHito(momento.hito)}`
      : `¡${String(racha.dias)} ${unDia ? 'día seguido' : 'días seguidos'}!`;

  // El foco entra al boton y vuelve a donde estaba; la pagina de atras no se mueve mientras tanto.
  useEffect(() => {
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const desbordeAnterior = document.body.style.overflow;

    // Sin desplazar: en un telefono acostado la celebracion empieza por arriba, y el boton queda pegado abajo.
    boton.current?.focus({ preventScroll: true });
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = desbordeAnterior;

      if (anterior !== null && anterior !== document.body && document.contains(anterior)) {
        anterior.focus();

        return;
      }

      // Lo que tenia el foco ya no existe (el boton «Terminar» se desmonta al terminar): el foco va al
      // titulo de la pantalla, para que no se pierda en el cuerpo de la pagina.
      const titulo = document.querySelector<HTMLElement>('h1');

      if (titulo !== null) {
        titulo.tabIndex = -1;
        titulo.focus({ preventScroll: true });
      }
    };
  }, []);

  useEffect(() => {
    function alPulsarTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        alCerrar();
      } else if (evento.key === 'Tab') {
        // El boton es lo unico que se puede tocar: el foco no se va a la pagina de atras.
        evento.preventDefault();
        boton.current?.focus();
      }
    }

    document.addEventListener('keydown', alPulsarTecla);

    return () => {
      document.removeEventListener('keydown', alPulsarTecla);
    };
  }, [alCerrar]);

  // La mascota da su saltito cuando ya entro.
  useEffect(() => {
    const temporizador = setTimeout(() => setLatido(1), LATIDO_DE_LA_MASCOTA_MS);

    return () => {
      clearTimeout(temporizador);
    };
  }, []);

  return (
    <div
      className={`racha-celebracion racha-celebracion--${escena}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={idDelTitulo}
      data-escena={escena}
    >
      <span className="racha-celebracion__fondo" aria-hidden="true" />

      {nivelDeLaEscena >= 4 && <span className="racha-celebracion__rayos" aria-hidden="true" />}
      {nivelDeLaEscena >= 6 && !sinMovimiento && <FuegosArtificiales />}
      {nivelDeLaEscena >= 7 && !sinMovimiento && <LluviaDeChispas />}

      <div className={`racha-celebracion__tarjeta llama--nivel-${String(nivelDeLaLlama)}`}>
        <p className="racha-celebracion__etiqueta">
          {momento.tipo === 'hito' ? nombreDelHito(momento.hito) : 'Racha del día'}
        </p>

        <div className="racha-celebracion__llama">
          <span className="racha-celebracion__aura" aria-hidden="true" />
          {nivelDeLaEscena >= 8 && <EstrellaDorada />}
          {nivelDeLaEscena >= 3 && !sinMovimiento && <OrbitaDeChispas />}

          <div className={`racha-celebracion__fuego llama--nivel-${String(nivelDeLaLlama)}`}>
            <DibujoDeLaLlama nivel={nivelDeLaLlama} enDescanso={false} tamano={132} />
          </div>

          {nivelDeLaEscena >= 1 && !sinMovimiento && <Estallido cantidad={16} retraso={0.5} />}
          {nivelDeLaEscena >= 2 && <Confeti />}
        </div>

        <h2 id={idDelTitulo} className="racha-celebracion__titulo">
          <span className="racha-celebracion__cifra" aria-hidden="true">
            {!sinMovimiento && (
              <span className="racha-celebracion__cifra-vieja">{racha.dias - 1}</span>
            )}
            <span className="racha-celebracion__cifra-nueva">{racha.dias}</span>
          </span>
          <span className="racha-celebracion__unidad" aria-hidden="true">
            {unDia ? 'día seguido' : 'días seguidos'}
          </span>
          <span className="solo-lectores">{tituloAccesible}</span>
        </h2>

        <SemanaDeLaRacha semana={racha.semana} intensa={nivelDeLaEscena >= 2} retraso={1} />

        <div className="racha-celebracion__voz">
          {nivelDeLaEscena >= 5 && <span className="racha-celebracion__halo" aria-hidden="true" />}
          <VozDeLaMascota
            mascota={mascota}
            mensaje={fraseDeLaCelebracion(momento, racha)}
            expresion="celebrando"
            latido={latido}
            resultado="acierto"
          />
        </div>

        <button
          ref={boton}
          type="button"
          className="pildora racha-celebracion__seguir"
          onClick={alCerrar}
        >
          Seguir
        </button>
      </div>
    </div>
  );
}
