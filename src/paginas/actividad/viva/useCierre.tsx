import { useRef, useState, type ReactNode } from 'react';

import type { Metadata } from '../../../infraestructura/api/resultados.ts';
import type { LoQueProduceLaActividad } from '../useCompletarActividad.ts';
import { BarraDeAccion, BotonPrincipal } from './BarraDeAccion.tsx';
import { useMascotaDeLaPersona } from './mascotaDeLaPersona.ts';
import { VozDeLaMascota } from './VozDeLaMascota.tsx';

/**
 * El cierre de una actividad de la que se sale con una frase (SCRUM-227): lo que la sesion dice al terminar
 * (`cierre`), con la mascota, antes de entregar el resultado.
 *
 * Una pantalla llama a `terminar(metadata)` cuando la persona acaba. Sin `cierre`, entrega al momento y la
 * actividad se comporta como siempre; con `cierre`, `pantalla` trae el cierre, y el resultado se entrega al
 * pulsar «Terminar». Nada se entrega dos veces. Lo entregado nunca lleva `score`: son actividades sin puntaje.
 *
 * Es una frase que agradece o acompana: **no valora lo que se respondio**.
 */
export function useCierre({
  cierre,
  alTerminar,
  enviando,
}: {
  cierre: string | undefined;
  alTerminar: (produjo: LoQueProduceLaActividad) => void;
  enviando: boolean;
}): {
  /** Entrega ya, o muestra el cierre y espera al boton. */
  terminar: (metadata: Metadata) => void;
  /** El cierre, si ya toca mostrarlo; `null` mientras la persona sigue en la actividad. */
  pantalla: ReactNode;
} {
  const mascota = useMascotaDeLaPersona();
  const [pendiente, setPendiente] = useState<Metadata | null>(null);
  const entregada = useRef(false);

  function entregar(metadata: Metadata) {
    if (entregada.current) {
      return;
    }

    entregada.current = true;
    alTerminar({ metadata });
  }

  function terminar(metadata: Metadata) {
    if (cierre === undefined) {
      entregar(metadata);
    } else {
      setPendiente(metadata);
    }
  }

  const pantalla =
    pendiente === null || cierre === undefined ? null : (
      <div className="viva">
        <VozDeLaMascota mascota={mascota} mensaje={cierre} expresion="feliz" latido={1} />

        <BarraDeAccion>
          <BotonPrincipal
            alPulsar={() => {
              entregar(pendiente);
            }}
            deshabilitado={enviando}
          >
            {enviando ? 'Guardando…' : 'Terminar'}
          </BotonPrincipal>
        </BarraDeAccion>
      </div>
    );

  return { terminar, pantalla };
}
