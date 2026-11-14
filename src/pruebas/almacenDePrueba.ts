import { alCambiarLaSesion, reiniciarElCicloParaLasPruebas } from '../sincronizacion/ciclo.ts';

/**
 * Un almacen local abierto para las pruebas que recorren una pantalla de verdad
 * (SCRUM-138): lo que se guarda va a la cola de esta persona y lo envia el motor de
 * verdad. Es de memoria: no escribe nada.
 *
 * Quien lo use simula la API (`registrarResultado`) y la conexion
 * (`hayConexionConLaApi`) con sus propios dobles.
 */
export async function abrirUnAlmacenDePrueba(persona = 'ana'): Promise<void> {
  reiniciarElCicloParaLasPruebas();
  await alCambiarLaSesion(persona, { persistente: false });
}

export function cerrarElAlmacenDePrueba(): void {
  reiniciarElCicloParaLasPruebas();
}
