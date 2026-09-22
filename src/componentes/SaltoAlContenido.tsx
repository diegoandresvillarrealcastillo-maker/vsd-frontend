import type { MouseEvent } from 'react';

/**
 * El primer tabulador de cada pantalla.
 *
 * Quien navega con teclado empieza arriba del todo y tiene que pasar por la
 * navegacion entera —seis paradas en la portada— antes de llegar a lo que vino
 * a leer. En cada pantalla. Este enlace lo salta de una.
 *
 * No se ve hasta que recibe el foco. No esta escondido: esta fuera de la
 * pantalla y vuelve en cuanto alguien tabula, que es distinto de `display:
 * none`, porque eso lo sacaria del orden de tabulacion y lo dejaria
 * inalcanzable justo para quien lo necesita.
 *
 * ---------------------------------------------------------------------------
 * Por que mueve el foco a mano
 * ---------------------------------------------------------------------------
 *
 * Un enlace a `#contenido` deberia bastar: el navegador enfoca el destino si
 * este puede recibir foco. En la practica no llego a ocurrir —la direccion ni
 * siquiera cambiaba— y el resultado era el peor posible: un enlace que dice
 * que salta y deja el foco donde estaba, de modo que la siguiente parada
 * volvia a ser el principio del menu.
 *
 * Moverlo aqui funciona igual en cualquier navegador y de paso no ensucia la
 * direccion con una almohadilla. El `href` se conserva porque es lo que hace
 * que esto sea un enlace: sale en la lista de enlaces de un lector de
 * pantalla y se puede abrir con Intro como cualquier otro.
 */

/** Id del `main` de cada pantalla. Aqui y en el destino, el mismo. */
export const ID_DEL_CONTENIDO = 'contenido';

export function SaltoAlContenido() {
  function saltar(evento: MouseEvent<HTMLAnchorElement>) {
    const destino = document.getElementById(ID_DEL_CONTENIDO);

    if (!destino) {
      // Sin destino, que el navegador haga lo que pueda. Es preferible a
      // tragarse la pulsacion y no hacer nada.
      return;
    }

    evento.preventDefault();

    // El destino lleva `tabIndex={-1}`, asi que puede recibir el foco sin
    // entrar en el orden de tabulacion. Al enfocarlo, lo siguiente que se
    // tabula es lo primero del contenido.
    destino.focus();
    destino.scrollIntoView();
  }

  return (
    <a className="salto" href={`#${ID_DEL_CONTENIDO}`} onClick={saltar}>
      Saltar al contenido
    </a>
  );
}
