/**
 * Google Analytics 4, lo justo y nada mas (SCRUM-161).
 *
 * Nada de aqui se ejecuta hasta que la persona acepta (`ProveedorDeAnalitica`
 * decide cuando llamar). Antes de eso no se descarga ni un byte de Google y no
 * existe ninguna cookie suya.
 *
 * ## Que se manda y que no
 *
 * - **Se manda**: una visita por pantalla, con la plantilla de la ruta
 *   (`plantillaDeRuta`), el origen del sitio desde el que llego (sin ruta ni
 *   consulta) y lo que Google recoge por si mismo de cualquier pagina: tipo de
 *   navegador y de dispositivo, idioma, y la direccion IP, que Google no guarda
 *   completa.
 * - **No se manda**: la direccion real, la consulta, el fragmento, el titulo de la
 *   pagina, ningun identificador de cuenta, ni nada que la persona haya escrito o
 *   hecho. Tampoco hay eventos propios: la unica medida es la visita.
 * - **Apagado a proposito**: las senales de Google (cruzan los datos con la cuenta
 *   de Google de la persona), la personalizacion de anuncios y todo el
 *   almacenamiento de anuncios. Ademas, en la consola de Google Analytics hay que
 *   apagar la medicion mejorada y fijar la retencion; ver el README.
 *
 * ## Por que `arguments` y no parametros
 *
 * `gtag.js` solo entiende los objetos `arguments` que le llegan por `dataLayer`: un
 * arreglo normal, que es lo que daria `...parametros`, lo ignora sin avisar. Es una
 * rareza conocida de Google y por eso `gtag` es una funcion clasica.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...argumentos: unknown[]) => void;
    /** Con `true`, Google Analytics deja de mandar datos de ese identificador. */
    [bandera: `ga-disable-${string}`]: boolean | undefined;
  }
}

const ORIGEN_DEL_SCRIPT = 'https://www.googletagmanager.com/gtag/js';

/** Marca del script que pusimos nosotros, para no ponerlo dos veces. */
const MARCA_DEL_SCRIPT = 'data-vsd-analitica';

/** Cuanto viven las cookies de Google Analytics: 90 dias, no los dos anos de fabrica. */
export const SEGUNDOS_DE_LA_COOKIE = 90 * 24 * 60 * 60;

function asegurarElDataLayer(): void {
  window.dataLayer ??= [];

  window.gtag ??= function gtag() {
    // Tiene que ser `arguments`: ver la nota de arriba.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer?.push(arguments);
  };
}

/** Si el script de Google ya esta puesto en la pagina. */
export function estaCargado(): boolean {
  return document.querySelector(`script[${MARCA_DEL_SCRIPT}]`) !== null;
}

/**
 * Pone Google Analytics a funcionar: lo configura y descarga su script. Si ya
 * estaba puesto (la persona retiro el permiso y lo volvio a dar), solo lo reactiva.
 */
export function activar(id: string): void {
  asegurarElDataLayer();

  const gtag = window.gtag;

  if (gtag === undefined) {
    return;
  }

  window[`ga-disable-${id}`] = false;

  if (estaCargado()) {
    gtag('consent', 'update', { analytics_storage: 'granted' });

    return;
  }

  gtag('js', new Date());
  // Solo la medicion. El resto del almacenamiento que Google sabe pedir, negado.
  gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  gtag('config', id, {
    // Las visitas las mandamos nosotros, con la plantilla. Si lo hiciera Google,
    // mandaria la direccion de verdad.
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    anonymize_ip: true,
    cookie_expires: SEGUNDOS_DE_LA_COOKIE,
    cookie_flags: window.location.protocol === 'https:' ? 'SameSite=Lax;Secure' : 'SameSite=Lax',
  });

  const script = document.createElement('script');

  script.async = true;
  script.src = `${ORIGEN_DEL_SCRIPT}?id=${encodeURIComponent(id)}`;
  script.setAttribute(MARCA_DEL_SCRIPT, 'ga4');
  document.head.append(script);
}

/**
 * Del sitio desde el que se llego, solo el origen: la ruta y la consulta pueden
 * decir demasiado. Si es este mismo sitio (se recargo la pagina) no es una fuente de
 * visitas, y no se manda.
 */
function origenDelReferente(): string {
  try {
    if (document.referrer === '') {
      return '';
    }

    const origen = new URL(document.referrer).origin;

    return origen === window.location.origin ? '' : origen;
  } catch {
    return '';
  }
}

/** Una visita a una pantalla. `plantilla` viene de `plantillaDeRuta`, nunca de la barra. */
export function enviarLaVisita(plantilla: string): void {
  window.gtag?.('event', 'page_view', {
    page_location: `${window.location.origin}${plantilla}`,
    page_path: plantilla,
    // El titulo del documento no se manda: la plantilla ya dice que pantalla es.
    page_title: plantilla,
    page_referrer: origenDelReferente(),
  });
}

/** Las cookies que Google Analytics pone, con el nombre que lleva cada una. */
function cookiesDeAnalitica(id: string): string[] {
  return ['_ga', `_ga_${id.slice(2)}`, '_gid', `_gat_gtag_${id.replace(/-/g, '_')}`];
}

/** Los dominios en los que Google pudo haber puesto la cookie: el actual y sus padres. */
function dominiosPosibles(): (string | null)[] {
  const partes = window.location.hostname.split('.');
  const dominios: (string | null)[] = [null];

  for (let desde = 0; desde < partes.length - 1; desde += 1) {
    dominios.push(partes.slice(desde).join('.'));
  }

  return dominios;
}

/** Borra las cookies de Google Analytics de este sitio. */
export function borrarLasCookies(id: string): void {
  for (const nombre of cookiesDeAnalitica(id)) {
    for (const dominio of dominiosPosibles()) {
      const dominioDeLaCookie = dominio === null ? '' : `; Domain=${dominio}`;

      document.cookie = `${nombre}=; Max-Age=0; Path=/${dominioDeLaCookie}`;
    }
  }
}

/**
 * Retira el permiso: Google Analytics deja de mandar datos y se borran sus cookies.
 *
 * El script de Google no se puede "descargar" de la pagina una vez puesto. Lo que
 * si hay es la bandera oficial `ga-disable-ID`, que le hace callar, y la
 * actualizacion del consentimiento. Al recargar la pagina el script ya no vuelve,
 * porque la decision guardada es rechazar.
 */
export function retirar(id: string): void {
  window[`ga-disable-${id}`] = true;
  window.gtag?.('consent', 'update', { analytics_storage: 'denied' });
  borrarLasCookies(id);
}
