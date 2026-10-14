/**
 * Lo que la mascota le dice a quien escribio en su diario algo que pide acompanar (SCRUM-194,
 * decision D6).
 *
 * ## Que no hace
 *
 * **Nunca lleva lineas de atencion.** Quien acaba de contar algo dificil y recibe, pegada al
 * texto, una lista de telefonos de crisis, lo vive como una alarma. Las lineas se piden aparte:
 * aceptar abre VSD IA con «¿Dónde busco ayuda?» ya preguntado, que responde con las del pais de
 * la persona y tambien sin conexion.
 *
 * Tampoco diagnostica, nombra lo escrito ni castiga. Y solo aparece con el permiso que la
 * persona dio en su perfil (SCRUM-108): sin el, el servidor no lee lo escrito y no hay nada que
 * ofrecer.
 *
 * ## Los textos
 *
 * Los revisa Diego: estan tambien en `docs/textos-del-asistente.md` del backend. Se cambian aqui,
 * en un solo sitio.
 */

export const TEXTO_DE_LA_INVITACION_DEL_DIARIO =
  'Gracias por escribirlo. Lo que sientes importa, y no tienes que pasarlo sin compañía. ¿Quieres ver algunos consejos o hablar con alguien?';

export const INVITACION_DEL_DIARIO = {
  texto: TEXTO_DE_LA_INVITACION_DEL_DIARIO,
  aceptar: 'Sí, ver opciones',
  rechazar: 'Ahora no',
  /**
   * Es una de las sugerencias que VSD IA ya sabe responder, tal cual: lleva a «dónde busco
   * ayuda» tambien sin conexion. Una prueba lo comprueba contra el paquete de reglas.
   */
  pregunta: '¿Dónde busco ayuda?',
} as const;
