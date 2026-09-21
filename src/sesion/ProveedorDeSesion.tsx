import type { AuthError, Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  olvidarPreferenciaDePestana,
  recordarEnEsteEquipo,
} from '../infraestructura/supabase/almacenamiento.ts';
import { supabase } from '../infraestructura/supabase/cliente.ts';
import { RUTAS } from '../rutas/rutas.ts';
import {
  SesionContexto,
  type DatosDeAcceso,
  type EstadoDeSesion,
  type ResultadoDeAcceso,
} from './SesionContexto.ts';

/**
 * Version del aviso de tratamiento de datos que se acepta al registrarse.
 *
 * Queda guardada con la cuenta porque la Ley 1581 no se conforma con un si o
 * un no: ante una reclamacion hay que poder demostrar **a que** dio permiso
 * cada persona y **cuando**. Si el aviso cambia, esta cadena cambia con el.
 */
export const VERSION_DEL_AVISO = '2026-09-1';

const BIEN: ResultadoDeAcceso = { ok: true };

const SIN_CONFIGURAR: ResultadoDeAcceso = {
  ok: false,
  mensaje: 'La aplicacion no tiene configurado el acceso. Avisa a quien la administra.',
};

/**
 * El cliente, o `null` si falta configuracion.
 *
 * `supabase()` lanza cuando no encuentra las credenciales, y eso esta bien
 * cuando alguien va a usarlo. Lo que no puede es tumbar la aplicacion entera:
 * quien acaba de clonar el repositorio se encontraba una pantalla en blanco y
 * el motivo solo en la consola del navegador.
 *
 * Aqui se atrapa para que lo que no depende de Supabase —la portada, el aviso
 * clinico, las lineas de atencion— siga en pie.
 */
function clienteONulo(): ReturnType<typeof supabase> | null {
  try {
    return supabase();
  } catch {
    return null;
  }
}

/**
 * Convierte el error de Supabase en algo que se pueda mostrar.
 *
 * La regla que manda aqui: **ningun mensaje puede revelar si un correo esta
 * registrado**. Decir "esa cuenta no existe" convierte la pantalla de acceso
 * en una forma de averiguar quien usa la aplicacion, y tratandose de una
 * herramienta de bienestar eso es informacion que nadie tiene por que poder
 * consultar.
 */
function traducir(error: AuthError | null): ResultadoDeAcceso {
  if (!error) {
    return BIEN;
  }

  const codigo = error.code ?? '';

  if (codigo === 'invalid_credentials' || error.status === 400) {
    return { ok: false, mensaje: 'El correo o la contrasena no coinciden.' };
  }

  if (codigo === 'over_request_rate_limit' || error.status === 429) {
    return { ok: false, mensaje: 'Demasiados intentos seguidos. Espera un momento y vuelve.' };
  }

  if (codigo === 'weak_password') {
    return { ok: false, mensaje: 'Esa contrasena es muy corta. Necesita al menos 8 caracteres.' };
  }

  if (codigo === 'email_not_confirmed') {
    return { ok: false, mensaje: 'Todavia no confirmaste el correo. Revisa tu bandeja.' };
  }

  // Cualquier otra cosa: ni el mensaje crudo de la libreria, que suele estar en
  // ingles y a veces trae detalles del servidor, ni un "error desconocido" que
  // no ayuda a nadie.
  return { ok: false, mensaje: 'No se pudo completar. Intentalo de nuevo en un momento.' };
}

