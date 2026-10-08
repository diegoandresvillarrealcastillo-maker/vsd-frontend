import { useId, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { MedidorDeContrasena } from '../../componentes/MedidorDeContrasena.tsx';
import { DatosDeHace } from '../../conexion/DatosDeHace.tsx';
import { ID_DEL_CONTENIDO } from '../../componentes/SaltoAlContenido.tsx';
import '../../estilos/aplicacion.css';
import { ErrorDeLaApi } from '../../infraestructura/api/clienteHttp.ts';
import {
  borrarMiCuenta,
  exportarMisDatos,
  FRASE_PARA_BORRAR,
  type CambiosDePreferencias,
  type Cuenta,
  type Modulo,
} from '../../infraestructura/api/cuenta.ts';
import { useMascotaPropia } from '../../foto/mascotaPropia.ts';
import { MascotaFlotante } from '../../mascota/MascotaFlotante.tsx';
import {
  FORMA_DE_LA_MASCOTA_PROPIA,
  mascotaParaMostrar,
  nombreAlElegir,
  nombreDeFabrica,
  PERSONAJES,
  PERSONAJES_EN_ORDEN,
  PRESENTACION_DE_LA_MASCOTA_PROPIA,
  RASGO_DE_LA_MASCOTA_PROPIA,
  type Eleccion,
} from '../../mascota/personajes.ts';
import { sprite } from '../../mascota/sprites.ts';
import { RUTAS } from '../../rutas/rutas.ts';
import { Semaforo } from '../../semaforo/Semaforo.tsx';
import { mensajeSiNoCumple } from '../../sesion/reglaDeContrasena.ts';
import { olvidarLosDatosDeLaSesionActual } from '../../sincronizacion/ciclo.ts';
import { exportarLoQueNoSeHaEnviado } from '../../sincronizacion/loGuardadoEnEsteEquipo.ts';
import { useSesion } from '../../sesion/useSesion.ts';
import { BarraSuperior } from '../panel/Estructura.tsx';
import { Icono } from '../panel/Icono.tsx';
import { MODULOS, ORDEN } from '../panel/modulos.ts';
import { armarLaExportacion } from './exportacion.ts';
import { Apartado, MensajeDeAviso, SIN_CONEXION, type Aviso } from './piezas.tsx';
import { TuFoto } from './TuFoto.tsx';
import { TuMascotaPropia } from './TuMascotaPropia.tsx';
import { TusAvisos } from './TusAvisos.tsx';
import { usePerfil } from './usePerfil.ts';

/**
 * El perfil: todo lo que la persona configura de su cuenta (SCRUM-101).
 *
 * - El nombre y los modulos activos se cambian aqui.
 * - La foto se elige de la galeria, se recorta y se comprime en el dispositivo,
 *   y se puede quitar (SCRUM-120).
 * - El correo se muestra pero no se edita: es la via de acceso y la identidad
 *   en Supabase.
 * - La contrasena se cambia con un codigo que llega al correo. Va directo a
 *   Supabase y nunca pasa por nuestra API.
 * - La mascota se elige entre los cinco personajes y se le pone nombre
 *   (SCRUM-99). Quien subio un dibujo propio lo tiene tambien entre las
 *   opciones, y lo sube y lo quita en su propio apartado (SCRUM-122).
 * - El diario solo se revisa si la persona lo permite (SCRUM-108).
 * - Los avisos: si llegan a este dispositivo y a que hora cada uno
 *   (SCRUM-102).
 * - Los datos se descargan y la cuenta se borra (SCRUM-75).
 */
export function Perfil() {
  const { estado, reintentar, guardar, reemplazarCuenta } = usePerfil();

  return (
    <div className="app">
      <BarraSuperior conSecciones={false} />

      <main id={ID_DEL_CONTENIDO} tabIndex={-1} className="app__contenido perfil">
        <Link to={RUTAS.PANEL} className="perfil__volver">
          <span className="perfil__volver-flecha" aria-hidden="true">
            <Icono nombre="arrow" tamano={16} />
          </span>
          Volver a tu panel
        </Link>

        <div>
          <p className="app__antetitulo">Tu cuenta</p>
          <h1 className="app__titulo perfil__titulo">Tu perfil</h1>
        </div>

        {estado.fase === 'cargando' && (
          <p className="app__aviso" role="status">
            Cargando tu perfil…
          </p>
        )}

        {estado.fase === 'error' && (
          <div className="app__aviso app__aviso--fallo" role="alert">
            <p>{estado.mensaje}</p>
            <button type="button" className="app__boton" onClick={reintentar}>
              Reintentar
            </button>
          </div>
        )}

        {estado.fase === 'listo' && (
          <>
            {/* Sin conexion se ve la copia de este equipo, y se dice de cuando es (SCRUM-142). */}
            {estado.deLaCopia !== null && (
              <DatosDeHace guardadoEn={estado.deLaCopia} ahora={estado.ahora} />
            )}
            {/* El nombre y la mascota parten del valor de la cuenta: si se vuelve a leer (llega lo
                del servidor tras ver la copia), empiezan de nuevo con lo que llego. */}
            <Nombre key={estado.lectura} cuenta={estado.cuenta} guardar={guardar} />
            <TuFoto actualizarCuenta={reemplazarCuenta} />
            <Modulos cuenta={estado.cuenta} guardar={guardar} />
            {/* Al subir o quitar la mascota propia, las opciones cambian y se parte de
                cero. Guardar la eleccion no la cambia: asi no se pierde su aviso. */}
            <TuMascota
              key={`${String(estado.lectura)}:${estado.cuenta.mascotaPropia?.actualizadaEl ?? 'sin-mascota-propia'}`}
              cuenta={estado.cuenta}
              guardar={guardar}
            />
            <TuMascotaPropia
              cuenta={estado.cuenta}
              guardar={guardar}
              actualizarCuenta={reemplazarCuenta}
            />
            <TuDiario cuenta={estado.cuenta} guardar={guardar} />
            <TusAvisos />
            <Correo correo={estado.cuenta.correo} />
            <Contrasena correo={estado.cuenta.correo} />
            <TusDatos />
            <BorrarCuenta />
            <MascotaFlotante mascota={estado.cuenta.mascota} />
            <Semaforo />
          </>
        )}
      </main>
    </div>
  );
}

function Nombre({
  cuenta,
  guardar,
}: {
  cuenta: Cuenta;
  guardar: (cambios: CambiosDePreferencias) => Promise<void>;
}) {
  const [nombre, setNombre] = useState(cuenta.nombre ?? '');
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
  const id = useId();

  async function alGuardar(evento: FormEvent) {
    evento.preventDefault();

    if (nombre.trim() === '') {
      setAviso({ tipo: 'fallo', texto: 'Escribe cómo quieres que te llamemos.' });
      return;
    }

    setOcupado(true);
    setAviso(null);

    try {
      await guardar({ nombre });
      setAviso({ tipo: 'bien', texto: 'Listo, así te llamaremos.' });
    } catch (error) {
      setAviso({
        tipo: 'fallo',
        texto:
          error instanceof ErrorDeLaApi && error.codigo === 'NOMBRE_INVALIDO'
            ? 'Ese nombre no se puede guardar: usa entre 1 y 100 caracteres, sin saltos de línea.'
            : SIN_CONEXION,
      });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Apartado titulo="Cómo te llamamos" ayuda="Es el nombre del saludo de tu panel.">
      <form className="perfil__fila" onSubmit={(evento) => void alGuardar(evento)} noValidate>
        <label htmlFor={id} className="solo-lectores">
          Nombre
        </label>
        <input
          id={id}
          className="bienvenida__entrada perfil__entrada"
          value={nombre}
          onChange={(evento) => setNombre(evento.target.value)}
          maxLength={100}
          autoComplete="given-name"
        />
        <button type="submit" className="app__boton" disabled={ocupado}>
          {ocupado ? 'Guardando…' : 'Guardar nombre'}
        </button>
      </form>
      <MensajeDeAviso aviso={aviso} />
    </Apartado>
  );
}

function Modulos({
  cuenta,
  guardar,
}: {
  cuenta: Cuenta;
  guardar: (cambios: CambiosDePreferencias) => Promise<void>;
}) {
  const [elegidos, setElegidos] = useState<readonly Modulo[]>(cuenta.modulosActivos);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);

  const cambio =
    elegidos.length !== cuenta.modulosActivos.length ||
    elegidos.some((modulo) => !cuenta.modulosActivos.includes(modulo));

  function alternar(modulo: Modulo) {
    setAviso(null);
    setElegidos((antes) =>
      antes.includes(modulo) ? antes.filter((uno) => uno !== modulo) : [...antes, modulo],
    );
  }

  async function alGuardar() {
    if (elegidos.length === 0) {
      setAviso({ tipo: 'fallo', texto: 'Deja al menos un módulo activo.' });
      return;
    }

    setOcupado(true);
    setAviso(null);

    try {
      await guardar({ modulosActivos: ORDEN.filter((modulo) => elegidos.includes(modulo)) });
      setAviso({ tipo: 'bien', texto: 'Tus módulos quedaron guardados.' });
    } catch {
      setAviso({ tipo: 'fallo', texto: SIN_CONEXION });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Apartado
      titulo="Tus módulos"
      ayuda="Los que tengas activos aparecen en tu panel con lo que te toca cada día. Desactivar uno no borra lo que ya hiciste en él."
    >
      <div className="perfil__modulos">
        {ORDEN.map((modulo) => {
          const datos = MODULOS[modulo];
          const activo = elegidos.includes(modulo);

          return (
            <button
              key={modulo}
              type="button"
              role="switch"
              aria-checked={activo}
              className={`perfil__modulo${activo ? ' perfil__modulo--activo' : ''}`}
              style={
                { '--modulo-fondo': datos.fondo, '--modulo-acento': datos.acento } as CSSProperties
              }
              onClick={() => alternar(modulo)}
            >
              <span className="tarjeta-modulo__icono">
                <Icono nombre={datos.icono} />
              </span>
              <span className="perfil__modulo-nombre">{datos.titulo}</span>
              <span className="perfil__interruptor" aria-hidden="true">
                <span />
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="app__boton perfil__accion"
        onClick={() => void alGuardar()}
        disabled={ocupado || !cambio}
      >
        {ocupado ? 'Guardando…' : 'Guardar módulos'}
      </button>
      <MensajeDeAviso aviso={aviso} />
    </Apartado>
  );
}

const LARGO_MAXIMO_DEL_NOMBRE_DE_LA_MASCOTA = 30;

/**
 * Elegir el personaje y su nombre.
 *
 * Cada personaje llega con su propio nombre. Si la persona no lo ha cambiado,
 * al elegir otro personaje el nombre cambia con el; si ya le puso uno suyo, se
 * respeta.
 *
 * Quien subio su propia mascota (SCRUM-122) la ve como una sexta opcion, «Mi
 * mascota». Quien no, no ve nada nuevo: no hay nada que elegir.
 */
function TuMascota({
  cuenta,
  guardar,
}: {
  cuenta: Cuenta;
  guardar: (cambios: CambiosDePreferencias) => Promise<void>;
}) {
  const actual = mascotaParaMostrar(cuenta.mascota);
  const tienePropia = cuenta.mascotaPropia != null;
  const dibujoPropio = useMascotaPropia();
  // Una forma «propia» sin dibujo guardado no tiene nada que elegir: se dibuja
  // como Fungito, igual que una forma que este frontend no conoce.
  const eleccionActual: Eleccion =
    actual.propia && tienePropia ? FORMA_DE_LA_MASCOTA_PROPIA : actual.personaje;
  const [eleccion, setEleccion] = useState<Eleccion>(eleccionActual);
  const [nombre, setNombre] = useState(actual.nombre);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
  const grupo = useId();
  const idDelNombre = useId();
  const opciones: readonly Eleccion[] = tienePropia
    ? [...PERSONAJES_EN_ORDEN, FORMA_DE_LA_MASCOTA_PROPIA]
    : PERSONAJES_EN_ORDEN;

  // Sin mascota guardada todavia, guardar la de siempre tambien es un cambio.
  const cambio =
    cuenta.mascota === null || eleccion !== eleccionActual || nombre.trim() !== actual.nombre;

  function elegir(nueva: Eleccion) {
    setAviso(null);
    setNombre(nombreAlElegir(nombre, eleccion, nueva));
    setEleccion(nueva);
  }

  async function alGuardar(evento: FormEvent) {
    evento.preventDefault();

    const limpio = nombre.trim();

    if (limpio === '') {
      setAviso({ tipo: 'fallo', texto: 'Ponle un nombre a tu mascota.' });
      return;
    }

    setOcupado(true);
    setAviso(null);

    try {
      await guardar({ mascota: { forma: eleccion, nombre: limpio } });
      setNombre(limpio);
      setAviso({ tipo: 'bien', texto: `Listo, ${limpio} te acompaña.` });
    } catch (error) {
      setAviso({
        tipo: 'fallo',
        texto:
          error instanceof ErrorDeLaApi && error.codigo === 'MASCOTA_INVALIDA'
            ? `Ese nombre no se puede guardar: usa entre 1 y ${LARGO_MAXIMO_DEL_NOMBRE_DE_LA_MASCOTA} caracteres, sin saltos de línea.`
            : SIN_CONEXION,
      });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Apartado
      titulo="Tu mascota"
      ayuda="Te acompaña flotando por la aplicación. Elige quién es y cómo se llama."
    >
      <form
        className="perfil__formulario perfil__mascota"
        onSubmit={(evento) => void alGuardar(evento)}
        noValidate
      >
        <fieldset
          className={`perfil__personajes${tienePropia ? ' perfil__personajes--con-propia' : ''}`}
        >
          <legend className="solo-lectores">Personaje</legend>
          {opciones.map((id) => (
            <label
              key={id}
              className={`perfil__personaje${id === eleccion ? ' perfil__personaje--elegido' : ''}`}
            >
              <input
                type="radio"
                name={grupo}
                value={id}
                checked={id === eleccion}
                onChange={() => elegir(id)}
                className="solo-lectores"
              />
              {id === FORMA_DE_LA_MASCOTA_PROPIA ? (
                dibujoPropio.url === null ? (
                  <span
                    className="perfil__personaje-dibujo perfil__personaje-dibujo--vacio"
                    aria-hidden="true"
                  />
                ) : (
                  <img
                    className="perfil__personaje-dibujo perfil__personaje-dibujo--propio"
                    src={dibujoPropio.url}
                    alt=""
                    width={72}
                    height={72}
                  />
                )
              ) : (
                <img
                  className="perfil__personaje-dibujo"
                  src={sprite(id, 'normal')}
                  alt=""
                  width={72}
                  height={72}
                  loading="lazy"
                />
              )}
              <span className="perfil__personaje-nombre">{nombreDeFabrica(id)}</span>
              <span className="perfil__personaje-rasgo">
                {id === FORMA_DE_LA_MASCOTA_PROPIA
                  ? RASGO_DE_LA_MASCOTA_PROPIA
                  : PERSONAJES[id].rasgo}
              </span>
            </label>
          ))}
        </fieldset>

        <p className="app__nota perfil__ayuda">
          {eleccion === FORMA_DE_LA_MASCOTA_PROPIA
            ? PRESENTACION_DE_LA_MASCOTA_PROPIA
            : PERSONAJES[eleccion].presentacion}
        </p>

        <div className="bienvenida__campo">
          <label htmlFor={idDelNombre} className="bienvenida__etiqueta">
            Cómo se llama
          </label>
          <input
            id={idDelNombre}
            className="bienvenida__entrada"
            value={nombre}
            onChange={(evento) => {
              setAviso(null);
              setNombre(evento.target.value);
            }}
            maxLength={LARGO_MAXIMO_DEL_NOMBRE_DE_LA_MASCOTA}
            autoComplete="off"
          />
        </div>

        <button type="submit" className="app__boton perfil__accion" disabled={ocupado || !cambio}>
          {ocupado ? 'Guardando…' : 'Guardar mascota'}
        </button>
      </form>
      <MensajeDeAviso aviso={aviso} />
    </Apartado>
  );
}

/**
 * El permiso para revisar el diario (SCRUM-108).
 *
 * Lo que la persona escribe en su diario no pasa por ninguna deteccion salvo
 * que ella lo encienda aqui. Es un interruptor y se guarda al pulsarlo; el
 * estado que se pinta es el que devuelve la API, no el que se pidio.
 *
 * Mientras guarda no se deshabilita: un boton deshabilitado pierde el foco, y
 * quien usa el teclado tendria que volver a buscarlo. Los clics de mas se
 * ignoran.
 */
function TuDiario({
  cuenta,
  guardar,
}: {
  cuenta: Cuenta;
  guardar: (cambios: CambiosDePreferencias) => Promise<void>;
}) {
  const encendido = cuenta.diarioConRecomendaciones;
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
  const datos = MODULOS.emociones;
  const idDeLaExplicacion = useId();

  async function alternar() {
    if (ocupado) {
      return;
    }

    const nuevo = !encendido;

    setOcupado(true);
    setAviso(null);

    try {
      await guardar({ diarioConRecomendaciones: nuevo });
      setAviso({
        tipo: 'bien',
        texto: nuevo
          ? 'Listo. Si algo de lo que escribes suena a que lo estás pasando mal, te mostraremos a dónde acudir.'
          : 'Listo. Tu diario ya no se revisa.',
      });
    } catch {
      setAviso({ tipo: 'fallo', texto: SIN_CONEXION });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Apartado
      titulo="Tu diario"
      ayuda="Lo que escribes en tu diario es tuyo. Mientras esto esté apagado, se guarda tal cual y nada lo revisa."
    >
      <button
        type="button"
        role="switch"
        aria-checked={encendido}
        aria-describedby={idDeLaExplicacion}
        className={`perfil__modulo${encendido ? ' perfil__modulo--activo' : ''}`}
        style={{ '--modulo-fondo': datos.fondo, '--modulo-acento': datos.acento } as CSSProperties}
        onClick={() => void alternar()}
      >
        <span className="tarjeta-modulo__icono">
          <Icono nombre="book" />
        </span>
        <span className="perfil__modulo-nombre">Recomendaciones según mi diario</span>
        <span className="perfil__interruptor" aria-hidden="true">
          <span />
        </span>
      </button>

      <p id={idDeLaExplicacion} className="app__nota perfil__ayuda">
        Si lo enciendes, la aplicación revisa de forma automática lo que escribes y, si algo suena a
        que lo estás pasando mal, te muestra líneas de atención a las que puedes acudir. Encenderlo
        no hace que ninguna persona lo lea. Puedes apagarlo cuando quieras.
      </p>
      <MensajeDeAviso aviso={aviso} />
    </Apartado>
  );
}

function Correo({ correo }: { correo: string }) {
  return (
    <Apartado
      titulo="Tu correo"
      ayuda="Es tu forma de entrar y no se puede cambiar desde aquí."
      exigeConexion={false}
    >
      <p className="perfil__correo">{correo}</p>
    </Apartado>
  );
}

/**
 * El cambio de contrasena en dos pasos.
 *
 * Primero se pide un codigo, que Supabase manda al correo de la cuenta. Despues
 * se escribe con la contrasena nueva. Sin un codigo valido, Supabase rechaza el
 * cambio: quien encuentre la sesion abierta en un equipo ajeno no puede
 * cambiar la contrasena sin acceso al correo.
 */
function Contrasena({ correo }: { correo: string }) {
  const { pedirCodigoDeVerificacion, cambiarContrasenaConCodigo } = useSesion();
  const [paso, setPaso] = useState<'inicio' | 'codigo'>('inicio');
  const [codigo, setCodigo] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
  const idCodigo = useId();
  const idNueva = useId();
  const idRepetida = useId();
  const idMedidor = useId();

  async function pedirCodigo() {
    setOcupado(true);
    setAviso(null);

    const resultado = await pedirCodigoDeVerificacion();

    setOcupado(false);

    if (!resultado.ok) {
      setAviso({ tipo: 'fallo', texto: resultado.mensaje ?? SIN_CONEXION });
      return;
    }

    setPaso('codigo');
    setAviso({ tipo: 'bien', texto: `Te enviamos un código a ${correo}. Revisa tu bandeja.` });
  }

  async function alCambiar(evento: FormEvent) {
    evento.preventDefault();

    if (codigo.trim() === '') {
      setAviso({ tipo: 'fallo', texto: 'Escribe el código que te llegó al correo.' });
      return;
    }

    const faltaAlgo = mensajeSiNoCumple(nueva);

    if (faltaAlgo !== null) {
      setAviso({ tipo: 'fallo', texto: faltaAlgo });
      return;
    }

    if (nueva !== repetida) {
      setAviso({ tipo: 'fallo', texto: 'Las dos contraseñas no coinciden.' });
      return;
    }

    setOcupado(true);
    setAviso(null);

    const resultado = await cambiarContrasenaConCodigo(nueva, codigo);

    setOcupado(false);

    if (!resultado.ok) {
      setAviso({ tipo: 'fallo', texto: resultado.mensaje ?? SIN_CONEXION });
      return;
    }

    setPaso('inicio');
    setCodigo('');
    setNueva('');
    setRepetida('');
    setAviso({ tipo: 'bien', texto: 'Tu contraseña quedó cambiada.' });
  }

  return (
    <Apartado
      titulo="Contraseña"
      ayuda="Para cambiarla te enviamos un código a tu correo. Así nadie puede cambiarla con solo encontrar tu sesión abierta."
    >
      {paso === 'inicio' ? (
        <button
          type="button"
          className="app__boton perfil__accion"
          onClick={() => void pedirCodigo()}
          disabled={ocupado}
        >
          {ocupado ? 'Enviando…' : 'Enviarme un código'}
        </button>
      ) : (
        <form
          className="perfil__formulario"
          onSubmit={(evento) => void alCambiar(evento)}
          noValidate
        >
          <div className="bienvenida__campo">
            <label htmlFor={idCodigo} className="bienvenida__etiqueta">
              Código del correo
            </label>
            <input
              id={idCodigo}
              className="bienvenida__entrada"
              value={codigo}
              onChange={(evento) => setCodigo(evento.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </div>
          <div className="bienvenida__campo">
            <label htmlFor={idNueva} className="bienvenida__etiqueta">
              Contraseña nueva
            </label>
            <input
              id={idNueva}
              type="password"
              className="bienvenida__entrada"
              value={nueva}
              onChange={(evento) => setNueva(evento.target.value)}
              autoComplete="new-password"
              aria-describedby={idMedidor}
            />
            <MedidorDeContrasena contrasena={nueva} id={idMedidor} />
          </div>
          <div className="bienvenida__campo">
            <label htmlFor={idRepetida} className="bienvenida__etiqueta">
              Repite la contraseña nueva
            </label>
            <input
              id={idRepetida}
              type="password"
              className="bienvenida__entrada"
              value={repetida}
              onChange={(evento) => setRepetida(evento.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="perfil__fila">
            <button type="submit" className="app__boton" disabled={ocupado}>
              {ocupado ? 'Cambiando…' : 'Cambiar contraseña'}
            </button>
            <button
              type="button"
              className="perfil__secundario"
              onClick={() => void pedirCodigo()}
              disabled={ocupado}
            >
              Enviarme otro código
            </button>
          </div>
        </form>
      )}
      <MensajeDeAviso aviso={aviso} />
    </Apartado>
  );
}

/**
 * Descarga lo que VSD Health guarda de la persona, en un archivo JSON.
 *
 * Incluye lo que este equipo todavia tiene guardado y no ha enviado (SCRUM-142). Exige
 * conexion: lo que guarda el servidor solo lo sabe el servidor.
 */
function TusDatos() {
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);

  async function descargar() {
    setOcupado(true);
    setAviso(null);

    try {
      // Lo que dice el servidor y, aparte, lo que este equipo todavia no le ha enviado.
      const datos = armarLaExportacion(
        await exportarMisDatos(),
        await exportarLoQueNoSeHaEnviado(),
      );
      const archivo = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
      const enlace = document.createElement('a');

      enlace.href = URL.createObjectURL(archivo);
      enlace.download = 'vsd-health-mis-datos.json';
      enlace.click();
      URL.revokeObjectURL(enlace.href);

      setAviso({ tipo: 'bien', texto: 'Tus datos se descargaron.' });
    } catch {
      setAviso({ tipo: 'fallo', texto: 'No se pudieron descargar. Inténtalo de nuevo.' });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Apartado
      titulo="Tus datos"
      ayuda="Descarga en un archivo todo lo que VSD Health guarda de ti: tu cuenta, tus resultados y tu diario. Si este equipo todavía guarda cambios que no se han enviado, también van."
    >
      <button
        type="button"
        className="app__boton perfil__accion"
        onClick={() => void descargar()}
        disabled={ocupado}
      >
        {ocupado ? 'Preparando…' : 'Descargar mis datos'}
      </button>
      <MensajeDeAviso aviso={aviso} />
    </Apartado>
  );
}

/**
 * Borrar la cuenta. No tiene vuelta atras, asi que pide escribir la frase
 * exacta antes de habilitar el boton, igual que la API.
 *
 * Si la API la borra, **tambien se borra todo lo que este equipo guardaba de ella**. Si no
 * la borra, no se toca nada: la cuenta sigue ahi y lo guardado todavia tiene a quien
 * enviarse.
 */
function BorrarCuenta() {
  const { salir } = useSesion();
  const navegar = useNavigate();
  const [frase, setFrase] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
  const id = useId();

  async function borrar(evento: FormEvent) {
    evento.preventDefault();

    if (frase !== FRASE_PARA_BORRAR) {
      return;
    }

    setOcupado(true);
    setAviso(null);

    try {
      await borrarMiCuenta(frase);
      // La cuenta ya no existe: lo que este equipo guardaba de ella (la copia, la cola y la
      // clave que las cifraba) no tiene a quien enviarse. Se olvida **antes** de cerrar
      // sesion, para que no dependa de que cerrarla salga bien (SCRUM-142).
      await olvidarLosDatosDeLaSesionActual();
      await salir();
      // react-router puede devolver una promesa; no hay nada que esperar.
      void navegar(RUTAS.INICIO, { replace: true });
    } catch (error) {
      setOcupado(false);
      setAviso({
        tipo: 'fallo',
        texto:
          error instanceof ErrorDeLaApi && error.codigo === 'BORRADO_NO_COMPLETADO'
            ? 'No se pudo borrar la cuenta en este momento, así que no se borró nada. Inténtalo en unos minutos.'
            : 'No se pudo borrar la cuenta. Revisa tu conexión e inténtalo de nuevo.',
      });
    }
  }

  return (
    <Apartado
      titulo="Borrar tu cuenta"
      ayuda="Se borran tu cuenta, tus resultados, tu diario y tu acceso. No tiene vuelta atrás: si quieres conservar algo, descarga tus datos antes."
      peligro
    >
      <form className="perfil__formulario" onSubmit={(evento) => void borrar(evento)}>
        <div className="bienvenida__campo">
          <label htmlFor={id} className="bienvenida__etiqueta">
            Para confirmar, escribe {FRASE_PARA_BORRAR}
          </label>
          <input
            id={id}
            className="bienvenida__entrada"
            value={frase}
            onChange={(evento) => setFrase(evento.target.value)}
            autoComplete="off"
          />
        </div>
        <button
          type="submit"
          className="perfil__peligro"
          disabled={ocupado || frase !== FRASE_PARA_BORRAR}
        >
          {ocupado ? 'Borrando…' : 'Borrar mi cuenta para siempre'}
        </button>
      </form>
      <MensajeDeAviso aviso={aviso} />
    </Apartado>
  );
}
