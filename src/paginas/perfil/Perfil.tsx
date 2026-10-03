import { useId, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

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
import { RUTAS } from '../../rutas/rutas.ts';
import { useSesion } from '../../sesion/useSesion.ts';
import { BarraSuperior } from '../panel/Estructura.tsx';
import { Icono } from '../panel/Icono.tsx';
import { MODULOS, ORDEN } from '../panel/modulos.ts';
import { usePerfil } from './usePerfil.ts';

/**
 * El perfil: todo lo que la persona configura de su cuenta (SCRUM-101).
 *
 * - El nombre y los modulos activos se cambian aqui.
 * - El correo se muestra pero no se edita: es la via de acceso y la identidad
 *   en Supabase.
 * - La contrasena se cambia con un codigo que llega al correo. Va directo a
 *   Supabase y nunca pasa por nuestra API.
 * - Los datos se descargan y la cuenta se borra (SCRUM-75).
 *
 * La personalizacion de la mascota llega con la mascota (SCRUM-99), en esta
 * misma pantalla.
 */
export function Perfil() {
  const { estado, reintentar, guardar } = usePerfil();

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
            <Nombre cuenta={estado.cuenta} guardar={guardar} />
            <Modulos cuenta={estado.cuenta} guardar={guardar} />
            <Correo correo={estado.cuenta.correo} />
            <Contrasena correo={estado.cuenta.correo} />
            <TusDatos />
            <BorrarCuenta />
          </>
        )}
      </main>
    </div>
  );
}

/** Una tarjeta del perfil con su titulo y su texto de ayuda. */
function Apartado({
  titulo,
  ayuda,
  peligro = false,
  children,
}: {
  titulo: string;
  ayuda?: string;
  peligro?: boolean;
  children: ReactNode;
}) {
  const id = useId();

  return (
    <section
      className={`app__caja perfil__apartado${peligro ? ' perfil__apartado--peligro' : ''}`}
      aria-labelledby={id}
    >
      <h2 id={id} className="perfil__apartado-titulo">
        {titulo}
      </h2>
      {ayuda !== undefined && <p className="app__nota perfil__ayuda">{ayuda}</p>}
      {children}
    </section>
  );
}

/** El resultado de una accion: confirmacion discreta o fallo que interrumpe. */
type Aviso = { tipo: 'bien' | 'fallo'; texto: string } | null;

function MensajeDeAviso({ aviso }: { aviso: Aviso }) {
  if (aviso === null) {
    return null;
  }

  return aviso.tipo === 'bien' ? (
    <p className="perfil__bien" role="status">
      {aviso.texto}
    </p>
  ) : (
    <p className="perfil__fallo" role="alert">
      {aviso.texto}
    </p>
  );
}

const SIN_CONEXION = 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.';

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

function Correo({ correo }: { correo: string }) {
  return (
    <Apartado titulo="Tu correo" ayuda="Es tu forma de entrar y no se puede cambiar desde aquí.">
      <p className="perfil__correo">{correo}</p>
    </Apartado>
  );
}

const MINIMO_DE_CONTRASENA = 8;

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

    if (nueva.length < MINIMO_DE_CONTRASENA) {
      setAviso({
        tipo: 'fallo',
        texto: `La contraseña nueva necesita al menos ${MINIMO_DE_CONTRASENA} caracteres.`,
      });
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
            />
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

/** Descarga lo que VSD Health guarda de la persona, en un archivo JSON. */
function TusDatos() {
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);

  async function descargar() {
    setOcupado(true);
    setAviso(null);

    try {
      const datos = await exportarMisDatos();
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
      ayuda="Descarga en un archivo todo lo que VSD Health guarda de ti: tu cuenta, tus resultados y tu diario."
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
