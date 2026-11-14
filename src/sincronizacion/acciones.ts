import { avisarQueLaColaCambio, cicloActual } from './ciclo.ts';
import { dependientesDe } from './cola.ts';

/**
 * Lo que la persona puede hacer con un cambio guardado que no se pudo enviar
 * (SCRUM-137).
 *
 * Solo dos cosas, y solo sobre lo que **necesita su atencion**: lo que esta
 * esperando su turno o su reintento lo maneja el motor, y la persona no tiene por
 * que tocarlo.
 *
 * - **Reintentar** es para lo que se rechazo de forma permanente o agoto los
 *   intentos: vuelve a la cola como si fuera nuevo, con los intentos en cero. Un
 *   conflicto no se reintenta: volveria a chocar con lo mismo. Y lo que no se pudo
 *   leer tampoco: no hay con que reenviar.
 * - **Descartar** lo tira, **junto con lo que dependia de el**. Editar algo que
 *   nunca se creo no tiene a que aplicarse y quedaria detenido para siempre.
 *
 * Ninguna de las dos toca la red: dejan la cola como esta y avisan que cambio.
 * Quien las llama decide si sincronizar a continuacion.
 */

/**
 * Devuelve a la cola un cambio que requeria atencion.
 *
 * @returns Si se pudo: `false` si el cambio ya no esta, si no esperaba atencion o si
 *   no se puede reenviar.
 */
export async function reintentarCambio(operationId: string): Promise<boolean> {
  const ciclo = cicloActual();

  if (ciclo === null) {
    return false;
  }

  const operacion = await ciclo.almacen.operacion(operationId);

  if (operacion?.estado !== 'requiere_atencion' || operacion.ilegible === true) {
    return false;
  }

  await ciclo.almacen.guardarOperacion({
    ...operacion,
    estado: 'pendiente',
    intentos: 0,
    proximoIntento: null,
    error: null,
  });
  avisarQueLaColaCambio();

  return true;
}

/**
 * Cuantos cambios se descartarian junto con este: los que dependen de el.
 * Sirve para decirselo a la persona antes de preguntarle si esta segura.
 */
export async function cuantosDependenDe(operationId: string): Promise<number> {
  const ciclo = cicloActual();

  if (ciclo === null) {
    return 0;
  }

  return dependientesDe(await ciclo.almacen.operaciones(), operationId).length;
}

/**
 * Tira un cambio que requeria atencion o chocaba con otro dispositivo, y los que
 * dependian de el.
 *
 * @returns Los identificadores de lo que se quito, el primero el que se pidio. Vacio
 *   si no se hizo nada: el cambio ya no esta o no esperaba a la persona. Lo que
 *   esta esperando su turno o en camino no se descarta por aqui.
 */
export async function descartarCambio(operationId: string): Promise<readonly string[]> {
  const ciclo = cicloActual();

  if (ciclo === null) {
    return [];
  }

  const todas = await ciclo.almacen.operaciones();
  const operacion = todas.find((candidata) => candidata.operationId === operationId);

  if (operacion?.estado !== 'requiere_atencion' && operacion?.estado !== 'conflicto') {
    return [];
  }

  const quitadas = [
    operacion.operationId,
    ...dependientesDe(todas, operationId).map((o) => o.operationId),
  ];

  for (const id of quitadas) {
    await ciclo.almacen.quitarOperacion(id);
  }

  avisarQueLaColaCambio();

  return quitadas;
}
