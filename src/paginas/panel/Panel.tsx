import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';

import { PieDeLaApp } from '../../componentes/PieDeLaApp.tsx';
import { ID_DEL_CONTENIDO } from '../../componentes/SaltoAlContenido.tsx';
import '../../estilos/aplicacion.css';
import type { Cuenta, Modulo } from '../../infraestructura/api/cuenta.ts';
import type { ActividadDeHoy, ProgresoDelModulo } from '../../infraestructura/api/progreso.ts';
import { MascotaFlotante } from '../../mascota/MascotaFlotante.tsx';
import { rutaDeActividad, rutaDeModulo } from '../../rutas/rutas.ts';
import { Semaforo } from '../../semaforo/Semaforo.tsx';
import { formatoEn, zonaActual } from '../../tiempo/zonaHoraria.ts';
import { Bienvenida } from './Bienvenida.tsx';
import { Celebracion } from './Celebracion.tsx';
import { BarraSuperior, NavegacionInferior } from './Estructura.tsx';
import { Icono } from './Icono.tsx';
import { MODULOS, ORDEN } from './modulos.ts';
import { DatosDeHace } from '../../conexion/DatosDeHace.tsx';
import { useDatosDelPanel } from './useDatosDelPanel.ts';

/**
 * El dashboard, con el diseño de Figma Make "Aplicación de salud integral"
 * (SCRUM-89).
 *
 * La estructura, los colores y la tipografia son los del diseño. Lo que cambia
 * es de donde salen los datos: **ningun numero esta escrito aqui**. El saludo
 * usa el nombre de la cuenta, el avance de hoy y el de cada modulo salen de
 * `GET /api/progreso`, y el plan diario es lo que el servidor dice que toca.
 *
 * La mascota flota sobre el dashboard (SCRUM-99) y celebra cuando el plan del
 * dia queda completo o se desbloquea un modulo.
 *
 * Lo que el diseño trae y aqui todavia no esta:
 * - VSD IA, que se abre desde la mascota (SCRUM-100).
 * - La etiqueta "Vista de prueba", que era del prototipo.
 */

