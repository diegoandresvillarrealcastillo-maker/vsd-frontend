import { useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ID_DEL_CONTENIDO } from '../../componentes/SaltoAlContenido.tsx';
import '../../estilos/aplicacion.css';
import type { Modulo } from '../../infraestructura/api/cuenta.ts';
import type { ProgresoDelModulo } from '../../infraestructura/api/progreso.ts';
import { RUTAS } from '../../rutas/rutas.ts';
import { BarraSuperior } from '../panel/Estructura.tsx';
import { Icono } from '../panel/Icono.tsx';
import { MODULOS, ORDEN } from '../panel/modulos.ts';
import { etapaSiguiente, etapasAnteriores, nombreDeEtapa, tramoDeHoy } from './etapas.ts';
import { HojaDeHoy } from './HojaDeHoy.tsx';
import { useSendero } from './useSendero.ts';

/**
 * El sendero de un modulo (SCRUM-92), con el diseño de la propuesta v3.
 *
 * Un punto por sesion de la etapa: los hechos rellenos del color del modulo,
 * el de hoy mas grande y con un anillo que se llena con lo hecho hoy, y los
 * que faltan punteados. El ultimo es la meta de la etapa. Las etapas
 * anteriores van plegadas arriba y la siguiente, bloqueada abajo.
 *
 * Los puntos ya hechos no se pueden abrir: la API dice cuantas sesiones hubo,
 * no que se hizo cada dia. El de hoy si, y abre lo que toca.
 */

/** Alto de cada fila del camino. Tiene que coincidir con la hoja de estilos. */
const ALTO_DE_FILA = 96;
const ALTO_DE_FILA_DE_HOY = 132;

/** Desplazamiento lateral de cada punto, para que el camino serpentee. */
function desplazamiento(indice: number): number {
  return Math.round(Math.sin(indice * 0.9) * 56);
}

function esModulo(valor: string | undefined): valor is Modulo {
  return valor !== undefined && (ORDEN as readonly string[]).includes(valor);
}

export function Sendero() {
  const { modulo } = useParams();

  return (
    <div className="app">
      <BarraSuperior conSecciones={false} />

      <main id={ID_DEL_CONTENIDO} tabIndex={-1} className="app__contenido sendero">
        <Link to={RUTAS.PANEL} className="perfil__volver">
          <span className="perfil__volver-flecha" aria-hidden="true">
            <Icono nombre="arrow" tamano={16} />
          </span>
          Volver a tu panel
        </Link>

        {esModulo(modulo) ? (
          <SenderoDe modulo={modulo} />
        ) : (
          <p className="app__aviso" role="alert">
            Ese módulo no existe. Vuelve a tu panel para elegir uno.
          </p>
        )}
      </main>
    </div>
  );
}

function SenderoDe({ modulo }: { modulo: Modulo }) {
  return <VistaDelSendero modulo={modulo} {...useSendero(modulo)} />;
}

/**
 * Lo que se pinta, separado de donde salen los datos, como en el panel: asi
 * se puede ver con datos de ejemplo sin sesion ni servidor.
 */
export function VistaDelSendero({
  modulo,
  estado,
  reintentar,
}: { modulo: Modulo } & ReturnType<typeof useSendero>) {
  const datos = MODULOS[modulo];

  return (
    <div
      className="sendero__cuerpo"
      style={{ '--modulo-fondo': datos.fondo, '--modulo-acento': datos.acento } as CSSProperties}
    >
      <div className="sendero__cabecera">
        <span className="tarjeta-modulo__icono">
          <Icono nombre={datos.icono} tamano={24} />
        </span>
        <div>
          <p className="app__antetitulo">Tu sendero</p>
          <h1 className="app__titulo perfil__titulo">{datos.titulo}</h1>
        </div>
      </div>

      {estado.fase === 'cargando' && (
        <p className="app__aviso" role="status">
          Cargando tu sendero…
        </p>
      )}

      {estado.fase === 'error' && (
        <div className="app__aviso app__aviso--fallo" role="alert">
          <p>{estado.mensaje}</p>
          <button type="button" className="app__boton" onClick={reintentar}>
            Reintentar
          </button>
        </div>
      )}

      {estado.fase === 'inactivo' && (
        <div className="app__aviso">
          <p>Todavía no tienes {datos.titulo} entre tus módulos.</p>
          <Link className="app__boton" to={RUTAS.PANEL}>
            Añadirlo desde tu panel
          </Link>
        </div>
      )}

      {estado.fase === 'listo' && <Camino progreso={estado.progreso} titulo={datos.titulo} />}
    </div>
  );
}

