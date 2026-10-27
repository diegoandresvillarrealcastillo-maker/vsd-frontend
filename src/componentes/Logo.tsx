import { Link } from 'react-router-dom';

import { RUTAS } from '../rutas/rutas.ts';

/**
 * La marca, en todas las pantallas.
 *
 * Aparece en la portada, en las cuatro pantallas de acceso y dentro de la
 * cuenta. No es decoracion repetida: es lo que dice en que aplicacion estas,
 * y desaparece justo cuando mas falta hace —al registrarte o al recuperar la
 * contrasena— si no se pone en todas.
 *
 * La imagen tiene fondo transparente, asi que no lleva recuadro ni mezcla de
 * capas: se apoya directamente sobre la superficie que tenga detras.
 *
 * El texto alternativo es el nombre y no "logo de VSD Health": quien no ve la
 * pantalla necesita saber a donde lleva el enlace, no que tipo de imagen es.
 */
export function Logo({ to = RUTAS.INICIO, className }: { to?: string; className?: string }) {
  return (
    <Link className={className === undefined ? 'logo' : `logo ${className}`} to={to}>
      {/* 264 x 135, que es el triple de lo que se dibuja (40 a 44 px de alto): cubre una pantalla
          de 3 puntos por pixel. Antes era un PNG de 480 x 246 y 150 KB, mas que todo el JavaScript
          de la portada junto (SCRUM-283). Con ancho y alto, la pagina no se mueve al llegar. */}
      <img
        className="logo__imagen"
        src="/logo-vsd-health.webp"
        width={264}
        height={135}
        alt="VSD Health"
      />
    </Link>
  );
}
