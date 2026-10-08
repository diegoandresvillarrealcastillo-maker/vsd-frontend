import { LienzoDeAcceso, Aparece } from './LienzoDeAcceso.tsx';
import { textoDeCobertura } from '../actividad/lineasParaMostrar.ts';
import { lineasParaMenores } from './lineasParaMenores.ts';

/**
 * Lo que ve quien resulta menor de 18 anos (L-02 de la auditoria 360).
 *
 * Se llega aqui de dos maneras, y la pantalla es la misma: el formulario calculo
 * la edad en el dispositivo y no mando nada, o la API la rechazo con
 * `MENOR_DE_EDAD` y borro la identidad. En los dos casos no se guardo nada.
 *
 * ## El tono
 *
 * Quien lo lee puede ser una persona de quince anos que busco ayuda y se encuentra
 * una puerta cerrada. Se le dice que no es por ella, por que es y que no se guardo
 * nada, y se le deja a quien acudir. Nada de rojo ni de alarma.
 *
 * ## Lo que no tiene, a proposito
 *
 * Ni «intentar de nuevo» ni una pista de que fecha funcionaria. Un filtro que
 * explica como saltarselo no filtra. Lo unico que hay para seguir es volver a la
 * portada.
 */
export function SoloMayores() {
  return (
    <LienzoDeAcceso
      titulo="Por ahora VSD Health es para mayores de 18 años"
      entradilla="No es por ti: la ley pide cuidados especiales con los datos de salud de menores de edad, y todavía no los tenemos. No guardamos nada de lo que escribiste."
    >
      <Aparece>
        <section className="solo-mayores" aria-labelledby="solo-mayores-titulo">
          <h2 id="solo-mayores-titulo" className="solo-mayores__titulo">
            Si quieres hablar con alguien
          </h2>

          <p className="solo-mayores__texto">
            Contárselo a un adulto de confianza ayuda más que guardarlo en silencio. Y si prefieres
            hablar con alguien de fuera, aquí tienes a quién acudir.
          </p>

          <ul className="solo-mayores__lineas">
            {lineasParaMenores().map((linea) => {
              const cobertura = textoDeCobertura(linea.cobertura);

              return (
                <li key={linea.id} className="solo-mayores__linea">
                  <p className="solo-mayores__linea-titulo">
                    <strong>{linea.titulo}</strong>
                    {cobertura !== undefined && (
                      <span className="solo-mayores__cobertura">{cobertura}</span>
                    )}
                  </p>

                  {linea.descripcion !== undefined && (
                    <p className="solo-mayores__descripcion">{linea.descripcion}</p>
                  )}

                  {linea.enlace !== undefined && (
                    <a
                      className="acceso__enlace"
                      href={linea.enlace}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Más información sobre ${linea.titulo} (se abre en otra pestaña)`}
                    >
                      Más información
                    </a>
                  )}
                </li>
              );
            })}
          </ul>

          <p className="solo-mayores__nota">Cuando cumplas 18 años te daremos la bienvenida.</p>
        </section>
      </Aparece>
    </LienzoDeAcceso>
  );
}
