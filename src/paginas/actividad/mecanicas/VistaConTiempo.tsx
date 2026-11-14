import { useEffect, useRef, type ReactNode } from 'react';

import '../../../estilos/juegosDeCognicion.css';
import { BarraDeAccion, BotonPrincipal } from '../viva/BarraDeAccion.tsx';

/**
 * Algo que se muestra unos segundos y luego se oculta (SCRUM-225): la lista de «Recuerda la lista» y la escena de
 * «Lo que vi». El tiempo a la vista es **parte del juego, no una amenaza** (R4): no hay cuenta atras ni numeros
 * en rojo, solo una barra suave que se vacia y un texto que lo dice. Y siempre se puede pasar antes con «Ya lo
 * tengo»: quien necesita menos tiempo no espera, y el tiempo no se mide.
 *
 * Con movimiento reducido la barra no se anima (queda llena): el texto sigue diciendo cuanto dura.
 */
export function VistaConTiempo({
  segundos,
  alAcabar,
  textoDelBoton = 'Ya lo tengo',
  children,
}: {
  segundos: number;
  alAcabar: () => void;
  textoDelBoton?: string;
  children: ReactNode;
}) {
  // El ultimo `alAcabar`, sin reiniciar el temporizador cada vez que cambia la funcion.
  const ultimo = useRef(alAcabar);

  useEffect(() => {
    ultimo.current = alAcabar;
  }, [alAcabar]);

  useEffect(() => {
    const temporizador = setTimeout(() => {
      ultimo.current();
    }, segundos * 1000);

    return () => {
      clearTimeout(temporizador);
    };
  }, [segundos]);

  return (
    <div className="juego__vista">
      {children}

      <p className="juego__vista-texto">
        Mira con calma: se oculta en unos {segundos} segundos. Si ya lo tienes, puedes seguir.
      </p>

      <div className="juego__vista-pista" aria-hidden="true">
        <span
          className="juego__vista-barra"
          style={{ animationDuration: `${String(segundos)}s` }}
        />
      </div>

      <BarraDeAccion>
        <BotonPrincipal alPulsar={alAcabar} conFlecha>
          {textoDelBoton}
        </BotonPrincipal>
      </BarraDeAccion>
    </div>
  );
}