/** "Viernes, 2 de octubre", en la zona de la persona, como el servidor. */
function hoyEnCastellano(): string {
  const texto = formatoEn(zonaActual(), 'es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function porcentaje(parte: number, total: number): number {
  return total === 0 ? 0 : Math.round((parte / total) * 100);
}

export function Panel() {
  return <VistaDelPanel {...useDatosDelPanel()} />;
}

/**
 * Lo que se pinta, separado de donde salen los datos.
 *
 * Asi la pantalla se puede ver con datos de ejemplo —para compararla con el
 * diseño— sin sesion ni servidor, y el gancho de datos se prueba aparte.
 */
export function VistaDelPanel({
  estado,
  reintentar,
  activarModulo,
  completarBienvenida,
}: ReturnType<typeof useDatosDelPanel>) {
  // Las secciones (Inicio, Explorar, Progreso) solo existen en el dashboard.
  // En la bienvenida, en la carga o en un error, sus enlaces no llevarian a
  // ningun sitio.
  const enDashboard = estado.fase === 'listo' && estado.cuenta.modulosActivos.length > 0;

  return (
    <div className="app">
      <BarraSuperior conSecciones={enDashboard} />

      <main id={ID_DEL_CONTENIDO} tabIndex={-1} className="app__contenido">
        {estado.fase === 'cargando' && (
          // `role="status"` lo anuncia un lector de pantalla sin interrumpir.
          <p className="app__aviso" role="status">
            Cargando tu espacio…
          </p>
        )}

        {estado.fase === 'error' && (
          // `role="alert"` si interrumpe: la persona tiene que enterarse de
          // que algo fallo para poder reintentar.
          <div className="app__aviso app__aviso--fallo" role="alert">
            <p>{estado.mensaje}</p>

            <button type="button" className="app__boton" onClick={reintentar}>
              Reintentar
            </button>
          </div>
        )}

        {/* Una cuenta que todavia no eligio modulos no llega al dashboard:
            primero la bienvenida (SCRUM-90). Se ve una sola vez, porque al
            elegir la lista deja de estar vacia. */}
        {estado.fase === 'listo' && estado.cuenta.modulosActivos.length === 0 && (
          <Bienvenida cuenta={estado.cuenta} alTerminar={completarBienvenida} />
        )}

        {/* Sin conexion se ve la copia de este equipo, y se dice de cuando es (SCRUM-140). */}
        {estado.fase === 'listo' && estado.deLaCopia !== null && (
          <DatosDeHace
            guardadoEn={estado.deLaCopia}
            ahora={estado.ahora}
            porEnviar={estado.sinEnviar}
          />
        )}

        {estado.fase === 'listo' && estado.cuenta.modulosActivos.length > 0 && (
          <Dashboard
            cuenta={estado.cuenta}
            progreso={estado.progreso}
            activarModulo={activarModulo}
          />
        )}

        {/* El aviso de la portada se ve una vez, antes de entrar. Este es el que
            acompana a quien usa la aplicacion a diario (L-03 de la auditoria 360). */}
        <PieDeLaApp />
      </main>

      {enDashboard && <NavegacionInferior />}
    </div>
  );
}

function Dashboard({
  cuenta,
  progreso,
  activarModulo,
}: {
  cuenta: Cuenta;
  progreso: readonly ProgresoDelModulo[];
  activarModulo: (modulo: Modulo) => Promise<void>;
}) {
  // El modulo recien desbloqueado y cuantos tiene ahora, para celebrarlo.
  const [celebracion, setCelebracion] = useState<{ modulo: Modulo; total: number } | null>(null);

  async function activarYCelebrar(modulo: Modulo): Promise<void> {
    await activarModulo(modulo);
    setCelebracion({ modulo, total: cuenta.modulosActivos.length + 1 });
  }

  const porModulo = new Map(progreso.map((uno) => [uno.modulo, uno]));
  const deHoy = progreso.flatMap((uno) =>
    uno.hoy.map((actividad) => ({ modulo: uno.modulo, actividad })),
  );
  const hechas = deHoy.filter(({ actividad }) => actividad.hecha).length;
  const siguiente = deHoy.find(({ actividad }) => !actividad.hecha);
  const planCompleto = deHoy.length > 0 && hechas === deHoy.length;

  return (
    <>
      <section id="inicio" className="app__portada" aria-labelledby="saludo">
        <div>
          <p className="app__fecha">{hoyEnCastellano()}</p>
          <h1 id="saludo" className="app__saludo">
            {cuenta.nombre === undefined ? 'Hola.' : `Hola, ${cuenta.nombre}.`}
            <br />
            <span className="app__saludo-pregunta">¿Por dónde empezamos hoy?</span>
          </h1>
        </div>

        <div className="app__caja app__avance">
          <div className="app__avance-cabecera">
            <span>Tu actividad de hoy</span>
            {deHoy.length > 0 && (
              <span className="app__avance-cifra">{porcentaje(hechas, deHoy.length)}%</span>
            )}
          </div>

          <div
            className="app__barra-progreso"
            role="progressbar"
            aria-label="Actividades de hoy hechas"
            aria-valuemin={0}
            aria-valuemax={deHoy.length}
            aria-valuenow={hechas}
          >
            <div style={{ width: `${porcentaje(hechas, deHoy.length)}%` }} />
          </div>

          <p className="app__nota">
            {deHoy.length === 0
              ? 'Elige un módulo para empezar tu plan de hoy.'
              : `${hechas} de ${deHoy.length} actividades de hoy. Refleja actividades, no una valoración de tu salud.`}
          </p>
        </div>
      </section>

      <section id="programas" className="app__seccion" aria-labelledby="titulo-modulos">
        <div className="app__seccion-cabecera">
          <div>
            <p className="app__antetitulo">Tu espacio de salud</p>
            <h2 id="titulo-modulos" className="app__titulo">
              Elige dónde enfocarte
            </h2>
          </div>
        </div>

        <div className="app__modulos">
          {ORDEN.map((modulo) => {
            const suyo = porModulo.get(modulo);

            return suyo === undefined ? (
              <ModuloPorActivar key={modulo} modulo={modulo} activar={activarYCelebrar} />
            ) : (
              <TarjetaDeModulo key={modulo} progreso={suyo} />
            );
          })}
        </div>
      </section>

      <section id="progreso" className="app__seccion app__plan-y-recomendado">
        <PlanDiario plan={deHoy} />
        <Recomendado siguiente={siguiente} hayPlan={deHoy.length > 0} />
      </section>

      {celebracion !== null && (
        <Celebracion
          modulo={celebracion.modulo}
          total={celebracion.total}
          alCerrar={() => setCelebracion(null)}
        />
      )}

      <MascotaFlotante mascota={cuenta.mascota} celebrar={planCompleto || celebracion !== null} />
      <Semaforo />
    </>
  );
}

/** Un modulo activo. Lleva a su sendero (SCRUM-92). */
function TarjetaDeModulo({ progreso }: { progreso: ProgresoDelModulo }) {
  const datos = MODULOS[progreso.modulo];
  const { etapa } = progreso;
  const avance = porcentaje(etapa.sesionesHechas, etapa.sesionesDeLaEtapa);
  const nombreDeEtapa = `${etapa.esTemporada ? 'Temporada' : 'Etapa'} ${etapa.numero}`;

  return (
    <Link
      to={rutaDeModulo(progreso.modulo)}
      className="tarjeta-modulo"
      style={{ '--modulo-fondo': datos.fondo, '--modulo-acento': datos.acento } as CSSProperties}
    >
      <span className="tarjeta-modulo__arriba">
        <span className="tarjeta-modulo__icono">
          <Icono nombre={datos.icono} tamano={24} />
        </span>
        <span className="tarjeta-modulo__cifra">{avance}%</span>
      </span>

      <span className="tarjeta-modulo__cuerpo">
        <span className="tarjeta-modulo__titulo">{datos.titulo}</span>
        <span className="tarjeta-modulo__texto">{datos.descripcion}</span>

        <span className="tarjeta-modulo__barra" aria-hidden="true">
          <span style={{ width: `${avance}%` }} />
        </span>

        <span className="tarjeta-modulo__pie">
          <span>
            {nombreDeEtapa} · {etapa.sesionesHechas} de {etapa.sesionesDeLaEtapa} sesiones
          </span>
          <Icono nombre="arrow" tamano={16} />
        </span>
      </span>
    </Link>
  );
}

/**
 * Un modulo que la persona no tiene activo.
 *
 * Activarlo es un clic. La celebracion al desbloquearlo llega con SCRUM-90;
 * aqui solo se activa y aparece en su sitio sin recargar.
 */
function ModuloPorActivar({
  modulo,
  activar,
}: {
  modulo: Modulo;
  activar: (modulo: Modulo) => Promise<void>;
}) {
  const datos = MODULOS[modulo];
  const [ocupado, setOcupado] = useState(false);
  const [fallo, setFallo] = useState(false);

  async function alPulsar() {
    setOcupado(true);
    setFallo(false);

    try {
      await activar(modulo);
    } catch {
      setFallo(true);
      setOcupado(false);
    }
  }

  return (
    <div
      className="tarjeta-modulo tarjeta-modulo--por-activar"
      style={{ '--modulo-fondo': datos.fondo, '--modulo-acento': datos.acento } as CSSProperties}
    >
      <span className="tarjeta-modulo__arriba">
        <span className="tarjeta-modulo__icono">
          <Icono nombre={datos.icono} tamano={24} />
        </span>
      </span>

      <span className="tarjeta-modulo__cuerpo">
        <span className="tarjeta-modulo__titulo">{datos.titulo}</span>
        <span className="tarjeta-modulo__texto">{datos.descripcion}</span>

        <button
          type="button"
          className="app__boton tarjeta-modulo__activar"
          onClick={() => void alPulsar()}
          disabled={ocupado}
        >
          <Icono nombre="plus" tamano={16} />
          {ocupado ? 'Añadiendo…' : `Añadir ${datos.titulo}`}
        </button>

        {fallo && (
          <span className="tarjeta-modulo__fallo" role="alert">
            No se pudo añadir. Inténtalo de nuevo.
          </span>
        )}
      </span>
    </div>
  );
}

function PlanDiario({ plan }: { plan: readonly { modulo: Modulo; actividad: ActividadDeHoy }[] }) {
  const hechas = plan.filter(({ actividad }) => actividad.hecha).length;

  return (
    <div className="app__caja app__plan">
      <div className="app__plan-cabecera">
        <div>
          <p className="app__antetitulo">Para hoy</p>
          <h2 className="app__titulo app__titulo--mediano">Tu plan diario</h2>
        </div>

        {plan.length > 0 && (
          <span className="app__contador">
            {hechas} de {plan.length}
          </span>
        )}
      </div>

      {plan.length === 0 ? (
        <p className="app__nota">
          Cuando elijas un módulo, aquí aparecerá lo que te toca cada día.
        </p>
      ) : (
        <ul className="app__actividades">
          {plan.map(({ modulo, actividad }) => (
            <li
              key={actividad.id}
              className={`fila-actividad${actividad.hecha ? ' fila-actividad--hecha' : ''}`}
            >
              <span className="fila-actividad__icono" style={{ background: MODULOS[modulo].fondo }}>
                <Icono nombre={MODULOS[modulo].icono} />
              </span>

              <span className="fila-actividad__texto">
                <span className="fila-actividad__nombre">{actividad.nombre}</span>
                <span className="fila-actividad__meta">
                  {actividad.tipo === undefined ? '' : `${actividad.tipo} · `}
                  {MODULOS[modulo].titulo}
                </span>
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
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * La tarjeta "Recomendado" del diseño, con algo que de verdad toca: la
 * siguiente actividad pendiente de hoy. En el diseño era un texto fijo.
 */
function Recomendado({
  siguiente,
  hayPlan,
}: {
  siguiente: { modulo: Modulo; actividad: ActividadDeHoy } | undefined;
  hayPlan: boolean;
}) {
  return (
    <aside className="app__recomendado" aria-labelledby="titulo-recomendado">
      <span
        className="app__recomendado-adorno app__recomendado-adorno--grande"
        aria-hidden="true"
      />
      <span
        className="app__recomendado-adorno app__recomendado-adorno--pequeno"
        aria-hidden="true"
      />

      <span className="app__recomendado-icono">
        <Icono nombre="moon" />
      </span>

      <p className="app__antetitulo app__antetitulo--salvia">Recomendado</p>

      {siguiente !== undefined ? (
        <>
          <h2 id="titulo-recomendado" className="app__recomendado-titulo">
            {siguiente.actividad.nombre}
          </h2>
          <p className="app__recomendado-texto">
            {siguiente.actividad.descripcion ??
              `Lo siguiente de tu plan en ${MODULOS[siguiente.modulo].titulo}.`}
          </p>
          <Link className="app__recomendado-boton" to={rutaDeActividad(siguiente.actividad.id)}>
            Comenzar
            <Icono nombre="arrow" tamano={16} />
          </Link>
        </>
      ) : hayPlan ? (
        <>
          <h2 id="titulo-recomendado" className="app__recomendado-titulo">
            Hoy ya hiciste todo tu plan
          </h2>
          <p className="app__recomendado-texto">Descansar también es cuidarte.</p>
        </>
      ) : (
        <>
          <h2 id="titulo-recomendado" className="app__recomendado-titulo">
            Empieza por un módulo
          </h2>
          <p className="app__recomendado-texto">
            Elige dónde quieres enfocarte y aquí te diremos por dónde seguir.
          </p>
          <a className="app__recomendado-boton" href="#programas">
            Ver los módulos
            <Icono nombre="arrow" tamano={16} />
          </a>
        </>
      )}
    </aside>
  );
}
