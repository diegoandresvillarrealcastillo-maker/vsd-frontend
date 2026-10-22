import { useEffect, useState } from 'react';

import type { Racha } from '../infraestructura/api/racha.ts';
import { useSesion } from '../sesion/useSesion.ts';
import { alCambiarLaRacha, rachaRecordadaDe } from './memoriaDeLaRacha.ts';
import { refrescarLaRacha } from './refrescarLaRacha.ts';

/**
 * La racha de la cuenta de ahora, o `null` si todavia no se sabe (SCRUM-186).
 *
 * La pide al montarse y otra vez cuando vuelve la conexion. Si no se puede pedir —sin
 * conexion, sin cuenta todavia— no es un error que la persona deba ver: se queda lo ultimo que
 * se supo, o nada. La llama es un acompanamiento, no una pantalla que pueda fallar.
 *
 * El dia lo cuenta el servidor, en la zona de la persona: aqui no se cuenta nada.
 *
 * Tambien cambia cuando otra pantalla refresca la racha de la misma cuenta (SCRUM-243), por
 * ejemplo al terminar una actividad: la llama de la barra crece sin recargar.
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
    const dejarDeEscuchar = alCambiarLaRacha((deQuien, nueva) => {
      if (vigente && deQuien === cuenta) {
        setRacha(nueva);
      }
    });

    function pedir() {
      if (cuenta === null) {
        return;
      }

      // Lo que llegue se recuerda y llega aqui por el oyente de arriba.
      refrescarLaRacha(cuenta, controlador.signal).catch(() => {
        // Sin conexion o sin cuenta todavia: se queda lo que habia.
      });
    }

    pedir();
    window.addEventListener('online', pedir);

    return () => {
      vigente = false;
      controlador.abort();
      dejarDeEscuchar();
      window.removeEventListener('online', pedir);
    };
  }, [cuenta]);

  return cuenta === null ? null : racha;
}
