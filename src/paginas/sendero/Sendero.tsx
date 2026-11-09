import { type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';

import { PantallaDeCarga } from '../../componentes/PantallaDeCarga.tsx';
import { ID_DEL_CONTENIDO } from '../../componentes/SaltoAlContenido.tsx';
import '../../estilos/aplicacion.css';
import type { Modulo } from '../../infraestructura/api/cuenta.ts';
import { MascotaFlotante } from '../../mascota/MascotaFlotante.tsx';
import { RUTAS } from '../../rutas/rutas.ts';
import { Semaforo } from '../../semaforo/Semaforo.tsx';
import { BarraSuperior } from '../panel/Estructura.tsx';
import { Icono } from '../panel/Icono.tsx';
import { MODULOS, ORDEN } from '../panel/modulos.ts';
import { ArbolDeSesiones } from './ArbolDeSesiones.tsx';
import { DatosDeHace } from '../../conexion/DatosDeHace.tsx';
import { ahoraMismo, diaDe } from '../diario/calendarioDelDiario.ts';
import { HistorialDelModulo } from './HistorialDelModulo.tsx';
import { useSendero } from './useSendero.ts';
import { useSesion } from '../../sesion/useSesion.ts';

/**
 * Sendero de sesiones publicadas. Cada nodo se puede abrir sin depender del dia.
 */

function esModulo(valor: string | undefined): valor is Modulo {
  return valor !== undefined && (ORDEN as readonly string[]).includes(valor);
}

export function Sendero() {
  const { modulo } = useParams();
  const { sesion } = useSesion();

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
          <SenderoDe modulo={modulo} personaId={sesion?.user.id ?? 'cuenta-local'} />
        ) : (
          <p className="app__aviso" role="alert">
            Ese módulo no existe. Vuelve a tu panel para elegir uno.
          </p>
        )}
      </main>

      <Semaforo />
    </div>
  );
}

function SenderoDe({ modulo, personaId }: { modulo: Modulo; personaId: string }) {
  return <VistaDelSendero modulo={modulo} personaId={personaId} {...useSendero(modulo)} />;
}

/**
 * Lo que se pinta, separado de donde salen los datos, como en el panel: asi
 * se puede ver con datos de ejemplo sin sesion ni servidor.
 */
export function VistaDelSendero({
  modulo,
  personaId = 'perfil-local',
  estado,
  reintentar,
}: { modulo: Modulo; personaId?: string } & ReturnType<typeof useSendero>) {
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

      {estado.fase === 'cargando' && <PantallaDeCarga mensaje="Cargando tu sendero…" enLinea />}

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

      {/* Sin conexion se ve la copia de este equipo, y se dice de cuando es (SCRUM-140). */}
      {estado.fase === 'listo' && estado.deLaCopia !== null && (
        <DatosDeHace
          guardadoEn={estado.deLaCopia}
          ahora={estado.ahora}
          porEnviar={estado.sinEnviar}
        />
      )}

      {estado.fase === 'listo' && (
        <ArbolDeSesiones modulo={modulo} diasHechos={estado.progreso.sesiones} personaId={personaId} />
      )}

      {/* El historial es del servidor y no tiene copia: sin conexion lo dice con calma y no tapa
          el sendero (SCRUM-184). */}
      {estado.fase === 'listo' && (
        <HistorialDelModulo
          key={modulo}
          modulo={modulo}
          titulo={datos.titulo}
          hoy={diaDe(ahoraMismo())}
        />
      )}

      {(estado.fase === 'listo' || estado.fase === 'inactivo') && (
        <MascotaFlotante
          mascota={estado.mascota}
          celebrar={
            estado.fase === 'listo' &&
            estado.progreso.hoy.length > 0 &&
            estado.progreso.hoy.every((actividad) => actividad.hecha)
          }
        />
      )}
    </div>
  );
}
