/**
 * Las direcciones de la aplicacion, en un solo sitio.
 *
 * Escribirlas a mano en cada `navigate('/acceso')` funciona hasta que alguien
 * escribe `/aceso` y el error solo aparece al pulsar el boton. Aqui TypeScript
 * lo detiene antes.
 */
export const RUTAS = {
  /** Portada publica. */
  INICIO: '/',

  /** Las tres pantallas de autenticacion. */
  ACCESO: '/acceso',
  REGISTRO: '/registro',
  RECUPERAR: '/recuperar',
  /** A donde lleva el enlace del correo de recuperacion. */
  CONTRASENA_NUEVA: '/contrasena-nueva',

  /** Primera pantalla despues de entrar. */
  PANEL: '/panel',
} as const;

export type Ruta = (typeof RUTAS)[keyof typeof RUTAS];
