import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

import {
  cambiarHorasDeAviso,
  cambiarRecordatoriosDelDia,
  consultarLasNotificaciones,
  soltarEsteNavegadorDelServidor,
  suscribirEsteNavegador,
  type CambiosDeHoras,
  type CambiosDeRecordatorios,
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
import { nombreDeLaZona } from '../../tiempo/zonaHoraria.ts';
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
 * - **Cuales llegan y a que hora.** Es de la cuenta: vale para todos sus
 *   dispositivos. Cada aviso se enciende y apaga por separado, y todos se leen
 *   en la zona horaria de la persona (SCRUM-123).
 *
 * Y dos grupos de avisos, porque se comportan distinto:
 *
 * - **Recordatorios del dia** (SCRUM-127): el de la manana y el de la noche,
 *   con la hora fija en las 8:00 y las 20:00. Solo se encienden o apagan.
 * - **A la hora que elijas:** el del semaforo y "un momento para ti", con hora
 *   propia.
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
    explicacion:
      'Una invitación a tus actividades, solo si ese día todavía no hiciste ninguna. ' +
      'Si también tienes encendido «Cierre del día», llega solo la que toque primero.',
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
  const idDeLasHoras = useId();
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

  const cambiarRecordatorios = useCallback(
    async (cambios: CambiosDeRecordatorios): Promise<void> => {
      setAviso(null);

      try {
        const datos = await cambiarRecordatoriosDelDia(cambios);

        setEstado({ fase: 'listo', datos });
      } catch {
        setAviso({ tipo: 'fallo', texto: SIN_CONEXION });
      }
    },
    [],
  );

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

          {/* Una API anterior a SCRUM-126 no manda estos campos: no se ofrece lo que no existe. */}
          {typeof estado.datos.recordatorioManana === 'boolean' &&
            typeof estado.datos.recordatorioNoche === 'boolean' && (
              <RecordatoriosDelDia
                manana={estado.datos.recordatorioManana}
                noche={estado.datos.recordatorioNoche}
                recibeEsteDispositivo={enEsteDispositivo}
                alCambiar={cambiarRecordatorios}
              />
            )}

          <div role="group" aria-labelledby={idDeLasHoras} className="perfil__grupo-de-avisos">
            <h3 id={idDeLasHoras} className="perfil__subtitulo">
              A la hora que elijas
            </h3>
            {(['semaforo', 'racha'] as const).map((clase) => (
              <HoraDeUnAviso
                key={clase}
                clase={clase}
                hora={clase === 'semaforo' ? estado.datos.horaSemaforo : estado.datos.horaRacha}
                alCambiar={cambiarHoras}
              />
            ))}
          </div>
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
  const encendido = hora !== null;
  const [escrita, setEscrita] = useState(hora ?? datos.horaPorDefecto);
  const [ocupado, setOcupado] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const idDeLaHora = useId();

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
    <InterruptorDeAviso
      nombre={datos.nombre}
      explicacion={datos.explicacion}
      icono={datos.icono}
      encendido={encendido}
      alAlternar={alternar}
    >
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
          {/* La hora se lee en la zona de la cuenta (SCRUM-123), no en la de Colombia. */}
          <span className="app__nota">{nombreDeLaZona()}</span>
        </div>
      )}
    </InterruptorDeAviso>
  );
}

/**
 * Un aviso: su interruptor y lo que hace. Lo que va dentro (la hora, una nota)
 * aparece debajo. Es un `switch`, asi que se maneja con teclado y se lee como
 * "interruptor, activado" en un lector de pantalla.
 */
function InterruptorDeAviso({
  nombre,
  explicacion,
  icono,
  encendido,
  alAlternar,
  children,
}: {
  nombre: string;
  explicacion: string;
  icono: NombreDeIcono;
  encendido: boolean;
  alAlternar: () => void;
  children?: ReactNode;
}) {
  const colores = MODULOS.bienestar;
  const idDeLaExplicacion = useId();

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
        onClick={alAlternar}
      >
        <span className="tarjeta-modulo__icono">
          <Icono nombre={icono} />
        </span>
        <span className="perfil__modulo-nombre">{nombre}</span>
        <span className="perfil__interruptor" aria-hidden="true">
          <span />
        </span>
      </button>

      <p id={idDeLaExplicacion} className="app__nota perfil__ayuda">
        {explicacion}
      </p>

      {children}
    </div>
  );
}

type MomentoDelDia = 'manana' | 'noche';

const MOMENTOS: Readonly<
  Record<
    MomentoDelDia,
    {
      readonly nombre: string;
      readonly explicacion: string;
      readonly icono: NombreDeIcono;
    }
  >
> = {
  manana: {
    nombre: 'Buenos días',
    explicacion: 'A las 8:00 a. m., una invitación a empezar el día. Sin prisa, a tu ritmo.',
    icono: 'leaf',
  },
  noche: {
    nombre: 'Cierre del día',
    explicacion:
      'A las 8:00 p. m., solo si hoy aún no hiciste ninguna actividad. Si ya la hiciste, no llega nada. ' +
      'Si también tienes encendido «Un momento para ti», llega solo la que toque primero.',
    icono: 'moon',
  },
};

/**
 * Los recordatorios de la manana y de la noche (SCRUM-127): a las 8:00 y a las
 * 20:00 de la persona, sin hora que elegir. Solo se encienden y se apagan.
 *
 * Avisan, con un tono de juego y sin culpa, lo que dicen: los textos viven en
 * el servidor y rotan cada dia. Aqui se explica a que hora y en que zona llegan,
 * y que hace falta que este dispositivo reciba avisos.
 */
function RecordatoriosDelDia({
  manana,
  noche,
  recibeEsteDispositivo,
  alCambiar,
}: {
  manana: boolean;
  noche: boolean;
  recibeEsteDispositivo: boolean;
  alCambiar: (cambios: CambiosDeRecordatorios) => Promise<void>;
}) {
  const [ocupado, setOcupado] = useState(false);
  const idDelTitulo = useId();
  const zona = nombreDeLaZona();
  const encendidos: Readonly<Record<MomentoDelDia, boolean>> = { manana, noche };

  async function alternar(momento: MomentoDelDia) {
    if (ocupado) {
      return;
    }

    setOcupado(true);

    try {
      await alCambiar({ [momento]: !encendidos[momento] });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div role="group" aria-labelledby={idDelTitulo} className="perfil__grupo-de-avisos">
      <h3 id={idDelTitulo} className="perfil__subtitulo">
        Recordatorios del día
      </h3>
      <p className="app__nota perfil__ayuda">
        Dos momentos fijos, a las 8:00 a. m. y a las 8:00 p. m. de tu zona horaria ({zona}). Si
        viajas, se ajustan solos.
      </p>

      {(['manana', 'noche'] as const).map((momento) => (
        <InterruptorDeAviso
          key={momento}
          nombre={MOMENTOS[momento].nombre}
          explicacion={MOMENTOS[momento].explicacion}
          icono={MOMENTOS[momento].icono}
          encendido={encendidos[momento]}
          alAlternar={() => void alternar(momento)}
        />
      ))}

      {(manana || noche) && !recibeEsteDispositivo && (
        <p className="app__nota">
          Este dispositivo todavía no recibe avisos, así que aquí no llegarán. Actívalos arriba para
          recibirlos.
        </p>
      )}
    </div>
  );
}
