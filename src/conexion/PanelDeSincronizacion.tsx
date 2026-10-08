import { useEffect, useId, useRef, useState } from 'react';

import { cuantosDependenDe } from '../sincronizacion/acciones.ts';
import {
  descartar,
  reintentar,
  sincronizarAhora,
  useSincronizacion,
} from '../sincronizacion/estado.ts';
import { cambios, cuandoFue, type CambioGuardado } from '../sincronizacion/resumen.ts';

/**
 * El panel que abre el indicador (SCRUM-137): el estado de la sincronizacion, el
 * boton "Sincronizar ahora" y la lista de lo que sigue guardado en este equipo.
 *
 * ## Lo que se ve de cada cambio
 *
 * El tipo ("Anotación del diario"), cuando se hizo y que le pasa. **Nunca lo
 * escrito**: el panel puede quedar abierto en una pantalla que mira otra persona.
 *
 * ## Lo que se puede hacer
 *
 * - **Sincronizar ahora.** No espera los reintentos programados. Sin conexion no
 *   se puede, y el boton lo dice en vez de desaparecer o quedarse mudo.
 * - **Reintentar** lo que se rechazo: vuelve a la cola de una vez.
 * - **Descartar** lo que se rechazo o chocó con otro dispositivo. **Pregunta
 *   primero**: tirar un cambio es perderlo, y con el van los que dependian de el.
 */
export function PanelDeSincronizacion({
  id,
  alCerrar,
  enfocar = false,
}: {
  id: string;
  alCerrar: () => void;
  /**
   * Lleva el foco al titulo al abrirse. Se pide cuando lo abrio un aviso: el boton
   * "Ver la lista" desaparece al pulsarlo y el foco no puede quedarse en el aire.
   */
  enfocar?: boolean;
}) {
  const { conexion, sincronizando, cambios: lista, ultimaSincronizacion } = useSincronizacion();
  const idDelTitulo = useId();
  const idDeLaAyuda = useId();
  const titulo = useRef<HTMLHeadingElement>(null);
  const [confirmando, setConfirmando] = useState<{ id: string; dependientes: number } | null>(null);
  const [anuncio, setAnuncio] = useState('');
  const sinConexion = conexion === 'sin_conexion';
  const noSePuedeSincronizar = sinConexion || sincronizando;
  const ahora = new Date();

  useEffect(() => {
    if (enfocar) {
      titulo.current?.focus();
    }
  }, [enfocar]);

  async function alSincronizar() {
    // `aria-disabled` deja el boton enfocable, pero no hace nada.
    if (noSePuedeSincronizar) {
      return;
    }

    setAnuncio('');
    await sincronizarAhora();
  }

  async function pedirConfirmacion(cambio: CambioGuardado) {
    setConfirmando({
      id: cambio.operationId,
      dependientes: await cuantosDependenDe(cambio.operationId),
    });
  }

  async function alReintentar(cambio: CambioGuardado) {
    setAnuncio('');
    await reintentar(cambio.operationId);
    setAnuncio('El cambio volvió a la cola.');
    // Lo que se reintento ya no esta en esta lista (o sigue, ya sin botones): el foco
    // no puede quedarse en un boton que desaparecio.
    titulo.current?.focus();
  }

  async function alDescartar(cambio: CambioGuardado) {
    const quitados = await descartar(cambio.operationId);

    setConfirmando(null);
    setAnuncio(
      quitados === 1 ? 'Se descartó 1 cambio.' : `Se descartaron ${String(quitados)} cambios.`,
    );
    titulo.current?.focus();
  }

  return (
    <section id={id} className="conexion__panel" aria-labelledby={idDelTitulo}>
      <div className="conexion__panel-cabecera">
        <h2 id={idDelTitulo} ref={titulo} tabIndex={-1} className="conexion__titulo">
          Lo guardado en este equipo
        </h2>
        <button type="button" className="conexion__cerrar" onClick={alCerrar}>
          Cerrar
        </button>
      </div>

      <p className="conexion__estado">
        {sinConexion
          ? 'Sin conexión. Lo que hagas se guarda aquí y se envía solo cuando vuelva.'
          : 'Con conexión. Lo que hagas se envía solo.'}
        {ultimaSincronizacion !== null &&
          ` Última vez que se envió: ${cuandoFue(ultimaSincronizacion, ahora)}.`}
      </p>

      <button
        type="button"
        className="conexion__sincronizar"
        aria-disabled={noSePuedeSincronizar}
        aria-describedby={sinConexion ? idDeLaAyuda : undefined}
        onClick={() => {
          void alSincronizar();
        }}
      >
        {sincronizando ? 'Sincronizando…' : 'Sincronizar ahora'}
      </button>
      {sinConexion && (
        <p id={idDeLaAyuda} className="conexion__ayuda">
          Sin conexión no se puede. Se enviará solo cuando vuelva.
        </p>
      )}

      {lista.length === 0 ? (
        <p className="conexion__vacio">No hay cambios guardados en este equipo.</p>
      ) : (
        <ul className="conexion__lista" aria-label="Cambios guardados en este equipo">
          {lista.map((cambio) => (
            <li key={cambio.operationId} className="conexion__cambio">
              <p className="conexion__cambio-titulo">
                <strong>{cambio.descripcion}</strong>
                <span className="conexion__cambio-hora">{cuandoFue(cambio.creadaEn, ahora)}</span>
              </p>
              <p className="conexion__cambio-detalle">{cambio.detalle}</p>

              {confirmando?.id === cambio.operationId ? (
                <div className="conexion__confirmar">
                  <p>
                    ¿Descartar este cambio? No se podrá recuperar.
                    {confirmando.dependientes > 0 &&
                      ` También se descartará${confirmando.dependientes === 1 ? '' : 'n'} ${cambios(confirmando.dependientes)} que ${confirmando.dependientes === 1 ? 'depende' : 'dependen'} de este.`}
                  </p>
                  <div className="conexion__cambio-acciones">
                    <button
                      type="button"
                      className="conexion__accion conexion__accion--peligro"
                      onClick={() => {
                        void alDescartar(cambio);
                      }}
                    >
                      Sí, descartar
                    </button>
                    <button
                      type="button"
                      className="conexion__accion"
                      onClick={() => {
                        setConfirmando(null);
                      }}
                    >
                      No, conservarlo
                    </button>
                  </div>
                </div>
              ) : (
                (cambio.puedeReintentarse || cambio.puedeDescartarse) && (
                  <div className="conexion__cambio-acciones">
                    {cambio.puedeReintentarse && (
                      <button
                        type="button"
                        className="conexion__accion"
                        onClick={() => {
                          void alReintentar(cambio);
                        }}
                      >
                        Reintentar
                      </button>
                    )}
                    {cambio.puedeDescartarse && (
                      <button
                        type="button"
                        className="conexion__accion"
                        onClick={() => {
                          void pedirConfirmacion(cambio);
                        }}
                      >
                        Descartar
                      </button>
                    )}
                  </div>
                )
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Lo que paso despues de una accion, para quien no lo ve. */}
      <p className="conexion__anuncio" role="status">
        {anuncio}
      </p>
    </section>
  );
}
