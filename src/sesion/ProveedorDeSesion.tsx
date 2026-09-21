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
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;

    // Primero lo que ya hubiera guardado, para no expulsar a quien recarga.
    void supabase()
      .auth.getSession()
      .then(({ data }) => {
        if (vigente) {
          setSesion(data.session);
          setCargando(false);
        }
      })
      .catch(() => {
        // Sin credenciales configuradas no hay sesion posible, y eso no es un
        // fallo: es el estado normal de quien todavia no ha entrado.
        if (vigente) {
          setCargando(false);
        }
      });

    // Y despues, cualquier cambio: entrar, salir, o que se renueve el token.
    // Sin esta suscripcion, cerrar sesion en otra pestana dejaria esta creyendo
    // que sigue dentro.
    const { data: suscripcion } = supabase().auth.onAuthStateChange((_evento, nueva) => {
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

      const { error } = await supabase().auth.signUp({
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

      const { error } = await supabase().auth.signInWithPassword({
        email: correo,
        password: contrasena,
      });

      return traducir(error);
    },
    [],
  );

  const entrarConGoogle = useCallback(async (recordar: boolean): Promise<ResultadoDeAcceso> => {
    recordarEnEsteEquipo(recordar);

    const { error } = await supabase().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${RUTAS.PANEL}` },
    });

    return traducir(error);
  }, []);

  const pedirRecuperacion = useCallback(async (correo: string): Promise<ResultadoDeAcceso> => {
    const { error } = await supabase().auth.resetPasswordForEmail(correo, {
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
    const { error } = await supabase().auth.updateUser({ password: nueva });

    return traducir(error);
  }, []);

  const salir = useCallback(async (): Promise<void> => {
    await supabase().auth.signOut();
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
