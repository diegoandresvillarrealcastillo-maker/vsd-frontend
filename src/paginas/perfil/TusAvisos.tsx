import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';

import { ACOMPANADO } from '../../estilos/movimiento.ts';
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
 *   dispositivos, y todos se leen en la zona horaria de la persona (SCRUM-123).
 *
 * Y los avisos se agrupan en dos tarjetas, una por lo que avisan. Cada una
 * tiene un solo interruptor y, encendida, despliega sus opciones; apagada, las
 * esconde del todo:
 *
 * - **Actividades y bienestar:** tres opciones en forma de chip. La de la
 *   manana (8:00) y la de la noche (20:00) tienen hora fija (SCRUM-127); la
 *   personalizada tiene la hora que la persona elija.
 * - **Pendientes del semaforo:** cuantos pendientes tiene, a la hora que elija.
 *
 * El servidor guarda cuatro avisos sueltos y la pantalla los junta: la tarjeta
 * de actividades esta encendida si lo esta alguno de sus tres chips, y apagarla
 * apaga los tres. No hay estado propio que pueda contradecir al del servidor.
 */

type Momento = 'manana' | 'noche' | 'personalizado';

type Elegidos = Readonly<Record<Momento, boolean>>;

const NINGUNO: Elegidos = { manana: false, noche: false, personalizado: false };

const MOMENTOS: readonly {
  readonly clave: Momento;
  readonly nombre: string;
  readonly detalle: string | null;
}[] = [
  { clave: 'manana', nombre: 'Mañana', detalle: '8:00 a. m.' },
  { clave: 'noche', nombre: 'Noche', detalle: '8:00 p. m.' },
  { clave: 'personalizado', nombre: 'Personalizado', detalle: null },
];

