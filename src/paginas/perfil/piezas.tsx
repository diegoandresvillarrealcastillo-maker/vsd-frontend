import { useId, type ReactNode } from 'react';

import { ExigeConexion } from '../../componentes/ExigeConexion.tsx';

/**
 * Las piezas que comparten los apartados del perfil: la tarjeta con su
 * titulo y el mensaje de resultado de cada accion.
 */

/**
 * Una tarjeta del perfil con su titulo y su texto de ayuda.
 *
 * Por omision **exige conexion** (SCRUM-142): cambiar el nombre, la foto, la mascota, los
 * avisos o la contrasena, descargar los datos y borrar la cuenta son cosas que decide el
 * servidor, y sin red no se pueden confirmar. Sin conexion los controles se ven
 * deshabilitados, con la explicacion escrita, y lo que se habia escrito no se pierde. Un
 * apartado que solo muestra algo (el correo) lo dice con `exigeConexion={false}`.
 */
export function Apartado({
  titulo,
  ayuda,
  peligro = false,
  exigeConexion = true,
  children,
}: {
  titulo: string;
  ayuda?: string;
  peligro?: boolean;
  exigeConexion?: boolean;
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
      {exigeConexion ? <ExigeConexion>{children}</ExigeConexion> : children}
    </section>
  );
}

/** El resultado de una accion: confirmacion discreta o fallo que interrumpe. */
export type Aviso = { tipo: 'bien' | 'fallo'; texto: string } | null;

export function MensajeDeAviso({ aviso }: { aviso: Aviso }) {
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

export const SIN_CONEXION = 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.';
