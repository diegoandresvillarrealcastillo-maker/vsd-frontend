import '../estilos/estados.css';
import { Esqueleto } from './Esqueleto.tsx';

interface Props {
  /** Que esta cargando, con la voz de la aplicacion: «Cargando tu espacio…». */
  mensaje: string;
  /** Cuantas tarjetas de esqueleto se dibujan. Tres llenan una pantalla de telefono. */
  tarjetas?: number;
}

/**
 * Lo que se ve mientras llega algo (SCRUM-180): unas tarjetas de esqueleto y, debajo, una
 * linea que dice que carga.
 *
 * El mensaje **se ve y se anuncia** (`role="status"`): una forma gris sola no le dice nada a
 * quien usa lector de pantalla, ni a quien pidio menos movimiento y no ve el brillo. Las
 * formas se esconden del lector (`aria-hidden`): leerlas una a una seria ruido.
 *
 * `aria-busy` marca la zona como en curso; cuando llegan los datos este componente se
 * desmonta y el contenido real ocupa su sitio.
 */
export function EstadoDeCarga({ mensaje, tarjetas = 3 }: Props) {
  return (
    <div className="estado-de-carga" role="status" aria-busy="true">
      <div className="estado-de-carga__marcas" aria-hidden="true">
        {Array.from({ length: tarjetas }, (_, indice) => (
          <div className="estado-de-carga__tarjeta" key={indice}>
            <Esqueleto ancho="40%" />
            <Esqueleto />
            <Esqueleto ancho="75%" />
          </div>
        ))}
      </div>

      <p className="estado-de-carga__texto">{mensaje}</p>
    </div>
  );
}
