import { avisarVersionNueva, laVersionNuevaTomoElControl } from './versionNueva.ts';

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
}) => (recargarLaPagina?: boolean) => Promise<void>;

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
    onRegisterError(error) {
      console.warn('No se pudo registrar el service worker.', error);
    },
  });
}
