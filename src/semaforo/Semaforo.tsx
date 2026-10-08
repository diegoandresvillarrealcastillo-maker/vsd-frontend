import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

import { useEscribiendo } from '../componentes/useEscribiendo.ts';
import '../estilos/semaforo.css';
import type { NivelDePendiente, Pendiente } from '../infraestructura/api/pendientes.ts';
import {
  agrupar,
  DIAS_AL_POSPONER,
  dentroDeDias,
  diasDesde,
  edad,
  LARGO_MAXIMO_DEL_TEXTO,
  NIVEL,
  NIVELES,
  PASOS_DE_LA_INDUCCION,
  textoDelRecordatorio,
  vencimiento,
} from './niveles.ts';
import { pedirVerLaLista } from '../sincronizacion/estado.ts';
import { haceCuanto } from '../tiempo/haceCuanto.ts';
import { diaEnLaZona } from '../tiempo/zonaHoraria.ts';
import { useDialogo } from '../componentes/useDialogo.ts';
import { describirCambios, describirPendiente } from './choques.ts';
import type { EstadoDelPendiente, PendienteEnPantalla } from './composicion.ts';
import { useSemaforo, type Choque } from './useSemaforo.ts';

/**
 * El semaforo de pendientes, flotante (SCRUM-98).
 *
 * - Un boton en la esquina de abajo a la derecha, con cuantos urgentes hay.
 *   Abre la ventana: en el movil, una hoja desde abajo; fuera, un panel a la
 *   derecha.
 * - La primera vez, antes de la ventana, una induccion de cuatro pasos.
 * - En la ventana se anade, se marca hecho (con deshacer), se sube de nivel
 *   y se elimina (con confirmacion).
 * - Si el backend manda un recordatorio, sale junto al boton, con calma: se
 *   puede revisar, dejar para dentro de una semana o para luego.
 * - No estorba: va por encima de la navegacion del movil y de la zona segura
 *   del iPhone, se aparta mientras se escribe, y la mascota no baja hasta su
 *   esquina (ver `medidas.ts`).
 * - Se maneja entero con teclado y se cierra con Escape.
 */

/** Que ya vio la induccion. Una comodidad de este navegador, no un dato personal. */
const CLAVE_DE_LA_INDUCCION = 'vsd-h:semaforo-induccion-vista';

function vioLaInduccion(): boolean {
  try {
    return localStorage.getItem(CLAVE_DE_LA_INDUCCION) === 'si';
  } catch {
    return false;
  }
}

function recordarQueLaVio(): void {
  try {
    localStorage.setItem(CLAVE_DE_LA_INDUCCION, 'si');
  } catch {
    // Sin almacenamiento, se vuelve a ver la proxima vez. No es grave.
  }
}

/**
 * Lo que se dice cuando ni siquiera se pudo guardar **en este equipo** (no hay una sesion
 * abierta, o no hay espacio). Sin conexion no es un fallo: lo guardado se envia solo despues.
 */
const NO_SE_PUDO_GUARDAR = 'No se pudo guardar en este equipo. Inténtalo de nuevo.';

/**
 * Lo que se dice de un pendiente que todavia no esta del todo en el servidor (SCRUM-140), o
 * `null` si lo esta. Nunca depende solo del color.
 */
function textoDelEstado(estado: EstadoDelPendiente): string | null {
  switch (estado) {
    case 'en_este_equipo':
      return 'Guardado en este equipo · se enviará cuando haya conexión';
    case 'guardando':
      return 'Guardando…';
    case 'error':
      return 'No se pudo enviar este cambio. Sigue guardado en este equipo.';
    case 'choco':
      return 'Cambió en otro dispositivo. Elige con cuál quedarte.';
    default:
      return null;
  }
}

/** El estado de un pendiente, en una linea bajo su texto. */
function EstadoDelPendienteEnPantalla({ pendiente }: { pendiente: PendienteEnPantalla }) {
  const texto = textoDelEstado(pendiente.estado);

  if (texto === null) {
    return null;
  }

  return pendiente.estado === 'error' ? (
    <p className="semaforo-tarea__estado semaforo-tarea__estado--error" role="alert">
      {texto}{' '}
      <button type="button" className="semaforo__accion" onClick={pedirVerLaLista}>
        Ver la lista
      </button>
    </p>
  ) : (
    <p className="semaforo-tarea__estado" role="status">
      {texto}
    </p>
  );
}

