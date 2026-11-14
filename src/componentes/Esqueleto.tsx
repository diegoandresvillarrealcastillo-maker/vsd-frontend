import '../estilos/estados.css';

interface Props {
  /** `linea` es una linea de texto, `bloque` una tarjeta y `circulo` un avatar. */
  forma?: 'linea' | 'bloque' | 'circulo';
  /** Cualquier medida de CSS. Por defecto, la de la forma. */
  ancho?: string;
  alto?: string;
}

/**
 * La forma gris que ocupa el sitio de algo que todavia no llego (SCRUM-180).
 *
 * Existe para que la pantalla no salte cuando llegan los datos y para que la espera se
 * vea como "ya viene", no como "se rompio". Es **decorativa**: no la anuncia un lector de
 * pantalla; quien avisa de la carga es `EstadoDeCarga`, con un mensaje.
 *
 * El brillo que la recorre se apaga con `prefers-reduced-motion`: queda la forma quieta.
 */
export function Esqueleto({ forma = 'linea', ancho, alto }: Props) {
  const estilo =
    ancho === undefined && alto === undefined
      ? undefined
      : {
          ...(ancho === undefined ? {} : { width: ancho }),
          ...(alto === undefined ? {} : { height: alto }),
        };

  return <span className={`esqueleto esqueleto--${forma}`} style={estilo} aria-hidden="true" />;
}
