/**
 * Cuando el navegador no tiene nada mejor que hacer (SCRUM-283): para lo que no hace falta para ver la
 * primera pantalla, como registrar el service worker, que ademas baja varios megas para abrir sin
 * conexion. Si el navegador no sabe decirlo (Safari no tiene `requestIdleCallback`), un momento
 * despues; si esta ocupado todo el tiempo, a lo mas tarde pasada `esperaMaxima`.
 */
export function alEstarOcioso(tarea: () => void, esperaMaxima = 4_000): void {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(tarea, { timeout: esperaMaxima });
    return;
  }

  setTimeout(tarea, 1_000);
}
