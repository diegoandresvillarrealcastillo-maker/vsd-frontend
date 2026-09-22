/**
 * Que tema esta puesto, y quien lo decidio.
 *
 * ---------------------------------------------------------------------------
 * Tres estados, no dos
 * ---------------------------------------------------------------------------
 *
 * La aplicacion puede estar en claro, en oscuro, o **sin que nadie lo haya
 * dicho**. Ese tercero no es un detalle: mientras nadie elija, la aplicacion
 * sigue al sistema, y si alguien cambia su equipo a oscuro por la noche la
 * aplicacion cambia con el. En cuanto se pulsa el control, esa preferencia
 * manda y deja de seguirlo.
 *
 * El CSS, en cambio, solo conoce dos: el elemento raiz lleva siempre
 * `data-tema` con un valor concreto. El tercer estado se resuelve aqui y en el
 * script del `index.html`, nunca en la hoja de estilos.
 *
 * ---------------------------------------------------------------------------
 * Donde se guarda
 * ---------------------------------------------------------------------------
 *
 * En `localStorage`, que es justo para lo que sirve: una comodidad de este
 * navegador, que no le importa a nadie mas y que no pasa nada si se pierde.
 * No es informacion de la persona y no sale de aqui.
 *
 * Cada acceso va envuelto porque en navegacion privada o con el
 * almacenamiento bloqueado, leer y escribir lanzan. Un tema que no se recuerda
 * es un incordio; una portada que no carga es otra cosa.
 */

export type Tema = 'claro' | 'oscuro';

/** La misma cadena esta en el script del `index.html`. Si cambia, cambian las dos. */
const CLAVE = 'vsd.tema';

const CONSULTA_OSCURO = '(prefers-color-scheme: dark)';

function esTema(valor: string | null | undefined): valor is Tema {
  return valor === 'claro' || valor === 'oscuro';
}

/** Lo que eligio la persona, o `null` si todavia no eligio nada. */
export function temaElegido(): Tema | null {
  try {
    const guardado = localStorage.getItem(CLAVE);
    return esTema(guardado) ? guardado : null;
  } catch {
    return null;
  }
}

/** Lo que pide el sistema operativo ahora mismo. */
export function temaDelSistema(): Tema {
  return window.matchMedia(CONSULTA_OSCURO).matches ? 'oscuro' : 'claro';
}

/**
 * El que se esta viendo.
 *
 * Se lee del documento y no se vuelve a calcular: ahi lo dejo el script del
 * `index.html` antes del primer pintado, y es la unica fuente que no puede
 * discrepar de lo que hay en pantalla.
 */
export function temaActual(): Tema {
  const puesto = document.documentElement.dataset.tema;
  return esTema(puesto) ? puesto : temaDelSistema();
}

/**
 * Pone el tema y lo recuerda.
 *
 * Lo unico que hace en la pagina es marcar el elemento raiz. A partir de ahi
 * manda el CSS: el bloque de tokens oscuros cuelga de esa marca. Ningun
 * componente tiene que enterarse.
 */
export function ponerTema(tema: Tema): void {
  const raiz = document.documentElement;

  // Las transiciones se apagan mientras dura el cambio. No es por estetica:
  // una propiedad que esta en una lista de `transition` y cuyo valor sale de
  // una variable se queda clavada en el valor viejo cuando lo unico que cambia
  // es la variable. El boton principal pasaba a oscuro con el fondo del tema
  // claro y el texto del oscuro, a 2,03:1 de contraste.
  raiz.dataset.cambiandoTema = '';
  raiz.dataset.tema = tema;

  // Leer una medida obliga al navegador a recalcular ahora, con las
  // transiciones todavia apagadas. Sin esta linea, el navegador podria agrupar
  // las dos marcas en el mismo paso y no servir de nada.
  void raiz.offsetHeight;

  requestAnimationFrame(() => {
    delete raiz.dataset.cambiandoTema;
  });

  try {
    localStorage.setItem(CLAVE, tema);
  } catch {
    // Sin poder guardarlo, el tema vale para esta pagina y se olvida al
    // recargar. Preferible a no dejar cambiarlo.
  }
}

/**
 * Sigue al sistema mientras nadie haya elegido.
 *
 * Quien cambia su equipo a oscuro al anochecer espera que las aplicaciones que
 * no ha tocado cambien con el. En cuanto pulsa el selector, esa preferencia
 * manda y esto deja de hacer nada.
 *
 * Se llama una vez al arrancar. No hace falta desengancharlo: vive tanto como
 * la pestana.
 */
export function seguirAlSistema(): void {
  window.matchMedia(CONSULTA_OSCURO).addEventListener('change', (evento) => {
    if (temaElegido() !== null) {
      return;
    }

    document.documentElement.dataset.tema = evento.matches ? 'oscuro' : 'claro';
  });
}
