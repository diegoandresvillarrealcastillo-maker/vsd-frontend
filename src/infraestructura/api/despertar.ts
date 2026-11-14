import { entorno } from '../entorno.ts';

/**
 * Despierta el API en cuanto se abre la aplicacion (SCRUM-111).
 *
 * En el plan gratuito de Render el API se duerme tras un rato sin uso, y
 * despertarlo tarda cerca de un minuto. Si ese minuto empieza al abrir la
 * portada o el acceso, en vez de al llegar al panel, casi no se nota:
 * mientras la persona lee o escribe su correo, el servidor ya va
 * arrancando.
 *
 * `GET /health` responde sin tocar la base de datos. Se pide sin CORS
 * (`no-cors`) porque la respuesta no se lee: solo importa que llegue.
 * Una vez por carga de la pagina, y si falla no pasa nada.
 */

let yaSePidio = false;

export function despertarElApi(): void {
  if (yaSePidio) {
    return;
  }

  yaSePidio = true;

  fetch(`${entorno.urlDeLaApi}/health`, { mode: 'no-cors', cache: 'no-store' }).catch(() => {
    // Sin red, o con el API caido: la pantalla lo dira cuando lo necesite.
  });
}

/** Para las pruebas: cada una empieza como una carga nueva. */
export function olvidarQueSeDesperto(): void {
  yaSePidio = false;
}
