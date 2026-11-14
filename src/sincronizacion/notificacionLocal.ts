/**
 * La notificacion de "tus cambios se enviaron" cuando la aplicacion esta en
 * segundo plano (SCRUM-137).
 *
 * Sincronizar solo ocurre con la aplicacion abierta, aunque sea en una pestana de
 * fondo. Si la persona esta en otra pestana o en otra aplicacion cuando vuelve la
 * conexion y se envia lo guardado, una notificacion le dice que ya esta.
 *
 * ## Reglas
 *
 * - **No pide permiso.** Solo se usa si ya se dio (el de los avisos de la
 *   aplicacion, SCRUM-102). Pedirlo aqui, sin que la persona lo haya buscado, seria
 *   un mal momento para una pregunta.
 * - **Texto neutro, sin nada de salud.** Una notificacion se lee en la pantalla de
 *   bloqueo, delante de quien sea. Dice que se enviaron cambios, no cuales ni de
 *   que tipo.
 * - **Una sola a la vez**: lleva una etiqueta y reemplaza a la anterior.
 * - **Sin sonido.**
 */

export const TITULO_DE_LA_NOTIFICACION = 'VSD Health';
export const TEXTO_DE_LA_NOTIFICACION = 'Tus cambios guardados en este equipo ya se enviaron.';
export const ETIQUETA_DE_LA_NOTIFICACION = 'vsd-sincronizacion';

interface Registro {
  showNotification(titulo: string, opciones: NotificationOptions): Promise<void>;
}

export interface EntornoDeNotificaciones {
  /** El permiso que la persona dio, o `undefined` si el navegador no tiene notificaciones. */
  readonly permiso: () => NotificationPermission | undefined;
  /** El service worker listo, o `null` si no hay. */
  readonly registro: () => Promise<Registro | null>;
}

const ENTORNO_REAL: EntornoDeNotificaciones = {
  permiso: () => (typeof Notification === 'undefined' ? undefined : Notification.permission),
  registro: async () => {
    if (!('serviceWorker' in navigator)) {
      return null;
    }

    return navigator.serviceWorker.ready;
  },
};

/**
 * Muestra la notificacion si se puede. Nunca lanza: una notificacion que no sale
 * no es motivo para que falle nada.
 */
export async function avisarEnSegundoPlano(
  entorno: EntornoDeNotificaciones = ENTORNO_REAL,
): Promise<boolean> {
  try {
    if (entorno.permiso() !== 'granted') {
      return false;
    }

    const registro = await entorno.registro();

    if (registro === null) {
      return false;
    }

    await registro.showNotification(TITULO_DE_LA_NOTIFICACION, {
      body: TEXTO_DE_LA_NOTIFICACION,
      tag: ETIQUETA_DE_LA_NOTIFICACION,
      silent: true,
    });

    return true;
  } catch {
    return false;
  }
}
