/**
 * Por que no sirvio el enlace del correo.
 *
 * Cuando algo falla, Supabase no redirige a una pantalla suya: manda de vuelta
 * a la aplicacion con el motivo en la URL. Segun el caso lo pone en la parte
 * de la consulta o detras de la almohadilla, asi que hay que mirar en las dos.
 *
 * Sin esto, cualquier fallo se veia igual —"el enlace no vale"— y no habia
 * forma de distinguir uno caducado de uno ya usado o de una configuracion mal
 * puesta. Quien lo lee necesita saber si tiene que pedir otro o avisar a
 * alguien.
 */

const MOTIVOS: Readonly<Record<string, string>> = {
  otp_expired: 'El enlace caducó. Pide uno nuevo y úsalo en cuanto llegue.',
  access_denied: 'El enlace ya no vale. Puede que se usara antes o que caducara.',
  invalid_request: 'El enlace llegó incompleto. Cópialo entero desde el correo.',
  // Este no es culpa de quien lo abre: la direccion de vuelta no esta en la
  // lista de permitidas del proyecto, y eso se arregla en el panel.
  bad_oauth_callback: 'La dirección de vuelta no está autorizada. Avisa al equipo.',
  validation_failed: 'La dirección de vuelta no está autorizada. Avisa al equipo.',
};

export interface MotivoDelEnlace {
  /** Texto listo para mostrar. */
  readonly mensaje: string;
  /** Codigo crudo, para poder buscarlo si hace falta. */
  readonly codigo: string | undefined;
}

export function motivoDelEnlace(url: URL): MotivoDelEnlace | null {
  // El fragmento llega como "#error=...&error_code=..." y no es una consulta,
  // asi que se analiza quitandole la almohadilla primero.
  const trasLaAlmohadilla = new URLSearchParams(url.hash.replace(/^#/, ''));

  const codigo =
    trasLaAlmohadilla.get('error_code') ??
    url.searchParams.get('error_code') ??
    trasLaAlmohadilla.get('error') ??
    url.searchParams.get('error') ??
    undefined;

  if (!codigo) {
    return null;
  }

  return {
    codigo,
    mensaje: MOTIVOS[codigo] ?? 'El enlace no sirvió. Pide uno nuevo desde la pantalla anterior.',
  };
}
