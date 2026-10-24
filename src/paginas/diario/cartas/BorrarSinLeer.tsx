import { useEffect, useId, useRef, useState } from 'react';

import '../../../estilos/cartas.css';

/**
 * «Borrar sin leerla» (SCRUM-230): el boton de una carta a mi de manana, con su confirmacion.
 *
 * Borrar no se puede deshacer, y es lo unico que se hace con la carta sin saber lo que dice, asi que pide
 * una segunda pulsacion en el mismo lugar: «Si, borrarla» o «Mejor no». Sin conexion tambien se puede:
 * el borrado queda guardado en este equipo y sale cuando vuelve la red.
 *
 * Tiene el mismo peso que «Leerla»: la misma pildora, el mismo tamano, ningun color de alarma. Lo que dice
 * el texto, y no el color, es lo que avisa de que no tiene vuelta.
 */
export function BorrarSinLeer({
  alBorrar,
  deshabilitado = false,
}: {
  /** Quien lo usa borra de verdad (encola el borrado). Si lanza, quien lo usa avisa. */
  alBorrar: () => void;
  deshabilitado?: boolean;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);
  const siBorrar = useRef<HTMLButtonElement>(null);
  const idDeLaConfirmacion = useId();

  // Quien abre la confirmacion llega directo a la decision: es lo primero que se alcanza.
  useEffect(() => {
    if (confirmando) {
      siBorrar.current?.focus();
    }
  }, [confirmando]);

  function mejorNo() {
    setConfirmando(false);
    // El foco vuelve a donde estaba: quien teclea no se pierde.
    boton.current?.focus();
  }

  return (
    <>
      <button
        ref={boton}
        type="button"
        className="pildora pildora--fantasma"
        aria-expanded={confirmando}
        aria-controls={idDeLaConfirmacion}
        disabled={deshabilitado}
        onClick={() => setConfirmando(true)}
      >
        Borrar sin leerla
      </button>

      {confirmando && (
        <div
          id={idDeLaConfirmacion}
          role="group"
          aria-label="Confirmar el borrado"
          className="carta__confirmar"
        >
          <p className="carta__confirmar-texto">¿Borrarla sin leerla? No se puede deshacer.</p>
          <div className="carta__acciones">
            <button
              ref={siBorrar}
              type="button"
              className="pildora pildora--fantasma"
              onClick={alBorrar}
            >
              Sí, borrarla
            </button>
            <button type="button" className="pildora pildora--fantasma" onClick={mejorNo}>
              Mejor no
            </button>
          </div>
        </div>
      )}
    </>
  );
}
