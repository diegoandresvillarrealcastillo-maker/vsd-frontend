import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useRef } from 'react';
import { Link } from 'react-router-dom';

import { alPulsarElFondo } from '../../componentes/alPulsarElFondo.ts';
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
 *
 * **Sin tope diario** (SCRUM-184): lo que ya se hizo hoy se puede volver a hacer («Otra vez»),
 * y si por frecuencia tocan menos de tres el servidor sugiere otras, que van en su propia
 * seccion y **no cuentan** para el «x de y» de hoy.
 */
export function HojaDeHoy({
  modulo,
  hoy,
  sugeridas = [],
  alCerrar,
}: {
  modulo: string;
  hoy: readonly ActividadDeHoy[];
  sugeridas?: readonly ActividadDeHoy[];
  alCerrar: () => void;
}) {
  const sinMovimiento = useReducedMotion() ?? false;
  const idDelTitulo = useId();
  const idDeLasSugeridas = useId();
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
    <div className="hoja" role="presentation" onClick={alPulsarElFondo(alCerrar)}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idDelTitulo}
        className="hoja__caja"
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
            {hoy.map((actividad) => (
              <FilaDeActividad key={actividad.id} actividad={actividad} />
            ))}
          </ul>
        )}

        {sugeridas.length > 0 && (
          <section className="hoja__sugeridas" aria-labelledby={idDeLasSugeridas}>
            <h3 id={idDeLasSugeridas} className="hoja__sugeridas-titulo">
              Si quieres hacer más
            </h3>
            <p className="app__nota">
              Es solo una sugerencia: hoy no te tocan y no cuentan para nada. Hazlas si te apetece.
            </p>
            <ul className="app__actividades">
              {sugeridas.map((actividad) => (
                <FilaDeActividad key={actividad.id} actividad={actividad} />
              ))}
            </ul>
          </section>
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

/**
 * Una actividad de la hoja. Lo que falta se empieza; lo ya hecho hoy **se puede volver a hacer**
 * (SCRUM-184): no hay tope diario, y repetirla no cambia lo que cuenta el dia.
 */
function FilaDeActividad({ actividad }: { actividad: ActividadDeHoy }) {
  const etiqueta = etiquetaDeFrecuencia(actividad.frecuencia);

  return (
    <li className={`fila-actividad${actividad.hecha ? ' fila-actividad--hecha' : ''}`}>
      <span className="fila-actividad__texto">
        <span className="fila-actividad__nombre">{actividad.nombre}</span>
        {(etiqueta !== undefined || actividad.descripcion !== undefined) && (
          <span className="fila-actividad__meta">
            {etiqueta !== undefined && <span className="hoja__frecuencia">{etiqueta}</span>}
            {actividad.descripcion}
          </span>
        )}
      </span>

      {actividad.hecha ? (
        <span className="fila-actividad__acciones">
          <span className="fila-actividad__estado fila-actividad__estado--hecha">
            <Icono nombre="check" tamano={16} />
            <span className="solo-lectores">Hecha hoy</span>
          </span>
          <Link
            className="fila-actividad__otra-vez"
            to={rutaDeActividad(actividad.id)}
            aria-label={`Hacer otra vez ${actividad.nombre}`}
          >
            Otra vez
          </Link>
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
}
