import '../estilos/llamar-ahora.css';
import type { LineaDeAtencion } from '../infraestructura/api/resultados.ts';
import { telefonoParaMarcar } from './telefonoParaMarcar.ts';

/**
 * «Llamar ahora» (SCRUM-257): abre el marcador con el numero verificado de la
 * linea. Aparece **solo** si la linea trae un telefono: el directorio internacional
 * no lo trae, y tampoco un servidor anterior; sin numero no hay boton.
 *
 * Es solo para lineas de atencion. Los telefonos del equipo de VSD Health son para
 * problemas tecnicos y nunca pasan por aqui (`ContactoDelEquipo`).
 *
 * Una opcion que se elige al contestar (el 192, opcion 4) no se marca sola: esta
 * en la descripcion de la linea, que se muestra justo encima.
 *
 * `etiqueta` es para cuando el boton no va debajo de la linea que llama y el texto
 * tiene que decir cual es («Llamar al 192»).
 */
export function LlamarAhora({
  linea,
  etiqueta,
}: {
  linea: Pick<LineaDeAtencion, 'telefono' | 'titulo'>;
  etiqueta?: string;
}) {
  const telefono = telefonoParaMarcar(linea.telefono);

  if (telefono === undefined) {
    return null;
  }

  return (
    <a
      className="llamar-ahora"
      href={`tel:${telefono}`}
      // El nombre accesible empieza por lo que se ve, y dice de cual linea es: con varias lineas,
      // «Llamar ahora» solo no basta.
      aria-label={etiqueta === undefined ? `Llamar ahora: ${linea.titulo}` : undefined}
    >
      {etiqueta ?? 'Llamar ahora'}
    </a>
  );
}
