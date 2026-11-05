import { useEffect, useState, type CSSProperties } from 'react';

import type { Modulo } from '../../infraestructura/api/cuenta.ts';
import {
  consultarSesionesPublicadas,
  type SesionPublicada,
} from '../../infraestructura/api/sesionesPublicadas.ts';
import { ALTO_DE_FILA, desplazamiento } from './geometria.ts';
import { PopoverDeActividad } from './PopoverDeActividad.tsx';

type Estado =
  | { readonly tipo: 'cargando' }
  | { readonly tipo: 'error' }
  | { readonly tipo: 'listo'; readonly sesiones: readonly SesionPublicada[] };

/** El arbol usa sesiones publicadas, no dias ficticios ni una fecha de desbloqueo. */
export function ArbolDeSesiones({ modulo }: { modulo: Modulo }) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });
  const [intento, setIntento] = useState(0);
  const [seleccion, setSeleccion] = useState<{
    ancla: HTMLElement;
    sesion: SesionPublicada;
  } | null>(null);

  useEffect(() => {
    const control = new AbortController();
    consultarSesionesPublicadas(modulo, control.signal).then(
      (sesiones) => {
        if (!control.signal.aborted) setEstado({ tipo: 'listo', sesiones });
      },
      () => {
        if (!control.signal.aborted) setEstado({ tipo: 'error' });
      },
    );
    return () => control.abort();
  }, [modulo, intento]);

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
  if (estado.sesiones.length === 0)
    return <p className="app__nota">Aún no hay actividades publicadas en este módulo.</p>;

  const puntos = estado.sesiones.map((_, indice) => ({
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
      <p className="app__nota">Elige cualquier actividad, en el orden que prefieras.</p>
      <div
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
          <ol className="sendero__puntos" aria-label={`Sesiones publicadas de ${modulo}`}>
            {estado.sesiones.map((sesion, indice) => (
              <li
                key={sesion.id}
                className="sendero__fila"
                style={{ '--x': `${desplazamiento(indice)}px` } as CSSProperties}
              >
                <button
                  type="button"
                  className="sendero__punto arbol-sesiones__punto"
                  aria-haspopup="dialog"
                  aria-label={`Actividad ${indice + 1}: ${sesion.titulo}`}
                  onClick={(evento) => setSeleccion({ ancla: evento.currentTarget, sesion })}
                >
                  {indice + 1}
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
      {seleccion !== null && (
        <PopoverDeActividad
          ancla={seleccion.ancla}
          actividad={{
            id: seleccion.sesion.idActividad,
            nombre: seleccion.sesion.titulo,
            hecha: false,
          }}
          idSesion={seleccion.sesion.id}
          alCerrar={() => setSeleccion(null)}
        />
      )}
    </div>
  );
}
