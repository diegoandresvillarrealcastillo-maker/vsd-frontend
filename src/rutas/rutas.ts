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

  /**
   * Los documentos legales. Publicos, con sesion o sin ella: se tienen que
   * poder leer antes de aceptarlos, y despues de hacerlo.
   */
  PRIVACIDAD: '/privacidad',
  TERMINOS: '/terminos',
  COOKIES: '/cookies',

  /**
   * La fecha de nacimiento y las casillas, para quien tiene sesion y todavia no
   * las dio: entro con Google, confirmo su correo en otro dispositivo o es una
   * cuenta de antes de que se pidieran.
   */
  COMPLETAR_REGISTRO: '/completa-tu-registro',

  /**
   * Lo que ve quien resulta menor de 18 anos. Publica: se llega a ella despues de
   * cerrar la sesion, y no guarda ni pide nada.
   */
  SOLO_MAYORES: '/solo-mayores',

  /** Primera pantalla despues de entrar. */
  PANEL: '/panel',

  /** Lo que la persona configura de su cuenta (SCRUM-101). */
  PERFIL: '/perfil',

  /** Mi diario: el lienzo para escribir y el historial por dias (SCRUM-96). */
  DIARIO: '/diario',

  /**
   * El sendero de un modulo (SCRUM-92). Lleva parametro: se usa
   * `rutaDeModulo`.
   */
  MODULO: '/modulo/:modulo',

  /**
   * Una actividad concreta. Lleva parametro, asi que no se navega a esta
   * cadena tal cual: se usa `rutaDeActividad`.
   */
  ACTIVIDAD: '/actividad/:id',
} as const;

export type Ruta = (typeof RUTAS)[keyof typeof RUTAS];

/**
 * La direccion de una actividad concreta.
 *
 * Existe para que el identificador se incruste en un solo sitio. Escribir
 * `` `/actividad/${id}` `` en cada enlace funciona hasta que la ruta cambia y
 * hay que encontrarlos todos.
 */
export function rutaDeActividad(id: string): string {
  return RUTAS.ACTIVIDAD.replace(':id', encodeURIComponent(id));
}

/** La direccion del sendero de un modulo. */
export function rutaDeModulo(modulo: string): string {
  return RUTAS.MODULO.replace(':modulo', encodeURIComponent(modulo));
}
