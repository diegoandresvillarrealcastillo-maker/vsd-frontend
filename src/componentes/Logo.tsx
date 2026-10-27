import { Link } from 'react-router-dom';

import { RUTAS } from '../rutas/rutas.ts';
import { IMAGEN_COMPLETA, IMAGEN_DEL_LOTO } from './imagenesDeLaMarca.ts';

/** Las dos caras de la marca (SCRUM-287). El tamano de cada una lo da el CSS de donde se use. */
const IMAGENES = {
  completo: IMAGEN_COMPLETA,
  loto: IMAGEN_DEL_LOTO,
} as const;

/**
 * La marca, en todas las pantallas.
 *
 * Aparece en la portada, en las cuatro pantallas de acceso y dentro de la
 * cuenta. No es decoracion repetida: es lo que dice en que aplicacion estas,
 * y desaparece justo cuando mas falta hace —al registrarte o al recuperar la
 * contrasena— si no se pone en todas.
 *
 * `completo` (el loto y "VSD Health") es para los sitios amplios: por debajo de unos 90 px de
 * alto las letras dejan de leerse. `loto` es para las barras y los sitios chicos.
 *
 * `conNombre` escribe "VSD Health" al lado del loto, para las barras donde el loto solo no
 * dice de que aplicacion es. Entonces el texto es el nombre del enlace y la imagen se calla.
 *
 * La imagen tiene fondo transparente, asi que no lleva recuadro ni mezcla de
 * capas: se apoya directamente sobre la superficie que tenga detras.
 *
 * El texto alternativo es el nombre y no "logo de VSD Health": quien no ve la
 * pantalla necesita saber a donde lleva el enlace, no que tipo de imagen es.
 */
export function Logo({
  to = RUTAS.INICIO,
  className,
  variante = 'completo',
  conNombre = false,
}: {
  to?: string;
  className?: string;
  variante?: keyof typeof IMAGENES;
  conNombre?: boolean;
}) {
  const imagen = IMAGENES[variante];

  return (
    <Link className={className === undefined ? 'logo' : `logo ${className}`} to={to}>
      {/* Con ancho y alto, la pagina no se mueve al llegar. Las medidas son las del archivo, que
          es el triple de lo que se dibuja: cubre una pantalla de 3 puntos por pixel sin pesar
          mas que el codigo de la portada (SCRUM-283). */}
      <img
        className={`logo__imagen logo__imagen--${variante}`}
        src={imagen.src}
        width={imagen.ancho}
        height={imagen.alto}
        alt={conNombre ? '' : 'VSD Health'}
      />
      {conNombre && <span className="logo__nombre">VSD Health</span>}
    </Link>
  );
}
