import { useSyncExternalStore } from 'react';

/**
 * El archivo de una persona, listo para pintar (SCRUM-120 y SCRUM-122).
 *
 * Lo usan la foto de perfil y la mascota propia, que son la misma historia con
 * distinto archivo: algo que vive en el servidor, que la cuenta anuncia con una
 * **marca** (si hay y desde cuando), y que no se puede poner en un `<img src>`
 * apuntando a la API porque cada peticion lleva la sesion y una imagen no puede
 * llevar cabeceras. Se pide con `fetch`, se guarda en memoria como un `Blob` y se
 * pinta con una direccion `blob:` que solo existe en esta pestana.
 *
 * Vive en un modulo y no en un contexto de React por lo mismo que la zona
 * horaria: lo leen la barra de arriba, el perfil y la mascota flotante, que no
 * comparten ningun ancestro comodo, y cambia como mucho una vez por archivo.
 *
 * ---------------------------------------------------------------------------
 * Cuando se pide
 * ---------------------------------------------------------------------------
 *
 * Cada vez que llega una cuenta, `sincronizar` mira su marca:
 *
 * - sin marca, no hay nada que pedir;
 * - con la marca del archivo que ya se tiene, tampoco: no se vuelve a bajar;
 * - con una marca distinta, se pide el nuevo.
 *
 * Si ya se tiene a mano el archivo (la foto que la persona acaba de elegir), se
 * usa ese y no se pide de vuelta.
 *
 * ---------------------------------------------------------------------------
 * Lo que no se queda
 * ---------------------------------------------------------------------------
 *
 * Es de una persona: al salir, o al llegar la cuenta de otra, se suelta y se
 * libera su direccion. El archivo de quien uso el navegador antes no puede verse
 * en el siguiente inicio de sesion.
 */

export interface EstadoDelArchivo {
  /** De quien es lo que hay guardado. */
  readonly cuenta: string | null;
  /** La marca del archivo que corresponde a `url`. */
  readonly marca: string | null;
  /** Direccion `blob:` para pintarlo, o `null` si no hay. */
  readonly url: string | null;
  /**
   * Se esta pidiendo: la cuenta dice que hay un archivo y todavia no llego.
   * Sirve para no pintar de mas el dibujo de siempre mientras tanto.
   */
  readonly cargando: boolean;
}

const VACIO: EstadoDelArchivo = { cuenta: null, marca: null, url: null, cargando: false };

export interface AlmacenDeArchivo {
  /**
   * Mira lo que dice la cuenta que acaba de llegar y deja el archivo como
   * corresponde.
   *
   * @param marca La marca que trae la cuenta, o `null` si no tiene archivo.
   * @param archivo El archivo, si ya se tiene a mano.
   */
  sincronizar(cuenta: string, marca: string | null, archivo?: Blob): void;

  /** Al salir: el archivo de esta cuenta no se queda para la siguiente persona. */
  olvidar(): void;

  /** Para pintar: la direccion y si se esta pidiendo. */
  usarElEstado(): EstadoDelArchivo;

  /** Para pintar: solo la direccion. Vuelve a pintar menos veces. */
  usarLaDireccion(): string | null;
}

export function crearElAlmacenDeArchivo(opciones: {
  /** Pide el archivo propio a la API. */
  readonly pedir: () => Promise<Blob>;
  /**
   * El tipo que tiene que llevar el `Blob`. Una direccion `blob:` de un SVG sin
   * tipo no se pinta, y el tipo que trae una respuesta no siempre llega.
   */
  readonly tipo?: string;
}): AlmacenDeArchivo {
  let estado: EstadoDelArchivo = VACIO;
  /** La marca que se esta pidiendo ahora, para no pedir dos veces la misma. */
  let marcaEnCamino: string | null = null;
  /** Cambia con cada decision nueva: una respuesta que llega tarde se descarta. */
  let turno = 0;

  const oyentes = new Set<() => void>();

  function cambiar(nuevo: EstadoDelArchivo): void {
    if (estado.url !== null && estado.url !== nuevo.url) {
      URL.revokeObjectURL(estado.url);
    }

    estado = nuevo;

    for (const oyente of oyentes) {
      oyente();
    }
  }

  function direccionDe(archivo: Blob): string {
    const conTipo =
      opciones.tipo !== undefined && archivo.type !== opciones.tipo
        ? new Blob([archivo], { type: opciones.tipo })
        : archivo;

    return URL.createObjectURL(conTipo);
  }

  /** Pide el archivo y lo deja listo, salvo que mientras tanto haya cambiado la situacion. */
  async function traer(cuenta: string, marca: string, mio: number): Promise<void> {
    let archivo: Blob;

    try {
      archivo = await opciones.pedir();
    } catch {
      // Sin el archivo, la persona ve lo de siempre. No se muestra uno viejo que
      // ya no es el suyo, ni se insiste: la proxima vez que llegue la cuenta se
      // vuelve a intentar.
      if (mio === turno) {
        marcaEnCamino = null;
        cambiar({ cuenta, marca: null, url: null, cargando: false });
      }

      return;
    }

    if (mio !== turno) {
      return;
    }

    marcaEnCamino = null;
    cambiar({ cuenta, marca, url: direccionDe(archivo), cargando: false });
  }

  function olvidar(): void {
    turno += 1;
    marcaEnCamino = null;
    cambiar(VACIO);
  }

  function sincronizar(cuenta: string, marca: string | null, archivo?: Blob): void {
    // La cuenta de otra persona: lo que hubiera era de alguien mas.
    if (estado.cuenta !== null && estado.cuenta !== cuenta) {
      olvidar();
    }

    if (marca === null) {
      turno += 1;
      marcaEnCamino = null;
      cambiar({ cuenta, marca: null, url: null, cargando: false });

      return;
    }

    if (archivo !== undefined) {
      turno += 1;
      marcaEnCamino = null;
      cambiar({ cuenta, marca, url: direccionDe(archivo), cargando: false });

      return;
    }

    if (estado.marca === marca || marcaEnCamino === marca) {
      return;
    }

    turno += 1;
    marcaEnCamino = marca;

    // Mientras llega, se sigue mostrando el anterior, si lo habia.
    cambiar({ ...estado, cuenta, cargando: true });

    void traer(cuenta, marca, turno);
  }

  function suscribir(oyente: () => void): () => void {
    oyentes.add(oyente);

    return () => {
      oyentes.delete(oyente);
    };
  }

  // Con nombre que empieza por `use`: es lo que las reglas de React reconocen
  // como un gancho.
  function useElEstado(): EstadoDelArchivo {
    return useSyncExternalStore(suscribir, () => estado);
  }

  function useLaDireccion(): string | null {
    return useSyncExternalStore(suscribir, () => estado.url);
  }

  return { sincronizar, olvidar, usarElEstado: useElEstado, usarLaDireccion: useLaDireccion };
}
