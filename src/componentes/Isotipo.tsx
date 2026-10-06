interface Props {
  /** Lado en pixeles. El isotipo es cuadrado. */
  tamano?: number;
}

/**
 * El isotipo de VSD Health: un cuadrado verde con el pulso en blanco (SCRUM-117).
 *
 * Es el mismo dibujo que `public/favicon.svg` y que el icono de la PWA, y por
 * eso es **el mismo en todas partes**: dentro de la aplicacion, en la pestana
 * y en la pantalla de inicio del telefono. Si cambia uno, cambian los tres.
 *
 * Los dos colores son valores fijos y no tokens del tema, a proposito. Un
 * logotipo no cambia de color segun el tema ni segun la pantalla: cuando lo
 * hacia, el de la barra del panel era un cuadrado con destellos que viraba
 * entre dos verdes, y el de las actividades era otra imagen distinta. Una
 * marca que cambia de cara deja de reconocerse como la misma.
 *
 * Va oculto a los lectores de pantalla: siempre lo acompana el nombre, y
 * anunciar "imagen" antes del enlace no dice nada.
 */
export function Isotipo({ tamano = 40 }: Props) {
  return (
    <svg
      className="isotipo"
      viewBox="0 0 32 32"
      width={tamano}
      height={tamano}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="8" fill="#3d7a6b" />
      <path
        d="M8 17.5c2.5 0 3-4 5-4s2.5 6 4.5 6 2.5-5 4-5 1.5 3 2.5 3"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
