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
      <img className="logo__imagen" src="/logo-vsd-health.png" alt="VSD Health" />
    </Link>
  );
}
