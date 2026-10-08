import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { ID_DEL_CONTENIDO } from '../../componentes/SaltoAlContenido.tsx';
import '../../estilos/actividad.css';
import '../../estilos/aplicacion.css';
import '../../estilos/diario.css';
import { RUTAS } from '../../rutas/rutas.ts';
import { Semaforo } from '../../semaforo/Semaforo.tsx';
import { AlmacenLleno } from '../../sincronizacion/almacenLocal.ts';
import { SinAlmacenAbierto } from '../../sincronizacion/ciclo.ts';
import { LineasDeAtencion } from '../actividad/LineasDeAtencion.tsx';
import { BarraSuperior } from '../panel/Estructura.tsx';
import { Icono } from '../panel/Icono.tsx';
import { agruparPorDia, ahoraMismo, diaDe, horaDe, nombreDelDia } from './calendarioDelDiario.ts';
import { DocumentoLeido } from './DocumentoLeido.tsx';
import { EditorDelDiario, type LoQueSeEscribio } from './EditorDelDiario.tsx';
import { minutosQueLeQuedan, type OrigenDeLaCopia } from './historial.ts';
import { useDiario, type EntradaDelHistorial, type NovedadDelDiario } from './useDiario.ts';

/** Ver `EditorDeDiagrama.tsx`: solo se descarga al abrir un diagrama. */
const EditorDeDiagrama = lazy(() => import('./EditorDeDiagrama.tsx'));

/** Cada cuanto se recalcula "quedan N min". */
const CADA_MEDIO_MINUTO = 30_000;

const TEXTO_DE_LA_COPIA_POR_LA_HORA =
  'Ya no se podía corregir esa anotación, así que lo que escribiste se guardó como una nueva del mismo día. No se perdió nada.';

/** Lo que se le dice a la persona cuando una correccion se guardo aparte (ADR 0009). */
function textoDeLaNovedad(novedad: NovedadDelDiario): string {
  return novedad.motivo === 'VERSION_DESACTUALIZADA'
    ? 'Corregiste una anotación que se había cambiado desde otro dispositivo. Para no pisar ninguna de las dos, lo que escribiste en este equipo se guardó como una anotación nueva, marcada como copia. No se perdió nada.'
    : TEXTO_DE_LA_COPIA_POR_LA_HORA;
}

/** Lo que se le dice cuando ni siquiera se pudo guardar en este equipo. Lo escrito sigue en el lienzo. */
function explicarElGuardado(error: unknown): string {
  if (error instanceof SinAlmacenAbierto) {
    return 'No pudimos guardar tu anotación en este equipo porque no hay una sesión abierta. Lo que escribiste sigue aquí: entra de nuevo y guárdala.';
  }

  if (error instanceof AlmacenLleno) {
    return 'No hay espacio en este equipo para guardar tu anotación. Lo que escribiste sigue aquí: libera espacio e inténtalo de nuevo.';
  }

  return 'No se pudo guardar tu anotación. Lo que escribiste sigue aquí: inténtalo de nuevo.';
}

/** De donde viene una copia: de cual anotacion y por que no se pudo corregir aquella. */
function textoDelOrigen({ motivo, creadaEnLaOriginal }: OrigenDeLaCopia): string {
  const cual =
    creadaEnLaOriginal === null
      ? 'la anotación original'
      : `la anotación de las ${horaDe(creadaEnLaOriginal)}`;

  return motivo === 'VERSION_DESACTUALIZADA'
    ? `Copia de lo que escribiste en este equipo: ${cual} se había cambiado desde otro dispositivo y no quisimos pisarla.`
    : `Copia de lo que escribiste en este equipo: ${cual} ya no se podía corregir porque pasó su primera hora.`;
}

/**
 * Mi diario (SCRUM-96, SCRUM-139).
 *
 * Arriba, el lienzo para escribir; debajo, el historial por dias con cada
 * anotacion y su hora. Lo que se escribe aparece en el historial al momento, antes de
 * enviarlo, y **sin conexion tambien**: queda guardado en este equipo y se envia solo.
 *
 * Una anotacion se puede corregir durante su primera hora ("Editar · quedan
 * N min"). Si al enviarla el servidor dice que ya no, o que otro dispositivo la cambio,
 * no se pierde nada: se guarda como una anotacion nueva del mismo dia, marcada como
 * copia (ADR 0009).
 */
