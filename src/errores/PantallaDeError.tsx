import { useEffect, useId, useRef } from 'react';

import { lineasDeRespaldo, textoDeCobertura } from '../paginas/actividad/lineasParaMostrar.ts';
import '../estilos/aplicacion.css';
import '../estilos/pantalla-de-error.css';

/**
 * Lo que se ve cuando la aplicacion falla (SCRUM-156).
 *
 * Antes un error al pintar desmontaba todo: la persona veia una pantalla en
 * blanco, sin forma de volver y sin las lineas de atencion. Y quien abre esta
 * aplicacion puede estar pasando un mal momento justo cuando falla.
 *
 * ## Por eso aqui no depende de nada
 *
 * Esta pantalla se pinta cuando algo ya esta roto, asi que no usa nada de lo
 * que podria estar roto: ni el enrutador, ni la sesion, ni la API, ni un
 * contexto. Es texto, un boton y un enlace normal. Las lineas salen de
 * `lineasDeRespaldo`, que solo mira la zona del dispositivo: las de Colombia
 * (192, opcion 4, y 123) para quien esta en Colombia, y el directorio
 * internacional, sin ningun numero, para quien no. Un telefono de otro pais
 * ensenado como propio es peor que ninguno.
 *
 * ## Tono
 *
 * Sin alarma, sin rojo y sin culpar: no es culpa de quien lo ve. Y sin prometer
 * lo que no sabemos: lo que ya se guardo sigue guardado; lo que se estaba
 * escribiendo, quiza no.
 *
 * @param intentos Cuantas veces se ha vuelto a intentar. Si el error vuelve, el
 *   texto cambia: repetir el mismo boton no es una respuesta.
 */
export function PantallaDeError({
  alReintentar,
  intentos,
}: {
  alReintentar: () => void;
  intentos: number;
}) {
  const idDelTitulo = useId();
  const idDeLasLineas = useId();
  const titulo = useRef<HTMLHeadingElement>(null);
  const lineas = lineasDeRespaldo();
  const sigue = intentos > 0;

  // Quien navega con teclado o con un lector de pantalla llega directo al
  // mensaje, no a donde estuviera el foco en la pantalla que se rompio.
  useEffect(() => {
    titulo.current?.focus();
  }, []);

  return (
    <main className="app error-pantalla" aria-labelledby={idDelTitulo}>
      <div className="error-pantalla__tarjeta">
        <h1 id={idDelTitulo} ref={titulo} tabIndex={-1} className="error-pantalla__titulo">
          {sigue ? 'Sigue sin funcionar' : 'Algo no salió como esperábamos'}
        </h1>

        <p className="error-pantalla__texto">
          {sigue
            ? 'Volvimos a intentarlo y falló otra vez. Puedes volver al inicio, o intentarlo más tarde.'
            : 'Hubo un fallo en la aplicación y no pudimos mostrar esta pantalla. No es culpa tuya.'}{' '}
          Lo que ya habías guardado no se pierde por esto.
        </p>

        <div className="error-pantalla__acciones">
          {!sigue && (
            <button type="button" className="app__boton" onClick={alReintentar}>
              Intentarlo de nuevo
            </button>
          )}
          {/* Un enlace de verdad, que recarga: si el estado de la aplicacion
              quedo mal, empezar de cero es lo que lo arregla. */}
          <a className={sigue ? 'app__boton' : 'error-pantalla__enlace'} href="/">
            Volver al inicio
          </a>
        </div>

        <section className="error-pantalla__lineas" aria-labelledby={idDeLasLineas}>
          <h2 id={idDeLasLineas} className="error-pantalla__subtitulo">
            Si ahora mismo te sirve hablar con alguien
          </h2>
          <p className="error-pantalla__texto">
            Estas líneas funcionan aunque la aplicación no lo haga.
          </p>

          <ul className="error-pantalla__lista">
            {lineas.map((linea) => {
              const cobertura = textoDeCobertura(linea.cobertura);

              return (
                <li key={linea.id} className="error-pantalla__linea">
                  <p className="error-pantalla__linea-titulo">
                    <strong>{linea.titulo}</strong>
                    {cobertura !== undefined && (
                      <span className="error-pantalla__cobertura">{cobertura}</span>
                    )}
                  </p>
                  {linea.descripcion !== undefined && (
                    <p className="error-pantalla__texto">{linea.descripcion}</p>
                  )}
                  {linea.enlace !== undefined && (
                    <a
                      className="error-pantalla__enlace"
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
      </div>
    </main>
  );
}
