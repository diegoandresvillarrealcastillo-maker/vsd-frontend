import {
  soltarEsteNavegadorDelServidor,
  type SuscripcionDelNavegador,
} from '../infraestructura/api/notificaciones.ts';

/**
 * Lo que los avisos necesitan del navegador (SCRUM-102): el permiso, el
 * service worker y la suscripcion de Web Push.
 *
 * Todo lo del navegador vive aqui y solo aqui, para que el resto lo pueda
 * simular en las pruebas, donde no hay nada de esto.
 */

const SERVICE_WORKER = '/sw.js';

export type CapacidadDelNavegador =
  /** Puede recibir avisos. */
  | 'lista'
  /** iPhone o iPad desde Safari: solo con la aplicacion instalada en el inicio. */
  | 'iphone-sin-instalar'
  /** Este navegador no recibe avisos web. */
  | 'sin-soporte';

export function capacidadDelNavegador(): CapacidadDelNavegador {
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
    return 'lista';
  }

  // Los iPad recientes se presentan como un Mac, pero con pantalla tactil.
  const esApple =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);

  return esApple ? 'iphone-sin-instalar' : 'sin-soporte';
}

/** El permiso de avisos para este sitio: `default` si nunca se pregunto. */
export function permisoDeAvisos(): NotificationPermission {
  return 'Notification' in window ? Notification.permission : 'default';
}

/** La persona no dio permiso: o lo nego, o cerro la pregunta. */
export class PermisoNegadoError extends Error {
  readonly permiso: NotificationPermission;

  constructor(permiso: NotificationPermission) {
    super('No hay permiso para mostrar avisos.');
    this.name = 'PermisoNegadoError';
    this.permiso = permiso;
  }
}

/** La clave VAPID llega en base64 para URL; el navegador la quiere en bytes. */
function bytesDeBase64Url(valor: string): Uint8Array<ArrayBuffer> {
  const base64 = (valor + '='.repeat((4 - (valor.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const binario = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binario.length));

  for (let indice = 0; indice < binario.length; indice += 1) {
    bytes[indice] = binario.charCodeAt(indice);
  }

  return bytes;
}

function mismaClave(actual: ArrayBuffer | null, esperada: Uint8Array): boolean {
  if (actual === null) {
    return false;
  }

  const bytes = new Uint8Array(actual);

  return (
    bytes.length === esperada.length && bytes.every((byte, indice) => byte === esperada[indice])
  );
}

/** La suscripcion de este navegador, si tiene una. */
export async function suscripcionActual(): Promise<PushSubscription | null> {
  if (capacidadDelNavegador() !== 'lista') {
    return null;
  }

  const registro = await navigator.serviceWorker.getRegistration(SERVICE_WORKER);

  return registro === undefined ? null : registro.pushManager.getSubscription();
}

/**
 * Pide permiso y suscribe este navegador con la clave del servidor.
 *
 * Si ya tenia una suscripcion hecha con otra clave (el servidor las cambio),
 * la suelta y hace una nueva: la vieja ya no recibiria nada.
 */
export async function suscribirNavegador(clavePublica: string): Promise<SuscripcionDelNavegador> {
  const permiso = await Notification.requestPermission();

  if (permiso !== 'granted') {
    throw new PermisoNegadoError(permiso);
  }

  const registro = await navigator.serviceWorker.register(SERVICE_WORKER);

  await navigator.serviceWorker.ready;

  const clave = bytesDeBase64Url(clavePublica);
  let suscripcion = await registro.pushManager.getSubscription();

  if (suscripcion !== null && !mismaClave(suscripcion.options.applicationServerKey, clave)) {
    await suscripcion.unsubscribe();
    suscripcion = null;
  }

  suscripcion ??= await registro.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: clave,
  });

  const { endpoint, keys } = suscripcion.toJSON();

  if (endpoint === undefined || keys?.p256dh === undefined || keys.auth === undefined) {
    throw new Error('El navegador no entrego una suscripcion completa.');
  }

  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

/** Suelta la suscripcion de este navegador. Devuelve su direccion, si tenia. */
export async function soltarNavegador(): Promise<string | null> {
  const suscripcion = await suscripcionActual();

  if (suscripcion === null) {
    return null;
  }

  const { endpoint } = suscripcion;

  await suscripcion.unsubscribe();

  return endpoint;
}

/** Cuanto puede tardar soltar el navegador al cerrar sesion. */
const LIMITE_AL_SALIR_MS = 3_000;

/**
 * Al cerrar sesion, este navegador deja de recibir los avisos de esa persona.
 *
 * En un equipo compartido, quien entre despues no tiene por que ver los
 * pendientes de quien salio. Primero se avisa al servidor, que necesita el
 * token; despues se suelta aqui. Si algo falla o tarda, se sale igual: el
 * servidor suelta solo un navegador que ya no responde.
 */
export async function dejarDeAvisarAEsteNavegador(): Promise<void> {
  const trabajo = (async () => {
    const suscripcion = await suscripcionActual();

    if (suscripcion === null) {
      return;
    }

    try {
      await soltarEsteNavegadorDelServidor(suscripcion.endpoint);
    } finally {
      await suscripcion.unsubscribe();
    }
  })();

  try {
    await Promise.race([
      trabajo,
      new Promise<void>((resolver) => setTimeout(resolver, LIMITE_AL_SALIR_MS)),
    ]);
  } catch {
    // Salir no se bloquea por esto.
  }
}
