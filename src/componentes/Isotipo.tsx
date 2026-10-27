import { IMAGEN_DEL_LOTO } from './imagenesDeLaMarca.ts';

interface Props {
  /** Alto en pixeles; el ancho sale de la proporcion del loto. */
  tamano?: number;
}

/**
 * El isotipo de VSD Health: el loto solo, sin letras (SCRUM-287). Va donde el logo completo no
 * cabe o no se leeria: la barra de la cuenta, el favicon y los iconos de la PWA, que son el mismo
 * loto. Antes era un cuadrado verde con un pulso blanco.
 *
 * La imagen no cambia segun el tema; en el claro `marca.css` solo la oscurece para que no se
 * pierda sobre el crema, igual que el logo completo. Es de tonos claros porque nacio para un
 * lienzo oscuro.
 *
 * Va oculta a los lectores de pantalla: siempre la acompana el nombre, y anunciar "imagen" antes
 * del enlace no dice nada.
 */
export function Isotipo({ tamano = 40 }: Props) {
  return (
    <img
      className="isotipo"
      src={IMAGEN_DEL_LOTO.src}
      width={Math.round((tamano * IMAGEN_DEL_LOTO.ancho) / IMAGEN_DEL_LOTO.alto)}
      height={tamano}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
