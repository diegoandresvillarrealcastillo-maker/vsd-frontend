import { useEffect, useId, useRef, useState } from 'react';

import '../estilos/racha.css';
import type { Racha } from '../infraestructura/api/racha.ts';
import { DibujoDeLaLlama } from './DibujoDeLaLlama.tsx';
import { PanelDeLaRacha } from './PanelDeLaRacha.tsx';
import { diasSeguidos } from './textosDeLaRacha.ts';
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
 * dice cuantos dias lleva o que la llama descansa. El panel (`PanelDeLaRacha`, SCRUM-243) muestra el
 * progreso hacia el proximo hito, la semana, los congelamientos y la escalera de hitos con la misma
 * calma, y se abre con un toque (en el movil no hay "pasar el raton"): ahi sube como una hoja desde
 * abajo.
 *
 * La animacion es un parpadeo suave de la llama; con `prefers-reduced-motion` queda quieta, y en
 * descanso nunca se anima.
 */

/** La llama de una racha ya conocida. */
export function LlamaDeRacha({ racha, hora }: { racha: Racha; hora?: number }) {
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
    <div className="llama" ref={contenedor} data-tutorial="llama">
      <button
        ref={boton}
        type="button"
        className={`llama__boton llama--nivel-${String(racha.nivel)}${racha.enDescanso ? ' llama--descanso' : ''}`}
        aria-label={nombre}
        aria-expanded={abierta}
        aria-controls={idDelPanel}
        onClick={() => setAbierta((antes) => !antes)}
      >
        <DibujoDeLaLlama nivel={racha.nivel} enDescanso={racha.enDescanso} />
        {!racha.enDescanso && (
          <span className="llama__dias" aria-hidden="true">
            {racha.dias}
          </span>
        )}
      </button>

      {abierta && (
        <>
          {/* En un telefono el panel es una hoja desde abajo y esto la oscurece de fondo; tocarlo la cierra. */}
          <div
            className="llama__velo"
            aria-hidden="true"
            onClick={() => {
              setAbierta(false);
            }}
          />
          <PanelDeLaRacha id={idDelPanel} racha={racha} {...(hora === undefined ? {} : { hora })} />
        </>
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
