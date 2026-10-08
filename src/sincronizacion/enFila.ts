/**
 * Una fila de tareas asincronas (SCRUM-139, SCRUM-140): cada una espera a que termine la
 * anterior, y ninguna rechaza.
 *
 * Sirve para lo que lee, cambia y escribe lo mismo: dos que se solapan leerian lo de antes y
 * la segunda pisaria a la primera. Un fallo de una tarea no detiene a las siguientes ni lo ve
 * quien espera: la fila nunca se atasca.
 */
export function crearFila(): (tarea: () => Promise<void>) => Promise<void> {
  let fila: Promise<void> = Promise.resolve();

  return (tarea) => {
    fila = fila.then(tarea).catch(() => undefined);

    return fila;
  };
}
