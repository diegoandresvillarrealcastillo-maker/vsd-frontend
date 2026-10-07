import { useSyncExternalStore } from 'react';

/**
 * El estado de las versiones nuevas de la aplicacion (SCRUM-135).
 *
 * Cuando el navegador baja una version nueva, el service worker nuevo queda
 * "esperando": no toma el control mientras haya una pagina de la version vieja
 * abierta, porque esa pagina pediria archivos que ya no existen. Aqui queda
 * anotado que hay uno esperando, y como hacer que tome el control, para que una
 * pieza de la pantalla lo ofrezca.
 *
 * Hay dos momentos, y no son lo mismo:
 *
 * - **`actualizar`**: hay una version nueva esperando. Se ofrece; la persona
 *   decide cuando.
 * - **`recargar`**: la version nueva YA tomo el control sin que esta pestana lo
 *   pidiera. Pasa si la persona la acepto en otra pestana de la aplicacion. Esta
 *   pagina sigue con el codigo viejo y los archivos viejos ya no estan guardados:
 *   hay que recargarla, pero **no a la fuerza**, porque quiza esta escribiendo.
 *
 * Es un almacen pequeno fuera de React porque quien detecta todo esto (el
 * registro del service worker, en `main.tsx`) vive antes de que exista ningun
 * componente.
 */

type Aplicar = () => Promise<void>;

/** Lo que la pantalla tiene que ofrecer ahora. */
export type OfertaDeVersion = 'ninguna' | 'actualizar' | 'recargar';

let oferta: OfertaDeVersion = 'ninguna';
let aplicarLaVersion: Aplicar | null = null;
let recargarLaPagina: (() => void) | null = null;
/** La persona pulso "Actualizar" en ESTA pestana: la recarga la pidio ella. */
let activacionPedidaAqui = false;
const oyentes = new Set<() => void>();

function cambiar(nueva: OfertaDeVersion): void {
  oferta = nueva;
  oyentes.forEach((oyente) => {
    oyente();
  });
}

/** El registro avisa: hay una version nueva, y esto es lo que la activa. */
export function avisarVersionNueva(aplicar: Aplicar): void {
  aplicarLaVersion = aplicar;
  cambiar('actualizar');
}

/**
 * "Despues": se esconde el aviso en esta visita. No se olvida la version: al
 * abrir la aplicacion otra vez, el navegador la sigue teniendo esperando y el
 * registro vuelve a avisar.
 *
 * Solo vale para la oferta de actualizar. La de recargar no se puede dejar para
 * despues: esta pagina ya esta desincronizada de lo guardado.
 */
export function dejarLaVersionParaDespues(): void {
  if (oferta === 'actualizar') {
    cambiar('ninguna');
  }
}

/**
 * Activa la version nueva, a peticion de la persona. Cuando el navegador la
 * activa, la pagina se recarga sola (ver `laVersionNuevaTomoElControl`).
 */
export async function aplicarLaVersionNueva(): Promise<void> {
  activacionPedidaAqui = true;

  try {
    await aplicarLaVersion?.();
  } catch (error) {
    activacionPedidaAqui = false;

    throw error;
  }
}

/**
 * La version nueva tomo el control de esta pagina. Es el momento en que el
 * plugin recargaria la pagina por su cuenta; aqui se decide si de verdad hace
 * falta hacerlo ya.
 *
 * - Si la persona la pidio en esta pestana: se recarga, que es lo que espera.
 * - Si no (la acepto en otra): **no se recarga**. Recargar una pagina sin que
 *   quien la usa lo sepa es perder lo que estuviera escribiendo. Se ofrece
 *   recargar y se espera.
 */
export function laVersionNuevaTomoElControl(recargar: () => void): void {
  if (activacionPedidaAqui) {
    recargar();

    return;
  }

  recargarLaPagina = recargar;
  cambiar('recargar');
}

/** "Recargar": la persona decidio que ya es buen momento. */
export function recargarAhora(): void {
  recargarLaPagina?.();
}

function suscribir(oyente: () => void): () => void {
  oyentes.add(oyente);

  return () => {
    oyentes.delete(oyente);
  };
}

function leer(): OfertaDeVersion {
  return oferta;
}

/** Para la pantalla: que hay que ofrecer ahora. */
export function useVersionNueva(): OfertaDeVersion {
  return useSyncExternalStore(suscribir, leer);
}

/** Solo para las pruebas: deja el almacen como al abrir la aplicacion. */
export function olvidarLaVersionNuevaParaLasPruebas(): void {
  aplicarLaVersion = null;
  recargarLaPagina = null;
  activacionPedidaAqui = false;
  oyentes.clear();
  oferta = 'ninguna';
}