export function Diario() {
  const diario = useDiario();
  const [ahora, setAhora] = useState(ahoraMismo);
  const [editando, setEditando] = useState<EntradaDelHistorial | undefined>(undefined);
  const [diaParaNueva, setDiaParaNueva] = useState(diario.hoy);
  // Cambiarla vuelve a montar el lienzo vacio.
  const [lienzo, setLienzo] = useState(0);
  const [guardandoAhora, setGuardandoAhora] = useState(false);
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

  function editar(entrada: EntradaDelHistorial) {
    setAviso(null);
    setEditando(entrada);
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
    setGuardandoAhora(true);

    try {
      if (editando === undefined) {
        await diario.escribir(escrito);
        setDiaParaNueva(diario.hoy);
      } else {
        if ((await diario.corregir(editando, escrito)) === 'nueva') {
          setAviso(TEXTO_DE_LA_COPIA_POR_LA_HORA);
        }

        setEditando(undefined);
      }

      // Solo cuando ya esta guardado en este equipo se vacia el lienzo.
      setLienzo((antes) => antes + 1);
    } catch (error) {
      setAviso(explicarElGuardado(error));
    } finally {
      setGuardandoAhora(false);
    }
  }

  function verDiagrama(entrada: EntradaDelHistorial, id: string) {
    const adjunto = entrada.adjuntos.find((uno) => uno.id === id);

    if (adjunto !== undefined) {
      setDiagramaParaVer(adjunto.datos);
    }
  }

  const dias = agruparPorDia(diario.entradas);
  // El reloj de esta pantalla late cada 30 segundos; lo recien escrito puede ser mas nuevo
  // que su ultimo latido, y entonces diria que queda mas de una hora para corregirlo.
  const ahoraVisible = diario.ahora > ahora ? diario.ahora : ahora;

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
            guardando={guardandoAhora}
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

        {diario.novedad !== null && (
          <div className="diario__aviso diario__aviso--novedad" role="status">
            <p>{textoDeLaNovedad(diario.novedad)}</p>
            <button
              type="button"
              className="pildora pildora--fantasma"
              onClick={diario.cerrarNovedad}
            >
              Entendido
            </button>
          </div>
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

          {diario.deLaCopia !== null && (
            <p className="diario__copia-local" role="status">
              Estás viendo lo que tenías guardado en este equipo (
              {nombreDelDia(diaDe(new Date(diario.deLaCopia)), diario.hoy).toLowerCase()} a las{' '}
              {horaDe(diario.deLaCopia)}). Se pone al día solo cuando haya conexión.
            </p>
          )}

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
                    ahora={ahoraVisible}
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
  const minutos = minutosQueLeQuedan(entrada, ahora);

  return (
    <li className={`diario__anotacion diario__anotacion--${entrada.estado}`}>
      <div className="diario__anotacion-cabecera">
        <span className="diario__hora">{horaDe(entrada.creadaEn)}</span>

        {entrada.copia !== undefined && <span className="diario__etiqueta-copia">Copia</span>}

        {entrada.estado === 'guardando' && (
          <span className="diario__estado" role="status">
            Guardando…
          </span>
        )}

        {entrada.estado === 'en_este_equipo' && (
          <span className="diario__estado" role="status">
            Guardada en este equipo · se enviará cuando haya conexión
          </span>
        )}

        {entrada.estado === 'error' && (
          <span className="diario__estado diario__estado--error" role="alert">
            No se pudo enviar. Sigue guardada en este equipo.{' '}
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

      {entrada.copia !== undefined && (
        <p className="diario__origen-de-la-copia">{textoDelOrigen(entrada.copia)}</p>
      )}

      {entrada.titulo !== null && <p className="diario__anotacion-titulo">{entrada.titulo}</p>}

      <DocumentoLeido documento={entrada.contenido} alVerDiagrama={alVerDiagrama} />
    </li>
  );
}
