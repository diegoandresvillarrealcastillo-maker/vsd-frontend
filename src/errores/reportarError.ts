/**
 * Avisar de que algo se rompio, sin llevarse nada de la persona (SCRUM-156).
 *
 * Cuando la aplicacion falla, alguien tiene que enterarse. Pero un error de
 * esta aplicacion puede venir con el texto de un diario, un nombre o un correo
 * dentro de su mensaje, y eso no sale del navegador. Por eso aqui **nunca** se
 * copia el mensaje del error, solo lo que sirve para encontrarlo:
 *
 * - el tipo (`TypeError`), no lo que dice;
 * - los pasos de la pila, que son nombres de funciones y archivos de la
 *   aplicacion;
 * - la ruta, sin lo que va despues de `?` ni de `#`, y con los identificadores
 *   cambiados por `:id`.
 *
 * A donde va el informe esta por decidir: hoy sale por la consola. Cuando se
 * elija un servicio (Sentry, el de Vercel...), se registra con `usarReportero`
 * en `main.tsx` y nada mas cambia.
 */

export type OrigenDelError = 'raiz' | 'ruta' | 'no-capturado' | 'ventana' | 'promesa';

export interface InformeDeError {
  readonly origen: OrigenDelError;
  /** El tipo del error: `TypeError`, `RangeError`... Nunca su mensaje. */
  readonly nombre: string;
  /** La ruta donde ocurrio, sin consulta ni almohadilla y sin identificadores. */
  readonly ruta: string;
  /** Los pasos de la pila, sin la linea del mensaje. */
  readonly pila: string;
  /** Los componentes por los que subio el error, si React los dio. */
  readonly componentes: string;
}

export type Reportero = (informe: InformeDeError) => void;

const REPORTERO_POR_DEFECTO: Reportero = (informe) => {
  console.error('[VSD] Error de la aplicacion', informe);
};

let reportero: Reportero = REPORTERO_POR_DEFECTO;

/** Cambia a donde van los informes. Sin argumento, vuelve a la consola. */
export function usarReportero(nuevo: Reportero = REPORTERO_POR_DEFECTO): void {
  reportero = nuevo;
}

const LARGO_MAXIMO = 2_000;

/** Un paso de la pila de Chrome: `    at funcion (direccion:linea:columna)`. */
const PASO_DE_CHROME = /^\s+at\s/;

/**
 * Uno de la de Firefox y Safari: `funcion@direccion:linea:columna`. Lo que va
 * despues de la arroba tiene que parecer una direccion de archivo: asi una linea
 * de un mensaje que sea un correo (`ana@ejemplo.com`) no se cuela.
 */
const PASO_DE_FIREFOX = /^[^\s:@]*@(?:https?:|file:|blob:|webpack|<anonymous>|\/)/;

/**
 * Los pasos de una pila. Se descarta todo lo demas, que es donde esta el
 * mensaje del error.
 */
function soloLosPasos(texto: string | undefined): string {
  if (texto === undefined) {
    return '';
  }

  return texto
    .split('\n')
    .filter((linea) => PASO_DE_CHROME.test(linea) || PASO_DE_FIREFOX.test(linea))
    .join('\n')
    .slice(0, LARGO_MAXIMO);
}

const IDENTIFICADOR = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d{3,})$/i;

/** La ruta de `pathname`, con los identificadores cambiados por `:id`. */
export function rutaSinIdentificadores(pathname: string): string {
  return pathname
    .split('/')
    .map((tramo) => (IDENTIFICADOR.test(tramo) ? ':id' : tramo))
    .join('/')
    .slice(0, 200);
}

function rutaActual(): string {
  try {
    return rutaSinIdentificadores(window.location.pathname);
  } catch {
    return '';
  }
}

/**
 * Manda el informe. No lanza nunca: avisar de un error no puede causar otro, y
 * menos dentro de la pantalla que se muestra cuando algo ya fallo.
 */
export function reportarError(
  error: unknown,
  origen: OrigenDelError,
  pilaDeComponentes?: string | null,
): void {
  try {
    reportero({
      origen,
      nombre: error instanceof Error ? error.name : typeof error,
      ruta: rutaActual(),
      pila: error instanceof Error ? soloLosPasos(error.stack) : '',
      componentes: soloLosPasos(pilaDeComponentes ?? undefined),
    });
  } catch {
    // El reportero fallo: no hay a quien contarselo.
  }
}