/** El dibujo del semaforo. Con `encendida`, solo esa luz tiene color. */
function IconoSemaforo({
  encendida,
  ancho = 22,
}: {
  encendida?: NivelDePendiente | null;
  ancho?: number;
}) {
  return (
    <svg
      className="semaforo-icono"
      viewBox="0 0 24 40"
      width={ancho}
      height={(ancho * 40) / 24}
      aria-hidden="true"
    >
      <rect x="2" y="1" width="20" height="38" rx="8" className="semaforo-icono__caja" />
      {NIVELES.map((nivel, indice) => (
        <circle
          key={nivel}
          cx="12"
          cy={10 + indice * 10}
          r="5"
          className={
            encendida === undefined || encendida === null || encendida === nivel
              ? `semaforo-luz semaforo-luz--${nivel}`
              : 'semaforo-luz semaforo-luz--apagada'
          }
        />
      ))}
    </svg>
  );
}

type Vista = 'cerrado' | 'induccion' | 'ventana';

export function Semaforo() {
  const semaforo = useSemaforo();
  const escribiendo = useEscribiendo();
  const [vista, setVista] = useState<Vista>('cerrado');
  const [resaltado, setResaltado] = useState<string | null>(null);
  const volverAlBoton = useRef(false);
  const boton = useRef<HTMLButtonElement>(null);
  const { estado } = semaforo;

  // Al cerrar la ventana o atender el recordatorio, lo que tenia el foco ya
  // no esta. El boton si: sigue ahi pase lo que pase. Se enfoca despues de
  // pintar, que es cuando ya se fue lo otro.
  useEffect(() => {
    if (volverAlBoton.current) {
      volverAlBoton.current = false;
      boton.current?.focus();
    }
  });

  const urgentes =
    estado.fase === 'listo'
      ? estado.pendientes.filter((uno) => !uno.hecho && uno.nivel === 'urgente').length
      : 0;

  function abrir(conResaltado: string | null = null) {
    setResaltado(conResaltado);
    setVista(vioLaInduccion() ? 'ventana' : 'induccion');
  }

  function cerrar() {
    volverAlBoton.current = true;
    setVista('cerrado');
    setResaltado(null);
  }

  return (
    <div className={`semaforo${escribiendo && vista === 'cerrado' ? ' semaforo--apartado' : ''}`}>
      <button
        ref={boton}
        type="button"
        className="semaforo__boton"
        aria-label={`${
          urgentes === 0
            ? 'Abrir tu semáforo de pendientes'
            : `Abrir tu semáforo de pendientes: ${urgentes} ${urgentes === 1 ? 'urgente' : 'urgentes'}`
        }${semaforo.choques.length > 0 ? ', con cambios por resolver' : ''}`}
        aria-haspopup="dialog"
        onClick={() => abrir()}
      >
        <IconoSemaforo />
        {urgentes > 0 && (
          <span className="semaforo__cuenta" aria-hidden="true">
            {urgentes}
          </span>
        )}
      </button>

      {/* Siempre montada: una region viva que aparece ya llena no siempre se
          anuncia. */}
      <div aria-live="polite">
        {vista === 'cerrado' && estado.fase === 'listo' && estado.recordatorio !== null && (
          <RecordatorioJuntoAlBoton
            semaforo={semaforo}
            pendientes={estado.pendientes}
            alRevisar={(id) => abrir(id)}
            alAtender={() => {
              volverAlBoton.current = true;
            }}
          />
        )}
      </div>

      {vista === 'induccion' && (
        <Induccion
          alTerminar={() => {
            recordarQueLaVio();
            setVista('ventana');
          }}
          alCerrar={() => {
            recordarQueLaVio();
            cerrar();
          }}
        />
      )}

      {vista === 'ventana' && (
        <Ventana semaforo={semaforo} resaltado={resaltado} alCerrar={cerrar} />
      )}
    </div>
  );
}

type UsoDelSemaforo = ReturnType<typeof useSemaforo>;

