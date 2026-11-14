import { entorno } from '../infraestructura/entorno.ts';

/**
 * El aviso de debajo del boton de Google cuando esta en modo de prueba (SCRUM-74).
 *
 * Mientras la pantalla de consentimiento de Google esta en pruebas, solo pasan las cuentas que el
 * equipo agrego como evaluadoras. Todas las demas ven un error de Google en otra pagina, sin
 * camino de vuelta, y creerian que la aplicacion esta rota. Se dice antes de pulsar y se ofrece
 * la salida que si funciona.
 *
 * No pinta nada fuera del modo de prueba.
 */
export function AvisoDeGoogleEnPrueba() {
  if (!entorno.googleEnPrueba) {
    return null;
  }

  return (
    <p className="campo__ayuda" data-testid="aviso-de-google-en-prueba">
      Entrar con Google está en pruebas: por ahora solo funciona con las cuentas que el equipo
      autorizó. Si la tuya no es una de ellas, usa tu correo y contraseña.
    </p>
  );
}