/** Las horas con las que se enciende un aviso que todavia no tenia. */
const HORA_DEL_SEMAFORO = '08:00';
const HORA_PERSONALIZADA = '19:00';

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

  // Las dos devuelven si se guardo, porque una tarjeta a veces necesita dos
  // cambios seguidos y no debe mandar el segundo si el primero fallo.
  const cambiarHoras = useCallback(async (cambios: CambiosDeHoras): Promise<boolean> => {
    setAviso(null);

    try {
      const datos = await cambiarHorasDeAviso(cambios);

      setEstado({ fase: 'listo', datos });

      return true;
    } catch {
      setAviso({ tipo: 'fallo', texto: SIN_CONEXION });

      return false;
    }
  }, []);

  const cambiarRecordatorios = useCallback(
    async (cambios: CambiosDeRecordatorios): Promise<boolean> => {
      setAviso(null);

      try {
        const datos = await cambiarRecordatoriosDelDia(cambios);

        setEstado({ fase: 'listo', datos });

        return true;
      } catch {
        setAviso({ tipo: 'fallo', texto: SIN_CONEXION });

        return false;
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

          <TarjetaDeActividades
            manana={estado.datos.recordatorioManana === true}
            noche={estado.datos.recordatorioNoche === true}
            horaPersonalizada={estado.datos.horaRacha}
            // Una API anterior a SCRUM-126 no manda los recordatorios fijos: no se ofrece lo que no existe.
            ofreceLosFijos={
              typeof estado.datos.recordatorioManana === 'boolean' &&
              typeof estado.datos.recordatorioNoche === 'boolean'
            }
            alCambiarRecordatorios={cambiarRecordatorios}
            alCambiarHoras={cambiarHoras}
          />

          <TarjetaDelSemaforo hora={estado.datos.horaSemaforo} alCambiarHoras={cambiarHoras} />

          {(estado.datos.recordatorioManana === true ||
            estado.datos.recordatorioNoche === true ||
            estado.datos.horaSemaforo !== null ||
            estado.datos.horaRacha !== null) &&
            !enEsteDispositivo && (
              <p className="app__nota">
                Este dispositivo todavía no recibe avisos, así que aquí no llegarán. Actívalos
                arriba para recibirlos.
              </p>
            )}
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

/**
 * Invitaciones a empezar el dia, a tomarse un momento y a cerrarlo.
 *
 * Los tres chips son avisos distintos en el servidor, y no avisan igual: el de
 * la manana sale siempre; el de la noche y el personalizado, solo si ese dia la
 * persona todavia no hizo ninguna actividad, y entre los dos llega uno solo,
 * el que toque primero. La explicacion lo dice tal cual.
 */
function TarjetaDeActividades({
  manana,
  noche,
  horaPersonalizada,
  ofreceLosFijos,
  alCambiarRecordatorios,
  alCambiarHoras,
}: {
  manana: boolean;
  noche: boolean;
  horaPersonalizada: string | null;
  ofreceLosFijos: boolean;
  alCambiarRecordatorios: (cambios: CambiosDeRecordatorios) => Promise<boolean>;
  alCambiarHoras: (cambios: CambiosDeHoras) => Promise<boolean>;
}) {
  const [ocupado, setOcupado] = useState(false);
  const interruptor = useRef<HTMLButtonElement>(null);
  // Lo que habia elegido antes de apagarla, para devolverlo al encenderla.
  const recordados = useRef<Elegidos | null>(null);

  const elegidos: Elegidos = { manana, noche, personalizado: horaPersonalizada !== null };
  const encendida = elegidos.manana || elegidos.noche || elegidos.personalizado;

  const hora = useHoraElegida(horaPersonalizada, HORA_PERSONALIZADA, async (valor) => {
    setOcupado(true);

    try {
      await alCambiarHoras({ horaRacha: valor });
    } finally {
      setOcupado(false);
    }
  });

  /** Lleva el servidor a lo que se pide, tocando solo lo que cambia. */
  async function aplicar(despues: Elegidos): Promise<boolean> {
    setOcupado(true);

    try {
      const recordatorios: CambiosDeRecordatorios = {
        ...(despues.manana !== elegidos.manana ? { manana: despues.manana } : {}),
        ...(despues.noche !== elegidos.noche ? { noche: despues.noche } : {}),
      };

      if (Object.keys(recordatorios).length > 0 && !(await alCambiarRecordatorios(recordatorios))) {
        return false;
      }

      if (despues.personalizado !== elegidos.personalizado) {
        return await alCambiarHoras({
          horaRacha: despues.personalizado ? hora.escrita : null,
        });
      }

      return true;
    } finally {
      setOcupado(false);
    }
  }

  async function alternarLaTarjeta() {
    if (ocupado) {
      return;
    }

    hora.cancelar();

    if (encendida) {
      recordados.current = elegidos;
      await aplicar(NINGUNO);

      return;
    }

    // Sin nada recordado se ofrece lo mas corriente: la manana y la noche.
    await aplicar(
      recordados.current ?? {
        manana: ofreceLosFijos,
        noche: ofreceLosFijos,
        personalizado: !ofreceLosFijos,
      },
    );
  }

  async function alternarUno(momento: Momento) {
    if (ocupado) {
      return;
    }

    if (momento === 'personalizado') {
      hora.cancelar();
    }

    const despues: Elegidos = { ...elegidos, [momento]: !elegidos[momento] };
    const queda = despues.manana || despues.noche || despues.personalizado;

    // Quitar el ultimo chip apaga la tarjeta. El chip desaparece con el
    // despliegue, y con el el foco: se devuelve al interruptor.
    if (!queda) {
      recordados.current = elegidos;
    }

    if ((await aplicar(despues)) && !queda) {
      interruptor.current?.focus();
    }
  }

  return (
    <TarjetaDeAviso
      nombre="Actividades y bienestar"
      explicacion="Invitaciones para empezar el día, para tomarte un momento o para cerrarlo. La de la mañana llega siempre; las demás, solo si ese día aún no hiciste ninguna actividad."
      icono="leaf"
      encendida={encendida}
      alAlternar={() => void alternarLaTarjeta()}
      referencia={interruptor}
    >
      <fieldset className="perfil__chips">
        <legend className="solo-lectores">Qué avisos quieres recibir</legend>

        {MOMENTOS.filter((momento) => ofreceLosFijos || momento.clave === 'personalizado').map(
          (momento) => (
            <Chip
              key={momento.clave}
              nombre={momento.nombre}
              detalle={momento.detalle}
              marcado={elegidos[momento.clave]}
              alCambiar={() => void alternarUno(momento.clave)}
            />
          ),
        )}
      </fieldset>

      <Despliegue abierto={elegidos.personalizado}>
        <CampoDeHora
          etiqueta="Hora del aviso personalizado"
          valor={hora.escrita}
          alEscribir={hora.escribir}
          conZona={false}
        />
      </Despliegue>

      {/* Un solo parrafo para las dos aclaraciones: apilar una nota por cada cosa
          alargaba la tarjeta. La zona vale para los tres chips. */}
      <p className="app__nota">
        Las horas son de tu zona horaria ({nombreDeLaZona()}). Si viajas, se ajustan solas.
        {elegidos.noche &&
          elegidos.personalizado &&
          ' Con «Noche» y «Personalizado» a la vez, llega solo la que toque primero.'}
      </p>
    </TarjetaDeAviso>
  );
}

/** Cuantos pendientes hay en el semaforo, a la hora que la persona elija. */
function TarjetaDelSemaforo({
  hora: horaGuardada,
  alCambiarHoras,
}: {
  hora: string | null;
  alCambiarHoras: (cambios: CambiosDeHoras) => Promise<boolean>;
}) {
  const [ocupado, setOcupado] = useState(false);
  const encendida = horaGuardada !== null;

  async function guardar(nueva: string | null) {
    setOcupado(true);

    try {
      await alCambiarHoras({ horaSemaforo: nueva });
    } finally {
      setOcupado(false);
    }
  }

  const hora = useHoraElegida(horaGuardada, HORA_DEL_SEMAFORO, guardar);

  function alternar() {
    if (ocupado) {
      return;
    }

    hora.cancelar();
    void guardar(encendida ? null : hora.escrita);
  }

  return (
    <TarjetaDeAviso
      nombre="Pendientes del semáforo"
      explicacion="Te avisamos cuántos pendientes tienes para que te organices."
      icono="check"
      encendida={encendida}
      alAlternar={alternar}
    >
      <CampoDeHora
        etiqueta="Hora del aviso: Pendientes del semáforo"
        valor={hora.escrita}
        alEscribir={hora.escribir}
      />
    </TarjetaDeAviso>
  );
}

/**
 * La hora que se escribe en un campo `time` y su guardado con espera: se manda
 * cuando esta completa y se deja de tocar un momento. `cancelar` borra un
 * guardado pendiente; hay que llamarlo al apagar el aviso, o la hora llegaria
 * despues y lo volveria a encender.
 */
function useHoraElegida(
  guardada: string | null,
  porDefecto: string,
  guardar: (hora: string) => Promise<void>,
) {
  const [escrita, setEscrita] = useState(guardada ?? porDefecto);
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  const cancelar = useCallback(() => clearTimeout(temporizador.current), []);

  function escribir(valor: string) {
    setEscrita(valor);
    clearTimeout(temporizador.current);

    if (HORA.test(valor)) {
      temporizador.current = setTimeout(() => void guardar(valor), ESPERA_AL_ESCRIBIR_LA_HORA_MS);
    }
  }

  return { escrita, escribir, cancelar };
}

/** "A las [hora] en tal zona". La hora se lee en la zona de la cuenta (SCRUM-123), no en la de Colombia. */
function CampoDeHora({
  etiqueta,
  valor,
  alEscribir,
  conZona = true,
}: {
  etiqueta: string;
  valor: string;
  alEscribir: (valor: string) => void;
  /** Falso cuando la tarjeta ya dice la zona una vez para todas sus horas. */
  conZona?: boolean;
}) {
  const id = useId();

  return (
    <div className="perfil__fila">
      <label htmlFor={id} className="bienvenida__etiqueta">
        A las
      </label>
      <input
        id={id}
        type="time"
        step={60}
        className="bienvenida__entrada perfil__hora"
        value={valor}
        onChange={(evento) => alEscribir(evento.target.value)}
        aria-label={etiqueta}
      />
      {conZona && <span className="app__nota">{nombreDeLaZona()}</span>}
    </div>
  );
}

/**
 * Una opcion en forma de chip. Es una casilla de verdad, escondida debajo: la
 * que recibe el foco, responde al espacio y anuncia un lector de pantalla. Lo
 * que se pinta es decoracion sincronizada con ella, y la marca de verificacion
 * evita que el estado se distinga solo por el color.
 */
function Chip({
  nombre,
  detalle,
  marcado,
  alCambiar,
}: {
  nombre: string;
  detalle: string | null;
  marcado: boolean;
  alCambiar: () => void;
}) {
  return (
    <label className="perfil__chip">
      <input
        type="checkbox"
        className="perfil__chip-entrada"
        checked={marcado}
        onChange={alCambiar}
      />
      <span className="perfil__chip-cuerpo">
        <span className="perfil__chip-marca" aria-hidden="true">
          <Icono nombre="check" tamano={14} />
        </span>
        {nombre}
        {/* El espacio explicito: sin estilos, nombre y hora se leerian pegados. */}
        {detalle !== null && (
          <>
            {' '}
            <span className="perfil__chip-detalle">{detalle}</span>
          </>
        )}
      </span>
    </label>
  );
}

/**
 * Una tarjeta de avisos: un interruptor, lo que hace y, encendida, sus
 * opciones. Es un `switch`, asi que se maneja con teclado y se lee como
 * "interruptor, activado" en un lector de pantalla.
 */
function TarjetaDeAviso({
  nombre,
  explicacion,
  icono,
  encendida,
  alAlternar,
  referencia,
  children,
}: {
  nombre: string;
  explicacion: string;
  icono: NombreDeIcono;
  encendida: boolean;
  alAlternar: () => void;
  referencia?: RefObject<HTMLButtonElement | null>;
  children: ReactNode;
}) {
  const colores = MODULOS.bienestar;
  const idDeLaExplicacion = useId();

  return (
    <div
      className={`perfil__tarjeta-de-aviso${encendida ? ' perfil__tarjeta-de-aviso--activa' : ''}`}
      style={
        { '--modulo-fondo': colores.fondo, '--modulo-acento': colores.acento } as CSSProperties
      }
    >
      <button
        ref={referencia}
        type="button"
        role="switch"
        aria-checked={encendida}
        aria-describedby={idDeLaExplicacion}
        className="perfil__tarjeta-interruptor"
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

      <Despliegue abierto={encendida}>{children}</Despliegue>
    </div>
  );
}

/**
 * Lo que aparece solo cuando hace falta. Cerrado no esta en el arbol: no ocupa
 * sitio ni recibe el foco. Al abrir y cerrar crece y se encoge, sin salto, y con
 * "reducir movimiento" aparece y desaparece de golpe.
 *
 * El recorte (`overflow`) solo rige mientras se mueve: al terminar de abrirse
 * se suelta, o el anillo de foco de lo que hay dentro quedaria cortado.
 */
function Despliegue({ abierto, children }: { abierto: boolean; children: ReactNode }) {
  const sinMovimiento = useReducedMotion() ?? false;

  return (
    <AnimatePresence initial={false}>
      {abierto && (
        <motion.div
          initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
          animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }}
          exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
          transition={sinMovimiento ? { duration: 0 } : ACOMPANADO}
        >
          {/* El espacio con lo de arriba va dentro, para que se anime con la altura. */}
          <div className="perfil__despliegue">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
