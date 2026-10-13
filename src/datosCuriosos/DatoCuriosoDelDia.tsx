import '../estilos/datoCurioso.css';
import { useDatoCurioso } from './useDatoCurioso.ts';

/**
 * El mini-panel del dato curioso (SCRUM-185): una frase corta de cultura general, distinta
 * cada dia, que reemplaza al viejo «Empieza por la que mas te llame…».
 *
 * Si todavia no se sabe —o no hay ningun dato publicado— **no pinta nada**: ni un hueco ni un
 * dato inventado. Es una invitacion y no un deber: no lleva boton, ni contador, ni nada que
 * se pueda «perder».
 *
 * Es una region con nombre y no un aviso: no interrumpe a nadie y un lector de pantalla puede
 * saltar a ella o pasarla por alto.
 */
export function DatoCuriosoDelDia() {
  const dato = useDatoCurioso();

  if (dato === null) {
    return null;
  }

  return (
    <section className="dato-curioso" aria-label="Dato curioso del día">
      <p className="dato-curioso__ceja">¿Sabías que…?</p>
      <p className="dato-curioso__texto">{dato.texto}</p>
    </section>
  );
}