function Camino({ progreso, titulo }: { progreso: ProgresoDelModulo; titulo: string }) {
  const { hoy } = progreso;
  const hechasHoy = hoy.filter((actividad) => actividad.hecha).length;
  const completoHoy = hoy.length > 0 && hechasHoy === hoy.length;
  const { etapa, indiceDeHoy, hoyCuenta, etapaCompletadaHoy } = tramoDeHoy(
    progreso.sesiones,
    hechasHoy > 0,
  );
  const anteriores = etapasAnteriores(etapa);
  const siguiente = etapaSiguiente(etapa);

  const [hojaAbierta, setHojaAbierta] = useState(false);
  const puntoDeHoy = useRef<HTMLButtonElement>(null);
  const sinMovimiento = useReducedMotion() ?? false;

  // En una etapa larga el punto de hoy puede quedar muy abajo: se acerca al
  // centro al llegar, sin mover el foco.
  useEffect(() => {
    if (indiceDeHoy > 3) {
      puntoDeHoy.current?.scrollIntoView?.({
        block: 'center',
        behavior: sinMovimiento ? 'auto' : 'smooth',
      });
    }
    // Solo al llegar a la pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Todas las filas miden lo mismo menos la de hoy, que es mas alta: el
  // centro de cada una sale de eso, sin medir nada en el navegador.
  const extraDeHoy = ALTO_DE_FILA_DE_HOY - ALTO_DE_FILA;
  const filas = Array.from({ length: etapa.sesionesDeLaEtapa }, (_, indice) => {
    const esHoy = indice === indiceDeHoy;
    const arriba = indice * ALTO_DE_FILA + (indice > indiceDeHoy ? extraDeHoy : 0);

    return {
      indice,
      x: desplazamiento(indice),
      y: arriba + (esHoy ? ALTO_DE_FILA_DE_HOY : ALTO_DE_FILA) / 2,
      hecha: indice < indiceDeHoy || (esHoy && hoyCuenta),
      meta: indice === etapa.sesionesDeLaEtapa - 1,
    };
  });
  const altoDelTramo = etapa.sesionesDeLaEtapa * ALTO_DE_FILA + extraDeHoy;

  return (
    <>
      {anteriores.length > 0 && (
        <details className="sendero__anteriores">
          <summary>
            <span className="sendero__sello" aria-hidden="true">
              <Icono nombre="check" tamano={16} />
            </span>
            <span>
              <strong>
                {anteriores.length === 1
                  ? '1 etapa completada'
                  : `${anteriores.length} etapas completadas`}
              </strong>
              <span className="sendero__resumen">
                {progreso.sesiones} sesiones en {titulo}
              </span>
            </span>
            <span className="sendero__chevron" aria-hidden="true">
              <Icono nombre="arrow" tamano={16} />
            </span>
          </summary>

          <ul className="sendero__lista-anteriores">
            {anteriores.map((anterior) => (
              <li key={nombreDeEtapa(anterior)}>
                <Icono nombre="check" tamano={14} />
                {nombreDeEtapa(anterior)} · {anterior.sesionesDeLaEtapa} sesiones
              </li>
            ))}
          </ul>
        </details>
      )}

      <section className="app__caja sendero__etapa" aria-labelledby="titulo-etapa">
        <div className="sendero__etapa-cabecera">
          <div>
            <p className="sendero__ceja">
              {etapa.esTemporada ? 'Temporada actual' : 'Etapa actual'}
            </p>
            <h2 id="titulo-etapa" className="perfil__apartado-titulo">
              {nombreDeEtapa(etapa)}
            </h2>
          </div>
          <span className="app__contador">
            {etapa.sesionesHechas} de {etapa.sesionesDeLaEtapa} sesiones
          </span>
        </div>

        <p className="app__nota sendero__explicacion">
          Cada día que haces algo de {titulo} cuenta como una sesión. Faltar un día no te quita
          nada.
        </p>

        {/* Lo mismo que pulsar el punto de hoy, pero siempre a la vista: en
            una etapa larga el punto puede quedar lejos. */}
        <button
          type="button"
          className="perfil__secundario sendero__ver-hoy"
          aria-haspopup="dialog"
          onClick={() => setHojaAbierta(true)}
        >
          Ver lo de hoy
          {hoy.length > 0 && ` · ${hechasHoy} de ${hoy.length}`}
        </button>

        <div className="sendero__tramo">
          <Traza puntos={filas} alto={altoDelTramo} />

          <ol className="sendero__puntos" aria-label={`Sesiones de la ${nombreDeEtapa(etapa)}`}>
            {filas.map(({ indice, x, hecha, meta }) => {
              const esHoy = indice === indiceDeHoy;

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
                        ref={puntoDeHoy}
                        type="button"
                        className={`sendero__punto sendero__punto--hoy${completoHoy ? ' sendero__punto--completo' : ''}${!hoyCuenta && !sinMovimiento ? ' sendero__punto--respira' : ''}`}
                        aria-haspopup="dialog"
                        aria-label={`Hoy, sesión ${indice + 1}: ${hechasHoy} de ${hoy.length} actividades hechas. Ver lo que te toca`}
                        onClick={() => setHojaAbierta(true)}
                      >
                        <Icono nombre={completoHoy ? 'check' : 'play'} tamano={28} />
                      </button>
                      <span className="sendero__etiqueta" aria-hidden="true">
                        Hoy
                      </span>
                    </span>
                  ) : (
                    <span
                      role="img"
                      className={`sendero__punto sendero__punto--${hecha ? 'hecho' : 'futuro'}${meta ? ' sendero__punto--meta' : ''}`}
                      aria-label={`Sesión ${indice + 1}${meta ? ', la meta de la etapa' : ''}: ${hecha ? 'hecha' : 'por hacer'}`}
                    >
                      {meta ? (
                        <Icono nombre="sparkles" tamano={24} />
                      ) : hecha ? (
                        <Icono nombre="check" tamano={22} />
                      ) : (
                        indice + 1
                      )}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <div className="sendero__bloqueada">
        <span className="sendero__candado" aria-hidden="true">
          <Icono nombre="sparkles" tamano={18} />
        </span>
        <div>
          <p className="sendero__bloqueada-titulo">
            {nombreDeEtapa(siguiente)} · {siguiente.sesionesDeLaEtapa} sesiones
          </p>
          <p className="sendero__bloqueada-texto">
            {etapaCompletadaHoy
              ? `Hoy completaste la ${nombreDeEtapa(etapa)}. Mañana empieza la siguiente.`
              : 'Se abre al completar esta etapa.'}
          </p>
        </div>
      </div>

      {hojaAbierta && (
        <HojaDeHoy modulo={titulo} hoy={hoy} alCerrar={() => setHojaAbierta(false)} />
      )}
    </>
  );
}

/**
 * La linea que une los puntos: llena entre dos sesiones hechas y punteada en
 * lo que falta. Se dibuja con las mismas medidas que las filas.
 */
function Traza({
  puntos,
  alto,
}: {
  puntos: readonly { x: number; y: number; hecha: boolean }[];
  alto: number;
}) {
  return (
    <svg
      className="sendero__traza"
      width="1"
      height={alto}
      viewBox={`0 0 1 ${alto}`}
      aria-hidden="true"
      focusable="false"
    >
      {puntos.slice(1).map((destino, indice) => {
        const origen = puntos[indice];

        if (origen === undefined) {
          return null;
        }

        const medio = (origen.y + destino.y) / 2;

        return (
          <path
            key={indice}
            className={
              origen.hecha && destino.hecha ? 'sendero__tramo--hecho' : 'sendero__tramo--pendiente'
            }
            d={`M${origen.x} ${origen.y}C${origen.x} ${medio} ${destino.x} ${medio} ${destino.x} ${destino.y}`}
          />
        );
      })}
    </svg>
  );
}

/** El anillo alrededor del punto de hoy: se llena con lo hecho hoy. */
function Anillo({ avance }: { avance: number }) {
  const radio = 46;
  const circunferencia = 2 * Math.PI * radio;

  return (
    <svg className="sendero__anillo" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <circle className="sendero__anillo-fondo" cx="50" cy="50" r={radio} />
      <circle
        className="sendero__anillo-avance"
        cx="50"
        cy="50"
        r={radio}
        strokeDasharray={circunferencia}
        strokeDashoffset={circunferencia * (1 - avance)}
      />
    </svg>
  );
}
