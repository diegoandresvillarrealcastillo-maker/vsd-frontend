import { traerElCatalogoConCopia } from './catalogoLocal.ts';

/**
 * Lo que se guarda por adelantado para poder usarlo sin conexion (SCRUM-138).
 *
 * Una actividad abre sin red porque su catalogo esta guardado en el equipo. Si la
 * copia solo se hiciera la primera vez que se abre una actividad, quien nunca la haya
 * abierto con conexion no la tendria cuando mas falta hace. Por eso, en cuanto se
 * abre el almacen de una persona y hay conexion, se leen las cosas que sirven para
 * todo el mundo y se dejan guardadas.
 *
 * **Nunca falla ni molesta**: es una comodidad. Sin conexion, o si el servidor no
 * responde, no pasa nada; se intentara otra vez cuando vuelva la red. Y solo trae lo
 * que es igual para todos (ver `lecturas.ts`).
 */
export async function precargarLasLecturas(): Promise<void> {
  // Cada lectura corre dentro de su propia promesa: ni una que falle antes de esperar a
  // nadie puede romper a quien llama.
  await Promise.allSettled([Promise.resolve().then(() => traerElCatalogoConCopia())]);
}
