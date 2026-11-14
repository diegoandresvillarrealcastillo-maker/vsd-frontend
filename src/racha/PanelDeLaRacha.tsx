import { useState } from 'react';

import '../estilos/racha-panel.css';
import type { Racha } from '../infraestructura/api/racha.ts';
import { useCargarLaMascota } from '../paginas/actividad/viva/useCargarLaMascota.ts';
import { useImagenDeLaMascota } from '../paginas/actividad/viva/useImagenDeLaMascota.ts';
import { horaLocal } from '../tiempo/zonaHoraria.ts';
import { BarraDeProgresoDeLaRacha } from './BarraDeProgresoDeLaRacha.tsx';
import { DibujoDeLaLlama } from './DibujoDeLaLlama.tsx';
import { EscaleraDeHitos } from './EscaleraDeHitos.tsx';
import { fraseDeLaRacha } from './frasesDeLaRacha.ts';
import { hitoAnteriorDe } from './hitos.ts';
import { SemanaDeLaRacha } from './SemanaDeLaRacha.tsx';
import { situacionDeLaRacha } from './situacionDeLaRacha.ts';
import { diasSeguidos, NOMBRE_DEL_NIVEL, textoDeLosCongelamientos } from './textosDeLaRacha.ts';

/**
 * El panel de la llama (SCRUM-243): lo que se abre al tocar la llama de la barra.
 *
 * De arriba abajo: la llama y cuanto lleva, la barra hacia el proximo hito, la semana, la mascota de la
 * cuenta con una frase, **lo que viene** (los proximos hitos, con lo que cambia en cada uno), lo ya
 * logrado en un desplegable, y los congelamientos del mes.
 *
 * Con un servidor que todavia no manda la semana, la escalera ni el proximo hito, esas partes no se
 * pintan y el panel queda como era: la llama, si hoy sumo y los congelamientos.
 *
 * ## Lo que dice la mascota
 *
 * Lo decide `situacionDeLaRacha`: anima con un hito cerca o un dia mas, y solo por la tarde, con hoy
 * sin hacer y una racha de 3 dias o mas, dice lo que esta en juego —con congelamientos, que una
 * actividad evita gastar uno; sin ellos, que la racha esta en juego—. Nunca dice que algo se perdio.
 *
 * Es una region con nombre y no un `status`: abrirla no anuncia todo el panel de golpe, y quien lo
 * lee con un lector de pantalla lo recorre en orden. `hora` es la hora local (0 a 23); sin ella se
 * toma la de ahora, y se fija al abrir.
 */

/** El copo de un congelamiento. */
function Copo() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" />
    </svg>
  );
}

export function PanelDeLaRacha({ id, racha, hora }: { id: string; racha: Racha; hora?: number }) {
  const mascota = useCargarLaMascota();
  const [horaDeAhora] = useState(() => hora ?? horaLocal(new Date()));
  const imagen = useImagenDeLaMascota(mascota, racha.hechoHoy ? 'feliz' : 'normal');

  const porLograr = racha.escalera.filter((hito) => !hito.logrado);
  const logrados = racha.escalera.filter((hito) => hito.logrado);
  const situacion = situacionDeLaRacha(racha, horaDeAhora);
  const frase = fraseDeLaRacha(situacion, {
    dias: racha.dias,
    faltan: racha.proximoHito - racha.dias,
    hito: racha.proximoHito,
  });

  return (
    <div
      id={id}
      className="llama__panel racha-panel"
      role="region"
      aria-label="Tu racha"
      tabIndex={-1}
    >
      <div className="racha-panel__cabecera">
        <span
          className={`racha-panel__llama llama--nivel-${String(racha.nivel)}${racha.enDescanso ? ' llama--descanso' : ''}`}
        >
          <DibujoDeLaLlama nivel={racha.nivel} enDescanso={racha.enDescanso} tamano={44} />
        </span>

        <div className="racha-panel__titulos">
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
        </div>
      </div>

      <BarraDeProgresoDeLaRacha
        dias={racha.dias}
        hitoAnterior={hitoAnteriorDe(racha.escalera)}
        proximoHito={racha.proximoHito}
      />

      <SemanaDeLaRacha semana={racha.semana} />

      <div className="racha-panel__mascota">
        <img src={imagen} alt="" width={64} height={64} draggable={false} />
        <p className="racha-panel__frase" aria-live="polite">
          {frase}
        </p>
      </div>

      {porLograr.length > 0 && (
        <div className="racha-panel__seccion">
          <p className="racha-panel__subtitulo">Lo que viene</p>
          <EscaleraDeHitos escalera={porLograr} nombre="Próximos hitos" destacarElPrimero />
        </div>
      )}

      {logrados.length > 0 && (
        <details className="racha-panel__logrados">
          <summary>{`Ya llegaste a ${String(logrados.length)} ${logrados.length === 1 ? 'hito' : 'hitos'}`}</summary>
          <EscaleraDeHitos escalera={logrados} nombre="Hitos logrados" />
        </details>
      )}

      <div className="racha-panel__seccion">
        <p className="racha-panel__subtitulo">Congelamientos</p>

        <ul className="racha-panel__casillas" aria-label="Congelamientos de este mes">
          {Array.from({ length: racha.congelamientosPorMes }, (_, indice) => {
            const usado = indice < racha.congelamientosUsados;

            return (
              <li
                key={indice}
                className={`racha-panel__casilla racha-panel__casilla--${usado ? 'usada' : 'disponible'}`}
              >
                <span className="racha-panel__copo" aria-hidden="true">
                  <Copo />
                </span>
                <span className="solo-lectores">{`Congelamiento ${String(indice + 1)}: ${usado ? 'usado' : 'disponible'}`}</span>
              </li>
            );
          })}
        </ul>

        <p className="llama__texto llama__texto--tenue">{textoDeLosCongelamientos(racha)}</p>
      </div>
    </div>
  );
}
