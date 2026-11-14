import '../estilos/conexion.css';
import { haceCuanto } from '../tiempo/haceCuanto.ts';

/**
 * Lo que dice una pantalla que esta ensenando la copia de este equipo en lugar de lo del
 * servidor (SCRUM-140): de cuando son los datos, que se ponen al dia solos cuando haya
 * conexion y, si la persona hizo algo sin conexion, que eso se contara cuando se envie.
 *
 * Nunca se calla ni se disfraza: lo que se ve puede no ser lo de ahora, y se dice.
 */
export function DatosDeHace({
  guardadoEn,
  ahora,
  porEnviar = 0,
}: {
  /** Cuando se guardo la copia, en ISO 8601. */
  guardadoEn: string;
  ahora: Date;
  /** Cuantas cosas hechas sin conexion siguen sin enviarse. */
  porEnviar?: number;
}) {
  return (
    <p className="datos-de-hace" role="status">
      Datos de {haceCuanto(guardadoEn, ahora)}. Se ponen al día solo cuando haya conexión.
      {porEnviar > 0 && ' Lo que hiciste sin conexión se contará cuando se envíe.'}
    </p>
  );
}
