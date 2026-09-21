import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { credencialesDeSupabase } from '../entorno.ts';
import { almacenamientoDeSesion } from './almacenamiento.ts';

/**
 * El cliente de Supabase, uno solo para toda la aplicacion.
 *
 * Se construye la primera vez que alguien lo pide y no al importar el modulo.
 * Asi la portada se puede ver sin haber configurado nada, y quien acaba de
 * clonar el repositorio no se encuentra una pantalla en blanco: el error, si
 * falta una credencial, aparece cuando de verdad hace falta y dice cual es.
 */
let cliente: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (cliente) {
    return cliente;
  }

  const { url, claveAnonima } = credencialesDeSupabase();

  cliente = createClient(url, claveAnonima, {
    auth: {
      // Donde vive la sesion lo decide el adaptador, segun la persona haya
      // marcado o no "no recordar en este equipo".
      storage: almacenamientoDeSesion,
      storageKey: 'vsd.sesion',

      persistSession: true,

      // El token de acceso dura una hora. Renovarlo solo es lo que evita que a
      // alguien se le corte a media actividad.
      autoRefreshToken: true,

      // El enlace del correo de recuperacion llega con el token en la parte de
      // la URL que va despues de la almohadilla. Sin esto no se recogeria y la
      // pantalla de contrasena nueva no tendria con que trabajar.
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  });

  return cliente;
}

/**
 * Suelta el cliente. Existe para las pruebas: sin esto, la primera que lo
 * construye deja su configuracion fijada para todas las demas.
 */
export function olvidarCliente(): void {
  cliente = null;
}
