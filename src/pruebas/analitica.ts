import { CLAVE_DEL_CONSENTIMIENTO } from '../analitica/consentimiento.ts';

/**
 * Deja la pagina como si nadie hubiera tocado la analitica (SCRUM-161).
 *
 * Google Analytics deja huellas globales —un script en `<head>`, `dataLayer`,
 * `gtag`, una bandera `ga-disable-ID` y cookies— y jsdom las conserva de una
 * prueba a la siguiente. Sin limpiarlas, una prueba que acepta hace que la
 * siguiente, que debia ver una pagina limpia, pase o falle por la herencia.
 */
export function olvidarLaAnalitica(id = 'G-TEST123456'): void {
  for (const script of document.head.querySelectorAll('script[data-vsd-analitica]')) {
    script.remove();
  }

  delete window.dataLayer;
  delete window.gtag;
  delete window[`ga-disable-${id}`];

  window.localStorage.removeItem(CLAVE_DEL_CONSENTIMIENTO);

  for (const cookie of document.cookie.split(';')) {
    const nombre = cookie.split('=')[0]?.trim();

    if (nombre !== undefined && nombre !== '') {
      document.cookie = `${nombre}=; Max-Age=0; Path=/`;
    }
  }
}

/** Lo que Google Analytics recibio, como listas legibles: cada entrada es una llamada a `gtag`. */
export function llamadasAGtag(): unknown[][] {
  return (window.dataLayer ?? []).map((entrada) => Array.from(entrada as ArrayLike<unknown>));
}
