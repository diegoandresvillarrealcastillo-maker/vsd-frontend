import { matchPath } from 'react-router-dom';

import { RUTAS } from '../rutas/rutas.ts';

/**
 * Lo unico que se cuenta de una visita a Google Analytics (SCRUM-161): **la
 * plantilla de la pantalla**, nunca la direccion que la persona tiene en la barra.
 *
 * `/actividad/9f1c…` y `/modulo/ansiedad` dicen mas de lo que parece: el
 * identificador de una actividad o el modulo que alguien abre cuentan, juntos,
 * algo de su salud. A Google solo le llegan `/actividad/:id` y `/modulo/:modulo`,
 * que sirven para saber que pantallas se usan y no que hizo cada quien.
 *
 * Tampoco pasan la consulta (`?…`) ni el fragmento (`#…`): el enlace del correo de
 * recuperar la contrasena trae un token ahi. Esto recibe solo el `pathname`, y
 * ademas se queda con la plantilla, no con la ruta.
 *
 * Lo que no es ninguna pantalla conocida se cuenta como `/otra`, sin su texto:
 * quien escribe una direccion a mano puede escribir cualquier cosa.
 */
export const RUTA_DESCONOCIDA = '/otra';

const PANTALLAS_FIJAS: ReadonlySet<string> = new Set([
  RUTAS.INICIO,
  RUTAS.ACCESO,
  RUTAS.REGISTRO,
  RUTAS.RECUPERAR,
  RUTAS.CONTRASENA_NUEVA,
  RUTAS.PRIVACIDAD,
  RUTAS.TERMINOS,
  RUTAS.COOKIES,
  RUTAS.PANEL,
  RUTAS.PERFIL,
  RUTAS.DIARIO,
]);

const PANTALLAS_CON_PARAMETRO: readonly string[] = [RUTAS.MODULO, RUTAS.ACTIVIDAD];

export function plantillaDeRuta(pathname: string): string {
  // Sin barra final y en minusculas: el enrutador las trata como la misma pantalla.
  const normalizada = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const comparable = normalizada.toLowerCase();

  if (PANTALLAS_FIJAS.has(comparable)) {
    return comparable;
  }

  for (const plantilla of PANTALLAS_CON_PARAMETRO) {
    if (matchPath({ path: plantilla, end: true }, normalizada) !== null) {
      return plantilla;
    }
  }

  return RUTA_DESCONOCIDA;
}
