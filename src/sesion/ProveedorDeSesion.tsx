import type { AuthError, Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { olvidarLosArchivosDeLaPersona } from '../foto/archivosDeLaPersona.ts';
import {
  esSoloDeEstaPestana,
  olvidarPreferenciaDePestana,
  recordarEnEsteEquipo,
} from '../infraestructura/supabase/almacenamiento.ts';
import { supabase } from '../infraestructura/supabase/cliente.ts';
import { dejarDeAvisarAEsteNavegador } from '../notificaciones/navegador.ts';
import { RUTAS } from '../rutas/rutas.ts';
import { alCambiarLaSesion, olvidarLosDatosDeLaSesionActual } from '../sincronizacion/ciclo.ts';
import { olvidarLaZonaDeLaCuenta } from '../tiempo/zonaHoraria.ts';
import { consultarLosTextosVigentes, type TextosVigentes } from '../infraestructura/api/aviso.ts';
import {
  SesionContexto,
  type DatosDeAcceso,
  type DatosDeEntrada,
  type EstadoDeSesion,
  type ResultadoDeAcceso,
} from './SesionContexto.ts';

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

const SIN_SERVIDOR: ResultadoDeAcceso = {
  ok: false,
  mensaje:
    'No se pudo conectar con el servidor para crear tu cuenta. Revisa tu conexión y vuelve a intentarlo.',
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
  weak_password:
    'Esa contraseña no cumple lo que se pide: al menos 8 caracteres, una mayúscula, una minúscula, un número y un símbolo.',
  email_not_confirmed: 'Todavía no confirmaste el correo. Revisa tu bandeja.',
  over_request_rate_limit: DEMASIADOS_INTENTOS,
  over_email_send_rate_limit: 'Se enviaron muchos correos seguidos. Espera unos minutos.',
  validation_failed: 'Revisa el correo: no tiene un formato válido.',

  // Estos dos no son culpa de quien esta delante de la pantalla: son
  // configuracion que falta en Supabase. Decirle "el correo o la contrasena no
  // coinciden" la mandaria a revisar algo que esta bien.
  // El cambio de contrasena desde el perfil (SCRUM-101).
  same_password: 'La contraseña nueva tiene que ser distinta de la actual.',
  reauthentication_needed: 'Para cambiar la contraseña primero pide el código de verificación.',
  reauthentication_not_valid: 'El código no es válido o ya venció. Pide uno nuevo.',

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
        // Sin sesion, lo que era de quien estaba —su foto, su mascota propia— no
        // se queda. `salir` ya lo suelta, pero la sesion tambien termina sin
        // pasar por ahi: caduca, se revoca, o se cierra en otra pestana.
        if (nueva === null) {
          olvidarLosArchivosDeLaPersona();
        }

        setSesion(nueva);
        setCargando(false);
      }
    });

    return () => {
      vigente = false;
      suscripcion.subscription.unsubscribe();
    };
  }, []);

  // El almacen local sigue a la sesion (SCRUM-136). Se mira el identificador de
  // Supabase y no el de nuestra cuenta: es el unico que se conoce sin conexion.
  //
  // Que la sesion termine NO borra lo guardado: si caduco o se cerro en otra
  // pestana, lo que la persona hizo sin conexion sigue ahi para cuando vuelva a
  // entrar. Solo `salir` lo olvida.
  const persona = sesion?.user.id ?? null;

  useEffect(() => {
    void alCambiarLaSesion(persona, { persistente: !esSoloDeEstaPestana() });
  }, [persona]);

  const registrarse = useCallback(
    async ({
      correo,
      contrasena,
      aceptaElAviso,
      aceptaLosTerminos,
    }: DatosDeAcceso & {
      aceptaElAviso: boolean;
      aceptaLosTerminos: boolean;
    }): Promise<ResultadoDeAcceso> => {
      if (!aceptaElAviso || !aceptaLosTerminos) {
        // No es una validacion de formulario cualquiera. Sin autorizacion
        // previa y expresa no hay base legal para guardar un solo dato de
        // salud, asi que la cuenta no puede crearse. Son dos casillas porque
        // son dos documentos: el aviso de privacidad y los terminos.
        return {
          ok: false,
          mensaje: 'Para crear la cuenta hace falta aceptar el aviso de privacidad y los términos.',
        };
      }

      recordarEnEsteEquipo(RECORDAR_SIEMPRE);

      const cliente = clienteONulo();

      if (!cliente) {
        return SIN_CONFIGURAR;
      }

      // Las versiones del aviso y de los terminos se piden a la API, que es su
      // unica fuente (SCRUM-85). Si no se puede saber cuales estan vigentes no
      // se crea la cuenta: registrarla con una version supuesta seria guardar un
      // consentimiento que nadie puede demostrar.
      let textos: TextosVigentes;

      try {
        textos = await consultarLosTextosVigentes();
      } catch {
        return SIN_SERVIDOR;
      }

      const { error } = await cliente.auth.signUp({
        email: correo,
        password: contrasena,
        options: {
          // Solo lo que se acepto y cuando, como constancia de que se marcaron
          // las casillas al registrarse. La fecha de nacimiento no va aqui: no
          // hace falta para crear la identidad y no tiene por que viajar en el
          // token de cada peticion. El consentimiento que vale lo registra la
          // API al crear la cuenta.
          data: {
            version_aviso: textos.aviso,
            version_terminos: textos.terminos,
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

  /**
   * Primer paso del cambio de contrasena desde el perfil: Supabase manda un
   * codigo al correo de la cuenta. Con "Secure password change" activado en
   * el proyecto, la contrasena nueva solo se acepta con ese codigo.
   */
  const pedirCodigoDeVerificacion = useCallback(async (): Promise<ResultadoDeAcceso> => {
    const cliente = clienteONulo();

    if (!cliente) {
      return SIN_CONFIGURAR;
    }

    const { error } = await cliente.auth.reauthenticate();

    return traducir(error);
  }, []);

  /**
   * Segundo paso: la contrasena nueva con el codigo. Va directo a Supabase,
   * como en el registro: nuestra API nunca la ve.
   */
  const cambiarContrasenaConCodigo = useCallback(
    async (nueva: string, codigo: string): Promise<ResultadoDeAcceso> => {
      const cliente = clienteONulo();

      if (!cliente) {
        return SIN_CONFIGURAR;
      }

      const { error } = await cliente.auth.updateUser({ password: nueva, nonce: codigo.trim() });

      return traducir(error);
    },
    [],
  );

  const salir = useCallback(async (): Promise<void> => {
    // Primero, y sin esperar: se empieza a olvidar lo guardado en este equipo
    // (SCRUM-136). Quien sale decide por si misma; nada de lo privado se queda
    // para la siguiente persona. Tiene que ir antes de soltar el token porque
    // sabe de quien es lo que borra por la sesion que todavia esta abierta.
    // Avisar de que quedan cambios sin enviar, antes de llegar aqui, es de quien
    // llama a `salir` (SCRUM-142): aqui ya no hay vuelta atras.
    const olvido = olvidarLosDatosDeLaSesionActual();

    // Antes de soltar el token: este navegador deja de recibir los avisos de
    // quien sale (SCRUM-102). No bloquea la salida si falla.
    await dejarDeAvisarAEsteNavegador();
    await clienteONulo()?.auth.signOut();
    await olvido;
    olvidarPreferenciaDePestana();
    // La zona y los archivos de esa cuenta no se quedan para la siguiente persona.
    olvidarLaZonaDeLaCuenta();
    olvidarLosArchivosDeLaPersona();
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
      pedirCodigoDeVerificacion,
      cambiarContrasenaConCodigo,
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
      pedirCodigoDeVerificacion,
      cambiarContrasenaConCodigo,
      salir,
    ],
  );

  return <SesionContexto.Provider value={valor}>{children}</SesionContexto.Provider>;
}
