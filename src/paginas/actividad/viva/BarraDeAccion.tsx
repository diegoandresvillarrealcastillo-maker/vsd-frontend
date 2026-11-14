import type { ReactNode, Ref } from 'react';

import '../../../estilos/viva.css';

/**
 * La franja de abajo con lo que se hace despues (SCRUM-173).
 *
 * Siempre esta en el mismo sitio y el boton principal siempre es el mismo gesto: asi, en
 * cualquier paso, la persona sabe donde tocar y no tiene que buscar. Queda pegada al borde de
 * abajo de la pantalla, a la altura del pulgar.
 */
export function BarraDeAccion({ children }: { children: ReactNode }) {
  return <div className="viva-accion">{children}</div>;
}

/** El boton grande de la franja. `tipo="submit"` envia el formulario que lo contiene. */
export function BotonPrincipal({
  children,
  tipo = 'button',
  alPulsar,
  deshabilitado = false,
  descritoPor,
  referencia,
  conFlecha = false,
}: {
  children: ReactNode;
  tipo?: 'button' | 'submit';
  alPulsar?: () => void;
  deshabilitado?: boolean;
  /** El `id` del texto que explica por que el boton esta apagado. */
  descritoPor?: string;
  /** Para llevarle el foco cuando el paso lo pide. */
  referencia?: Ref<HTMLButtonElement>;
  /** Una flecha que empuja hacia la derecha: invita a seguir. Es adorno. */
  conFlecha?: boolean;
}) {
  return (
    <button
      {...(referencia === undefined ? {} : { ref: referencia })}
      type={tipo}
      className="viva-boton"
      disabled={deshabilitado}
      {...(descritoPor === undefined ? {} : { 'aria-describedby': descritoPor })}
      {...(alPulsar === undefined ? {} : { onClick: alPulsar })}
    >
      {children}
      {conFlecha && (
        <svg
          className="viva-boton__flecha"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M5 12h14m-6-6 6 6-6 6"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

/** El boton de al lado, sin relleno: volver, o la salida amable. */
export function BotonSecundario({
  children,
  alPulsar,
  deshabilitado = false,
}: {
  children: ReactNode;
  alPulsar: () => void;
  deshabilitado?: boolean;
}) {
  return (
    <button
      type="button"
      className="viva-boton viva-boton--secundario"
      disabled={deshabilitado}
      onClick={alPulsar}
    >
      {children}
    </button>
  );
}
