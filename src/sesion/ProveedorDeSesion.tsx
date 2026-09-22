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
  type DatosDeEntrada,
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

/**
 * Al registrarse y al entrar con Google, la sesion se recuerda.
 *
 * La pregunta de si recordar el equipo solo la hace la pantalla de inicio de
 * sesion. Al crear una cuenta no tiene sentido —acabas de hacerla y vas a
 * entrar igual— y ponerla ahi seria una casilla mas que leer en el peor
 * momento para pedir atencion.
 */
const RECORDAR_SIEMPRE = true;

const BIEN: ResultadoDeAcceso = { ok: true };

const SIN_CONFIGURAR: ResultadoDeAcceso = {
  ok: false,
  mensaje: 'La aplicación no tiene configurado el acceso. Avisa a quien la administra.',
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

const DEMASIADOS_INTENTOS = 'Demasiados intentos seguidos. Espera un momento y vuelve.';

/** Cada codigo de error de Supabase con su texto en espanol. */
const MENSAJES: Readonly<Record<string, string>> = {
  invalid_credentials: 'El correo o la contraseña no coinciden.',
  weak_password: 'Esa contraseña es muy corta. Necesita al menos 8 caracteres.',
  email_not_confirmed: 'Todavía no confirmaste el correo. Revisa tu bandeja.',
  over_request_rate_limit: DEMASIADOS_INTENTOS,
  over_email_send_rate_limit: 'Se enviaron muchos correos seguidos. Espera unos minutos.',
  validation_failed: 'Revisa el correo: no tiene un formato válido.',

  // Estos dos no son culpa de quien esta delante de la pantalla: son
  // configuracion que falta en Supabase. Decirle "el correo o la contrasena no
  // coinciden" la mandaria a revisar algo que esta bien.
  email_provider_disabled: 'El acceso por correo no está habilitado todavía. Avisa al equipo.',
  signup_disabled: 'El registro está cerrado ahora mismo. Avisa al equipo.',
};

/**
 * Convierte el error de Supabase en algo que se pueda mostrar.
 *
 * Se decide por el **codigo** del error y nunca por el estado HTTP. Antes se
 * trataba cualquier 400 como credenciales equivocadas, y eso hacia que una
 * pantalla de registro dijera "el correo o la contrasena no coinciden" cuando
 * el problema real era que el proveedor de correo estaba desactivado en
 * Supabase. Un mensaje que manda a revisar lo que ya esta bien cuesta mas que
 * no decir nada.
 *
 * La regla que sigue mandando: **ningun mensaje del inicio de sesion puede
 * revelar si un correo esta registrado**. Decir "esa cuenta no existe"
 * convierte la pantalla de acceso en una forma de averiguar quien usa la
 * aplicacion.
 */
function traducir(error: AuthError | null): ResultadoDeAcceso {
  if (!error) {
    return BIEN;
  }

  const conocido = MENSAJES[error.code ?? ''];

  if (conocido) {
    return { ok: false, mensaje: conocido };
  }

  if (error.status === 429) {
    return { ok: false, mensaje: DEMASIADOS_INTENTOS };
  }

  // Cualquier otra cosa: ni el mensaje crudo de la libreria, que suele estar en
  // ingles y a veces trae detalles del servidor, ni un "error desconocido" que
  // no ayuda a nadie.
  return { ok: false, mensaje: 'No se pudo completar. Inténtalo de nuevo en un momento.' };
}

/**
 * Lo mismo, pero para el registro.
 *
 * Una cuenta que ya existe se responde aparte porque en el registro **si hay
 * que decirlo**: sin eso la persona se queda sin saber por que no puede
 * continuar. La frase va en condicional para no afirmarlo de plano.
 *
 * Es una concesion consciente. En el inicio de sesion y en la recuperacion la
 * regla de no revelar se mantiene entera; aqui cede lo justo para que la
 * pantalla sirva de algo.
 */
function traducirRegistro(error: AuthError | null): ResultadoDeAcceso {
  const codigo = error?.code ?? '';

  if (codigo === 'user_already_exists' || codigo === 'email_exists') {
    return {
      ok: false,
      mensaje: 'Si ya tienes una cuenta con ese correo, entra desde la pantalla de acceso.',
    };
  }

  return traducir(error);
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
      aceptaElAviso,
    }: DatosDeAcceso & { aceptaElAviso: boolean }): Promise<ResultadoDeAcceso> => {
      if (!aceptaElAviso) {
        // No es una validacion de formulario cualquiera. Sin autorizacion
        // previa y expresa no hay base legal para guardar un solo dato de
        // salud, asi que la cuenta no puede crearse.
        return { ok: false, mensaje: 'Para crear la cuenta hace falta aceptar el aviso.' };
      }

      recordarEnEsteEquipo(RECORDAR_SIEMPRE);

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

      return traducirRegistro(error);
    },
    [],
  );

  const entrar = useCallback(
    async ({ correo, contrasena, recordar }: DatosDeEntrada): Promise<ResultadoDeAcceso> => {
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
