/**
 * Avisos locales para quien necesita reaccionar cuando el servidor acepta un resultado.
 * Solo se comparte la cuenta: nunca el contenido ni las respuestas de la actividad.
 */
type Oyente = (cuenta: string) => void;

const oyentes = new Set<Oyente>();
const NOMBRE_DEL_CANAL = 'vsd-cola';
let canal: BroadcastChannel | null = null;

function abrirCanal(): void {
  if (canal !== null || typeof BroadcastChannel === 'undefined') {
    return;
  }

  canal = new BroadcastChannel(NOMBRE_DEL_CANAL);
  canal.addEventListener('message', (evento: MessageEvent<unknown>) => {
    const datos = evento.data as { persona?: unknown; tipo?: unknown } | null;

    if (datos?.tipo !== 'resultado-sincronizado' || typeof datos.persona !== 'string') {
      return;
    }

    avisarLocal(datos.persona);
  });
}

function avisarLocal(cuenta: string): void {
  for (const oyente of [...oyentes]) {
    try {
      oyente(cuenta);
    } catch {
      // Una pantalla no debe frenar la sincronizacion de las demas.
    }
  }
}

/** Escucha la confirmacion de un resultado enviado desde la cola local. */
export function alSincronizarUnResultado(oyente: Oyente): () => void {
  oyentes.add(oyente);
  abrirCanal();

  return () => {
    oyentes.delete(oyente);

    if (oyentes.size === 0 && canal !== null) {
      canal.close();
      canal = null;
    }
  };
}

/** Avisa despues de que la API acepto un resultado que estaba en la cola local. */
export function avisarResultadoSincronizado(cuenta: string): void {
  avisarLocal(cuenta);
  canal?.postMessage({ persona: cuenta, tipo: 'resultado-sincronizado' });
}
