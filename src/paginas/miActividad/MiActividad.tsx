import { useId, useMemo, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';

import { EstadoDeCarga } from '../../componentes/EstadoDeCarga.tsx';
import { EstadoVacio } from '../../componentes/EstadoVacio.tsx';
import { PantallaDeCarga } from '../../componentes/PantallaDeCarga.tsx';
import { ID_DEL_CONTENIDO } from '../../componentes/SaltoAlContenido.tsx';
import { DatosDeHace } from '../../conexion/DatosDeHace.tsx';
import '../../estilos/aplicacion.css';
import '../../estilos/miActividad.css';
import type { ProgresoDelModulo } from '../../infraestructura/api/progreso.ts';
import { MascotaFlotante } from '../../mascota/MascotaFlotante.tsx';
import { SemanaDeLaRacha } from '../../racha/SemanaDeLaRacha.tsx';
import { useRacha } from '../../racha/useRacha.ts';
import { RUTAS, rutaDeActividad } from '../../rutas/rutas.ts';
import { Semaforo } from '../../semaforo/Semaforo.tsx';
import { diaDe, horaDe, nombreDelDia } from '../diario/calendarioDelDiario.ts';
import { BarraSuperior, NavegacionInferior } from '../panel/Estructura.tsx';
import { Icono } from '../panel/Icono.tsx';
import { MODULOS, ORDEN } from '../panel/modulos.ts';
import { construirLaRuta } from '../panel/ruta/construirLaRuta.ts';
import { useLecturaDelPanel } from '../panel/useLecturaDelPanel.ts';
import {
  actividadesDeLaSemana,
  diasConActividad,
  esReciente,
  textoDelResumen,
  ultimasActividades,
} from './resumenDeActividad.ts';
import { useActividadReciente } from './useActividadReciente.ts';

/**
 * «Mi actividad» (SCRUM-296): lo que la persona ha hecho, sin calificarlo.
 *
 * Reemplaza a «Progreso» en la navegacion. Junta cuatro cosas: la semana (de la racha), las sesiones
 * de cada modulo (del panel), lo ultimo que se hizo con un enlace para repetirlo (del historial) y un
 * acceso directo a lo que sigue. **Es solo participacion**: dias, actividades y sesiones, nunca un
 * puntaje, un porcentaje ni un juicio.
 *
 * Sin conexion se ve la copia del panel de este equipo y se dice de cuando es (SCRUM-140). El
 * historial no tiene copia: su bloque lo dice con calma y no tapa el resto.
 */

/** Cuantas de las ultimas actividades se ensenan. */
const ULTIMAS_QUE_SE_VEN = 5;

export function MiActividad() {
  const { estado, reintentar } = useLecturaDelPanel();

  return (
    <div className="app">
      <BarraSuperior conSecciones={false} pagina="actividad" />

      <main id={ID_DEL_CONTENIDO} tabIndex={-1} className="app__contenido mi-actividad">
        <header className="mi-actividad__cabecera">
          <p className="app__antetitulo">Tu participación</p>
          <h1 className="app__titulo">Mi actividad</h1>
        </header>

        {estado.fase === 'cargando' && <PantallaDeCarga mensaje="Cargando tu actividad…" enLinea />}

        {estado.fase === 'error' && (
          // `role="alert"` si interrumpe: la persona tiene que enterarse de que algo fallo para poder reintentar.
          <div className="app__aviso app__aviso--fallo" role="alert">
            <p>{estado.mensaje}</p>

            <button type="button" className="app__boton" onClick={reintentar}>
              Reintentar
            </button>
          </div>
        )}

        {/* Sin conexion se ve la copia de este equipo, y se dice de cuando es (SCRUM-140). */}
        {estado.fase === 'listo' && estado.deLaCopia !== null && (
          <DatosDeHace
            guardadoEn={estado.deLaCopia}
            ahora={estado.ahora}
            porEnviar={estado.sinEnviar}
          />
        )}

        {estado.fase === 'listo' && <Resumen progreso={estado.progreso} ahora={estado.ahora} />}
      </main>

      <NavegacionInferior pagina="actividad" />

      {estado.fase === 'listo' && <MascotaFlotante mascota={estado.cuenta.mascota} />}
      <Semaforo />
    </div>
  );
}

function Resumen({ progreso, ahora }: { progreso: readonly ProgresoDelModulo[]; ahora: Date }) {
  const racha = useRacha();
  // Los modulos en el orden del panel, no en el que los haya entregado el servidor. La ruta si usa el
  // orden del servidor, igual que «Recomendado» en el panel.
  const modulos = useMemo(
    () => ORDEN.flatMap((modulo) => progreso.filter((uno) => uno.modulo === modulo)),
    [progreso],
  );
  const { estado: reciente, reintentar } = useActividadReciente(modulos.map((uno) => uno.modulo));
  const ruta = useMemo(() => construirLaRuta(progreso), [progreso]);
  const idDeLaSemana = useId();
  const idDeLasSesiones = useId();
  const idDeLasUltimas = useId();
  const idDeLoQueSigue = useId();

  // Sin la semana de la racha (sin conexion y sin nada recordado) no se sabe cuantos dias fueron: no se
  // dice «ninguno».
  const semana = racha?.semana ?? [];
  const haySemana = semana.length === 7;
  const hechos = reciente.fase === 'listo' ? reciente.hechos : [];
  const ultimas = ultimasActividades(hechos, ULTIMAS_QUE_SE_VEN);
  const ultima = ultimas[0];
  const hoy = diaDe(ahora);
  const siguiente = ruta.siguiente;
  // Los modulos donde se hizo algo hace un momento (SCRUM-311). Sin historial no hay ninguno.
  const modulosConLoReciente = new Set(
    hechos.filter(({ hechaEn }) => esReciente(hechaEn, ahora)).map(({ modulo }) => modulo),
  );

  return (
    <>
      <section className="app__caja mi-actividad__bloque" aria-labelledby={idDeLaSemana}>
        <h2 id={idDeLaSemana} className="perfil__apartado-titulo">
          Esta semana
        </h2>

        {haySemana ? (
          <>
            {/* Hasta que llega el historial no se dice, para que la frase no cambie a mitad de lectura. */}
            {reciente.fase !== 'cargando' && (
              <p className="mi-actividad__resumen">
                {textoDelResumen(
                  diasConActividad(semana),
                  reciente.fase === 'listo' ? actividadesDeLaSemana(semana, hechos) : undefined,
                )}
              </p>
            )}

            {ultima !== undefined && (
              <p className="app__nota">Tu última actividad fue «{ultima.actividad.nombre}».</p>
            )}

            <SemanaDeLaRacha semana={semana} />
          </>
        ) : (
          <p className="app__nota">Tu semana aparece aquí cuando haya conexión.</p>
        )}
      </section>

      <section className="app__caja mi-actividad__bloque" aria-labelledby={idDeLasSesiones}>
        <h2 id={idDeLasSesiones} className="perfil__apartado-titulo">
          Sesiones completadas
        </h2>

        <p className="app__nota">
          Cada día que haces algo de un módulo cuenta como una sesión. Aquí nada se califica.
        </p>

        {modulos.length === 0 ? (
          <EstadoVacio
            titulo="Todavía no tienes módulos"
            texto="Elige dónde enfocarte desde tu panel y aquí verás tus sesiones."
            icono={<Icono nombre="leaf" tamano={22} />}
          />
        ) : (
          <ul className="mi-actividad__modulos" aria-labelledby={idDeLasSesiones}>
            {modulos.map(({ modulo, sesiones }) => {
              const datos = MODULOS[modulo];

              return (
                <li
                  key={modulo}
                  className={
                    modulosConLoReciente.has(modulo)
                      ? 'mi-actividad__modulo mi-actividad__modulo--reciente'
                      : 'mi-actividad__modulo'
                  }
                  style={
                    {
                      '--modulo-fondo': datos.fondo,
                      '--modulo-acento': datos.acento,
                    } as CSSProperties
                  }
                >
                  <span className="mi-actividad__icono" aria-hidden="true">
                    <Icono nombre={datos.icono} tamano={20} />
                  </span>
                  <span className="mi-actividad__modulo-nombre">{datos.titulo}</span>
                  <span className="mi-actividad__modulo-cifra">
                    <span className="mi-actividad__modulo-numero">{sesiones}</span>{' '}
                    {sesiones === 1 ? 'sesión' : 'sesiones'}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="app__caja mi-actividad__bloque" aria-labelledby={idDeLasUltimas}>
        <h2 id={idDeLasUltimas} className="perfil__apartado-titulo">
          Últimas actividades
        </h2>

        {reciente.fase === 'cargando' && (
          <EstadoDeCarga mensaje="Cargando tus últimas actividades…" tarjetas={1} />
        )}

        {reciente.fase === 'error' && (
          <div className="app__aviso app__aviso--fallo" role="alert">
            <p>{reciente.mensaje}</p>

            <button type="button" className="app__boton" onClick={reintentar}>
              Reintentar
            </button>
          </div>
        )}

        {reciente.fase === 'listo' && ultimas.length === 0 && (
          <EstadoVacio
            titulo="Todavía no hay actividades"
            texto="Cuando hagas una, aparece aquí y la puedes repetir cuando quieras."
            icono={<Icono nombre="calendar" tamano={22} />}
          />
        )}

        {ultimas.length > 0 && (
          <ul className="mi-actividad__ultimas" aria-labelledby={idDeLasUltimas}>
            {ultimas.map((hecho) => {
              const datos = MODULOS[hecho.modulo];

              return (
                <li
                  key={hecho.id}
                  className={
                    esReciente(hecho.hechaEn, ahora)
                      ? 'mi-actividad__hecho mi-actividad__hecho--reciente'
                      : 'mi-actividad__hecho'
                  }
                  style={
                    {
                      '--modulo-fondo': datos.fondo,
                      '--modulo-acento': datos.acento,
                    } as CSSProperties
                  }
                >
                  <span className="mi-actividad__icono" aria-hidden="true">
                    <Icono nombre={datos.icono} tamano={20} />
                  </span>

                  <span className="mi-actividad__hecho-texto">
                    <span className="mi-actividad__hecho-nombre">{hecho.actividad.nombre}</span>
                    <span className="mi-actividad__hecho-cuando">
                      <span>{datos.titulo}</span> · <span>{nombreDelDia(hecho.dia, hoy)}</span> ·{' '}
                      <span>{horaDe(hecho.hechaEn)}</span>
                    </span>
                  </span>

                  <Link
                    className="pildora pildora--fantasma mi-actividad__repetir"
                    to={rutaDeActividad(hecho.actividad.id)}
                    aria-label={`Repetir ${hecho.actividad.nombre}`}
                  >
                    Repetir
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mi-actividad__sigue" aria-labelledby={idDeLoQueSigue}>
        {siguiente !== undefined ? (
          <>
            <p className="mi-actividad__sigue-ceja">Lo que sigue en tu día</p>
            <h2 id={idDeLoQueSigue} className="mi-actividad__siguiente-nombre">
              {siguiente.actividad.nombre}
            </h2>
            <p className="mi-actividad__sigue-texto">
              {siguiente.actividad.descripcion ??
                `Lo siguiente de tu plan en ${MODULOS[siguiente.modulo].titulo}.`}
            </p>
            <Link className="pildora pildora--fuerte" to={rutaDeActividad(siguiente.actividad.id)}>
              Continuar mi recorrido
              <Icono nombre="arrow" tamano={16} />
            </Link>
          </>
        ) : (
          <>
            <h2 id={idDeLoQueSigue} className="mi-actividad__siguiente-nombre">
              {ruta.total > 0 ? 'Hoy ya hiciste todo tu plan' : 'Empieza por un módulo'}
            </h2>
            <p className="mi-actividad__sigue-texto">
              {ruta.total > 0
                ? 'Descansar también es cuidarte.'
                : 'Elige dónde quieres enfocarte y aquí te diremos por dónde seguir.'}
            </p>
            <Link className="pildora pildora--fuerte" to={RUTAS.PANEL}>
              Ir a tu panel
              <Icono nombre="arrow" tamano={16} />
            </Link>
          </>
        )}
      </section>
    </>
  );
}
