import { ErrorDeLaApi } from '../infraestructura/api/clienteHttp.ts';

/**
 * Que hacer con un envio que fallo (SCRUM-136, HU_MF09_002 criterios 3, 4 y 5).
 *
 * No todos los fallos significan lo mismo, y tratarlos igual es como se pierden
 * cosas o se atascan colas:
 *
 * - **`red`**: ni llego. No es culpa de la operacion ni del servidor: no hay
 *   conexion. Se detiene todo el envio y se deja la operacion como estaba; no
 *   cuenta como intento. Puede durar dias.
 * - **`temporal`**: llego, y el servidor no pudo ahora (5xx, demasiadas
 *   peticiones, tiempo agotado). Se reintenta mas tarde, con espera creciente. No
 *   detiene a las demas.
 * - **`sesion`**: la sesion no vale (401). Se detiene todo y se pide entrar de
 *   nuevo, **sin descartar nada**: lo guardado sigue ahi.
 * - **`conflicto`**: otro dispositivo cambio lo mismo (ADR 0009). No se pisa nada.
 * - **`permanente`**: la API la rechazo y reintentar no va a cambiar la respuesta
 *   (datos invalidos, ya no existe). Se marca para atencion y no detiene a las
 *   demas independientes.
 */
export type ClaseDeFallo =
  | { readonly clase: 'red' }
  | {
      readonly clase: 'temporal';
      readonly codigo: string;
      readonly estado?: number;
      readonly reintentarEnSegundos?: number;
    }
  | { readonly clase: 'sesion' }
  | { readonly clase: 'conflicto'; readonly codigo: string; readonly estado: number }
  | { readonly clase: 'permanente'; readonly codigo: string; readonly estado?: number };

/**
 * Los codigos con los que la API dice "esto ya no es lo que viste". En los dos casos
 * lo que se traia se guarda como una anotacion nueva (ADR 0009), y por eso no es
 * ni un error permanente ni algo que reintentar.
 */
export const CODIGOS_DE_CONFLICTO: ReadonlySet<string> = new Set([
  'VERSION_DESACTUALIZADA',
  'EDICION_FUERA_DE_PLAZO',
]);

function esNombre(error: unknown, nombre: string): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { name?: unknown }).name === nombre
  );
}

export function clasificarFallo(error: unknown): ClaseDeFallo {
  if (error instanceof ErrorDeLaApi) {
    const { estado } = error;
    const codigo = error.codigo ?? `HTTP_${String(estado)}`;

    if (estado === 401) {
      return { clase: 'sesion' };
    }

    if (CODIGOS_DE_CONFLICTO.has(error.codigo ?? '')) {
      return { clase: 'conflicto', codigo, estado };
    }

    // 408 tiempo agotado, 425 demasiado pronto, 429 demasiadas peticiones, y todo
    // 5xx (un proxy caido, el servidor reiniciando, el plan gratuito despertando).
    if (estado === 408 || estado === 425 || estado === 429 || estado >= 500) {
      return {
        clase: 'temporal',
        codigo,
        estado,
        ...(error.reintentarEnSegundos === undefined
          ? {}
          : { reintentarEnSegundos: error.reintentarEnSegundos }),
      };
    }

    return { clase: 'permanente', codigo, estado };
  }

  // `fetch` falla con un TypeError cuando no hay red (o la direccion no responde,
  // o un bloqueador la corta). Un tiempo agotado o una peticion cancelada tambien
  // son "no llego".
  if (
    error instanceof TypeError ||
    esNombre(error, 'AbortError') ||
    esNombre(error, 'TimeoutError')
  ) {
    return { clase: 'red' };
  }

  // La respuesta llego pero no se pudo leer como JSON: casi siempre es la pagina de
  // entrada de una red wifi (un portal cautivo) o un proxy, que contestan 200 con
  // HTML. Es "no llego la API", no un error de la operacion.
  if (error instanceof SyntaxError) {
    return { clase: 'red' };
  }

  // Algo que no esperabamos. Se trata como pasajero, no como permanente: asi no se
  // descarta ni se marca como rechazada una operacion por un fallo que no es suyo,
  // y el limite de intentos evita que reintente para siempre.
  return { clase: 'temporal', codigo: 'ERROR_INESPERADO' };
}
