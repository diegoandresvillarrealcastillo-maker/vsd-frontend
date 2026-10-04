import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react';

import {
  cambiarHorasDeAviso,
  consultarLasNotificaciones,
  soltarEsteNavegadorDelServidor,
  suscribirEsteNavegador,
  type CambiosDeHoras,
  type EstadoDeLasNotificaciones,
} from '../../infraestructura/api/notificaciones.ts';
import {
  capacidadDelNavegador,
  PermisoNegadoError,
  permisoDeAvisos,
  soltarNavegador,
  suscribirNavegador,
  suscripcionActual,
} from '../../notificaciones/navegador.ts';
import { Icono, type NombreDeIcono } from '../panel/Icono.tsx';
import { MODULOS } from '../panel/modulos.ts';
import { Apartado, MensajeDeAviso, SIN_CONEXION, type Aviso } from './piezas.tsx';

/**
 * Los avisos del perfil (SCRUM-102).
 *
 * Dos cosas distintas, y la pantalla las separa:
 *
 * - **Si este dispositivo los recibe.** Lo decide el navegador, que pide
 *   permiso. Sin permiso todo sigue funcionando. En iPhone solo funciona con
 *   la aplicacion instalada en la pantalla de inicio, y se explica como.
 * - **A que hora llega cada uno.** Es de la cuenta: vale para todos sus
 *   dispositivos. Cada aviso se enciende, cambia de hora y apaga por separado.
 */

type ClaseDeAviso = 'semaforo' | 'racha';

const CLASES: Readonly<
  Record<
    ClaseDeAviso,
    {
      readonly nombre: string;
      readonly explicacion: string;
      readonly icono: NombreDeIcono;
      readonly horaPorDefecto: string;
      readonly campo: keyof CambiosDeHoras;
    }
  >
> = {
  semaforo: {
    nombre: 'Pendientes del semáforo',
    explicacion: 'Cuántos pendientes tienes y cuáles, a la hora que elijas.',
    icono: 'check',
    horaPorDefecto: '08:00',
    campo: 'horaSemaforo',
  },
  racha: {
    nombre: 'Un momento para ti',
    explicacion: 'Una invitación a tus actividades, solo si ese día todavía no hiciste ninguna.',
    icono: 'sparkles',
    horaPorDefecto: '19:00',
    campo: 'horaRacha',
  },
};

/** Cuanto se espera tras tocar la hora antes de guardarla. */
const ESPERA_AL_ESCRIBIR_LA_HORA_MS = 700;

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

type Estado =
  | { readonly fase: 'cargando' }
  | { readonly fase: 'error' }
  | { readonly fase: 'listo'; readonly datos: EstadoDeLasNotificaciones };

