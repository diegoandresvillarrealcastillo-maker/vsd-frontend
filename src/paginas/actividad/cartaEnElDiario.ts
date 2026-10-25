import type { NodoDelDocumento } from '../../infraestructura/api/diario.ts';
import type { EscrituraEnCola } from '../../sincronizacion/anotaciones.ts';
import { encolar } from '../../sincronizacion/ciclo.ts';
import { diaEnLaZona } from '../../tiempo/zonaHoraria.ts';

/**
 * «Carta a mi de manana» (SCRUM-227, ficha EMO-05, decision D-C5): lo escrito se guarda **como una entrada del
 * diario**, que ya tiene aislamiento, exportacion y borrado. Va por la misma cola que cualquier cosa que se
 * escribe en el diario, asi que tambien se guarda sin conexion y sale cuando vuelve.
 *
 * ## Lo que esto no hace (todavia)
 *
 * La entrada es de **hoy**: el diario no admite entradas con fecha de manana. Que la carta reaparezca manana al
 * abrir la aplicacion, y se pueda borrar sin leerla, necesita un borrado en el diario y una tarjeta en el panel
 * que aun no existen. Mientras tanto la carta esta en el diario, y el cierre de la actividad lo dice asi: no
 * promete lo que no pasa.
 */
export const TITULO_DE_LA_CARTA = 'Carta a mí de mañana';

/** Un texto como documento del diario: un parrafo por cada renglon. */
export function documentoDeUnTexto(texto: string): NodoDelDocumento {
  const renglones = texto.split(/\r?\n/);

  return {
    type: 'doc',
    content: renglones.map((renglon): NodoDelDocumento =>
      renglon === ''
        ? { type: 'paragraph' }
        : { type: 'paragraph', content: [{ type: 'text', text: renglon }] },
    ),
  };
}

/**
 * Deja la carta guardada **en este equipo** y en la cola de envio; lanza si no se pudo (no hay donde guardar),
 * y quien llama no debe vaciar lo que la persona escribio.
 */
export async function guardarLaCartaEnElDiario(
  texto: string,
  ahora: Date = new Date(),
): Promise<void> {
  const operationId = globalThis.crypto.randomUUID();
  const payload: EscrituraEnCola = {
    clientOperationId: operationId,
    dia: diaEnLaZona(ahora),
    titulo: TITULO_DE_LA_CARTA,
    contenido: documentoDeUnTexto(texto),
    // La hora del dispositivo: sin conexion, la de cuando llegue seria mentira.
    escritaEn: ahora.toISOString(),
  };

  await encolar({
    operationId,
    tipo: 'diario.escribir',
    entidad: `diario:${operationId}`,
    payload,
  });
}
