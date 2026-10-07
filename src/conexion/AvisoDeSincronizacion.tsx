import { Link } from 'react-router-dom';

import '../estilos/conexion.css';
import { lineasParaMostrar, textoDeCobertura } from '../paginas/actividad/lineasParaMostrar.ts';
import { RUTAS } from '../rutas/rutas.ts';
import { descartarElAviso, pedirVerLaLista, useSincronizacion } from '../sincronizacion/estado.ts';

/**
 * El aviso de despues de sincronizar (SCRUM-137): "Volviste a tener conexión.
 * Enviamos 3 cambios que estaban guardados en este equipo."
 *
 * ## Como se anuncia
 *
 * La region `role="status"` esta **siempre** en el documento y solo su contenido
 * aparece: los lectores de pantalla anuncian los cambios de una region que ya
 * existia, no la que nace con el texto puesto. Y **no roba el foco**: llega, se
 * anuncia, y quien quiera lo alcanza con el tabulador. Cada aviso lleva un numero
 * distinto, asi que dos iguales seguidos se anuncian dos veces.
 *
 * ## Que dice
 *
 * Uno por tanda, nunca uno por cambio. Si algo no salio, lo dice y lleva a la
 * lista. Si la sesion vencio, lleva a entrar. Y si lo enviado sugiere acompanamiento
 * —un resultado hecho sin conexion, por ejemplo— ofrece las lineas de atencion.
 *
 * No hay animaciones: con movimiento reducido o sin el, se ve igual.
 */
export function AvisoDeSincronizacion() {
  const { aviso } = useSincronizacion();

  return (
    <div className="aviso-sincronizacion" role="status">
      {aviso !== null && (
        <div
          key={aviso.id}
          className={`aviso-sincronizacion__tarjeta aviso-sincronizacion__tarjeta--${aviso.tono}`}
        >
          <p className="aviso-sincronizacion__texto">{aviso.texto}</p>

          {aviso.sugiereAcompanamiento && (
            <section className="aviso-sincronizacion__lineas">
              <p className="aviso-sincronizacion__texto">
                Si te sirve hablarlo con alguien, aquí tienes a quién llamar.
              </p>
              <ul className="aviso-sincronizacion__lista-de-lineas">
                {lineasParaMostrar(aviso.lineasDeAtencion).map((linea) => {
                  const cobertura = textoDeCobertura(linea.cobertura);

                  return (
                    <li key={linea.id}>
                      <strong>{linea.titulo}</strong>
                      {cobertura !== undefined && (
                        <span className="aviso-sincronizacion__cobertura"> · {cobertura}</span>
                      )}
                      {linea.descripcion !== undefined && (
                        <span className="aviso-sincronizacion__descripcion">
                          {' '}
                          {linea.descripcion}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <div className="aviso-sincronizacion__acciones">
            {aviso.pedirEntrar && (
              <Link
                className="aviso-sincronizacion__boton aviso-sincronizacion__boton--principal"
                to={RUTAS.ACCESO}
                onClick={descartarElAviso}
              >
                Entrar
              </Link>
            )}
            {aviso.verLista && (
              <button
                type="button"
                className="aviso-sincronizacion__boton aviso-sincronizacion__boton--principal"
                onClick={() => {
                  pedirVerLaLista();
                  descartarElAviso();
                }}
              >
                Ver la lista
              </button>
            )}
            <button
              type="button"
              className="aviso-sincronizacion__boton"
              onClick={descartarElAviso}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
