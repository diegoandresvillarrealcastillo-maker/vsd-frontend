import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useRef } from 'react';
import { Link } from 'react-router-dom';

import type { ActividadDeHoy } from '../../infraestructura/api/progreso.ts';
import { rutaDeActividad } from '../../rutas/rutas.ts';
import { Icono } from '../panel/Icono.tsx';
import { etiquetaDeFrecuencia } from './frecuencia.ts';

/**
 * Lo que toca hoy en un modulo, al pulsar el punto de hoy del sendero.
 *
 * Es un dialogo como el de la celebracion: el foco entra al abrirse y vuelve
 * al punto al cerrar, se cierra con Escape o pulsando fuera, y sin animacion
 * con `prefers-reduced-motion`. Los colores del modulo los hereda de la
 * pantalla.
 */
export function HojaDeHoy({
  modulo,
  hoy,
  alCerrar,
}: {
  modulo: string;
  hoy: readonly ActividadDeHoy[];
  alCerrar: () => void;
}) {
  const sinMovimiento = useReducedMotion() ?? false;
  const idDelTitulo = useId();
  const boton = useRef<HTMLButtonElement>(null);
  const cerrar = useRef(alCerrar);
  const hechas = hoy.filter((actividad) => actividad.hecha).length;

  useEffect(() => {
    cerrar.current = alCerrar;
  });

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;

    boton.current?.focus();

    function alPulsarTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        cerrar.current();
      }
    }

    document.addEventListener('keydown', alPulsarTecla);

    return () => {
      document.removeEventListener('keydown', alPulsarTecla);
      anterior?.focus?.();
    };
  }, []);

  return (
    <div className="hoja" onClick={alCerrar}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idDelTitulo}
        className="hoja__caja"
        onClick={(evento) => evento.stopPropagation()}
        initial={sinMovimiento ? false : { opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={
          sinMovimiento ? { duration: 0 } : { type: 'spring', stiffness: 340, damping: 30 }
        }
      >
        <div className="hoja__cabecera">
          <div>
            <p className="app__antetitulo hoja__modulo">{modulo}</p>
            <h2 id={idDelTitulo} className="app__titulo app__titulo--mediano">
              Lo de hoy
            </h2>
          </div>

          {hoy.length > 0 && (
            <span className="app__contador">
              {hechas} de {hoy.length}
            </span>
          )}
        </div>

        {hoy.length === 0 ? (
          <p className="app__nota">Hoy no te toca nada en este módulo. Descansar también cuenta.</p>
        ) : (
          <ul className="app__actividades">
            {hoy.map((actividad) => {
              const etiqueta = etiquetaDeFrecuencia(actividad.frecuencia);

              return (
                <li
                  key={actividad.id}
                  className={`fila-actividad${actividad.hecha ? ' fila-actividad--hecha' : ''}`}
                >
                  <span className="fila-actividad__texto">
                    <span className="fila-actividad__nombre">{actividad.nombre}</span>
                    {(etiqueta !== undefined || actividad.descripcion !== undefined) && (
                      <span className="fila-actividad__meta">
                        {etiqueta !== undefined && (
                          <span className="hoja__frecuencia">{etiqueta}</span>
                        )}
                        {actividad.descripcion}
                      </span>
                    )}
                  </span>

                  {actividad.hecha ? (
                    <span className="fila-actividad__estado fila-actividad__estado--hecha">
                      <Icono nombre="check" tamano={16} />
                      <span className="solo-lectores">Hecha hoy</span>
                    </span>
                  ) : (
                    <Link
                      className="fila-actividad__estado"
                      to={rutaDeActividad(actividad.id)}
                      aria-label={`Empezar ${actividad.nombre}`}
                    >
                      <Icono nombre="play" tamano={16} />
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <button
          ref={boton}
          type="button"
          className="perfil__secundario hoja__cerrar"
          onClick={alCerrar}
        >
          Cerrar
        </button>
      </motion.div>
    </div>
  );
}