export function ProveedorDeSesion({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null);

  // Empieza en "cargando" solo si hay algo que cargar. Sin configuracion no
  // hay sesion posible y se sabe desde el primer instante, asi que anunciar
  // una espera que nunca va a terminar dejaria las rutas protegidas colgadas.
  //
  // Se calcula con la forma perezosa de useState —una funcion— para que se
  // evalue una sola vez y no en cada pintado.
  const [cargando, setCargando] = useState(() => clienteONulo() !== null);

  useEffect(() => {
    let vigente = true;
    const cliente = clienteONulo();

    if (!cliente) {
      // La aplicacion tiene que seguir en pie: la portada y el aviso clinico
      // no dependen de Supabase.
      return;
    }

    // Primero lo que ya hubiera guardado, para no expulsar a quien recarga.
    void cliente.auth
      .getSession()
      .then(({ data }) => {
        if (vigente) {
          setSesion(data.session);
          setCargando(false);
        }
      })
      .catch(() => {
        if (vigente) {
          setCargando(false);
        }
      });

    // Y despues, cualquier cambio: entrar, salir, o que se renueve el token.
    // Sin esta suscripcion, cerrar sesion en otra pestana dejaria esta creyendo
    // que sigue dentro.
    const { data: suscripcion } = cliente.auth.onAuthStateChange((_evento, nueva) => {
      if (vigente) {
        setSesion(nueva);
        setCargando(false);
      }
    });

    return () => {
      vigente = false;
      suscripcion.subscription.unsubscribe();
    };
  }, []);

  const registrarse = useCallback(
    async ({
      correo,
      contrasena,
      recordar,
      aceptaElAviso,
    }: DatosDeAcceso & { aceptaElAviso: boolean }): Promise<ResultadoDeAcceso> => {
      if (!aceptaElAviso) {
        // No es una validacion de formulario cualquiera. Sin autorizacion
        // previa y expresa no hay base legal para guardar un solo dato de
        // salud, asi que la cuenta no puede crearse.
        return { ok: false, mensaje: 'Para crear la cuenta hace falta aceptar el aviso.' };
      }

      recordarEnEsteEquipo(recordar);

      const cliente = clienteONulo();

      if (!cliente) {
        return SIN_CONFIGURAR;
      }

      const { error } = await cliente.auth.signUp({
        email: correo,
        password: contrasena,
        options: {
          data: {
            version_aviso: VERSION_DEL_AVISO,
            acepto_en: new Date().toISOString(),
          },
          emailRedirectTo: `${window.location.origin}${RUTAS.PANEL}`,
        },
      });

      return traducir(error);
    },
    [],
  );

  const entrar = useCallback(
    async ({ correo, contrasena, recordar }: DatosDeAcceso): Promise<ResultadoDeAcceso> => {
      // Antes de iniciar sesion, no despues: el token se escribe durante la
      // llamada, y para entonces ya tiene que estar decidido donde va.
      recordarEnEsteEquipo(recordar);

      const cliente = clienteONulo();

      if (!cliente) {
        return SIN_CONFIGURAR;
      }

      const { error } = await cliente.auth.signInWithPassword({
        email: correo,
        password: contrasena,
      });

      return traducir(error);
    },
    [],
  );

  const entrarConGoogle = useCallback(async (recordar: boolean): Promise<ResultadoDeAcceso> => {
    recordarEnEsteEquipo(recordar);

    const cliente = clienteONulo();

    if (!cliente) {
      return SIN_CONFIGURAR;
    }

    const { error } = await cliente.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${RUTAS.PANEL}` },
    });

    return traducir(error);
  }, []);

  const pedirRecuperacion = useCallback(async (correo: string): Promise<ResultadoDeAcceso> => {
    const cliente = clienteONulo();

    if (!cliente) {
      return SIN_CONFIGURAR;
    }

    const { error } = await cliente.auth.resetPasswordForEmail(correo, {
      redirectTo: `${window.location.origin}${RUTAS.CONTRASENA_NUEVA}`,
    });

    // Se responde lo mismo haya cuenta o no, y tambien si la llamada fallo por
    // limite de peticiones. Decir "ese correo no existe" permitiria averiguar
    // quien tiene cuenta probando direcciones una a una.
    if (error?.status === 429) {
      return { ok: false, mensaje: 'Demasiados intentos seguidos. Espera un momento y vuelve.' };
    }

    return BIEN;
  }, []);

  const cambiarContrasena = useCallback(async (nueva: string): Promise<ResultadoDeAcceso> => {
    const cliente = clienteONulo();

    if (!cliente) {
      return SIN_CONFIGURAR;
    }

    const { error } = await cliente.auth.updateUser({ password: nueva });

    return traducir(error);
  }, []);

  const salir = useCallback(async (): Promise<void> => {
    await clienteONulo()?.auth.signOut();
    olvidarPreferenciaDePestana();
    setSesion(null);
  }, []);

  const valor = useMemo<EstadoDeSesion>(
    () => ({
      sesion,
      cargando,
      correo: sesion?.user.email ?? null,
      registrarse,
      entrar,
      entrarConGoogle,
      pedirRecuperacion,
      cambiarContrasena,
      salir,
    }),
    [
      sesion,
      cargando,
      registrarse,
      entrar,
      entrarConGoogle,
      pedirRecuperacion,
      cambiarContrasena,
      salir,
    ],
  );

  return <SesionContexto.Provider value={valor}>{children}</SesionContexto.Provider>;
}
