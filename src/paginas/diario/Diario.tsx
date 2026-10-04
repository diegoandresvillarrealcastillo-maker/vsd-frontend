import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { ID_DEL_CONTENIDO } from '../../componentes/SaltoAlContenido.tsx';
import '../../estilos/actividad.css';
import '../../estilos/aplicacion.css';
import '../../estilos/diario.css';
import type { Anotacion } from '../../infraestructura/api/diario.ts';
import { RUTAS } from '../../rutas/rutas.ts';
import { Semaforo } from '../../semaforo/Semaforo.tsx';
import { LineasDeAtencion } from '../actividad/LineasDeAtencion.tsx';
import { BarraSuperior } from '../panel/Estructura.tsx';
import { Icono } from '../panel/Icono.tsx';
import { explicar } from '../panel/useDatosDelPanel.ts';
import {
  agruparPorDia,
  ahoraMismo,
  horaEnColombia,
  minutosParaEditar,
  nombreDelDia,
} from './calendarioDelDiario.ts';
import { DocumentoLeido } from './DocumentoLeido.tsx';
import { EditorDelDiario, type LoQueSeEscribio } from './EditorDelDiario.tsx';
import { useDiario, type EntradaDelHistorial } from './useDiario.ts';

/** Ver `EditorDeDiagrama.tsx`: solo se descarga al abrir un diagrama. */
const EditorDeDiagrama = lazy(() => import('./EditorDeDiagrama.tsx'));

/** Cada cuanto se recalcula "quedan N min". */
const CADA_MEDIO_MINUTO = 30_000;

/**
 * Mi diario (SCRUM-96).
 *
 * Arriba, el lienzo para escribir; debajo, el historial por dias con cada
 * anotacion y su hora. Lo que se escribe aparece en el historial al momento,
 * antes de que responda el servidor.
 *
 * Una anotacion se puede corregir durante su primera hora ("Editar · quedan
 * N min"). Si al guardar el servidor dice que ya no, no se pierde nada: se
 * guarda como una anotacion nueva del mismo dia (ADR 0009).
 */