function RecordatorioJuntoAlBoton({
  semaforo,
  pendientes,
  alRevisar,
  alAtender,
}: {
  semaforo: UsoDelSemaforo;
  pendientes: readonly Pendiente[];
  alRevisar: (id: string) => void;
  /** Se pospuso o se dejo para luego: el recordatorio se va. */
  alAtender: () => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [fallo, setFallo] = useState(false);
  const idDelTexto = useId();
  const { estado, editar, dejarParaLuego } = semaforo;
  const recordatorio = estado.fase === 'listo' ? estado.recordatorio : null;
  const pendiente = pendientes.find((uno) => uno.id === recordatorio?.pendienteId);

  if (recordatorio === null || pendiente === undefined) {
    return null;
  }

  async function posponer(id: string) {
    setOcupado(true);
    setFallo(false);

    try {
      await editar(id, { posponerHasta: dentroDeDias(DIAS_AL_POSPONER, new Date()) });
      alAtender();
    } catch {
      setFallo(true);
      setOcupado(false);
    }
  }

  return (
    <section
      className={`semaforo__recordatorio semaforo__recordatorio--${recordatorio.nivel}`}
      aria-labelledby={idDelTexto}
    >
      <p className="semaforo__recordatorio-ceja">
        <IconoSemaforo encendida={recordatorio.nivel} ancho={12} />
        Tu semáforo · {NIVEL[recordatorio.nivel].nombre}
      </p>
      <p id={idDelTexto} className="semaforo__recordatorio-texto">
        {textoDelRecordatorio(recordatorio)}
      </p>
      <p className="semaforo__recordatorio-pendiente">
        «{pendiente.texto}»
        <span>
          {' '}
          ·{' '}
          {recordatorio.fechaLimite === null
            ? edad(recordatorio.dias)
            : vencimiento(recordatorio.fechaLimite, diaEnLaZona(new Date())).texto}
        </span>
      </p>

      {fallo && (
        <p className="semaforo__fallo" role="alert">
          {NO_SE_PUDO_GUARDAR}
        </p>
      )}

      <div className="semaforo__acciones">
        <button
          type="button"
          className="semaforo__accion semaforo__accion--principal"
          onClick={() => alRevisar(pendiente.id)}
        >
          Revisarlo
        </button>
        <button
          type="button"
          className="semaforo__accion"
          disabled={ocupado}
          onClick={() => void posponer(pendiente.id)}
        >
          En una semana
        </button>
        <button
          type="button"
          className="semaforo__accion"
          onClick={() => {
            dejarParaLuego();
            alAtender();
          }}
        >
          Ahora no
        </button>
      </div>
    </section>
  );
}

function Induccion({ alTerminar, alCerrar }: { alTerminar: () => void; alCerrar: () => void }) {
  const [paso, setPaso] = useState(0);
  const siguiente = useRef<HTMLButtonElement>(null);
  const caja = useDialogo<HTMLDivElement>(alCerrar, siguiente);
  const idDelTitulo = useId();
  const idDelTexto = useId();
  const datos = PASOS_DE_LA_INDUCCION[paso];
  const ultimo = paso === PASOS_DE_LA_INDUCCION.length - 1;

  if (datos === undefined) {
    return null;
  }

  return (
    <div className="semaforo-velo semaforo-velo--centro" onClick={alCerrar}>
      <div
        ref={caja}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idDelTitulo}
        aria-describedby={idDelTexto}
        className="semaforo-induccion"
        onClick={(evento) => evento.stopPropagation()}
      >
        <IconoSemaforo encendida={datos.nivel} ancho={40} />
        <p className="semaforo-induccion__paso">
          Paso {paso + 1} de {PASOS_DE_LA_INDUCCION.length}
        </p>
        <h2 id={idDelTitulo} className="semaforo-induccion__titulo">
          {datos.titulo}
        </h2>
        <p id={idDelTexto}>{datos.texto}</p>
        <p className="semaforo-induccion__ejemplo">{datos.ejemplo}</p>

        <div className="semaforo-induccion__acciones">
          <button type="button" className="semaforo__accion" onClick={alCerrar}>
            {ultimo ? 'Cerrar' : 'Saltar'}
          </button>
          <button
            ref={siguiente}
            type="button"
            className="semaforo__accion semaforo__accion--principal"
            onClick={() => {
              if (ultimo) {
                alTerminar();
                return;
              }

              setPaso(paso + 1);
              // El boton es el mismo: el foco se queda y se lee el paso nuevo
              // por la descripcion del dialogo.
              siguiente.current?.focus();
            }}
          >
            {ultimo ? 'Empezar' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** El resultado de una accion dentro de la ventana. */
type Aviso =
  | { readonly tipo: 'bien'; readonly texto: string; readonly deshacer?: () => Promise<void> }
  | { readonly tipo: 'fallo'; readonly texto: string }
  | null;

function Ventana({
  semaforo,
  resaltado,
  alCerrar,
}: {
  semaforo: UsoDelSemaforo;
  resaltado: string | null;
  alCerrar: () => void;
}) {
  const titulo = useRef<HTMLHeadingElement>(null);
  const caja = useDialogo<HTMLDivElement>(alCerrar, titulo);
  const idDelTitulo = useId();
  const [aviso, setAviso] = useState<Aviso>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [editandoFecha, setEditandoFecha] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const enfocar = useRef<'deshacer' | 'titulo' | null>(null);
  const deshacer = useRef<HTMLButtonElement>(null);
  const { estado, choques, reintentar, editar, borrar, resolver } = semaforo;

  useEffect(() => {
    if (resaltado !== null) {
      document.getElementById(`pendiente-${resaltado}`)?.scrollIntoView({ block: 'center' });
    }
  }, [resaltado]);

  // Lo que tenia el foco (el boton de un pendiente que se fue, o se movio de
  // color) ya no esta: se lleva a algo que siga ahi, una vez pintado.
  useEffect(() => {
    const destino = enfocar.current;

    if (destino === null) {
      return;
    }

    enfocar.current = null;
    (destino === 'deshacer' ? (deshacer.current ?? titulo.current) : titulo.current)?.focus();
  });

  /** Hace algo con un pendiente. Si falla, lo dice y no cambia nada. */
  async function hacer(id: string, accion: () => Promise<Aviso>, foco: 'deshacer' | 'titulo') {
    setOcupado(id);
    setAviso(null);

    try {
      const resultado = await accion();

      enfocar.current = foco;
      setAviso(resultado);
      setConfirmando(null);
    } catch {
      setAviso({ tipo: 'fallo', texto: NO_SE_PUDO_GUARDAR });
    } finally {
      setOcupado(null);
    }
  }

  function marcarHecho(pendiente: Pendiente) {
    void hacer(
      pendiente.id,
      async () => {
        await editar(pendiente.id, { hecho: true });

        return {
          tipo: 'bien',
          texto: `Hecho: «${pendiente.texto}».`,
          deshacer: async () => {
            await editar(pendiente.id, { hecho: false });
          },
        };
      },
      'deshacer',
    );
  }

  function subir(pendiente: Pendiente, nivel: NivelDePendiente) {
    void hacer(
      pendiente.id,
      async () => {
        await editar(pendiente.id, { nivel });

        return { tipo: 'bien', texto: `«${pendiente.texto}» pasó a ${NIVEL[nivel].nombre}.` };
      },
      'titulo',
    );
  }

  /** Pone, cambia o quita la fecha limite (SCRUM-119). `null` la quita. */
  function cambiarFecha(pendiente: Pendiente, fecha: string | null) {
    void hacer(
      pendiente.id,
      async () => {
        await editar(pendiente.id, { fechaLimite: fecha });
        setEditandoFecha(null);

        return {
          tipo: 'bien',
          texto:
            fecha === null
              ? `«${pendiente.texto}» ya no tiene fecha límite.`
              : `«${pendiente.texto}»: ${vencimiento(fecha, diaEnLaZona(new Date())).texto.toLowerCase()}.`,
        };
      },
      'titulo',
    );
  }

  function eliminar(pendiente: Pendiente) {
    void hacer(
      pendiente.id,
      async () => {
        await borrar(pendiente.id);

        return { tipo: 'bien', texto: `«${pendiente.texto}» se eliminó.` };
      },
      'titulo',
    );
  }

  function volverAPendientes(pendiente: Pendiente) {
    void hacer(
      pendiente.id,
      async () => {
        await editar(pendiente.id, { hecho: false });

        return { tipo: 'bien', texto: `«${pendiente.texto}» vuelve a tus pendientes.` };
      },
      'titulo',
    );
  }

  /** La persona eligio con cual quedarse cuando un cambio choco con otro dispositivo. */
  function elegir(choque: Choque, eleccion: 'servidor' | 'mio') {
    void hacer(
      choque.id,
      async () => {
        await resolver(choque.id, eleccion);

        return {
          tipo: 'bien',
          texto:
            eleccion === 'servidor'
              ? `Te quedaste con lo del otro dispositivo en «${choque.mio.texto}».`
              : `Se enviará tu cambio en «${choque.mio.texto}».`,
        };
      },
      'titulo',
    );
  }

  async function alDeshacer(accion: () => Promise<void>) {
    // El boton de deshacer se va con el aviso: el foco pasa al titulo.
    enfocar.current = 'titulo';
    setAviso(null);

    try {
      await accion();
      setAviso({ tipo: 'bien', texto: 'Listo, vuelve a estar pendiente.' });
    } catch {
      setAviso({ tipo: 'fallo', texto: NO_SE_PUDO_GUARDAR });
    }
  }

  const ahora = new Date();
  const grupos = estado.fase === 'listo' ? agrupar(estado.pendientes) : null;

  return (
    <div className="semaforo-velo" onClick={alCerrar}>
      <div
        ref={caja}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idDelTitulo}
        className="semaforo-ventana"
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="semaforo-ventana__asa" aria-hidden="true" />

        <div className="semaforo-ventana__cabecera">
          <IconoSemaforo ancho={18} />
          <h2 id={idDelTitulo} ref={titulo} tabIndex={-1} className="semaforo-ventana__titulo">
            Tu semáforo
          </h2>
          <button
            type="button"
            className="semaforo-ventana__cerrar"
            aria-label="Cerrar el semáforo"
            onClick={alCerrar}
          >
            ×
          </button>
        </div>

        {estado.fase === 'cargando' && (
          <p className="semaforo__nota" role="status">
            Cargando tu semáforo…
          </p>
        )}

        {estado.fase === 'error' && (
          <div className="semaforo__nota" role="alert">
            <p>No se pudo cargar tu semáforo.</p>
            <button type="button" className="semaforo__accion" onClick={reintentar}>
              Reintentar
            </button>
          </div>
        )}

        {estado.fase === 'listo' && estado.deLaCopia !== null && (
          <p className="semaforo__copia" role="status">
            Datos de {haceCuanto(estado.deLaCopia, ahora)}. Se ponen al día solo cuando haya
            conexión.
          </p>
        )}

        <Choques choques={choques} ocupado={ocupado} alElegir={elegir} />

        {grupos !== null && (
          <>
            {NIVELES.map((nivel) => (
              <Nivel
                key={nivel}
                nivel={nivel}
                pendientes={grupos.porNivel[nivel]}
                ahora={ahora}
                resaltado={resaltado}
                confirmando={confirmando}
                editandoFecha={editandoFecha}
                ocupado={ocupado}
                alMarcarHecho={marcarHecho}
                alSubir={subir}
                alEditarFecha={setEditandoFecha}
                alCambiarFecha={cambiarFecha}
                alPedirEliminar={(id) => {
                  setAviso(null);
                  setConfirmando(id);
                }}
                alCancelarEliminar={() => setConfirmando(null)}
                alEliminar={eliminar}
              />
            ))}

            <Hechos hechos={grupos.hechos} ocupado={ocupado} alVolver={volverAPendientes} />

            <Nuevo semaforo={semaforo} alGuardar={setAviso} />
          </>
        )}

        <div className="semaforo-ventana__aviso">
          {aviso?.tipo === 'fallo' ? (
            <p className="semaforo__fallo" role="alert">
              {aviso.texto}
            </p>
          ) : (
            <p className="semaforo__bien" role="status">
              {aviso?.texto}
              {aviso?.deshacer !== undefined && (
                <button
                  ref={deshacer}
                  type="button"
                  className="semaforo__deshacer"
                  onClick={() => {
                    const accion = aviso.deshacer;

                    if (accion !== undefined) {
                      void alDeshacer(accion);
                    }
                  }}
                >
                  Deshacer
                </button>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Los cambios que chocaron con otro dispositivo (SCRUM-140, ADR 0009): lo del servidor y lo
 * que la persona cambio, lado a lado, para que elija. Nada se descarta hasta que elija.
 */
function Choques({
  choques,
  ocupado,
  alElegir,
}: {
  choques: readonly Choque[];
  ocupado: string | null;
  alElegir: (choque: Choque, eleccion: 'servidor' | 'mio') => void;
}) {
  const idDelTitulo = useId();

  if (choques.length === 0) {
    return null;
  }

  const hoy = diaEnLaZona(new Date());

  return (
    <section className="semaforo-choques" aria-labelledby={idDelTitulo}>
      <h3 id={idDelTitulo} className="semaforo-choques__titulo">
        {choques.length === 1
          ? 'Un cambio chocó con otro dispositivo'
          : `${String(choques.length)} cambios chocaron con otro dispositivo`}
      </h3>
      <p className="semaforo__nota">
        Lo cambiaste sin conexión y, mientras tanto, se cambió en otro dispositivo. Elige con cuál
        quedarte: no se pierde nada hasta que elijas.
      </p>

      {choques.map((choque) => (
        <UnChoque
          key={choque.id}
          choque={choque}
          hoy={hoy}
          ocupado={ocupado === choque.id}
          alElegir={(eleccion) => alElegir(choque, eleccion)}
        />
      ))}
    </section>
  );
}

/** Un cambio que choco: lo del otro dispositivo y lo de la persona, y como elegir. */
function UnChoque({
  choque,
  hoy,
  ocupado,
  alElegir,
}: {
  choque: Choque;
  hoy: string;
  ocupado: boolean;
  alElegir: (eleccion: 'servidor' | 'mio') => void;
}) {
  const idDelOtro = useId();
  const idDeMio = useId();

  return (
    <article className="semaforo-choque">
      <p className="semaforo-choque__texto">{choque.mio.texto}</p>

      <div className="semaforo-choque__columnas">
        <section className="semaforo-choque__columna" aria-labelledby={idDelOtro}>
          <h4 id={idDelOtro}>En el otro dispositivo</h4>
          {choque.delServidor === undefined ? (
            <p className="semaforo__nota">No se puede ver ahora. Conéctate para compararlo.</p>
          ) : (
            <ul>
              {describirPendiente(choque.delServidor, hoy).map((linea) => (
                <li key={linea}>{linea}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="semaforo-choque__columna" aria-labelledby={idDeMio}>
          <h4 id={idDeMio}>Tu cambio</h4>
          <ul>
            {describirCambios(choque.cambios, choque.eliminar, hoy).map((linea) => (
              <li key={linea}>{linea}</li>
            ))}
          </ul>
        </section>
      </div>

      <div className="semaforo__acciones">
        <button
          type="button"
          className="semaforo__accion"
          disabled={ocupado}
          onClick={() => alElegir('servidor')}
        >
          Quedarme con lo del otro dispositivo
        </button>
        <button
          type="button"
          className="semaforo__accion semaforo__accion--principal"
          disabled={ocupado}
          onClick={() => alElegir('mio')}
        >
          Aplicar mi cambio
        </button>
      </div>
    </article>
  );
}

function Nivel({
  nivel,
  pendientes,
  ahora,
  resaltado,
  confirmando,
  editandoFecha,
  ocupado,
  alMarcarHecho,
  alSubir,
  alEditarFecha,
  alCambiarFecha,
  alPedirEliminar,
  alCancelarEliminar,
  alEliminar,
}: {
  nivel: NivelDePendiente;
  pendientes: readonly PendienteEnPantalla[];
  ahora: Date;
  resaltado: string | null;
  confirmando: string | null;
  editandoFecha: string | null;
  ocupado: string | null;
  alMarcarHecho: (pendiente: Pendiente) => void;
  alSubir: (pendiente: Pendiente, nivel: NivelDePendiente) => void;
  alEditarFecha: (id: string | null) => void;
  alCambiarFecha: (pendiente: Pendiente, fecha: string | null) => void;
  alPedirEliminar: (id: string) => void;
  alCancelarEliminar: () => void;
  alEliminar: (pendiente: Pendiente) => void;
}) {
  const idDelNivel = useId();
  const { nombre, plazo, sube } = NIVEL[nivel];
  const hoy = diaEnLaZona(ahora);

  return (
    <section className="semaforo-nivel" aria-labelledby={idDelNivel}>
      <h3 id={idDelNivel} className="semaforo-nivel__cabeza">
        <span className={`semaforo-punto semaforo-punto--${nivel}`} aria-hidden="true" />
        <span className="semaforo-nivel__nombre">{nombre}</span>
        <span className="semaforo-nivel__plazo">{plazo}</span>
      </h3>

      {pendientes.length === 0 ? (
        <p className="semaforo__nota">Nada aquí.</p>
      ) : (
        <ul className="semaforo-nivel__lista">
          {pendientes.map((pendiente) => {
            const idDelTexto = `pendiente-${pendiente.id}-texto`;

            return (
              <li
                key={pendiente.id}
                id={`pendiente-${pendiente.id}`}
                className={`semaforo-tarea semaforo-tarea--${nivel}${
                  pendiente.id === resaltado ? ' semaforo-tarea--resaltada' : ''
                }`}
              >
                <p id={idDelTexto} className="semaforo-tarea__texto">
                  {pendiente.texto}
                </p>
                <p className="semaforo-tarea__edad">{edad(diasDesde(pendiente.creadoEn, ahora))}</p>
                {pendiente.fechaLimite !== null && (
                  <p
                    className={`semaforo-tarea__limite${
                      vencimiento(pendiente.fechaLimite, hoy).vencida
                        ? ' semaforo-tarea__limite--vencida'
                        : ''
                    }`}
                  >
                    {vencimiento(pendiente.fechaLimite, hoy).texto}
                  </p>
                )}
                <EstadoDelPendienteEnPantalla pendiente={pendiente} />

                {confirmando === pendiente.id ? (
                  <ConfirmarEliminar
                    pendiente={pendiente}
                    ocupado={ocupado === pendiente.id}
                    alCancelar={alCancelarEliminar}
                    alEliminar={() => alEliminar(pendiente)}
                  />
                ) : (
                  <div className="semaforo__acciones">
                    <button
                      type="button"
                      className="semaforo__accion"
                      aria-describedby={idDelTexto}
                      disabled={ocupado === pendiente.id}
                      onClick={() => alMarcarHecho(pendiente)}
                    >
                      Hecho
                    </button>
                    {sube !== null && (
                      <button
                        type="button"
                        className="semaforo__accion"
                        aria-describedby={idDelTexto}
                        disabled={ocupado === pendiente.id}
                        onClick={() => alSubir(pendiente, sube)}
                      >
                        Subir a {NIVEL[sube].nombre}
                      </button>
                    )}
                    <button
                      type="button"
                      className="semaforo__accion"
                      aria-describedby={idDelTexto}
                      aria-expanded={editandoFecha === pendiente.id}
                      disabled={ocupado === pendiente.id}
                      onClick={() =>
                        alEditarFecha(editandoFecha === pendiente.id ? null : pendiente.id)
                      }
                    >
                      {pendiente.fechaLimite === null ? 'Poner fecha' : 'Cambiar fecha'}
                    </button>
                    <button
                      type="button"
                      className="semaforo__accion"
                      aria-describedby={idDelTexto}
                      disabled={ocupado === pendiente.id}
                      onClick={() => alPedirEliminar(pendiente.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                )}

                {confirmando !== pendiente.id && editandoFecha === pendiente.id && (
                  <EditorDeFecha
                    pendiente={pendiente}
                    ocupado={ocupado === pendiente.id}
                    alCambiar={(fecha) => alCambiarFecha(pendiente, fecha)}
                    alCerrar={() => alEditarFecha(null)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * La fecha limite de un pendiente, en el mismo sitio (SCRUM-119).
 *
 * Elegir un dia la guarda de una vez: no hay boton de guardar que olvidar. Es
 * opcional, asi que siempre se puede quitar. Sin fecha, el semaforo recuerda
 * por los dias del color, y aqui se dice.
 */
function EditorDeFecha({
  pendiente,
  ocupado,
  alCambiar,
  alCerrar,
}: {
  pendiente: Pendiente;
  ocupado: boolean;
  alCambiar: (fecha: string | null) => void;
  alCerrar: () => void;
}) {
  const idDelCampo = useId();

  return (
    <div className="semaforo-fecha">
      <label htmlFor={idDelCampo} className="semaforo-fecha__etiqueta">
        Fecha límite
      </label>
      <input
        id={idDelCampo}
        type="date"
        className="semaforo-nuevo__campo semaforo-fecha__campo"
        value={pendiente.fechaLimite ?? ''}
        disabled={ocupado}
        onChange={(evento) => {
          if (evento.target.value !== '') {
            alCambiar(evento.target.value);
          }
        }}
      />
      <div className="semaforo__acciones">
        {pendiente.fechaLimite !== null && (
          <button
            type="button"
            className="semaforo__accion"
            disabled={ocupado}
            onClick={() => alCambiar(null)}
          >
            Quitar fecha
          </button>
        )}
        <button type="button" className="semaforo__accion" onClick={alCerrar}>
          Cerrar
        </button>
      </div>
      <p className="semaforo__nota">
        {pendiente.fechaLimite === null
          ? 'Sin fecha, te lo recordamos según su color.'
          : 'Te lo recordamos cuando llegue ese día.'}
      </p>
    </div>
  );
}

/** Eliminar no tiene vuelta atras: se pide confirmarlo en el mismo sitio. */
function ConfirmarEliminar({
  pendiente,
  ocupado,
  alCancelar,
  alEliminar,
}: {
  pendiente: Pendiente;
  ocupado: boolean;
  alCancelar: () => void;
  alEliminar: () => void;
}) {
  const cancelar = useRef<HTMLButtonElement>(null);
  const idDeLaPregunta = useId();

  useEffect(() => {
    cancelar.current?.focus();
  }, []);

  return (
    <div className="semaforo-confirmar" role="group" aria-labelledby={idDeLaPregunta}>
      <p id={idDeLaPregunta} className="semaforo-confirmar__pregunta">
        ¿Eliminar «{pendiente.texto}»? No se puede deshacer.
      </p>
      <div className="semaforo__acciones">
        <button ref={cancelar} type="button" className="semaforo__accion" onClick={alCancelar}>
          Cancelar
        </button>
        <button
          type="button"
          className="semaforo__accion semaforo__accion--peligro"
          disabled={ocupado}
          onClick={alEliminar}
        >
          {ocupado ? 'Eliminando…' : 'Eliminar'}
        </button>
      </div>
    </div>
  );
}

/** Lo hecho en los ultimos 7 dias, plegado: se puede devolver a pendientes. */
function Hechos({
  hechos,
  ocupado,
  alVolver,
}: {
  hechos: readonly PendienteEnPantalla[];
  ocupado: string | null;
  alVolver: (pendiente: Pendiente) => void;
}) {
  if (hechos.length === 0) {
    return null;
  }

  return (
    <details className="semaforo-hechos">
      <summary>Hechos esta semana ({hechos.length})</summary>
      <ul className="semaforo-hechos__lista">
        {hechos.map((pendiente) => {
          const idDelTexto = `pendiente-${pendiente.id}-hecho`;

          return (
            <li key={pendiente.id} className="semaforo-hechos__fila">
              <span id={idDelTexto} className="semaforo-hechos__texto">
                {pendiente.texto}
                {textoDelEstado(pendiente.estado) !== null && (
                  <span className="semaforo-hechos__estado">
                    {' '}
                    · {textoDelEstado(pendiente.estado)}
                  </span>
                )}
              </span>
              <button
                type="button"
                className="semaforo__accion"
                aria-describedby={idDelTexto}
                disabled={ocupado === pendiente.id}
                onClick={() => alVolver(pendiente)}
              >
                Volver a pendientes
              </button>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function Nuevo({
  semaforo,
  alGuardar,
}: {
  semaforo: UsoDelSemaforo;
  alGuardar: (aviso: Aviso) => void;
}) {
  const [texto, setTexto] = useState('');
  const [nivel, setNivel] = useState<NivelDePendiente>('aplazable');
  const [fecha, setFecha] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const idDelCampo = useId();
  const idDeLaFecha = useId();
  const grupo = useId();

  async function alAnadir(evento: FormEvent) {
    evento.preventDefault();

    const limpio = texto.trim();

    if (limpio === '') {
      alGuardar({ tipo: 'fallo', texto: 'Escribe qué tienes pendiente.' });
      return;
    }

    setOcupado(true);
    alGuardar(null);

    try {
      await semaforo.crear(limpio, nivel, fecha === '' ? undefined : fecha);
      setTexto('');
      setFecha('');
      alGuardar({ tipo: 'bien', texto: `Anotado en ${NIVEL[nivel].nombre}.` });
    } catch {
      alGuardar({ tipo: 'fallo', texto: NO_SE_PUDO_GUARDAR });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form className="semaforo-nuevo" onSubmit={(evento) => void alAnadir(evento)} noValidate>
      <label htmlFor={idDelCampo} className="semaforo-nuevo__etiqueta">
        Añadir algo
      </label>
      <input
        id={idDelCampo}
        className="semaforo-nuevo__campo"
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        maxLength={LARGO_MAXIMO_DEL_TEXTO}
        placeholder="Ej.: Pedir cita en la EPS"
        autoComplete="off"
        enterKeyHint="done"
      />

      <fieldset className="semaforo-nuevo__niveles">
        <legend className="solo-lectores">¿Para cuándo?</legend>
        {NIVELES.map((uno) => (
          <label
            key={uno}
            className={`semaforo-nuevo__nivel${uno === nivel ? ' semaforo-nuevo__nivel--elegido' : ''}`}
          >
            <input
              type="radio"
              name={grupo}
              value={uno}
              checked={uno === nivel}
              onChange={() => setNivel(uno)}
              className="solo-lectores"
            />
            <span className={`semaforo-punto semaforo-punto--${uno}`} aria-hidden="true" />
            {NIVEL[uno].nombre}
          </label>
        ))}
      </fieldset>

      <div className="semaforo-nuevo__fecha">
        <label htmlFor={idDeLaFecha} className="semaforo-nuevo__fecha-etiqueta">
          Fecha límite <span>(opcional)</span>
        </label>
        <input
          id={idDeLaFecha}
          type="date"
          className="semaforo-nuevo__campo"
          value={fecha}
          onChange={(evento) => setFecha(evento.target.value)}
        />
      </div>

      <button
        type="submit"
        className="semaforo__accion semaforo__accion--principal"
        disabled={ocupado}
      >
        {ocupado ? 'Añadiendo…' : 'Añadir'}
      </button>
    </form>
  );
}
