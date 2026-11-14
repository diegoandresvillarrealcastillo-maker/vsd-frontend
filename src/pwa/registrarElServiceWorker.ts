import {
  avisarVersionNueva,
  laVersionNuevaTomoElControl,
  volverAOfrecerLaVersion,
} from './versionNueva.ts';

/**
 * Lo que necesitamos de `registerSW` (el que genera `vite-plugin-pwa`), dicho
 * con nuestros propios tipos: asi las pruebas lo reemplazan por uno falso sin
 * importar el modulo virtual del plugin, que solo existe al compilar.
 */
export type RegistrarSW = (opciones: {
  readonly immediate?: boolean;
  readonly onNeedRefresh?: () => void;
  readonly onNeedReload?: () => void;
  readonly onRegisterError?: (error: unknown) => void;
  readonly onRegisteredSW?: (
    urlDelScript: string,
    registro: ServiceWorkerRegistration | undefined,
  ) => void;
}) => (recargarLaPagina?: boolean) => Promise<void>;

/** Lo que se necesita del documento para saber cuando la aplicacion vuelve a primer plano. */
export interface DocumentoDeLaPagina {
  readonly visibilityState: DocumentVisibilityState;
  addEventListener(tipo: 'visibilitychange', oyente: () => void): void;
}

/** Cada cuanto se pregunta por una version nueva a quien deja la aplicacion abierta. */
const CADA_HORA_EN_MS = 60 * 60 * 1000;

/**
 * Pregunta si hay una version nueva (SCRUM-234). Sin conexion, o si el navegador no puede, no pasa nada: la
 * respuesta se pierde en silencio, y se vuelve a preguntar la proxima vez.
 */
function preguntarPorUnaVersionNueva(registro: ServiceWorkerRegistration): void {
  registro.update().catch(() => undefined);
}

/**
 * Una aplicacion instalada en un telefono casi nunca se abre desde cero: se retoma. Por eso, ademas de cuando
 * el navegador decida, se pregunta por una version nueva **cada vez que vuelve a primer plano** y cada hora, y
 * una version que se dejo para despues se ofrece otra vez (`volverAOfrecerLaVersion`).
 */
function buscarVersionesNuevas(
  registro: ServiceWorkerRegistration,
  documento: DocumentoDeLaPagina,
): void {
  documento.addEventListener('visibilitychange', () => {
    if (documento.visibilityState !== 'visible') {
      return;
    }

    volverAOfrecerLaVersion();
    preguntarPorUnaVersionNueva(registro);
  });

  setInterval(() => {
    preguntarPorUnaVersionNueva(registro);
  }, CADA_HORA_EN_MS);
}

/**
 * Registra el service worker al abrir la aplicacion (SCRUM-135).
 *
 * Antes se registraba solo al activar los avisos, porque era lo unico que
 * hacia: no guardaba nada. Ahora tambien guarda la aplicacion para abrirla sin
 * conexion, y eso tiene que ocurrir desde la primera visita.
 *
 * Una version nueva **no se activa sola**: se avisa y la persona decide. Ver
 * `sw.ts` para el motivo.
 *
 * ## Por que `onNeedReload`
 *
 * Sin el, el plugin registra una recarga automatica en cuanto detecta una
 * version esperando, y la dispara cuando esa version se activa **por cualquier
 * via**. Si la persona la acepta en otra pestana de la aplicacion, esta se
 * recargaria sola aunque estuviera escribiendo en su diario. Con `onNeedReload`
 * el plugin avisa y la decision es nuestra: se recarga si la persona lo pidio
 * aqui; si no, se ofrece recargar y se espera.
 *
 * Si el navegador no puede registrarlo (navegacion privada en algunos, o sin
 * soporte), la aplicacion sigue funcionando igual, solo que sin abrir sin
 * conexion. Por eso un fallo aqui se anota y no se propaga.
 */
export function registrarElServiceWorker(
  registrar: RegistrarSW,
  recargarLaPagina: () => void = () => {
    window.location.reload();
  },
  documento: DocumentoDeLaPagina = document,
): void {
  const activar = registrar({
    immediate: true,
    onNeedRefresh() {
      // `true`: pide al plugin la recarga cuando la version toma el control. Sin
      // recargar, la pagina vieja seguiria con archivos que la nueva retiro.
      avisarVersionNueva(() => activar(true));
    },
    onNeedReload() {
      laVersionNuevaTomoElControl(recargarLaPagina);
    },
    onRegisteredSW(_urlDelScript, registro) {
      if (registro !== undefined) {
        buscarVersionesNuevas(registro, documento);
      }
    },
    onRegisterError(error) {
      console.warn('No se pudo registrar el service worker.', error);
    },
  });
}
