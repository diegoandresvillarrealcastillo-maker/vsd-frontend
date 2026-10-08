import { useEffect, useId, useRef, useState } from 'react';

import { cuantosDependenDe } from '../sincronizacion/acciones.ts';
import {
  descartar,
  reintentar,
  sincronizarAhora,
  useSincronizacion,
} from '../sincronizacion/estado.ts';
import { leerLoEscritoDe } from '../sincronizacion/loGuardadoEnEsteEquipo.ts';
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
 *   Si es una **anotacion del diario**, ademas lo dice con todas las letras (se borra lo que
 *   la persona escribio) y ofrece **copiar el texto** antes (SCRUM-142). Se copia sin
 *   mostrarlo: el panel puede quedar abierto frente a otra persona.
 */
/** Si el cambio es una anotacion del diario: lo unico que la persona escribe con sus palabras. */
function esDelDiario(cambio: CambioGuardado): boolean {
  return cambio.tipo === 'diario.escribir' || cambio.tipo === 'diario.editar';
}

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
  const idDeLaPregunta = useId();
  const titulo = useRef<HTMLHeadingElement>(null);
  /** El boton de "no, conservarlo" de la confirmacion que este abierta (solo hay una). */
  const conservar = useRef<HTMLButtonElement>(null);
  const [confirmando, setConfirmando] = useState<{
    id: string;
    dependientes: number;
    /** Lo que se escribio, si es del diario y hay algo que copiar. */
    escrito: { texto: string; conDiagramas: boolean } | null;
  } | null>(null);
  const [anuncio, setAnuncio] = useState('');
  const sinConexion = conexion === 'sin_conexion';
  const noSePuedeSincronizar = sinConexion || sincronizando;
  const ahora = new Date();

  useEffect(() => {
    if (enfocar) {
      titulo.current?.focus();
    }
  }, [enfocar]);

  // Al pedir la confirmacion, el boton que se pulso desaparece: el foco no puede quedarse en el
  // aire. Va a lo seguro (conservar), como en la confirmacion de salir (SCRUM-142).
  useEffect(() => {
    if (confirmando !== null) {
      conservar.current?.focus();
    }
  }, [confirmando]);

  async function alSincronizar() {
    // `aria-disabled` deja el boton enfocable, pero no hace nada.
    if (noSePuedeSincronizar) {
      return;
    }

    setAnuncio('');
    await sincronizarAhora();
  }

  async function pedirConfirmacion(cambio: CambioGuardado) {
    setAnuncio('');
    setConfirmando({
      id: cambio.operationId,
      dependientes: await cuantosDependenDe(cambio.operationId),
      escrito: esDelDiario(cambio) ? await leerLoEscritoDe(cambio.operationId) : null,
    });
  }

  /** Copia lo que se escribio al portapapeles, sin ensenarlo. */
  async function alCopiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setAnuncio('Texto copiado. Ya puedes pegarlo donde quieras conservarlo.');
    } catch {
      setAnuncio('No se pudo copiar el texto. Si quieres conservarlo, no lo descartes todavía.');
    }
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
                <div className="conexion__confirmar" role="group" aria-labelledby={idDeLaPregunta}>
                  <p id={idDeLaPregunta}>
                    {esDelDiario(cambio)
                      ? '¿Descartar esta anotación? Se borra lo que escribiste en tu diario y no se podrá recuperar.'
                      : '¿Descartar este cambio? No se podrá recuperar.'}
                    {confirmando.dependientes > 0 &&
                      ` También se descartará${confirmando.dependientes === 1 ? '' : 'n'} ${cambios(confirmando.dependientes)} que ${confirmando.dependientes === 1 ? 'depende' : 'dependen'} de este.`}
                  </p>
                  {confirmando.escrito !== null && (
                    <p className="conexion__ayuda">
                      Si quieres conservarlo, copia el texto antes.
                      {confirmando.escrito.conDiagramas && ' Los diagramas no se copian.'}
                    </p>
                  )}
                  <div className="conexion__cambio-acciones">
                    {confirmando.escrito !== null && (
                      <button
                        type="button"
                        className="conexion__accion"
                        onClick={() => {
                          void alCopiar(confirmando.escrito?.texto ?? '');
                        }}
                      >
                        Copiar el texto
                      </button>
                    )}
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
                      ref={conservar}
                      type="button"
                      className="conexion__accion"
                      onClick={() => {
                        setConfirmando(null);
                        // El boton que se pulso desaparece con la confirmacion.
                        titulo.current?.focus();
                      }}
                    >
                      {esDelDiario(cambio) ? 'No, conservarla' : 'No, conservarlo'}
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
