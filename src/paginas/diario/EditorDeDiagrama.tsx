import { Excalidraw, serializeAsJSON } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useEffect, useRef, useState } from 'react';

/**
 * El editor de diagramas, a pantalla completa (SCRUM-96).
 *
 * **Este modulo es el que pesa**: Excalidraw y su hoja de estilos. Solo se
 * importa con `lazy`, desde `Diario.tsx`, y por eso no se descarga hasta que
 * alguien inserta o abre un diagrama. Nadie mas debe importarlo directamente,
 * o el peso vuelve a la carga inicial de la aplicacion.
 *
 * Excalidraw es MIT. Se descartaron tldraw, que exige licencia comercial o
 * marca de agua, y diagrams.net incrustado, que haria pasar el diario por un
 * dominio ajeno.
 */
export default function EditorDeDiagrama({
  inicial,
  soloLectura,
  alTerminar,
}: {
  inicial: Readonly<Record<string, unknown>> | undefined;
  soloLectura: boolean;
  /** Con la escena en JSON al pulsar "Listo", o `null` al cancelar o cerrar. */
  alTerminar: (datos: Record<string, unknown> | null) => void;
}) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const primerBoton = useRef<HTMLButtonElement>(null);
  // El lienzo sigue el tema de la aplicacion (SCRUM-112).
  const oscuro = document.documentElement.dataset.tema === 'oscuro';

  useEffect(() => {
    primerBoton.current?.focus();

    function alPulsarTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        alTerminar(null);
      }
    }

    document.addEventListener('keydown', alPulsarTecla);

    return () => {
      document.removeEventListener('keydown', alPulsarTecla);
    };
  }, [alTerminar]);

  function listo() {
    if (api === null) {
      return;
    }

    // `serializeAsJSON` deja solo lo que se puede guardar: sin funciones, sin
    // el estado de la interfaz que no hace falta para volver a abrirlo.
    const json = serializeAsJSON(
      api.getSceneElements(),
      api.getAppState(),
      api.getFiles(),
      'local',
    );

    alTerminar(JSON.parse(json) as Record<string, unknown>);
  }

  return (
    <div className="diagrama" role="dialog" aria-modal="true" aria-label="Editor de diagramas">
      <div className="diagrama__barra">
        <span className="diagrama__titulo">{soloLectura ? 'Diagrama' : 'Dibuja tu diagrama'}</span>

        <div className="diagrama__acciones">
          {soloLectura ? (
            <button
              ref={primerBoton}
              type="button"
              className="pildora pildora--fuerte"
              onClick={() => alTerminar(null)}
            >
              Cerrar
            </button>
          ) : (
            <>
              <button
                ref={primerBoton}
                type="button"
                className="pildora pildora--fantasma"
                onClick={() => alTerminar(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="pildora pildora--fuerte"
                disabled={api === null}
                onClick={listo}
              >
                Listo
              </button>
            </>
          )}
        </div>
      </div>

      <div className="diagrama__lienzo">
        <Excalidraw
          excalidrawAPI={setApi}
          {...(inicial === undefined ? {} : { initialData: inicial })}
          viewModeEnabled={soloLectura}
          theme={oscuro ? 'dark' : 'light'}
          langCode="es-ES"
        />
      </div>
    </div>
  );
}
