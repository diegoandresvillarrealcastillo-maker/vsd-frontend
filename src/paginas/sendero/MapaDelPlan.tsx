import { useReducedMotion } from 'framer-motion';
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';

import { alPulsarElFondo } from '../../componentes/alPulsarElFondo.ts';
import { useDialogo } from '../../componentes/useDialogo.ts';
import type { ActividadDeHoy, ProgresoDelModulo } from '../../infraestructura/api/progreso.ts';
import { rutaDeActividad } from '../../rutas/rutas.ts';
import { Icono } from '../panel/Icono.tsx';
import { MODULOS } from '../panel/modulos.ts';
import { Anillo } from './Anillo.tsx';
import { FondoDelMapa } from './FondoDelMapa.tsx';
import { HojaDeHoy } from './HojaDeHoy.tsx';
import { DIAS_DEL_PLAN, filasDelMapa, planDelAnio } from './planDelAnio.ts';

/** Cada cuantos dias hay un hito: ese dia hecho lleva el icono del modulo y no el check. */
const DIAS_POR_HITO = 7;

/**
 * El mapa de los 365 dias de un modulo (SCRUM-293).
 *
 * Es el sendero entero desde el primer dia, no una etapa a la vez: los hechos rellenos del color del
 * modulo, el de hoy mas grande y con un anillo que se llena con lo hecho hoy, y los que faltan
 * punteados, **numerados y sin titulo** (la sesion de cada dia la elige el servidor con lo que la
 * persona va haciendo, asi que no se sabe de antemano). Al abrirse, la vista va sola al dia activo.
 *
 * Los dias hechos se abren para **repetir** lo que se quiera, como en Duolingo: repetir no resta ni
 * suma dias, porque un dia cuenta una sola vez; lo unico que mueve el plan es hacer algo en un dia
 * nuevo.
 *
 * Cada 7.º dia hecho es un hito (SCRUM-310): lleva el icono del modulo y un brillo suave. Lo demas
 * queda quieto: se mueven solo hoy, la meta y los hitos, porque son 365 puntos y animarlos todos
 * pesaria. Detras va un fondo animado del modulo (`FondoDelMapa`), fuera de la ventana que se
 * desplaza.
 *
 * Los colores del modulo los hereda de quien lo pinta (`--modulo-fondo` y `--modulo-acento`).
 */
type Dialogo = { readonly tipo: 'hoy' } | { readonly tipo: 'dia'; readonly dia: number };

/** La meta ya tiene su propio icono: un hito es un dia hecho cualquiera, cada `DIAS_POR_HITO`. */
const esHito = (numero: number, meta: boolean): boolean => !meta && numero % DIAS_POR_HITO === 0;

