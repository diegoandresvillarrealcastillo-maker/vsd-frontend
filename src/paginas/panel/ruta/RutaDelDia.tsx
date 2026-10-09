import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';

import { Confeti } from '../../../componentes/Confeti.tsx';
import '../../../estilos/ruta.css';
import { rutaDeActividad } from '../../../rutas/rutas.ts';
import { Icono } from '../Icono.tsx';
import { MODULOS } from '../modulos.ts';
import {
  desplazamientoDelNodo,
  type NodoDeLaRuta,
  type RutaDelDia as Ruta,
  type TramoDeLaRuta,
} from './construirLaRuta.ts';

/** Alto de cada fila del camino. Tiene que coincidir con `--ruta-fila` de la hoja de estilos. */
const ALTO_DE_FILA = 150;
/** A que altura de la fila queda el centro del punto. Igual que `--ruta-centro`. */
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
 */
export function RutaDelDia({
  ruta,
  nuevas,
}: {
  ruta: Ruta;
  /** Los ids de las actividades que se acaban de hacer, para celebrarlas. */
  nuevas: ReadonlySet<string>;
}) {
  const [confetiPuesto, setConfetiPuesto] = useState(true);
  const celebraLaMeta = ruta.planCompleto && nuevas.size > 0 && confetiPuesto;
  const inicios = ruta.tramos.map((_, posicion) =>
    ruta.tramos.slice(0, posicion).reduce((suma, tramo) => suma + tramo.nodos.length, 0),
  );

  return (
    <section className="app__caja ruta" aria-labelledby="titulo-ruta">
      <div className="ruta__cabecera">
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
        <p className="app__nota">
          Cuando elijas un módulo, aquí aparecerá lo que te toca cada día.
        </p>
      ) : (
        <div className="ruta__camino">
          {ruta.tramos.map((tramo, posicion) => (
            <Tramo
              key={tramo.progreso.modulo}
              tramo={tramo}
              inicio={inicios[posicion] ?? 0}
              nuevas={nuevas}
            />
          ))}

          <Meta
            lograda={ruta.planCompleto}
            fila={ruta.total}
            celebrando={celebraLaMeta}
            alTerminarElConfeti={() => setConfetiPuesto(false)}
          />
        </div>
      )}
    </section>
  );
}

function Tramo({
  tramo,
  inicio,
  nuevas,
}: {
  tramo: TramoDeLaRuta;
  inicio: number;
  nuevas: ReadonlySet<string>;
}) {
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
            {etapa.esTemporada ? 'Temporada' : 'Etapa'} {etapa.numero} · {etapa.sesionesHechas} de{' '}
            {etapa.sesionesDeLaEtapa} sesiones
          </p>
        </div>
      </div>

      <ol className="ruta__nodos" aria-label={`Actividades de hoy en ${datos.titulo}`}>
        {tramo.nodos.map((nodo, indice) => {
          const siguiente = tramo.nodos[indice + 1];
          const x = desplazamientoDelNodo(inicio + indice);

          return (
            <li
              key={nodo.actividad.id}
              className="ruta__fila"
              data-lado={x > 0 ? 'derecha' : 'izquierda'}
              style={{ '--x': `${x}px`, '--i': inicio + indice } as CSSProperties}
            >
              {siguiente !== undefined && (
                <Hilo
                  desde={x}
                  hasta={desplazamientoDelNodo(inicio + indice + 1)}
                  hecho={nodo.estado === 'hecha' && siguiente.estado === 'hecha'}
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

/** El trazo entre dos puntos: lleno entre dos hechos, de puntitos en lo que falta. */
function Hilo({ desde, hasta, hecho }: { desde: number; hasta: number; hecho: boolean }) {
  const medio = ALTO_DE_FILA / 2;

  return (
    <svg
      className={`ruta__hilo${hecho ? ' ruta__hilo--hecho' : ''}`}
      width="1"
      height={ALTO_DE_FILA}
      viewBox={`0 0 1 ${ALTO_DE_FILA}`}
      aria-hidden="true"
      focusable="false"
      style={{ top: CENTRO_DEL_PUNTO }}
    >
      <path
        d={`M${desde} 0C${desde} ${medio} ${hasta} ${medio} ${hasta} ${ALTO_DE_FILA}`}
        fill="none"
      />
    </svg>
  );
}

function Nodo({ nodo, nueva }: { nodo: NodoDeLaRuta; nueva: boolean }) {
  const { actividad, estado } = nodo;
  const datos = MODULOS[nodo.modulo];
  const icono = estado === 'hecha' ? 'check' : estado === 'siguiente' ? 'play' : datos.icono;
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
            <span className={clase}>
              <Icono nombre={icono} tamano={30} />
              <span className="solo-lectores">Hecha hoy</span>
            </span>
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
  alTerminarElConfeti,
}: {
  lograda: boolean;
  fila: number;
  celebrando: boolean;
  alTerminarElConfeti: () => void;
}) {
  return (
    <div className="ruta__tramo ruta__tramo--meta">
      <ol className="ruta__nodos" aria-label="Meta del día">
        <li
          className="ruta__fila ruta__fila--meta"
          style={{ '--x': `${desplazamientoDelNodo(fila)}px`, '--i': fila } as CSSProperties}
        >
          <span className="ruta__nodo-envoltura">
            <span className="ruta__punto">
              <span
                className={`ruta__nodo ruta__nodo--meta${lograda ? ' ruta__nodo--lograda' : ''}`}
              >
                <Icono nombre={lograda ? 'star' : 'lock'} tamano={32} />
                {celebrando && <Confeti alTerminar={alTerminarElConfeti} />}
              </span>
            </span>

            <span className="ruta__etiqueta">
              <span className="ruta__nombre">{lograda ? '¡Lo lograste hoy!' : 'Meta de hoy'}</span>
              <span className="ruta__sello ruta__sello--meta">
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
