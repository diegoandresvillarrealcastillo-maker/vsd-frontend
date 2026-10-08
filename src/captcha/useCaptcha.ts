import { useCallback, useMemo, useState } from 'react';

import { entorno } from '../infraestructura/entorno.ts';

/**
 * Lo que se dice si alguien envia antes de que Cloudflare termine. Se bloquea el
 * envio en vez de desactivar el boton: un boton apagado sin explicacion deja a
 * quien usa un lector de pantalla sin saber por que.
 */
export const ESPERA_DEL_CAPTCHA = 'Un momento: todavía estamos comprobando que eres una persona.';

/** Lo que una pantalla necesita saber del CAPTCHA. */
export interface EstadoDelCaptcha {
  /** Si esta pantalla tiene CAPTCHA. Sin clave del sitio no hay nada. */
  readonly activo: boolean;
  readonly claveDelSitio: string | null;
  /** El token vigente, o `null` mientras Cloudflare no lo haya dado. */
  readonly token: string | null;
  /**
   * Cuantas veces se pidio un token nuevo. El widget lo mira para volver a
   * empezar.
   */
  readonly reinicio: number;
  /** Lo llama el widget cuando tiene un token, o cuando el que tenia caduco. */
  readonly ponerToken: (token: string | null) => void;
  /**
   * Pide un token nuevo. **Hay que llamarlo despues de cada intento**: Supabase
   * acepta cada token una sola vez, y reusarlo, aunque el intento anterior
   * fallara, haria que el siguiente se rechace.
   */
  readonly reiniciar: () => void;
}

/**
 * El CAPTCHA de una pantalla (SCRUM-165).
 *
 * Por defecto toma la clave del ambiente; `null` lo apaga. Las pruebas la pasan
 * a mano para no depender de las variables de entorno.
 */
export function useCaptcha(
  claveDelSitio: string | null = entorno.captcha.claveDelSitio,
): EstadoDelCaptcha {
  const [token, setToken] = useState<string | null>(null);
  const [reinicio, setReinicio] = useState(0);

  const ponerToken = useCallback((nuevo: string | null) => setToken(nuevo), []);

  const reiniciar = useCallback(() => {
    setToken(null);
    setReinicio((vez) => vez + 1);
  }, []);

  return useMemo(
    () => ({
      activo: claveDelSitio !== null,
      claveDelSitio,
      token,
      reinicio,
      ponerToken,
      reiniciar,
    }),
    [claveDelSitio, token, reinicio, ponerToken, reiniciar],
  );
}
