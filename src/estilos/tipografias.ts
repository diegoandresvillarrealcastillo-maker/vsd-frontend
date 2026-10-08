/**
 * Las tipografias, servidas desde el propio dominio (L-06 de la auditoria 360).
 *
 * Antes se pedian a Google en cada visita: la direccion IP de quien llegaba le
 * llegaba a Google antes de cualquier aviso, habia que declararlo como tercero y la
 * politica de contenido tenia que abrirle la puerta a dos origenes ajenos. Ahora
 * las letras viajan con la aplicacion, y el service worker las guarda con el resto
 * de sus archivos para verlas tambien sin conexion.
 *
 * Son las mismas familias y los mismos pesos que pedia `index.html`:
 *
 * - **Manrope** 500, 600 y 800: la portada y las pantallas de acceso.
 * - **DM Sans** 400 a 700: el texto dentro de la aplicacion.
 * - **Newsreader** cursiva 400 y 500: los titulos de la aplicacion.
 *
 * ## Solo el subconjunto latino
 *
 * Cubre el espanol entero (tildes, enie, `¿` y `¡`). Los subconjuntos cirilico,
 * griego o vietnamita pesarian mas en cada visita sin que nadie los use; si algun
 * dia hace falta otro alfabeto, se anade su archivo aqui.
 *
 * ## Una diferencia pequena con Google
 *
 * Google servia Newsreader con el eje de tamano optico (`opsz`) variable; estos
 * archivos son estaticos, con el tamano optico por defecto. A tamanos grandes los
 * trazos son un poco menos finos. Si se notara, el paquete variable
 * (`@fontsource-variable/newsreader`) lo recupera a cambio de un archivo mas
 * pesado.
 */
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/manrope/latin-800.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/newsreader/latin-400-italic.css';
import '@fontsource/newsreader/latin-500-italic.css';
