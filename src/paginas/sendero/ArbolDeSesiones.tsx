import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useReducedMotion } from 'framer-motion';

import '../../estilos/arbolVivo.css';
import type { Modulo } from '../../infraestructura/api/cuenta.ts';
import { FondoVivo } from '../actividad/viva/FondoVivo.tsx';
import {
  consultarSesionesPublicadas,
  consultarSesionesHechas,
  type SesionPublicada,
} from '../../infraestructura/api/sesionesPublicadas.ts';
import { ALTO_DE_FILA, desplazamiento } from './geometria.ts';
import { PopoverDeActividad } from './PopoverDeActividad.tsx';
import { ordenarActividadesParaPersona } from './ordenPersonalDeSesiones.ts';

type Estado =
  | { readonly tipo: 'cargando' }
  | { readonly tipo: 'error' }
  | {
      readonly tipo: 'listo';
      readonly sesiones: readonly SesionPublicada[];
      readonly hechas: ReadonlySet<string>;
    };

/** El arbol usa sesiones publicadas, no dias ficticios ni una fecha de desbloqueo. */
export function ArbolDeSesiones({
  modulo,
  diasHechos = 0,
  personaId = 'perfil-local',
}: {
  modulo: Modulo;
  diasHechos?: number;
  personaId?: string;
}) {
  const sinMovimiento = useReducedMotion();
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });
  const [intento, setIntento] = useState(0);
  const ventana = useRef<HTMLDivElement>(null);
  const [seleccion, setSeleccion] = useState<{
    ancla: HTMLElement;
    sesion: SesionPublicada;
  } | null>(null);

  useEffect(() => {
    const control = new AbortController();
    Promise.all([
      consultarSesionesPublicadas(modulo, control.signal),
      consultarSesionesHechas(modulo, control.signal),
    ]).then(
      ([sesiones, hechas]) => {
        if (!control.signal.aborted)
          setEstado({ tipo: 'listo', sesiones, hechas: new Set(hechas) });
      },
      () => {
        if (!control.signal.aborted) setEstado({ tipo: 'error' });
      },
    );
    return () => control.abort();
  }, [modulo, intento]);

  const grupos = useMemo(() => estado.tipo === 'listo'
    ? ordenarActividadesParaPersona(estado.sesiones, personaId, modulo)
    : [], [estado, modulo, personaId]);
  const idsHechosPorActividad = useMemo(() => {
    const hechos = new Set<string>();
    if (estado.tipo === 'listo') {
      for (const grupo of grupos) {
        if (grupo.sesiones.some((sesion) => estado.hechas.has(sesion.id))) hechos.add(grupo.idActividad);
      }
    }
    return hechos;
  }, [estado, grupos]);

  const indiceDeHoy =
    estado.tipo === 'listo'
      ? Math.min(Math.max(0, Math.floor(diasHechos)), Math.max(0, grupos.length - 1))
      : 0;

  useEffect(() => {
    if (estado.tipo !== 'listo') return;
    const ventanaActual = ventana.current;
    if (ventanaActual !== null) {
      ventanaActual.scrollTop = Math.max(
        0,
        (indiceDeHoy + 0.5) * ALTO_DE_FILA - ventanaActual.clientHeight / 2,
      );
    }
  }, [estado, indiceDeHoy]);

  if (estado.tipo === 'cargando') return <p role="status">Cargando actividades…</p>;
  if (estado.tipo === 'error') {
    return (
      <div role="alert">
        <p>No pudimos cargar las actividades.</p>
        <button
          type="button"
          className="perfil__secundario"
          onClick={() => {
            setEstado({ tipo: 'cargando' });
            setIntento((actual) => actual + 1);
          }}
        >
          Reintentar
        </button>
      </div>
    );
  }
  if (grupos.length === 0)
    return <p className="app__nota">Aún no hay actividades publicadas en este módulo.</p>;

  const puntos = grupos.map((_, indice) => ({
    x: desplazamiento(indice),
    y: (indice + 0.5) * ALTO_DE_FILA,
  }));
  const trazo = puntos
    .slice(1)
    .map((destino, indice) => {
      const origen = puntos[indice]!;
      const medio = (origen.y + destino.y) / 2;
      return `M${origen.x} ${origen.y}C${origen.x} ${medio} ${destino.x} ${medio} ${destino.x} ${destino.y}`;
    })
    .join('');

  return (
    <div className="arbol-sesiones">
      <div className="arbol-sesiones__cabecera">
        <p className="app__nota">Día {indiceDeHoy + 1} · Puedes elegir cualquier actividad.</p>
        <button
          type="button"
          className="perfil__secundario"
          onClick={() => {
            const boton = ventana.current?.querySelector<HTMLButtonElement>(
              '[data-dia-activo="true"]',
            );
            boton?.scrollIntoView({
              block: 'center',
              behavior: sinMovimiento ? 'instant' : 'smooth',
            });
            boton?.focus({ preventScroll: true });
          }}
        >
          Ir a mi día
        </button>
      </div>
      <div className="arbol-sesiones__mapa">
        <FondoVivo modulo={modulo} />
        <div
          ref={ventana}
          className="arbol-sesiones__ventana"
          role="region"
          aria-label={`Actividades de ${modulo}`}
          // El contenedor con overflow debe recibir foco para poder desplazarse con teclado.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
        >
          <div className="sendero__tramo">
            <svg
              className="sendero__traza"
              width="1"
              height={puntos.length * ALTO_DE_FILA}
              viewBox={`0 0 1 ${puntos.length * ALTO_DE_FILA}`}
              aria-hidden="true"
              focusable="false"
            >
              <path className="sendero__tramo--pendiente" d={trazo} />
            </svg>
            <ol className="sendero__puntos" aria-label={`Actividades de ${modulo}`}>
              {grupos.map(({ sesion, idActividad }, indice) => (
                <li
                  key={idActividad}
                  className="sendero__fila"
                  style={{ '--x': `${desplazamiento(indice)}px` } as CSSProperties}
                >
                  <span className="arbol-sesiones__nodo">
                    <button
                      type="button"
                      className={`sendero__punto arbol-sesiones__punto${idsHechosPorActividad.has(idActividad) ? ' arbol-sesiones__punto--hecho' : ''}${indice === indiceDeHoy ? ' arbol-sesiones__punto--hoy' : ''}${seleccion?.sesion.id === sesion.id ? ' arbol-sesiones__punto--seleccionado' : ''}`}
                      data-dia-activo={indice === indiceDeHoy}
                      aria-haspopup="dialog"
                      aria-expanded={seleccion?.sesion.id === sesion.id}
                      aria-label={`Actividad ${indice + 1}: ${sesion.actividad}${idsHechosPorActividad.has(idActividad) ? ', completada' : indice === indiceDeHoy ? ', sugerida para hoy' : ''}`}
                      onClick={(evento) => {
                        const punto = evento.currentTarget;
                        if (!sinMovimiento) {
                          // Solo salta el boton pulsado. La envoltura conserva el zigzag y el ancla.
                          punto.getAnimations?.().forEach((animacion) => {
                            if (animacion.id === 'salto-del-arbol') animacion.cancel();
                          });
                          const salto = punto.animate?.(
                            [
                              { transform: 'translateY(0) scale(1)', offset: 0 },
                              { transform: 'translateY(4px) scale(1.08, 0.9)', offset: 0.16 },
                              { transform: 'translateY(-18px) scale(0.96, 1.06)', offset: 0.42 },
                              { transform: 'translateY(2px) scale(1.04, 0.96)', offset: 0.72 },
                              { transform: 'translateY(0) scale(1)', offset: 1 },
                            ],
                            { duration: 560, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' },
                          );
                          if (salto !== undefined) salto.id = 'salto-del-arbol';
                        }
                        setSeleccion({ ancla: punto, sesion });
                      }}
                    >
                      {indice + 1}
                    </button>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
      {seleccion !== null && (
        <PopoverDeActividad
          key={seleccion.sesion.id}
          ancla={seleccion.ancla}
          actividad={{
            id: seleccion.sesion.idActividad,
            nombre: seleccion.sesion.actividad,
            hecha: idsHechosPorActividad.has(seleccion.sesion.idActividad),
          }}
          idSesion={seleccion.sesion.id}
          alCerrar={() => setSeleccion(null)}
        />
      )}
    </div>
  );
}
