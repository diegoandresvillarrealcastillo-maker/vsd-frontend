import { useEffect, useState } from 'react';

import { consultarLaRacha, type Racha } from '../infraestructura/api/racha.ts';
import { useSesion } from '../sesion/useSesion.ts';
import { rachaRecordadaDe, recordarLaRacha } from './memoriaDeLaRacha.ts';

/**
 * La racha de la cuenta de ahora, o `null` si todavia no se sabe (SCRUM-186).
 *
 * La pide al montarse y otra vez cuando vuelve la conexion. Si no se puede pedir —sin
 * conexion, sin cuenta todavia— no es un error que la persona deba ver: se queda lo ultimo que
 * se supo, o nada. La llama es un acompanamiento, no una pantalla que pueda fallar.
 *
 * El dia lo cuenta el servidor, en la zona de la persona: aqui no se cuenta nada.
 */
export function useRacha(): Racha | null {
  const { sesion } = useSesion();
  const cuenta = sesion?.user.id ?? null;
  const [racha, setRacha] = useState<Racha | null>(
    cuenta === null ? null : rachaRecordadaDe(cuenta),
  );

  useEffect(() => {
    if (cuenta === null) {
      return undefined;
    }

    let vigente = true;
    const controlador = new AbortController();

    function pedir() {
      consultarLaRacha(controlador.signal)
        .then((nueva) => {
          if (vigente && cuenta !== null) {
            recordarLaRacha(cuenta, nueva);
            setRacha(nueva);
          }
        })
        .catch(() => {
          // Sin conexion o sin cuenta todavia: se queda lo que habia.
        });
    }

    pedir();
    window.addEventListener('online', pedir);

    return () => {
      vigente = false;
      controlador.abort();
      window.removeEventListener('online', pedir);
    };
  }, [cuenta]);

  return cuenta === null ? null : racha;
}
