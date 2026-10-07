import { useSyncExternalStore } from 'react';

import type { Cuenta } from '../infraestructura/api/cuenta.ts';
import { guardarLaFoto, pedirLaFoto, quitarLaFoto } from '../infraestructura/api/foto.ts';

/**
 * La foto de perfil de la persona, lista para pintar (SCRUM-120).
 *
 * Una foto es un archivo: no se puede poner en un `<img src>` apuntando a la API,
 * porque cada peticion tiene que llevar la sesion y una imagen no puede llevar
 * cabeceras. Se pide con `fetch`, se guarda en memoria como un `Blob` y se
 * pinta con una direccion `blob:` que solo existe en esta pestana.
 *
 * Vive en un modulo y no en un contexto de React por lo mismo que la zona
 * horaria: la leen la barra de arriba y el perfil, que no comparten ningun
 * ancestro comodo, y cambia como mucho una vez por foto.
 *
 * ---------------------------------------------------------------------------
 * Cuando se pide la foto
 * ---------------------------------------------------------------------------
 *
 * La cuenta dice **si hay foto y desde cuando** (`foto.actualizadaEl`), sin los
 * bytes. Cada vez que llega una cuenta, `sincronizarLaFoto` mira esa marca:
 *
 * - sin marca, no hay nada que pedir;
 * - con la marca de la foto que ya se tiene, tampoco: no se vuelve a bajar;
 * - con una marca distinta, se pide la foto nueva.
 *
 * Al guardar una foto propia no hace falta pedirla de vuelta: el archivo ya esta
 * aqui, y se usa ese mismo.
 *
 * ---------------------------------------------------------------------------
 * Lo que no se queda
 * ---------------------------------------------------------------------------
 *
 * Es de una persona: al salir, o al llegar la cuenta de otra, se suelta y se
 * libera su direccion. La foto de quien uso el navegador antes no puede verse en
 * el siguiente inicio de sesion.
 */

interface Estado {
  /** De quien es lo que hay guardado. */
  readonly cuenta: string | null;
  /** La marca de la foto que corresponde a `url`. */
  readonly marca: string | null;
  /** Direccion `blob:` para pintarla, o `null` si no hay. */
  readonly url: string | null;
}

const VACIO: Estado = { cuenta: null, marca: null, url: null };

let estado: Estado = VACIO;
/** La marca que se esta pidiendo ahora, para no pedir dos veces la misma. */
let marcaEnCamino: string | null = null;
/** Cambia con cada decision nueva: una respuesta que llega tarde se descarta. */
let turno = 0;

const oyentes = new Set<() => void>();

function avisar(): void {
  for (const oyente of oyentes) {
    oyente();
  }
}

function cambiar(nuevo: Estado): void {
  if (estado.url !== null && estado.url !== nuevo.url) {
    URL.revokeObjectURL(estado.url);
  }

  estado = nuevo;
  avisar();
}

/** Pide la foto y la deja lista, salvo que mientras tanto haya cambiado la situacion. */
async function traer(cuenta: string, marca: string, mio: number): Promise<void> {
  let archivo: Blob;

  try {
    archivo = await pedirLaFoto();
  } catch {
    // Sin la foto, la persona ve el icono de siempre. No se muestra una foto
    // vieja que ya no es la suya, ni se insiste: la proxima vez que llegue la
    // cuenta se vuelve a intentar.
    if (mio === turno) {
      marcaEnCamino = null;
      cambiar({ cuenta, marca: null, url: null });
    }

    return;
  }

  if (mio !== turno) {
    return;
  }

  marcaEnCamino = null;
  cambiar({ cuenta, marca, url: URL.createObjectURL(archivo) });
}

/**
 * Mira la cuenta que acaba de llegar y deja la foto como corresponde.
 *
 * @param archivo La foto, si ya se tiene a mano (la que acaba de elegir la
 *   persona). Evita pedirla de vuelta a la API.
 */
export function sincronizarLaFoto(cuenta: Pick<Cuenta, 'id' | 'foto'>, archivo?: Blob): void {
  const marca = cuenta.foto?.actualizadaEl ?? null;

  // La cuenta de otra persona: lo que hubiera era de alguien mas.
  if (estado.cuenta !== null && estado.cuenta !== cuenta.id) {
    olvidarLaFoto();
  }

  if (marca === null) {
    turno += 1;
    marcaEnCamino = null;
    cambiar({ cuenta: cuenta.id, marca: null, url: null });

    return;
  }

  if (archivo !== undefined) {
    turno += 1;
    marcaEnCamino = null;
    cambiar({ cuenta: cuenta.id, marca, url: URL.createObjectURL(archivo) });

    return;
  }

  if (estado.marca === marca || marcaEnCamino === marca) {
    return;
  }

  turno += 1;
  marcaEnCamino = marca;

  void traer(cuenta.id, marca, turno);
}

/** Al salir: la foto de esta cuenta no se queda para la siguiente persona. */
export function olvidarLaFoto(): void {
  turno += 1;
  marcaEnCamino = null;
  cambiar(VACIO);
}

/**
 * Guarda la foto y la deja lista para pintar. Devuelve la cuenta como quedo.
 * Si la API la rechaza, lanza y lo que se veia se queda como estaba.
 */
export async function subirLaFoto(foto: Blob): Promise<Cuenta> {
  const cuenta = await guardarLaFoto(foto);

  sincronizarLaFoto(cuenta, foto);

  return cuenta;
}

/** Quita la foto y la deja de pintar. Devuelve la cuenta como quedo. */
export async function retirarLaFoto(): Promise<Cuenta> {
  const cuenta = await quitarLaFoto();

  sincronizarLaFoto(cuenta);

  return cuenta;
}

function suscribir(oyente: () => void): () => void {
  oyentes.add(oyente);

  return () => {
    oyentes.delete(oyente);
  };
}

/** La direccion de la foto de la persona, o `null` si no tiene. */
export function useFotoDePerfil(): string | null {
  return useSyncExternalStore(suscribir, () => estado.url);
}
