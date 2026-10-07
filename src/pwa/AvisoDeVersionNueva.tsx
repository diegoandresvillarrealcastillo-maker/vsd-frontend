import { useEffect, useState } from 'react';

import '../estilos/pwa.css';
import {
  aplicarLaVersionNueva,
  dejarLaVersionParaDespues,
  recargarAhora,
  useVersionNueva,
} from './versionNueva.ts';

/**
 * Cuanto se espera, despues de pulsar "Actualizar", a que el navegador active la
 * version nueva y recargue la pagina. Si pasa de aqui, algo no salio: se dice y
 * el boton vuelve a estar disponible, en lugar de dejarlo "Actualizando…" para
 * siempre.
 */
const ESPERA_A_QUE_RECARGUE_EN_MS = 8000;

/**
 * El aviso de que hay una version nueva de la aplicacion (SCRUM-135).
 *
 * **Se ofrece, no se impone.** Recargar la pagina sin avisar mientras alguien
 * escribe en su diario seria perder lo escrito. Por eso el aviso espera a que la
 * persona diga "Actualizar", y "Despues" lo guarda para la proxima visita.
 *
 * Hay un segundo aviso, el de **recargar**: la version nueva ya tomo el control
 * porque la persona la acepto en otra pestana. Esta pagina sigue con codigo y
 * archivos viejos, asi que hay que recargarla, pero tampoco a la fuerza. Ese no
 * tiene "Despues": ya esta desincronizada, y esperar es lo que hace la persona
 * al seguir escribiendo hasta que le parezca bien.
 *
 * La region `role="status"` esta siempre en el documento y solo su contenido
 * aparece: los lectores de pantalla anuncian los cambios de una region que ya
 * existia, no la que nace con el texto puesto. Y no roba el foco: llega, se
 * anuncia, y quien quiera lo alcanza con el tabulador.
 */
export function AvisoDeVersionNueva() {
  const oferta = useVersionNueva();
  const [aplicando, setAplicando] = useState(false);
  const [fallo, setFallo] = useState(false);

  // Si pasa el tiempo y la pagina no se recargo, no se queda esperando.
  useEffect(() => {
    if (!aplicando) {
      return undefined;
    }

    const espera = setTimeout(() => {
      setAplicando(false);
      setFallo(true);
    }, ESPERA_A_QUE_RECARGUE_EN_MS);

    return () => {
      clearTimeout(espera);
    };
  }, [aplicando]);

  async function actualizar(): Promise<void> {
    setAplicando(true);
    setFallo(false);

    try {
      await aplicarLaVersionNueva();
      // Aqui no se quita "Actualizando…": el navegador activa la version nueva y
      // la pagina se recarga. Si no lo hace, lo resuelve el tiempo de espera.
    } catch {
      // El navegador no pudo activarla. No se pierde nada: la version actual
      // sigue funcionando, y al cerrar la aplicacion y abrirla la nueva entra.
      setAplicando(false);
      setFallo(true);
    }
  }

  return (
    <div className="version-nueva" role="status">
      {oferta === 'actualizar' ? (
        <div className="version-nueva__tarjeta">
          <p className="version-nueva__texto">
            <strong>Hay una versión nueva de VSD Health.</strong> Al actualizar, la página se
            recarga: termina primero lo que estés escribiendo.
          </p>
          {fallo ? (
            <p className="version-nueva__texto version-nueva__error">
              No se pudo actualizar ahora. Cierra la aplicación y vuelve a abrirla.
            </p>
          ) : null}
          <div className="version-nueva__acciones">
            <button
              type="button"
              className="version-nueva__boton version-nueva__boton--principal"
              disabled={aplicando}
              onClick={() => {
                void actualizar();
              }}
            >
              {aplicando ? 'Actualizando…' : 'Actualizar'}
            </button>
            <button
              type="button"
              className="version-nueva__boton"
              disabled={aplicando}
              onClick={dejarLaVersionParaDespues}
            >
              Después
            </button>
          </div>
        </div>
      ) : null}

      {oferta === 'recargar' ? (
        <div className="version-nueva__tarjeta">
          <p className="version-nueva__texto">
            <strong>VSD Health se actualizó en otra pestaña.</strong> Recarga esta página para
            seguir con la versión nueva. Hazlo cuando termines lo que estás escribiendo.
          </p>
          <div className="version-nueva__acciones">
            <button
              type="button"
              className="version-nueva__boton version-nueva__boton--principal"
              onClick={recargarAhora}
            >
              Recargar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
