import type { ReactNode } from 'react';

import '../estilos/estados.css';

interface Props {
  titulo: string;
  /** Lo que pasara cuando haya algo, o que hacer para que lo haya. */
  texto?: string;
  /** Un icono decorativo. */
  icono?: ReactNode;
  /** Una accion, por ejemplo un enlace o un boton. */
  children?: ReactNode;
}

/**
 * Lo que se ve cuando no hay nada que mostrar todavia (SCRUM-180).
 *
 * Un vacio no es un error ni una falta: es el principio. Por eso no usa `role="alert"` ni
 * `role="status"` (no interrumpe a nadie) y su tono es de invitacion, no de reclamo: dice
 * que pasara cuando haya algo, no que falta algo por hacer.
 */
export function EstadoVacio({ titulo, texto, icono, children }: Props) {
  return (
    <div className="estado-vacio">
      {icono !== undefined && (
        <span className="estado-vacio__icono" aria-hidden="true">
          {icono}
        </span>
      )}

      <p className="estado-vacio__titulo">{titulo}</p>

      {texto !== undefined && <p className="estado-vacio__texto">{texto}</p>}

      {children}
    </div>
  );
}
