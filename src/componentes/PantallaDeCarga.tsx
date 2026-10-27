import type { CSSProperties } from 'react';

import { DATOS_DE_LA_CARGA, ETIQUETAS_DE_LA_CARGA } from './datosDeLaCarga.ts';

interface Props {
  /** Que esta cargando, con la voz de la aplicacion: «Comprobando la sesión». */
  mensaje: string;
  /**
   * Dentro de una pantalla que ya tiene su barra y su marco (el panel), en lugar de ocupar toda la
   * ventana.
   */
  enLinea?: boolean;
  /**
   * No se ve hasta pasado casi un segundo (SCRUM-248). Para esperas que casi siempre duran un
   * instante y que llegan **despues** de que la persona ya vio algo: mostrarla de golpe parpadea.
   * No es para la apertura: ahi ya hay una pantalla de carga puesta por el `index.html`.
   */
  tardio?: boolean;
}

/**
 * La pantalla de carga con la mascota corriendo sobre una barra (SCRUM-283).
 *
 * Es la misma que el `index.html` pinta antes de que baje el JavaScript, con las mismas clases y los
 * mismos estilos (estan en el propio `index.html`, porque tienen que estar antes que cualquier
 * hoja). Asi, desde que se abre la aplicacion hasta que hay algo que mostrar, la espera se ve igual y
 * nunca queda una pantalla en blanco.
 *
 * Que mascota corre no se decide aqui: la pone el documento (`data-mascota`, ver
 * `mascota/mascotaDeLaCarga.ts`), que es lo unico que se sabe a tiempo.
 *
 * El mensaje **se ve y se anuncia** (`role="status"`), como en `EstadoDeCarga`: la mascota sola no le
 * dice nada a quien usa lector de pantalla. El dibujo y los datos se esconden del lector: son un
 * adorno de la espera, y leerlos uno a uno cada pocos segundos seria ruido. Con «menos movimiento» la
 * mascota se queda quieta a media pista y se ve un solo dato, sin cambiar.
 */
export function PantallaDeCarga({ mensaje, enLinea = false, tardio = false }: Props) {
  const clases = [
    'vsd-carga',
    enLinea ? 'vsd-carga--en-linea' : '',
    tardio ? 'vsd-carga--tardio' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={clases} role="status" aria-busy="true">
      <div className="vsd-carga__pista" aria-hidden="true">
        <span className="vsd-carga__corredor">
          <span className="vsd-carga__img" />
        </span>

        <span className="vsd-carga__barra">
          <span className="vsd-carga__relleno" />
        </span>
      </div>

      <p className="vsd-carga__texto">{mensaje}</p>

      <ul className="vsd-carga__datos" aria-hidden="true">
        {DATOS_DE_LA_CARGA.map((dato, indice) => (
          <li
            className="vsd-carga__dato"
            style={{ '--i': indice } as CSSProperties}
            key={dato.texto}
          >
            <span className="vsd-carga__etiqueta">{ETIQUETAS_DE_LA_CARGA[dato.tipo]}</span>
            <span className="vsd-carga__frase">{dato.texto}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