export function MapaDelPlan({ progreso, titulo }: { progreso: ProgresoDelModulo; titulo: string }) {
  const { hoy, sugeridas = [] } = progreso;
  const hechasHoy = hoy.filter((actividad) => actividad.hecha).length;
  const completoHoy = hoy.length > 0 && hechasHoy === hoy.length;
  const { sesiones } = progreso;
  const plan = useMemo(() => planDelAnio(sesiones, hechasHoy > 0), [sesiones, hechasHoy]);
  // Son 365 filas con su trazo: solo se rehacen si cambia el plan.
  const mapa = useMemo(() => filasDelMapa(plan), [plan]);

  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const ventana = useRef<HTMLDivElement>(null);
  const sinMovimiento = useReducedMotion() ?? false;

  // Al abrir el mapa la vista va al dia activo, con el centro de su punto a media altura de la
  // ventana: nadie tiene que bajar desde el dia 1. Es instantaneo, no se desliza.
  useEffect(() => {
    const elemento = ventana.current;

    if (elemento !== null) {
      elemento.scrollTop = Math.max(0, mapa.yDeHoy - elemento.clientHeight / 2);
    }
    // Solo al llegar: el mapa se monta al desplegar el modulo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mapa">
      <div className="mapa__cabecera">
        <div>
          <p className="sendero__ceja">Tu ruta de 365 días</p>
          {plan.vuelta > 1 && <p className="mapa__vuelta">Vuelta {plan.vuelta} de tu ruta</p>}
        </div>
        <span className="app__contador">
          Día {plan.indiceDeHoy + 1} de {DIAS_DEL_PLAN}
        </span>
      </div>

      <p className="app__nota">
        Aquí ves los {DIAS_DEL_PLAN} días de tu ruta desde el primero. Los días hechos se pueden
        abrir y repetir. Faltar un día no te quita nada.
      </p>

      <button
        type="button"
        className="perfil__secundario sendero__ver-hoy"
        aria-haspopup="dialog"
        onClick={() => setDialogo({ tipo: 'hoy' })}
      >
        Ver lo de hoy
        {hoy.length > 0 && ` · ${hechasHoy} de ${hoy.length}`}
      </button>

      <div className="mapa__escena">
        <FondoDelMapa modulo={progreso.modulo} />

        <div
          ref={ventana}
          className="mapa__ventana"
          role="region"
          aria-label={`Ruta de ${DIAS_DEL_PLAN} días de ${titulo}`}
          // Una region con barra de desplazamiento debe poder recibir el foco para recorrerla con las flechas (WCAG 2.1.1; axe: scrollable-region-focusable).
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
        >
          <div className="sendero__tramo">
            <svg
              className="sendero__traza"
              width="1"
              height={mapa.alto}
              viewBox={`0 0 1 ${mapa.alto}`}
              aria-hidden="true"
              focusable="false"
            >
              <path className="sendero__tramo--pendiente" d={mapa.trazoPendiente} />
              <path className="sendero__tramo--hecho" d={mapa.trazoHecho} />
            </svg>

            <ol className="sendero__puntos" aria-label={`Días de la ruta de ${titulo}`}>
              {mapa.filas.map(({ indice, x, hecha, meta }) => {
                const esHoy = indice === plan.indiceDeHoy;
                const numero = indice + 1;

                return (
                  <li
                    key={indice}
                    className={`sendero__fila${esHoy ? ' sendero__fila--hoy' : ''}`}
                    style={{ '--x': `${x}px` } as CSSProperties}
                  >
                    {esHoy ? (
                      <span className="sendero__envoltura">
                        <Anillo avance={hoy.length === 0 ? 0 : hechasHoy / hoy.length} />
                        <button
                          type="button"
                          className={`sendero__punto sendero__punto--hoy${completoHoy ? ' sendero__punto--completo' : ''}${!plan.hoyCuenta && !sinMovimiento ? ' sendero__punto--respira' : ''}`}
                          aria-haspopup="dialog"
                          aria-label={`Hoy, día ${numero}: ${hechasHoy} de ${hoy.length} actividades hechas. Ver lo que te toca`}
                          onClick={() => setDialogo({ tipo: 'hoy' })}
                        >
                          <Icono nombre={completoHoy ? 'check' : 'play'} tamano={34} />
                        </button>
                        <span className="sendero__etiqueta" aria-hidden="true">
                          Hoy
                        </span>
                      </span>
                    ) : hecha ? (
                      <button
                        type="button"
                        className={`sendero__punto sendero__punto--hecho mapa__punto-hecho${meta ? ' sendero__punto--meta' : ''}${esHito(numero, meta) ? ' sendero__punto--hito' : ''}`}
                        aria-haspopup="dialog"
                        aria-label={`Día ${numero}${meta ? ', la meta del plan' : ''}, hecho. Ver y repetir`}
                        onClick={() => setDialogo({ tipo: 'dia', dia: numero })}
                      >
                        {meta ? (
                          <Icono nombre="sparkles" tamano={30} />
                        ) : esHito(numero, meta) ? (
                          <Icono nombre={MODULOS[progreso.modulo].icono} tamano={30} />
                        ) : (
                          <Icono nombre="check" tamano={26} />
                        )}
                      </button>
                    ) : (
                      <span
                        role="img"
                        className={`sendero__punto sendero__punto--futuro${meta ? ' sendero__punto--meta' : ''}`}
                        aria-label={`Día ${numero}${meta ? ', la meta del plan' : ''}, por hacer`}
                      >
                        {meta ? <Icono nombre="sparkles" tamano={30} /> : numero}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>

      {dialogo?.tipo === 'hoy' && (
        <HojaDeHoy
          modulo={titulo}
          hoy={hoy}
          sugeridas={sugeridas}
          alCerrar={() => setDialogo(null)}
        />
      )}

      {dialogo?.tipo === 'dia' && (
        <HojaDeUnDiaHecho
          dia={dialogo.dia}
          modulo={titulo}
          actividades={[...hoy, ...sugeridas]}
          alCerrar={() => setDialogo(null)}
        />
      )}
    </div>
  );
}

/**
 * Un dia que ya se hizo: no se guarda **que** se hizo cada dia (la API dice cuantos dias hubo, no
 * el detalle), asi que ofrece repetir lo que hay en el modulo. El foco vuelve al punto al cerrar.
 *
 * Lo que dice es lo que de verdad pasa: repetir no cambia los dias hechos, pero si hoy todavia no se
 * hizo nada, lo que se repita cuenta como lo de hoy.
 */
function HojaDeUnDiaHecho({
  dia,
  modulo,
  actividades,
  alCerrar,
}: {
  dia: number;
  modulo: string;
  actividades: readonly ActividadDeHoy[];
  alCerrar: () => void;
}) {
  const idDelTitulo = useId();

  // El foco vuelve al punto que abrio la hoja, que sigue en el mapa. Va antes de `useDialogo`: sus
  // efectos corren en orden, y este tiene que ver el foco antes de que el dialogo lo mueva adentro.
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;

    return () => anterior?.focus?.();
  }, []);

  const caja = useDialogo<HTMLDivElement>(alCerrar);
  // Si hoy ya se hizo algo, esa actividad sale en `hoy` y tambien podria estar en `sugeridas`.
  const unicas = [...new Map(actividades.map((actividad) => [actividad.id, actividad])).values()];

  return (
    <div className="hoja" role="presentation" onClick={alPulsarElFondo(alCerrar)}>
      <div
        ref={caja}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idDelTitulo}
        className="hoja__caja"
      >
        <div className="hoja__cabecera">
          <div>
            <p className="app__antetitulo hoja__modulo">{modulo}</p>
            <h2 id={idDelTitulo} className="app__titulo app__titulo--mediano">
              Día {dia}
            </h2>
          </div>
        </div>

        <p className="app__nota">
          Ya completaste este día. Puedes repetir una actividad cuando quieras y las veces que
          quieras. Si hoy todavía no hiciste nada, lo que repitas contará como lo de hoy; los días
          ya hechos no cambian.
        </p>

        {unicas.length === 0 ? (
          <p className="app__nota">No hay nada para repetir por ahora.</p>
        ) : (
          <ul className="app__actividades">
            {unicas.map((actividad) => (
              <li key={actividad.id} className="fila-actividad">
                <span className="fila-actividad__texto">
                  <span className="fila-actividad__nombre">{actividad.nombre}</span>
                </span>
                <Link
                  className="fila-actividad__otra-vez"
                  to={rutaDeActividad(actividad.id)}
                  aria-label={`Repetir ${actividad.nombre}`}
                >
                  Repetir
                </Link>
              </li>
            ))}
          </ul>
        )}

        <button type="button" className="perfil__secundario hoja__cerrar" onClick={alCerrar}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
