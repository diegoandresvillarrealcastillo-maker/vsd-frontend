import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';

import { Confeti } from '../../../componentes/Confeti.tsx';
import { EstadoVacio } from '../../../componentes/EstadoVacio.tsx';
import '../../../estilos/ruta.css';
import { rutaDeActividad } from '../../../rutas/rutas.ts';
import { nombreDeEtapa } from '../../sendero/etapas.ts';
import { Icono } from '../Icono.tsx';
import { MODULOS } from '../modulos.ts';
import {
  desplazamientoDelNodo,
  type NodoDeLaRuta,
  type RutaDelDia as Ruta,
  type TramoDeLaRuta,
} from './construirLaRuta.ts';
import { desplazamientoParaCentrar } from './desplazamientoDelRecorrido.ts';

/**
 * La geometria del camino. Vive aqui porque el hilo entre dos puntos es un SVG que necesita
 * los numeros; la hoja de estilos los recibe como variables en la propia seccion y no tiene
 * copia que mantener a mano.
 */
const ALTO_DE_FILA = 150;
/** A que altura de la fila queda el centro del punto. */
const CENTRO_DEL_PUNTO = 56;

/**
 * Lo que toca hoy, como un camino (SCRUM-170).
 *
 * Un punto por actividad, agrupados por modulo, que serpentean hacia abajo hasta la meta
 * del dia. El estado de cada uno se entiende **por la forma y el icono**, no solo por el
 * color:
 *
 * - hecha: lleno, con una marca de hecho;
 * - la siguiente: mas grande, con un triangulo de "empezar", un halo y un globo que invita;
 * - pendiente: con el borde del modulo y su icono;
 * - la meta: con un candado hasta que se hace todo, y con una estrella cuando se logra.
 *
 * Nada aqui castiga: no hay vidas, ni rachas que se rompan, ni nada que se pierda por no
 * hacer algo hoy. Las que no se hicieron esperan, sin avisos.
 *
 * **El camino se desplaza dentro de su recuadro** (SCRUM-250): con las actividades del dia mide
 * mas de 1.500 px y alargaba toda la pantalla. El titulo y el contador quedan fuera, siempre a la
 * vista, y al abrir el recuadro se lleva solo hasta la actividad que toca (o hasta la meta, si ya
 * se hizo todo) para que no quede escondida cuando ya hay varias hechas.
 */
