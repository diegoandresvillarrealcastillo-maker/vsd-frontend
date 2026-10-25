import { useId } from 'react';

import { LlamarAhora } from '../../componentes/LlamarAhora.tsx';
import type { LineaDeAtencion } from '../../infraestructura/api/resultados.ts';
import { lineasParaMostrar, textoDeCobertura } from './lineasParaMostrar.ts';

/**
 * Las lineas de atencion, cuando el resultado sugiere acompanamiento.
 *
 * Se ofrecen, no se imponen, y sin dramatizar: nada de rojo, de iconos de
 * alarma ni de "busca ayuda urgente". Quien llega aqui puede haber tenido solo
 * una semana pesada. El tono es el de alguien que deja un numero apuntado por
 * si hace falta.
 *
 * El enlace abre la pagina del servicio. Llamar es el boton «Llamar ahora»
 * (SCRUM-257), que sale solo si la linea trae un telefono verificado: algunas
 * lineas se marcan con una opcion despues ("192, opcion 4") que no se marca sola,
 * y esa opcion esta en la descripcion, justo encima.
 */
export function LineasDeAtencion({ lineas }: { lineas: readonly LineaDeAtencion[] | undefined }) {
  const idDelTitulo = useId();

  return (
    <section className="actividad__lineas" aria-labelledby={idDelTitulo}>
      <h2 id={idDelTitulo} className="actividad__lineas-titulo">
        Si te sirve hablarlo con alguien
      </h2>

      <p className="actividad__apoyo">
        Contarlo a alguien de confianza ayuda más que aguantarlo en silencio. Y si prefieres hablar
        con alguien de fuera, aquí tienes a quién llamar.
      </p>

      <ul className="actividad__lista-de-lineas">
        {lineasParaMostrar(lineas).map((linea) => {
          const cobertura = textoDeCobertura(linea.cobertura);

          return (
            <li key={linea.id} className="actividad__linea">
              <p className="actividad__linea-titulo">
                <strong>{linea.titulo}</strong>
                {cobertura !== undefined && (
                  <span className="actividad__linea-cobertura">{cobertura}</span>
                )}
              </p>

              {linea.descripcion !== undefined && (
                <p className="actividad__linea-descripcion">{linea.descripcion}</p>
              )}

              <LlamarAhora linea={linea} />

              {linea.enlace !== undefined && (
                // El nombre accesible empieza por lo que se ve, para que quien
                // lo dicta por voz lo encuentre, y dice de que linea es: con
                // tres enlaces iguales, "Más información" solo no basta.
                <a
                  className="actividad__linea-enlace"
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
    </section>
  );
}