export function TusAvisos() {
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' });
  const [intento, setIntento] = useState(0);
  const [enEsteDispositivo, setEnEsteDispositivo] = useState(false);
  const [permiso, setPermiso] = useState<NotificationPermission>(permisoDeAvisos);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
  const capacidad = capacidadDelNavegador();

  useEffect(() => {
    const control = new AbortController();

    Promise.all([consultarLasNotificaciones(control.signal), suscripcionActual()]).then(
      ([datos, suscripcion]) => {
        if (!control.signal.aborted) {
          setEstado({ fase: 'listo', datos });
          setEnEsteDispositivo(suscripcion !== null);
        }
      },
      () => {
        if (!control.signal.aborted) {
          setEstado({ fase: 'error' });
        }
      },
    );

    return () => control.abort();
  }, [intento]);

  const cambiarHoras = useCallback(async (cambios: CambiosDeHoras): Promise<void> => {
    setAviso(null);

    try {
      const datos = await cambiarHorasDeAviso(cambios);

      setEstado({ fase: 'listo', datos });
    } catch {
      setAviso({ tipo: 'fallo', texto: SIN_CONEXION });
    }
  }, []);

  async function activarAqui(clavePublica: string) {
    setOcupado(true);
    setAviso(null);

    try {
      await suscribirEsteNavegador(await suscribirNavegador(clavePublica));
      setEnEsteDispositivo(true);
      setPermiso('granted');
      setAviso({ tipo: 'bien', texto: 'Listo: este dispositivo recibirá tus avisos.' });
    } catch (error) {
      if (error instanceof PermisoNegadoError) {
        setPermiso(error.permiso);
        setAviso({
          tipo: 'fallo',
          texto:
            error.permiso === 'denied'
              ? 'Bloqueaste los avisos para VSD Health en este navegador.'
              : 'No diste permiso para los avisos. Puedes intentarlo cuando quieras.',
        });
      } else {
        setAviso({ tipo: 'fallo', texto: SIN_CONEXION });
      }
    } finally {
      setOcupado(false);
    }
  }

  async function desactivarAqui() {
    setOcupado(true);
    setAviso(null);

    try {
      const suscripcion = await suscripcionActual();

      if (suscripcion !== null) {
        await soltarEsteNavegadorDelServidor(suscripcion.endpoint);
      }

      await soltarNavegador();
      setEnEsteDispositivo(false);
      setAviso({ tipo: 'bien', texto: 'Este dispositivo ya no recibe tus avisos.' });
    } catch {
      setAviso({ tipo: 'fallo', texto: SIN_CONEXION });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Apartado
      titulo="Avisos"
      ayuda="Te avisamos aunque no tengas la aplicación abierta. Nunca dicen nada de tu salud: solo cuántos pendientes tienes, o una invitación a tu momento del día."
    >
      {estado.fase === 'cargando' && (
        <p className="app__nota" role="status">
          Cargando tus avisos…
        </p>
      )}

      {estado.fase === 'error' && (
        <div className="perfil__fila" role="alert">
          <p className="perfil__fallo">No se pudieron cargar tus avisos.</p>
          <button
            type="button"
            className="perfil__secundario"
            onClick={() => {
              setEstado({ fase: 'cargando' });
              setIntento((antes) => antes + 1);
            }}
          >
            Reintentar
          </button>
        </div>
      )}

      {estado.fase === 'listo' && !estado.datos.disponible && (
        <p className="app__nota">
          Los avisos todavía no están disponibles. Cuando lo estén, podrás activarlos aquí.
        </p>
      )}

      {estado.fase === 'listo' && estado.datos.disponible && (
        <>
          <EsteDispositivo
            capacidad={capacidad}
            permiso={permiso}
            activo={enEsteDispositivo}
            ocupado={ocupado}
            alActivar={() => {
              const { clavePublica } = estado.datos;

              if (clavePublica !== null) {
                void activarAqui(clavePublica);
              }
            }}
            alDesactivar={() => void desactivarAqui()}
          />

          {(['semaforo', 'racha'] as const).map((clase) => (
            <HoraDeUnAviso
              key={clase}
              clase={clase}
              hora={clase === 'semaforo' ? estado.datos.horaSemaforo : estado.datos.horaRacha}
              alCambiar={cambiarHoras}
            />
          ))}
        </>
      )}

      <MensajeDeAviso aviso={aviso} />
    </Apartado>
  );
}

/** Si este dispositivo recibe los avisos, y como activarlos si no. */
function EsteDispositivo({
  capacidad,
  permiso,
  activo,
  ocupado,
  alActivar,
  alDesactivar,
}: {
  capacidad: ReturnType<typeof capacidadDelNavegador>;
  permiso: NotificationPermission;
  activo: boolean;
  ocupado: boolean;
  alActivar: () => void;
  alDesactivar: () => void;
}) {
  if (capacidad === 'iphone-sin-instalar') {
    return (
      <p className="app__nota">
        En iPhone y iPad los avisos llegan solo si instalas VSD Health en tu pantalla de inicio (iOS
        16.4 o más reciente): en Safari, toca Compartir y después «Agregar a inicio». Ábrela desde
        ahí y vuelve a esta pantalla.
      </p>
    );
  }

  if (capacidad === 'sin-soporte') {
    return (
      <p className="app__nota">
        Este navegador no puede recibir avisos. Prueba con Chrome, Edge, Firefox o Safari.
      </p>
    );
  }

  if (activo) {
    return (
      <div className="perfil__fila">
        <p className="perfil__correo">Este dispositivo recibe tus avisos.</p>
        <button
          type="button"
          className="perfil__secundario"
          onClick={alDesactivar}
          disabled={ocupado}
        >
          {ocupado ? 'Un momento…' : 'Dejar de recibirlos aquí'}
        </button>
      </div>
    );
  }

  if (permiso === 'denied') {
    return (
      <p className="app__nota">
        Bloqueaste los avisos para VSD Health en este navegador. Para recibirlos, permite las
        notificaciones en la configuración del sitio y vuelve aquí.
      </p>
    );
  }

  return (
    <button
      type="button"
      className="app__boton perfil__accion"
      onClick={alActivar}
      disabled={ocupado}
    >
      {ocupado ? 'Activando…' : 'Recibir avisos en este dispositivo'}
    </button>
  );
}

/** Un aviso: el interruptor y, encendido, su hora. */
function HoraDeUnAviso({
  clase,
  hora,
  alCambiar,
}: {
  clase: ClaseDeAviso;
  hora: string | null;
  alCambiar: (cambios: CambiosDeHoras) => Promise<void>;
}) {
  const datos = CLASES[clase];
  const colores = MODULOS.bienestar;
  const encendido = hora !== null;
  const [escrita, setEscrita] = useState(hora ?? datos.horaPorDefecto);
  const [ocupado, setOcupado] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const idDeLaHora = useId();
  const idDeLaExplicacion = useId();

  useEffect(() => () => clearTimeout(temporizador.current), []);

  async function guardar(nueva: string | null) {
    setOcupado(true);

    try {
      await alCambiar({ [datos.campo]: nueva });
    } finally {
      setOcupado(false);
    }
  }

  function alternar() {
    if (ocupado) {
      return;
    }

    clearTimeout(temporizador.current);
    void guardar(encendido ? null : escrita);
  }

  function alEscribirHora(valor: string) {
    setEscrita(valor);
    clearTimeout(temporizador.current);

    // Se guarda cuando la hora esta completa y se deja de tocar un momento.
    if (HORA.test(valor)) {
      temporizador.current = setTimeout(() => void guardar(valor), ESPERA_AL_ESCRIBIR_LA_HORA_MS);
    }
  }

  return (
    <div className="perfil__aviso">
      <button
        type="button"
        role="switch"
        aria-checked={encendido}
        aria-describedby={idDeLaExplicacion}
        className={`perfil__modulo${encendido ? ' perfil__modulo--activo' : ''}`}
        style={
          { '--modulo-fondo': colores.fondo, '--modulo-acento': colores.acento } as CSSProperties
        }
        onClick={alternar}
      >
        <span className="tarjeta-modulo__icono">
          <Icono nombre={datos.icono} />
        </span>
        <span className="perfil__modulo-nombre">{datos.nombre}</span>
        <span className="perfil__interruptor" aria-hidden="true">
          <span />
        </span>
      </button>

      <p id={idDeLaExplicacion} className="app__nota perfil__ayuda">
        {datos.explicacion}
      </p>

      {encendido && (
        <div className="perfil__fila">
          <label htmlFor={idDeLaHora} className="bienvenida__etiqueta">
            A las
          </label>
          <input
            id={idDeLaHora}
            type="time"
            step={60}
            className="bienvenida__entrada perfil__hora"
            value={escrita}
            onChange={(evento) => alEscribirHora(evento.target.value)}
            aria-label={`Hora del aviso: ${datos.nombre}`}
          />
          <span className="app__nota">hora de Colombia</span>
        </div>
      )}
    </div>
  );
}