export function Diario() {
  const diario = useDiario();
  const [ahora, setAhora] = useState(ahoraMismo);
  const [editando, setEditando] = useState<Anotacion | undefined>(undefined);
  const [diaParaNueva, setDiaParaNueva] = useState(diario.hoy);
  // Cambiarla vuelve a montar el lienzo vacio.
  const [lienzo, setLienzo] = useState(0);
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [diagramaParaVer, setDiagramaParaVer] = useState<Readonly<Record<string, unknown>> | null>(
    null,
  );
  const seccionDelLienzo = useRef<HTMLElement>(null);
  const idDelHistorial = useId();

  useEffect(() => {
    const reloj = setInterval(() => setAhora(ahoraMismo()), CADA_MEDIO_MINUTO);

    return () => {
      clearInterval(reloj);
    };
  }, []);

  function llevarAlLienzo() {
    setLienzo((antes) => antes + 1);
    seccionDelLienzo.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }

  function editar(anotacion: Anotacion) {
    setAviso(null);
    setEditando(anotacion);
    llevarAlLienzo();
  }

  function agregarEn(dia: string) {
    setAviso(null);
    setEditando(undefined);
    setDiaParaNueva(dia);
    llevarAlLienzo();
  }

  async function guardar(escrito: LoQueSeEscribio) {
    setAviso(null);

    if (editando === undefined) {
      diario.escribir(escrito);
      setDiaParaNueva(diario.hoy);
      setLienzo((antes) => antes + 1);

      return;
    }

    setCorrigiendo(true);

    try {
      const como = await diario.corregir(editando, escrito);

      if (como === 'nueva') {
        setAviso(
          'Ya no se podía corregir esa anotación, así que lo que escribiste se guardó como una nueva del mismo día. No se perdió nada.',
        );
      }

      setEditando(undefined);
      setLienzo((antes) => antes + 1);
    } catch (error) {
      setAviso(explicar(error));
    } finally {
      setCorrigiendo(false);
    }
  }

  function verDiagrama(entrada: EntradaDelHistorial, id: string) {
    const adjunto = entrada.adjuntos.find((uno) => uno.id === id);

    if (adjunto !== undefined) {
      setDiagramaParaVer(adjunto.datos);
    }
  }

  const dias = agruparPorDia(diario.entradas);

  return (
    <div className="app">
      <BarraSuperior conSecciones={false} />

      <main id={ID_DEL_CONTENIDO} tabIndex={-1} className="app__contenido diario">
        <Link to={RUTAS.PANEL} className="perfil__volver">
          <span className="perfil__volver-flecha" aria-hidden="true">
            <Icono nombre="arrow" tamano={16} />
          </span>
          Volver a tu panel
        </Link>

        <h1 className="diario__titulo">Mi diario</h1>

        <section ref={seccionDelLienzo} className="diario__lienzo" aria-label="Escribir">
          <EditorDelDiario
            key={`${editando?.id ?? 'nueva'}-${lienzo}`}
            editando={editando}
            diaInicial={diaParaNueva}
            hoy={diario.hoy}
            guardando={corrigiendo}
            alGuardar={(escrito) => void guardar(escrito)}
            alCancelar={
              editando === undefined
                ? undefined
                : () => {
                    setEditando(undefined);
                    setLienzo((antes) => antes + 1);
                  }
            }
          />
        </section>

        {aviso !== null && (
          <p className="diario__aviso" role="status">
            {aviso}
          </p>
        )}

        {diario.lineas !== null && (
          <div className="diario__apoyo">
            <LineasDeAtencion lineas={diario.lineas} />
            <button
              type="button"
              className="pildora pildora--fantasma"
              onClick={diario.cerrarLineas}
            >
              Cerrar
            </button>
          </div>
        )}

        <section className="diario__historial" aria-labelledby={idDelHistorial}>
          <h2 id={idDelHistorial}>Tus días</h2>

          {diario.fase.fase === 'cargando' && <p role="status">Cargando tu diario…</p>}

          {diario.fase.fase === 'error' && (
            <div role="alert">
              <p>{diario.fase.mensaje}</p>
              <button type="button" className="pildora pildora--fantasma" onClick={diario.recargar}>
                Reintentar
              </button>
            </div>
          )}

          {diario.fase.fase === 'listo' && dias.length === 0 && (
            <p className="diario__vacio">
              Todavía no hay nada en tu diario. Lo que escribas arriba aparece aquí.
            </p>
          )}

          {dias.map(({ dia, anotaciones }) => (
            <article key={dia} className="diario__dia">
              <header className="diario__dia-cabecera">
                <h3>{nombreDelDia(dia, diario.hoy)}</h3>
                <button
                  type="button"
                  className="pildora pildora--fantasma"
                  onClick={() => agregarEn(dia)}
                >
                  Agregar anotación
                </button>
              </header>

              <ol className="diario__anotaciones">
                {anotaciones.map((entrada) => (
                  <AnotacionDelHistorial
                    key={entrada.id}
                    entrada={entrada}
                    ahora={ahora}
                    alEditar={() => editar(entrada)}
                    alReintentar={() => diario.reintentar(entrada)}
                    alVerDiagrama={(id) => verDiagrama(entrada, id)}
                  />
                ))}
              </ol>
            </article>
          ))}

          {diario.fase.fase === 'listo' && (
            <button
              type="button"
              className="pildora pildora--fantasma diario__mas"
              onClick={diario.verDiasAnteriores}
            >
              Ver días anteriores
            </button>
          )}
        </section>
      </main>

      <Semaforo />

      {diagramaParaVer !== null && (
        <Suspense
          fallback={
            <p className="diagrama__cargando" role="status">
              Abriendo el diagrama…
            </p>
          }
        >
          <EditorDeDiagrama
            inicial={diagramaParaVer}
            soloLectura
            alTerminar={() => setDiagramaParaVer(null)}
          />
        </Suspense>
      )}
    </div>
  );
}

function AnotacionDelHistorial({
  entrada,
  ahora,
  alEditar,
  alReintentar,
  alVerDiagrama,
}: {
  entrada: EntradaDelHistorial;
  ahora: Date;
  alEditar: () => void;
  alReintentar: () => void;
  alVerDiagrama: (id: string) => void;
}) {
  const minutos =
    entrada.estado === 'guardada' ? minutosParaEditar(entrada.editableHasta, ahora) : 0;

  return (
    <li className={`diario__anotacion diario__anotacion--${entrada.estado}`}>
      <div className="diario__anotacion-cabecera">
        <span className="diario__hora">{horaEnColombia(entrada.creadaEn)}</span>

        {entrada.estado === 'guardando' && (
          <span className="diario__estado" role="status">
            Guardando…
          </span>
        )}

        {entrada.estado === 'error' && (
          <span className="diario__estado diario__estado--error" role="alert">
            No se pudo guardar.{' '}
            <button type="button" className="diario__reintentar" onClick={alReintentar}>
              Reintentar
            </button>
          </span>
        )}

        {minutos > 0 && (
          <button type="button" className="diario__editar" onClick={alEditar}>
            Editar · {minutos === 1 ? 'queda 1 min' : `quedan ${minutos} min`}
          </button>
        )}
      </div>

      {entrada.titulo !== null && <p className="diario__anotacion-titulo">{entrada.titulo}</p>}

      <DocumentoLeido documento={entrada.contenido} alVerDiagrama={alVerDiagrama} />
    </li>
  );
}
