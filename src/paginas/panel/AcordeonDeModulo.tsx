import { useId, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';

import type { ProgresoDelModulo } from '../../infraestructura/api/progreso.ts';
import { rutaDeModulo } from '../../rutas/rutas.ts';
import { MapaDelPlan } from '../sendero/MapaDelPlan.tsx';
import { DIAS_DEL_PLAN, planDelAnio } from '../sendero/planDelAnio.ts';
import { Icono } from './Icono.tsx';
import { MODULOS } from './modulos.ts';
import { porcentaje } from './porcentaje.ts';

/**
 * Un modulo activo del panel, como una pestaña que se despliega (SCRUM-293).
 *
 * Cerrado, solo se ve el nombre y en que dia de los 365 va. La ruta con todos sus dias **solo se
 * monta al abrirlo**: son 365 puntos por modulo y no hace falta pintar los de tres a la vez, ni hacer
 * bajar a nadie por una pantalla larguisima para llegar a lo que busca. Al abrirlo, la vista va sola
 * al dia activo (`MapaDelPlan`).
 *
 * El boton es un encabezado: lo abre y lo cierra con teclado como cualquier acordeon. Lo abierto lo
 * decide quien lo usa (solo uno a la vez, y se recuerda el ultimo).
 */
export function AcordeonDeModulo({
  progreso,
  abierto,
  alAlternar,
}: {
  progreso: ProgresoDelModulo;
  abierto: boolean;
  alAlternar: () => void;
}) {
  const datos = MODULOS[progreso.modulo];
  const idDelBoton = useId();
  const idDeLaRuta = useId();
  const plan = planDelAnio(
    progreso.sesiones,
    progreso.hoy.some((actividad) => actividad.hecha),
  );
  const avance = porcentaje(plan.diasHechos, DIAS_DEL_PLAN);

  return (
    <div
      className={`acordeon-modulo${abierto ? ' acordeon-modulo--abierto' : ''}`}
      style={{ '--modulo-fondo': datos.fondo, '--modulo-acento': datos.acento } as CSSProperties}
    >
      <h3 className="acordeon-modulo__encabezado">
        <button
          id={idDelBoton}
          type="button"
          className="acordeon-modulo__boton"
          aria-expanded={abierto}
          aria-controls={idDeLaRuta}
          onClick={alAlternar}
        >
          <span className="tarjeta-modulo__icono">
            <Icono nombre={datos.icono} tamano={24} />
          </span>

          <span className="acordeon-modulo__texto">
            <span className="acordeon-modulo__titulo">{datos.titulo}</span>
            <span className="acordeon-modulo__descripcion">{datos.descripcion}</span>
            <span className="acordeon-modulo__pie">
              Día {plan.indiceDeHoy + 1} de {DIAS_DEL_PLAN} · {avance}%
            </span>
            <span className="tarjeta-modulo__barra" aria-hidden="true">
              <span style={{ width: `${avance}%` }} />
            </span>
          </span>

          <span className="sendero__chevron acordeon-modulo__chevron" aria-hidden="true">
            <Icono nombre="arrow" tamano={16} />
          </span>
        </button>
      </h3>

      <div id={idDeLaRuta} role="region" aria-labelledby={idDelBoton} hidden={!abierto}>
        {abierto && (
          <div className="acordeon-modulo__cuerpo">
            <MapaDelPlan progreso={progreso} titulo={datos.titulo} />

            <Link className="acordeon-modulo__detalle" to={rutaDeModulo(progreso.modulo)}>
              Ver el detalle de {datos.titulo}
              <Icono nombre="arrow" tamano={16} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
