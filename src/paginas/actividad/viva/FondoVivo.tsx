import '../../../estilos/viva.css';

/**
 * El fondo de la pantalla de una actividad (SCRUM-173): tres manchas de luz del color del
 * modulo que se desplazan muy despacio. Da vida sin pedir atencion.
 *
 * Es solo adorno: no recibe toques ni lo lee un lector de pantalla, y con
 * `prefers-reduced-motion` las manchas se quedan quietas.
 */
export function FondoVivo() {
  return (
    <div className="viva-fondo" aria-hidden="true">
      <span className="viva-fondo__mancha" />
      <span className="viva-fondo__mancha" />
      <span className="viva-fondo__mancha" />
    </div>
  );
}
