import { ErrorDeLaApi } from '../../infraestructura/api/clienteHttp.ts';

/**
 * Convierte el fallo en algo que se pueda leer.
 *
 * Se decide por el **codigo** de la API cuando lo hay, y por el estado HTTP
 * cuando no. Nunca por el texto del error: el texto puede reescribirse sin
 * avisar, el codigo y el estado son parte del contrato.
 *
 * El codigo hace falta porque el estado a veces no alcanza. Un 400 puede ser que
 * falte el consentimiento o puede ser cualquier otra cosa que la API rechace, y
 * dar por hecho lo primero produce un mensaje que manda a la persona a revisar
 * algo que estaba bien.
 *
 * Ninguno de estos mensajes cuenta nada del interior del sistema. Lo que se
 * dice es que paso y que puede hacer la persona, que son las dos unicas cosas
 * que le sirven. Y se redactan aqui, y no se reenvia el mensaje de la API,
 * porque esta pantalla sabe algo que el servidor no: que lo que fallo fue
 * entrar al panel.
 */
export function explicar(error: unknown): string {
  if (!(error instanceof ErrorDeLaApi)) {
    // Aqui cae que no haya red, o que la API no este arrancada. `fetch` no
    // lanza un ErrorDeLaApi en ese caso porque no llego a haber respuesta.
    return 'No se pudo conectar con el servidor. Revisa tu conexión y vuelve a intentarlo.';
  }

  switch (error.codigo) {
    case 'CONSENTIMIENTO_NO_REGISTRADO':
      return 'No se pudo crear tu cuenta porque falta la aceptación del aviso de tratamiento de datos.';

    // Solo ocurre si el aviso cambio entre pedir la version y darse de alta.
    // Reintentar vuelve a pedirla, asi que es exactamente lo que hay que hacer.
    case 'VERSION_DEL_AVISO_NO_VIGENTE':
      return 'El aviso de tratamiento de datos acaba de actualizarse. Vuelve a intentarlo para aceptar la versión actual.';

    case 'CORREO_YA_REGISTRADO':
      return 'Ese correo ya pertenece a una cuenta creada con otro método de acceso. Entra con el método que usaste la primera vez.';

    // No deberia ocurrir, porque el alta va justo antes de consultar. Si pasa,
    // decir "no tienes cuenta" es mas util que un numero.
    case 'CUENTA_NO_REGISTRADA':
      return 'Todavía no tienes una cuenta de VSD Health. Vuelve a intentarlo para crearla.';

    default:
      break;
  }

  if (error.estado === 401) {
    return 'Tu sesión caducó. Vuelve a entrar.';
  }

  if (error.estado === 429) {
    return 'Hiciste muchas peticiones seguidas. Espera un momento y vuelve a intentarlo.';
  }

  // Sin codigo reconocido queda el numero. No es bonito, pero es lo que la
  // persona puede leernos por teléfono, y junto con el identificador de la
  // petición es lo que permite encontrar qué pasó.
  return `No se pudo cargar tu panel (error ${error.estado}). Vuelve a intentarlo en un momento.`;
}
