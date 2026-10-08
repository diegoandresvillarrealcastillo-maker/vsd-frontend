import { traerElCatalogoConCopia } from './catalogoLocal.ts';
import { precargarElDiario } from './diarioLocal.ts';
import { precargarElPanel } from './panelLocal.ts';
import { precargarLasReglasLocales } from './reglasLocalesLocal.ts';
import { precargarElSemaforo } from './semaforoLocal.ts';

/**
 * Lo que se guarda por adelantado para poder usarlo sin conexion (SCRUM-138).
 *
 * Una actividad abre sin red porque su catalogo esta guardado en el equipo. Si la
 * copia solo se hiciera la primera vez que se abre una actividad, quien nunca la haya
 * abierto con conexion no la tendria cuando mas falta hace. Por eso, en cuanto se
 * abre el almacen de una persona y hay conexion, se leen las cosas que sirven para
 * todo el mundo y se dejan guardadas.
 *
 * Lo mismo vale para el diario (SCRUM-139): sus ultimos 30 dias se dejan guardados, en el
 * almacen cifrado de la persona, para poder leerlos sin conexion. Esa lectura **no da de
 * alta la cuenta**: eso registra un consentimiento y solo lo hace una pantalla.
 *
 * Y el semaforo de pendientes (SCRUM-140), por lo mismo: asi se puede usar completo sin red
 * desde la primera vez. Sin recordatorios: esos los decide el servidor.
 *
 * Y el panel con el sendero (SCRUM-140): la cuenta y el progreso, para que abran sin red. Esa
 * lectura tampoco da de alta la cuenta.
 *
 * Y las reglas con las que VSD IA responde sin conexion (SCRUM-141): un saludo, una
 * despedida, las lineas de ayuda de cada pais y la deteccion de riesgo. Las lineas son lo
 * ultimo que se quiere no tener cuando falla la red.
 *
 * **Nunca falla ni molesta**: es una comodidad. Sin conexion, o si el servidor no
 * responde, no pasa nada; se intentara otra vez cuando vuelva la red.
 */
export async function precargarLasLecturas(): Promise<void> {
  // Cada lectura corre dentro de su propia promesa: ni una que falle antes de esperar a
  // nadie puede romper a quien llama.
  await Promise.allSettled([
    Promise.resolve().then(() => traerElCatalogoConCopia()),
    Promise.resolve().then(() => precargarElDiario()),
    Promise.resolve().then(() => precargarElSemaforo()),
    Promise.resolve().then(() => precargarElPanel()),
    Promise.resolve().then(() => precargarLasReglasLocales()),
  ]);
}
