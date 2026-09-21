import { createContext } from 'react';
import type { Session } from '@supabase/supabase-js';

/** Lo que la aplicacion sabe sobre quien esta dentro. */
export interface EstadoDeSesion {
  /**
   * `null` significa que no hay nadie. Mientras `cargando` sea verdadero, no
   * significa nada todavia: solo que aun no se ha comprobado.
   */
  readonly sesion: Session | null;

  /**
   * Verdadero hasta que se sabe si hay sesion o no.
   *
   * Sin este estado, la aplicacion pinta un instante como si no hubiera nadie
   * y expulsa a quien si tenia sesion. El parpadeo dura poco y la expulsion no
   * se deshace sola.
   */
  readonly cargando: boolean;

  /** Correo de quien esta dentro, o `null`. */
  readonly correo: string | null;

  // Se declaran como propiedades y no con la forma corta de metodo. Con la
  // forma corta, extraerlas con desestructuracion —que es como se usan— hace
  // saltar la regla que avisa de metodos separados de su objeto.
  readonly registrarse: (
    datos: DatosDeAcceso & { aceptaElAviso: boolean },
  ) => Promise<ResultadoDeAcceso>;
  readonly entrar: (datos: DatosDeAcceso) => Promise<ResultadoDeAcceso>;
  readonly entrarConGoogle: (recordar: boolean) => Promise<ResultadoDeAcceso>;
  readonly pedirRecuperacion: (correo: string) => Promise<ResultadoDeAcceso>;
  readonly cambiarContrasena: (nueva: string) => Promise<ResultadoDeAcceso>;
  readonly salir: () => Promise<void>;
}

export interface DatosDeAcceso {
  readonly correo: string;
  readonly contrasena: string;
  /** Sin marcar, la sesion muere al cerrar la pestana. */
  readonly recordar: boolean;
}

/**
 * El resultado de un intento.
 *
 * Se devuelve en vez de lanzar porque un correo equivocado no es una excepcion
 * del programa: es el curso normal de una pantalla de acceso, y la pantalla
 * tiene que poder pintarlo sin envolver cada llamada en un try.
 */
export interface ResultadoDeAcceso {
  readonly ok: boolean;
  /** Mensaje ya listo para mostrar. Vacio cuando `ok`. */
  readonly mensaje?: string;
}

export const SesionContexto = createContext<EstadoDeSesion | null>(null);
