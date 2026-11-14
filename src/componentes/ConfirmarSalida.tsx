import { useId, useRef } from 'react';

import '../estilos/conexion.css';
import { useEnLinea } from '../conexion/useEnLinea.ts';
import { alPulsarElFondo } from './alPulsarElFondo.ts';
import { useDialogo } from './useDialogo.ts';

/**
 * Lo que se pregunta antes de cerrar sesion si hay cambios sin enviar (SCRUM-142).
 *
 * Cerrar sesion **olvida todo lo guardado en este equipo**, y eso incluye lo que todavia no
 * llego al servidor: es lo que evita dejar los datos de una persona a la vista de la
 * siguiente. Por eso, si hay algo sin enviar, no se sale sin avisar.
 *
 * Se ofrece, por orden: **esperar** (que es lo que recibe el foco: la opcion que no pierde
 * nada), **enviarlos ahora** (si hay conexion) y **salir de todos modos**. Escape es esperar.
 *
 * No dice que cambios son: el dialogo puede quedar a la vista de otra persona.
 */
export function ConfirmarSalida({
  cambios,
  enviando,
  alEsperar,
  alEnviar,
  alSalir,
}: {
  /** Cuantos cambios siguen sin enviarse. */
  cambios: number;
  /** Se estan enviando ahora, a peticion de la persona. */
  enviando: boolean;
  alEsperar: () => void;
  alEnviar: () => void;
  alSalir: () => void;
}) {
  const enLinea = useEnLinea();
  const idDelTitulo = useId();
  const idDelTexto = useId();
  const esperar = useRef<HTMLButtonElement>(null);
  const caja = useDialogo<HTMLDivElement>(alEsperar, esperar);

  return (
    <div className="confirmar-salida" role="presentation" onClick={alPulsarElFondo(alEsperar)}>
      <div
        ref={caja}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={idDelTitulo}
        aria-describedby={idDelTexto}
        className="confirmar-salida__caja"
      >
        <h2 id={idDelTitulo} className="confirmar-salida__titulo">
          ¿Salir ahora?
        </h2>

        <p id={idDelTexto} className="confirmar-salida__texto">
          {cambios === 1
            ? 'Tienes 1 cambio guardado en este equipo que no se ha enviado. Si sales ahora, se perderá.'
            : `Tienes ${String(cambios)} cambios guardados en este equipo que no se han enviado. Si sales ahora, se perderán.`}
        </p>

        {!enLinea && (
          <p className="confirmar-salida__ayuda" role="status">
            Sin conexión no se pueden enviar. Si te quedas, se envían solos cuando vuelva.
          </p>
        )}

        <div className="confirmar-salida__acciones">
          <button
            ref={esperar}
            type="button"
            className="confirmar-salida__boton confirmar-salida__boton--principal"
            onClick={alEsperar}
          >
            Esperar
          </button>

          {enLinea && (
            <button
              type="button"
              className="confirmar-salida__boton"
              aria-disabled={enviando}
              onClick={() => {
                // `aria-disabled` y no `disabled`: el foco no se va mientras se envia.
                if (!enviando) {
                  alEnviar();
                }
              }}
            >
              {enviando ? 'Enviando…' : 'Enviarlos ahora'}
            </button>
          )}

          <button
            type="button"
            className="confirmar-salida__boton confirmar-salida__boton--peligro"
            onClick={alSalir}
          >
            Salir y perderlos
          </button>
        </div>
      </div>
    </div>
  );
}
