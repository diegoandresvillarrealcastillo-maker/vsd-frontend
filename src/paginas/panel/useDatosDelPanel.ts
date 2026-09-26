import { useCallback, useEffect, useState } from 'react';

import { traerElCatalogo, type CategoriaDelCatalogo } from '../../infraestructura/api/catalogo.ts';
import { ErrorDeLaApi } from '../../infraestructura/api/clienteHttp.ts';
import { darDeAltaLaCuenta, type Cuenta } from '../../infraestructura/api/cuenta.ts';
import { VERSION_DEL_AVISO } from '../../sesion/consentimiento.ts';

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
      readonly catalogo: readonly CategoriaDelCatalogo[];
    }
  | { readonly fase: 'error'; readonly mensaje: string };

/**
 * Convierte el fallo en algo que se pueda leer.
 *
 * Se decide por el estado HTTP y no por el texto del error: el texto puede
 * cambiar sin avisar, el estado es parte del contrato.
 *
 * Ninguno de estos mensajes cuenta nada del interior del sistema. Lo que se
 * dice es que paso y que puede hacer la persona, que son las dos unicas cosas
 * que le sirven.
 */
function explicar(error: unknown): string {
  if (!(error instanceof ErrorDeLaApi)) {
    // Aqui cae que no haya red, o que la API no este arrancada. `fetch` no
    // lanza un ErrorDeLaApi en ese caso porque no llego a haber respuesta.
    return 'No se pudo conectar con el servidor. Revisa tu conexión y vuelve a intentarlo.';
  }

  if (error.estado === 401) {
    return 'Tu sesión caducó. Vuelve a entrar.';
  }

  if (error.estado === 409) {
    return 'Ese correo ya pertenece a una cuenta creada con otro método de acceso. Entra con el método que usaste la primera vez.';
  }

  if (error.estado === 400) {
    return 'No se pudo completar el registro de tu cuenta porque falta la aceptación del aviso de tratamiento de datos.';
  }

  if (error.estado === 429) {
    return 'Hiciste muchas peticiones seguidas. Espera un momento y vuelve a intentarlo.';
  }

  return `No se pudo cargar tu panel (error ${error.estado}). Vuelve a intentarlo en un momento.`;
}

/**
 * Trae lo que el panel necesita: la cuenta y el catalogo.
 *
 * El alta de cuenta va aqui y no en el inicio de sesion a proposito. Supabase
 * autentica, pero la cuenta de VSD Health es una entidad propia que alguien
 * tiene que crear, y hacerlo al entrar al panel tiene dos ventajas: ocurre
 * tambien cuando la sesion se restaura al recargar la pagina, y ocurre una
 * sola vez por pantalla en lugar de repartido entre tres formularios.
 *
 * Que la llamada sea idempotente en el servidor es lo que lo hace seguro:
 * entrar diez veces no crea diez cuentas ni sobrescribe el consentimiento.
 */
export function useDatosDelPanel(): {
  readonly estado: EstadoDelPanel;
  readonly reintentar: () => void;
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
        // En paralelo porque no dependen una de otra: el alta necesita la
        // sesion y el catalogo es una ruta publica. En serie la pantalla
        // tardaria el doble sin ganar nada.
        const [cuenta, catalogo] = await Promise.all([
          darDeAltaLaCuenta(VERSION_DEL_AVISO, control.signal),
          traerElCatalogo(control.signal),
        ]);

        if (control.signal.aborted) {
          return;
        }

        setEstado({ fase: 'listo', cuenta, catalogo });
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

  return { estado, reintentar };
}
