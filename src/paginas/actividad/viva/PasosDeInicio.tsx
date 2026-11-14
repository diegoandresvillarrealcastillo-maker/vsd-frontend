import '../../../estilos/viva.css';

/**
 * Los pasos de un juego, antes de empezar (SCRUM-173): tres lineas numeradas que entran una tras
 * otra. Quien lo lee sabe de un vistazo que va a pasar, sin tener que leer un parrafo.
 */
export function PasosDeInicio({ pasos }: { pasos: readonly string[] }) {
  return (
    <ol className="viva-pasos">
      {pasos.map((paso, indice) => (
        <li key={paso} className="viva-pasos__paso">
          <span className="viva-pasos__numero" aria-hidden="true">
            {indice + 1}
          </span>
          <span>{paso}</span>
        </li>
      ))}
    </ol>
  );
}
