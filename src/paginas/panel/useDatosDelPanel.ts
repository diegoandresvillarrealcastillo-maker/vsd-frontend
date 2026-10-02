import { useCallback, useEffect, useState } from 'react';

import { consultarLaVersionDelAviso } from '../../infraestructura/api/aviso.ts';
import { ErrorDeLaApi } from '../../infraestructura/api/clienteHttp.ts';
import {
  cambiarPreferencias,
  darDeAltaLaCuenta,
  type Cuenta,
  type Modulo,
} from '../../infraestructura/api/cuenta.ts';
import { consultarElProgreso, type ProgresoDelModulo } from '../../infraestructura/api/progreso.ts';

/**
 * En que punto esta la carga del panel.
 *
 * Se modela como tres casos excluyentes y no como tres banderas sueltas
 * (`cargando`, `error`, `datos`). Con banderas existen combinaciones que no
 * significan nada —cargando y con error a la vez— y tarde o temprano alguien
 * pinta una de ellas.
 */
export type EstadoDelPanel =
  | { readonly fase: 'cargando' }
  | {
      readonly fase: 'listo';
      readonly cuenta: Cuenta;
      readonly progreso: readonly ProgresoDelModulo[];
    }
  | { readonly fase: 'error'; readonly mensaje: string };

/**
 * Convierte el fallo en algo que se pueda leer.
 *
 * Se decide por el **codigo** de la API cuando lo hay, y por el estado HTTP
 * cuando no. Nunca por el texto del error: el texto puede reescribirse sin
 * avisar, el codigo y el estado son parte del contrato.
 *
 * El codigo hace falta porque el estado a veces no alcanza. Un 400 puede ser que
 * falte el consentimiento o puede ser cualquier otra cosa que la API rechace, y
 * dar por hecho lo primero produce un mensaje que manda a la persona a revisar
 * algo que estaba bien.
 *
 * Ninguno de estos mensajes cuenta nada del interior del sistema. Lo que se
 * dice es que paso y que puede hacer la persona, que son las dos unicas cosas
 * que le sirven. Y se redactan aqui, y no se reenvia el mensaje de la API,
 * porque esta pantalla sabe algo que el servidor no: que lo que fallo fue
 * entrar al panel.
 */
export function explicar(error: unknown): string {
  if (!(error instanceof ErrorDeLaApi)) {
    // Aqui cae que no haya red, o que la API no este arrancada. `fetch` no
    // lanza un ErrorDeLaApi en ese caso porque no llego a haber respuesta.
    return 'No se pudo conectar con el servidor. Revisa tu conexión y vuelve a intentarlo.';
  }

  switch (error.codigo) {
    case 'CONSENTIMIENTO_NO_REGISTRADO':
      return 'No se pudo crear tu cuenta porque falta la aceptación del aviso de tratamiento de datos.';

    // Solo ocurre si el aviso cambio entre pedir la version y darse de alta.
    // Reintentar vuelve a pedirla, asi que es exactamente lo que hay que hacer.
    case 'VERSION_DEL_AVISO_NO_VIGENTE':
      return 'El aviso de tratamiento de datos acaba de actualizarse. Vuelve a intentarlo para aceptar la versión actual.';

    case 'CORREO_YA_REGISTRADO':
      return 'Ese correo ya pertenece a una cuenta creada con otro método de acceso. Entra con el método que usaste la primera vez.';

    // No deberia ocurrir, porque el alta va justo antes de consultar. Si pasa,
    // decir "no tienes cuenta" es mas util que un numero.
    case 'CUENTA_NO_REGISTRADA':
      return 'Todavía no tienes una cuenta de VSD Health. Vuelve a intentarlo para crearla.';

    default:
      break;
  }

  if (error.estado === 401) {
    return 'Tu sesión caducó. Vuelve a entrar.';
  }

  if (error.estado === 429) {
    return 'Hiciste muchas peticiones seguidas. Espera un momento y vuelve a intentarlo.';
  }

  // Sin codigo reconocido queda el numero. No es bonito, pero es lo que la
  // persona puede leernos por teléfono, y junto con el identificador de la
  // petición es lo que permite encontrar qué pasó.
  return `No se pudo cargar tu panel (error ${error.estado}). Vuelve a intentarlo en un momento.`;
}

/**
 * Trae lo que el panel necesita: la cuenta y el progreso de cada modulo.
 *
 * El alta de cuenta va aqui y no en el inicio de sesion a proposito. Supabase
 * autentica, pero la cuenta de VSD Health es una entidad propia que alguien
 * tiene que crear, y hacerlo al entrar al panel tiene dos ventajas: ocurre
 * tambien cuando la sesion se restaura al recargar la pagina, y ocurre una
 * sola vez por pantalla en lugar de repartido entre tres formularios.
 *
 * Que la llamada sea idempotente en el servidor es lo que lo hace seguro:
 * entrar diez veces no crea diez cuentas ni sobrescribe el consentimiento.
 *
 * El progreso va **despues** del alta, en serie y no en paralelo: es una ruta
 * con cuenta, y la primera vez que alguien entra esa cuenta todavia no existe
 * hasta que el alta termina.
 */
export function useDatosDelPanel(): {
  readonly estado: EstadoDelPanel;
  readonly reintentar: () => void;
  readonly activarModulo: (modulo: Modulo) => Promise<void>;
} {
  const [estado, setEstado] = useState<EstadoDelPanel>({ fase: 'cargando' });
  const [intento, setIntento] = useState(0);

  const reintentar = useCallback(() => {
    setEstado({ fase: 'cargando' });
    setIntento((anterior) => anterior + 1);
  }, []);

  useEffect(() => {
    const control = new AbortController();

    async function cargar(): Promise<void> {
      try {
        // La version del aviso la dice la API, que es su unica fuente.
        const version = await consultarLaVersionDelAviso(control.signal);
        const cuenta = await darDeAltaLaCuenta(version, control.signal);
        const progreso = await consultarElProgreso(control.signal);

        if (control.signal.aborted) {
          return;
        }

        setEstado({ fase: 'listo', cuenta, progreso });
      } catch (error) {
        // Abortar es lo que pasa al desmontar, y no es un fallo que contar:
        // pintar un error aqui dejaria un mensaje sobre una pantalla que la
        // persona ya dejo atras.
        if (control.signal.aborted) {
          return;
        }

        setEstado({ fase: 'error', mensaje: explicar(error) });
      }
    }

    void cargar();

    return () => {
      control.abort();
    };
  }, [intento]);

  /**
   * Activa un modulo mas y vuelve a pedir el progreso.
   *
   * Se pide de nuevo en lugar de inventar el del modulo nuevo aqui: lo que le
   * toca hoy lo decide el servidor, y adivinarlo en el cliente daria una
   * pantalla que cambia al recargar.
   *
   * Si falla, lanza: quien pulso el boton es quien tiene que contarlo.
   */
  const activarModulo = useCallback(
    async (modulo: Modulo): Promise<void> => {
      if (estado.fase !== 'listo') {
        return;
      }

      const cuenta = await cambiarPreferencias({
        modulosActivos: [...estado.cuenta.modulosActivos, modulo],
      });
      const progreso = await consultarElProgreso();

      setEstado({ fase: 'listo', cuenta, progreso });
    },
    [estado],
  );

  return { estado, reintentar, activarModulo };
}
