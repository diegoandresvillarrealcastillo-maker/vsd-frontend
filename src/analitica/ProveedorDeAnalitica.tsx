import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import { ID_DEL_CONTENIDO } from '../componentes/SaltoAlContenido.tsx';
import { entorno } from '../infraestructura/entorno.ts';
import { AnaliticaContexto, type EstadoDeAnalitica } from './AnaliticaContexto.ts';
import { guardarLaDecision, leerLaDecision, type Decision } from './consentimiento.ts';
import { activar, enviarLaVisita, retirar } from './ga4.ts';
import { plantillaDeRuta } from './plantillaDeRuta.ts';

interface Props {
  children: ReactNode;
  /**
   * El identificador de medicion. Por defecto, el del ambiente. `null` apaga todo;
   * las pruebas lo pasan a mano para no depender del entorno.
   */
  idDeMedicion?: string | null;
}

const ANUNCIO_DE_ACEPTADA = 'Guardamos tu elección: contaremos las visitas a las pantallas.';
const ANUNCIO_DE_RECHAZADA = 'Guardamos tu elección: no contaremos tus visitas.';

/**
 * Decide cuando Google Analytics puede existir (SCRUM-161).
 *
 * ## Las reglas
 *
 * 1. **Sin identificador de medicion no hay nada**: ni banner, ni script, ni
 *    cookies.
 * 2. **Sin una decision de aceptar, Google no se toca.** Ni la primera visita, ni
 *    despues de rechazar. El script ni se descarga.
 * 3. **Aceptar** configura Google Analytics y manda una visita por pantalla,
 *    siempre con la plantilla de la ruta y nunca con la direccion real.
 * 4. **Rechazar despues de haber aceptado** detiene el envio y borra las cookies
 *    en el acto, sin esperar a recargar.
 * 5. La decision se recuerda en el navegador. Si no se puede recordar, se vuelve a
 *    preguntar, que es el lado seguro.
 *
 * Tiene que estar dentro del enrutador: cada cambio de pantalla es una visita.
 *
 * ## El foco
 *
 * El banner no roba el foco al aparecer: quien lee o escribe no tiene que ser
 * interrumpido. Pero al cerrarse el boton que se pulso desaparece, y el foco se
 * perderia en el vacio; por eso se devuelve a lo que abrio el banner (en la
 * primera visita, al contenido de la pantalla).
 */
export function ProveedorDeAnalitica({
  children,
  idDeMedicion = entorno.analitica.idDeMedicion,
}: Props) {
  const ubicacion = useLocation();
  const disponible = idDeMedicion !== null;

  const [decision, setDecision] = useState<Decision | null>(() =>
    disponible ? leerLaDecision() : null,
  );
  const [reabierto, setReabierto] = useState(false);
  const [anuncio, setAnuncio] = useState('');

  const preguntando = disponible && (decision === null || reabierto);
  const activa = disponible && decision === 'aceptada';

  // ---------- Google Analytics, solo con permiso ----------

  useEffect(() => {
    if (activa && idDeMedicion !== null) {
      activar(idDeMedicion);
    }
  }, [activa, idDeMedicion]);

  // La ultima direccion contada, solo para no contar dos veces la misma visita
  // (React en desarrollo corre cada efecto dos veces). No sale de este navegador.
  const ultimaContada = useRef<string | null>(null);

  useEffect(() => {
    if (!activa) {
      ultimaContada.current = null;

      return;
    }

    if (ultimaContada.current === ubicacion.pathname) {
      return;
    }

    ultimaContada.current = ubicacion.pathname;
    enviarLaVisita(plantillaDeRuta(ubicacion.pathname));
  }, [activa, ubicacion.pathname]);

  // ---------- Lo que la persona elige ----------

  const quienAbrio = useRef<HTMLElement | null>(null);

  const decidir = useCallback(
    (nueva: Decision) => {
      if (idDeMedicion === null) {
        return;
      }

      guardarLaDecision(nueva);

      if (nueva === 'rechazada' && decision === 'aceptada') {
        retirar(idDeMedicion);
      }

      setDecision(nueva);
      setReabierto(false);
      setAnuncio(nueva === 'aceptada' ? ANUNCIO_DE_ACEPTADA : ANUNCIO_DE_RECHAZADA);
    },
    [idDeMedicion, decision],
  );

  const aceptar = useCallback(() => decidir('aceptada'), [decidir]);
  const rechazar = useCallback(() => decidir('rechazada'), [decidir]);

  const preguntarDeNuevo = useCallback(() => {
    quienAbrio.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setAnuncio('');
    setReabierto(true);
  }, []);

  const cerrar = useCallback(() => {
    setReabierto(false);
  }, []);

  // Al cerrarse el banner, el foco vuelve a donde estaba.
  const estabaPreguntando = useRef(preguntando);

  useEffect(() => {
    if (estabaPreguntando.current && !preguntando) {
      const origen = quienAbrio.current;
      const destino = origen?.isConnected ? origen : document.getElementById(ID_DEL_CONTENIDO);

      destino?.focus({ preventScroll: true });
      quienAbrio.current = null;
    }

    estabaPreguntando.current = preguntando;
  }, [preguntando]);

  const valor = useMemo<EstadoDeAnalitica>(
    () => ({
      idDeMedicion,
      disponible,
      decision,
      preguntando,
      aceptar,
      rechazar,
      preguntarDeNuevo,
      cerrar,
    }),
    [idDeMedicion, disponible, decision, preguntando, aceptar, rechazar, preguntarDeNuevo, cerrar],
  );

  return (
    <AnaliticaContexto.Provider value={valor}>
      {children}
      {/* Siempre en el documento, para que el lector de pantalla anuncie el cambio
          aunque el banner ya no este. */}
      {disponible && (
        <p className="solo-lectores" role="status">
          {anuncio}
        </p>
      )}
    </AnaliticaContexto.Provider>
  );
}