export function RutaDelDia({
  ruta,
  nuevas,
}: {
  ruta: Ruta;
  /** Los ids de las actividades que se acaban de hacer, para celebrarlas. */
  nuevas: ReadonlySet<string>;
}) {
  const recorrido = useRef<HTMLDivElement>(null);
  // Cambia cuando la actividad que toca es otra (se hizo una) o cuando se completa el dia.
  const queToca = ruta.tramos
    .flatMap((tramo) => tramo.nodos)
    .find((nodo) => nodo.estado === 'siguiente')?.actividad.id;

  useLayoutEffect(() => {
    const contenedor = recorrido.current;
    const fila = (
      contenedor?.querySelector('.ruta__nodo--siguiente') ??
      contenedor?.querySelector('.ruta__nodo--meta')
    )?.closest<HTMLElement>('.ruta__fila');

    if (contenedor === null || contenedor === undefined || fila === null || fila === undefined) {
      return;
    }

    // Se mide con rectangulos y no con `offsetTop`: no depende de quien sea el padre posicionado.
    // Solo se mueve el recuadro: `scrollIntoView` movia tambien la pagina.
    const filaRect = fila.getBoundingClientRect();
    const recorridoRect = contenedor.getBoundingClientRect();

    contenedor.scrollTop = desplazamientoParaCentrar(
      {
        arriba: filaRect.top - recorridoRect.top + contenedor.scrollTop,
        alto: filaRect.height,
      },
      { alto: contenedor.clientHeight, contenido: contenedor.scrollHeight },
    );
  }, [queToca, ruta.planCompleto]);

  return (
    <section
      className="app__caja ruta"
      aria-labelledby="titulo-ruta"
      style={
        {
          '--ruta-fila': `${String(ALTO_DE_FILA)}px`,
          '--ruta-centro': `${String(CENTRO_DEL_PUNTO)}px`,
        } as CSSProperties
      }
    >
      {/* La ruta entera es muy alta y no cabe junto a la caja de Fungito (SCRUM-201): el
          tutorial senala su cabecera, que siempre esta y siempre es pequena. */}
      <div className="ruta__cabecera" data-tutorial="ruta">
        <div>
          <p className="app__antetitulo">Para hoy</p>
          <h2 id="titulo-ruta" className="app__titulo app__titulo--mediano">
            Tu ruta de hoy
          </h2>
        </div>

        {ruta.total > 0 && (
          <span className="app__contador">
            {ruta.hechas} de {ruta.total}
          </span>
        )}
      </div>

      {ruta.total === 0 ? (
        <EstadoVacio
          titulo="Todavía no hay nada para hoy"
          texto="Cuando elijas un módulo, aquí aparecerá lo que te toca cada día."
          icono={<Icono nombre="activity" tamano={22} />}
        />
      ) : (
        <div className="ruta__recorrido" ref={recorrido}>
          <div className="ruta__camino">
            {ruta.tramos.map((tramo) => (
              <Tramo key={tramo.progreso.modulo} tramo={tramo} nuevas={nuevas} />
            ))}

            <Meta
              lograda={ruta.planCompleto}
              fila={ruta.total}
              // El confeti sale cuando el plan se completa ahora, no al abrir uno ya completo.
              celebrando={ruta.planCompleto && nuevas.size > 0}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function Tramo({ tramo, nuevas }: { tramo: TramoDeLaRuta; nuevas: ReadonlySet<string> }) {
  const datos = MODULOS[tramo.progreso.modulo];
  const { etapa } = tramo.progreso;

  return (
    <div
      className="ruta__tramo"
      style={{ '--modulo-fondo': datos.fondo, '--modulo-acento': datos.acento } as CSSProperties}
    >
      <div className="ruta__unidad">
        <span className="ruta__unidad-icono">
          <Icono nombre={datos.icono} tamano={22} />
        </span>
        <div className="ruta__unidad-texto">
          <h3 className="ruta__unidad-titulo">{datos.titulo}</h3>
          <p className="ruta__unidad-etapa">
            {nombreDeEtapa(etapa)} · {etapa.sesionesHechas} de {etapa.sesionesDeLaEtapa} sesiones
          </p>
        </div>
      </div>

      <ol className="ruta__nodos" aria-label={`Actividades de hoy en ${datos.titulo}`}>
        {tramo.nodos.map((nodo, posicion) => {
          const siguiente = tramo.nodos[posicion + 1];
          const x = desplazamientoDelNodo(nodo.indice);

          return (
            <li
              key={nodo.actividad.id}
              className="ruta__fila"
              data-lado={x > 0 ? 'derecha' : 'izquierda'}
              style={{ '--x': `${String(x)}px`, '--i': nodo.indice } as CSSProperties}
            >
              {siguiente !== undefined && (
                <Hilo
                  desde={x}
                  hasta={desplazamientoDelNodo(siguiente.indice)}
                  hecho={nodo.estado === 'hecha' && siguiente.estado === 'hecha'}
                  hacia={siguiente.estado === 'siguiente'}
                />
              )}

              <Nodo nodo={nodo} nueva={nuevas.has(nodo.actividad.id)} />
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * El trazo entre dos puntos: lleno entre dos hechos, de puntitos en lo que falta. El que lleva
 * a la actividad que toca ahora (`hacia`) tiene los puntitos en marcha, como una senal de por
 * donde seguir.
 */
function Hilo({
  desde,
  hasta,
  hecho,
  hacia,
}: {
  desde: number;
  hasta: number;
  hecho: boolean;
  hacia: boolean;
}) {
  const medio = ALTO_DE_FILA / 2;

  return (
    <svg
      className={`ruta__hilo${hecho ? ' ruta__hilo--hecho' : ''}${hacia ? ' ruta__hilo--hacia' : ''}`}
      width="1"
      height={ALTO_DE_FILA}
      viewBox={`0 0 1 ${String(ALTO_DE_FILA)}`}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={`M${String(desde)} 0C${String(desde)} ${String(medio)} ${String(hasta)} ${String(medio)} ${String(hasta)} ${String(ALTO_DE_FILA)}`}
        fill="none"
      />
    </svg>
  );
}

const ICONO_DEL_ESTADO = { hecha: 'check', siguiente: 'play' } as const;

function Nodo({ nodo, nueva }: { nodo: NodoDeLaRuta; nueva: boolean }) {
  const { actividad, estado } = nodo;
  const icono = estado === 'pendiente' ? MODULOS[nodo.modulo].icono : ICONO_DEL_ESTADO[estado];
  const clase = `ruta__nodo ruta__nodo--${estado}${nueva ? ' ruta__nodo--recien' : ''}`;

  return (
    <span className="ruta__nodo-envoltura">
      {estado === 'siguiente' && (
        <span className="ruta__globo" aria-hidden="true">
          Empezar
        </span>
      )}

      <span className="ruta__punto">
        {estado === 'hecha' ? (
          <>
            {/* Sin tope diario (SCRUM-184): lo ya hecho se puede volver a hacer. El nombre
                dice las dos cosas, el estado y lo que pasa al pulsarlo. */}
            <Link
              className={clase}
              to={rutaDeActividad(actividad.id)}
              aria-label={`Hecha hoy: ${actividad.nombre}. Hacer otra vez`}
            >
              <Icono nombre={icono} tamano={30} />
              <span className="solo-lectores">Hecha hoy</span>
            </Link>
            {nueva && <span className="ruta__destello" aria-hidden="true" />}
          </>
        ) : (
          <Link
            className={clase}
            to={rutaDeActividad(actividad.id)}
            aria-label={`Empezar ${actividad.nombre}`}
          >
            <Icono nombre={icono} tamano={estado === 'siguiente' ? 36 : 28} />
          </Link>
        )}
      </span>

      <span className="ruta__etiqueta">
        <span className="ruta__nombre">{actividad.nombre}</span>
        {estado === 'hecha' && <span className="ruta__sello">Hecha</span>}
      </span>
    </span>
  );
}

/** El final del camino: cerrada hasta que se hace todo lo de hoy. */
function Meta({
  lograda,
  fila,
  celebrando,
}: {
  lograda: boolean;
  fila: number;
  celebrando: boolean;
}) {
  return (
    <div className="ruta__tramo ruta__tramo--meta">
      <ol className="ruta__nodos" aria-label="Meta del día">
        <li
          className="ruta__fila"
          style={
            { '--x': `${String(desplazamientoDelNodo(fila))}px`, '--i': fila } as CSSProperties
          }
        >
          <span className="ruta__nodo-envoltura">
            <span className="ruta__punto">
              <span
                className={`ruta__nodo ruta__nodo--meta${lograda ? ' ruta__nodo--lograda' : ''}`}
              >
                <Icono nombre={lograda ? 'star' : 'lock'} tamano={32} />
                {celebrando && <Confeti />}
              </span>
            </span>

            <span className="ruta__etiqueta">
              <span className="ruta__nombre">{lograda ? '¡Lo lograste hoy!' : 'Meta de hoy'}</span>
              <span className="ruta__sello">
                {lograda ? 'Descansar también es cuidarte' : 'Se abre al terminar tu ruta'}
              </span>
            </span>
          </span>
        </li>
      </ol>

      {/* Se anuncia sin interrumpir: es una buena noticia, no una alerta. Solo existe cuando
          hay algo que anunciar: un aviso vacio siempre presente solo estorba. */}
      {lograda && (
        <p className="solo-lectores" role="status">
          Terminaste tu ruta de hoy.
        </p>
      )}
    </div>
  );
}
