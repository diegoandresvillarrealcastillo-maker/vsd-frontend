import { useEffect, useId, useRef, useState } from 'react';

import '../estilos/racha.css';
import type { NivelDeLaLlama, Racha } from '../infraestructura/api/racha.ts';
import { useRacha } from './useRacha.ts';

/**
 * La llama de la racha (SCRUM-186): cuatro niveles, a la izquierda del indicador de conexion.
 *
 * Un dia suma con al menos una actividad. Si algun dia no hay, tres por mes se cubren solos
 * (ADR 0024 de `vsd-backend`), y al cuarto la llama **descansa**: no se pierde ni se rompe, y
 * vuelve con la siguiente actividad. Por eso aqui no hay un solo texto de perdida, de falta ni
 * de reclamo, y lo vigila una prueba.
 *
 * El dibujo es decorativo (`aria-hidden`): lo que anuncia un lector de pantalla es el boton, que
 * dice cuantos dias lleva o que la llama descansa. El panel explica los congelamientos con la
 * misma calma, y se abre con un toque (en el movil no hay "pasar el raton").
 *
 * La animacion es un parpadeo suave de la llama; con `prefers-reduced-motion` queda quieta, y en
 * descanso nunca se anima.
 */

/** El nombre de cada nivel, para quien lo lee en el panel. */
const NOMBRE_DEL_NIVEL: Record<NivelDeLaLlama, string> = {
  0: 'Ascua',
  1: 'Llama',
  2: 'Llama firme',
  3: 'Hoguera',
  4: 'Estrella',
};

function diasSeguidos(dias: number): string {
  return `${String(dias)} ${dias === 1 ? 'día seguido' : 'días seguidos'}`;
}

/** El dibujo: una llama grande, una interior mas clara y, de los niveles altos, chispas. */
function Dibujo({ nivel, enDescanso }: { nivel: NivelDeLaLlama; enDescanso: boolean }) {
  const id = useId();
  const degradado = `${id}-llama`;

  return (
    <svg className="llama__dibujo" viewBox="0 0 24 26" width="26" height="28" aria-hidden="true">
      <defs>
        <linearGradient id={degradado} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" style={{ stopColor: 'var(--llama-base)' }} />
          <stop offset="0.55" style={{ stopColor: 'var(--llama-media)' }} />
          <stop offset="1" style={{ stopColor: 'var(--llama-punta)' }} />
        </linearGradient>
      </defs>

      <path
        className="llama__cuerpo"
        fill={enDescanso ? 'none' : `url(#${degradado})`}
        d="M12 2.5c.6 3.3-1.6 5-3.3 7.2C7.3 11.5 6.5 13 6.5 15.4a5.5 5.5 0 0 0 11 0c0-2.2-1-3.9-2.1-5.3-.3 1.2-.9 2-1.6 2.4.6-3.2-.2-6.4-1.8-10Z"
      />

      {!enDescanso && (
        <path
          className="llama__corazon"
          d="M12 22a3.1 3.1 0 0 0 3.1-3.1c0-1.6-1.2-2.7-2.2-3.9-.3.9-.8 1.5-1.4 1.8.3-1.6-.2-3-.8-4.2-1.1 1.4-2 3-2 6.3A3.1 3.1 0 0 0 12 22Z"
        />
      )}

      {nivel >= 3 && !enDescanso && (
        <>
          <circle className="llama__chispa llama__chispa--a" cx="5" cy="9" r="1" />
          <circle className="llama__chispa llama__chispa--b" cx="19.5" cy="7" r="0.9" />
        </>
      )}

      {nivel >= 4 && !enDescanso && (
        <path
          className="llama__estrella"
          d="m12 0 .7 1.6 1.6.7-1.6.7L12 4.6l-.7-1.6-1.6-.7 1.6-.7Z"
        />
      )}
    </svg>
  );
}

/** El texto de los congelamientos del mes. */
function textoDeLosCongelamientos(racha: Racha): string {
  const { congelamientosUsados: usados, congelamientosPorMes: porMes } = racha;

  if (usados === 0) {
    return `Cada mes te cubrimos hasta ${String(porMes)} días sin actividad para que tu llama no se corte.`;
  }

  if (usados >= porMes) {
    return `Este mes te cubrimos ${String(usados)} de ${String(porMes)} días sin actividad. El mes que viene vuelven a estar.`;
  }

  return `Este mes te cubrimos ${String(usados)} de ${String(porMes)} días sin actividad. Quedan ${String(porMes - usados)}.`;
}

/** La llama de una racha ya conocida. */
export function LlamaDeRacha({ racha }: { racha: Racha }) {
  const [abierta, setAbierta] = useState(false);
  const idDelPanel = useId();
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!abierta) {
      return undefined;
    }

    function alPulsarFuera(evento: MouseEvent) {
      if (!contenedor.current?.contains(evento.target as Node)) {
        setAbierta(false);
      }
    }

    function alPulsarTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        setAbierta(false);
        // Quien cerro con el teclado sigue ahi.
        boton.current?.focus();
      }
    }

    document.addEventListener('mousedown', alPulsarFuera);
    document.addEventListener('keydown', alPulsarTecla);

    return () => {
      document.removeEventListener('mousedown', alPulsarFuera);
      document.removeEventListener('keydown', alPulsarTecla);
    };
  }, [abierta]);

  const nombre = racha.enDescanso
    ? 'Tu llama descansa. Con tu próxima actividad vuelve a encenderse'
    : `Tu racha: ${diasSeguidos(racha.dias)}`;

  return (
    <div className="llama" ref={contenedor}>
      <button
        ref={boton}
        type="button"
        className={`llama__boton llama--nivel-${String(racha.nivel)}${racha.enDescanso ? ' llama--descanso' : ''}`}
        aria-label={nombre}
        aria-expanded={abierta}
        aria-controls={idDelPanel}
        onClick={() => setAbierta((antes) => !antes)}
      >
        <Dibujo nivel={racha.nivel} enDescanso={racha.enDescanso} />
        {!racha.enDescanso && (
          <span className="llama__dias" aria-hidden="true">
            {racha.dias}
          </span>
        )}
      </button>

      {abierta && (
        <div id={idDelPanel} className="llama__panel" role="status">
          <p className="llama__titulo">
            {racha.enDescanso
              ? 'Tu llama descansa'
              : `${NOMBRE_DEL_NIVEL[racha.nivel]} · ${diasSeguidos(racha.dias)}`}
          </p>
          <p className="llama__texto">
            {racha.enDescanso
              ? 'Con tu próxima actividad vuelve a encenderse, con un día.'
              : racha.hechoHoy
                ? 'Hoy ya sumaste.'
                : 'Una actividad hoy mantiene tu llama.'}
          </p>
          <p className="llama__texto llama__texto--tenue">{textoDeLosCongelamientos(racha)}</p>
        </div>
      )}
    </div>
  );
}

/**
 * La llama de la barra: pide la racha y la pinta cuando llega.
 *
 * Mientras no se sabe —o si no se pudo pedir— **no pinta nada**: la barra no salta ni muestra
 * un cero que no es verdad.
 */
export function LlamaDeLaBarra() {
  const racha = useRacha();

  return racha === null ? null : <LlamaDeRacha racha={racha} />;
}
