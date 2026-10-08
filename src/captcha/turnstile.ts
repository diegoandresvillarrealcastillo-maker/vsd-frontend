/**
 * El cargador de Cloudflare Turnstile (SCRUM-165).
 *
 * El script de Cloudflare **solo se descarga cuando una pantalla con CAPTCHA se
 * muestra**, y solo si hay clave del sitio. Quien no pasa por registro, acceso o
 * recuperacion no habla nunca con Cloudflare; y sin clave, nadie lo hace.
 *
 * Se pide con `render=explicit`: la pantalla decide cuando y donde pintar el
 * widget, en lugar de que el script lo busque por su cuenta en el documento.
 */
export const URL_DE_TURNSTILE = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

export interface OpcionesDeTurnstile {
  readonly sitekey: string;
  /** Un nombre corto para las estadisticas de Cloudflare: letras, numeros, `_` y `-`. */
  readonly action?: string;
  readonly theme?: 'auto' | 'light' | 'dark';
  readonly size?: 'normal' | 'flexible' | 'compact';
  readonly language?: string;
  /** `interaction-only`: el widget solo se ve si Cloudflare necesita que la persona haga algo. */
  readonly appearance?: 'always' | 'execute' | 'interaction-only';
  readonly callback: (token: string) => void;
  readonly 'expired-callback'?: () => void;
  readonly 'error-callback'?: () => void;
  readonly 'timeout-callback'?: () => void;
}

export interface Turnstile {
  render(contenedor: HTMLElement, opciones: OpcionesDeTurnstile): string;
  reset(idDelWidget: string): void;
  remove(idDelWidget: string): void;
}

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let carga: Promise<Turnstile> | null = null;

/**
 * Devuelve Turnstile, descargando el script la primera vez.
 *
 * Una sola descarga aunque varias pantallas lo pidan a la vez. Si falla (sin
 * red, bloqueado por una extension), la promesa se descarta para que el
 * siguiente intento vuelva a probar, y el script que quedo a medias se quita.
 */
export function cargarTurnstile(): Promise<Turnstile> {
  if (window.turnstile !== undefined) {
    return Promise.resolve(window.turnstile);
  }

  carga ??= new Promise<Turnstile>((resolver, rechazar) => {
    const script = document.createElement('script');

    script.src = `${URL_DE_TURNSTILE}?render=explicit`;
    script.async = true;
    script.defer = true;

    script.addEventListener('load', () => {
      if (window.turnstile === undefined) {
        carga = null;
        script.remove();
        rechazar(new Error('Turnstile cargo pero no quedo disponible.'));

        return;
      }

      resolver(window.turnstile);
    });

    script.addEventListener('error', () => {
      carga = null;
      script.remove();
      rechazar(new Error('No se pudo descargar Turnstile.'));
    });

    document.head.append(script);
  });

  return carga;
}

/** Solo para las pruebas: olvida la descarga en curso. */
export function olvidarLaCargaDeTurnstile(): void {
  carga = null;
}
