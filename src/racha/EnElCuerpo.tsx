import { forwardRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import '../estilos/racha-portal.css';

/**
 * Pinta lo que lleva dentro en el cuerpo de la pagina, con la paleta de la aplicacion (SCRUM-243).
 *
 * Es para las capas `position: fixed` de la racha: el panel de la llama y la celebracion. Pintadas donde
 * nacen, un ancestro con `backdrop-filter` (la barra de arriba) o con su propio contexto de apilamiento
 * (el contenido de una actividad) las desplaza o las deja por debajo de otras. Ver `racha-portal.css`.
 *
 * `paleta` dice de cual de los dos mundos son los tokens: `app` (el panel, la barra) o `actividad`.
 * El envoltorio no genera caja; `ref` apunta a el para saber si un toque cayo dentro.
 */
export const EnElCuerpo = forwardRef<
  HTMLDivElement,
  { paleta: 'app' | 'actividad'; children: ReactNode }
>(function EnElCuerpo({ paleta, children }, ref) {
  return createPortal(
    <div ref={ref} className={`${paleta} racha-portal`}>
      {children}
    </div>,
    document.body,
  );
});
