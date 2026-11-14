import { useEffect, useRef, useState } from 'react';

import '../estilos/captcha.css';
import { cargarTurnstile, type Turnstile } from './turnstile.ts';
import type { EstadoDelCaptcha } from './useCaptcha.ts';

type Fase = 'comprobando' | 'listo' | 'fallo';

const TEXTO_POR_FASE: Readonly<Record<Fase, string>> = {
  comprobando: 'Comprobando que eres una persona. Si aparece una casilla, márcala.',
  listo: 'Verificación lista.',
  fallo: 'No pudimos hacer la verificación de seguridad. Revisa tu conexión.',
};

/** El tema de la aplicacion, para que el widget no desentone. Sin tema fijado, el del sistema. */
function temaDeLaAplicacion(): 'auto' | 'light' | 'dark' {
  const tema = document.documentElement.dataset.tema;

  if (tema === 'claro') {
    return 'light';
  }

  return tema === 'oscuro' ? 'dark' : 'auto';
}

interface Props {
  captcha: EstadoDelCaptcha;
  /** Para las estadisticas de Cloudflare: de que pantalla vino el intento. */
  accion: 'registro' | 'acceso' | 'recuperar';
}

/**
 * La verificacion de que quien escribe es una persona, con Cloudflare Turnstile
 * (SCRUM-165).
 *
 * ## Sin clave, no existe
 *
 * Si no hay clave del sitio no pinta nada y no descarga nada: la pantalla
 * funciona como antes. Es lo que permite desplegar esto antes de activar el
 * CAPTCHA en Supabase.
 *
 * ## Que muestra y que dice
 *
 * El widget va en modo `interaction-only`: solo se ve si Cloudflare necesita que
 * la persona haga algo. Debajo hay siempre una linea de estado, en una region que
 * un lector de pantalla anuncia, que dice si esta comprobando, si ya esta lista o
 * si fallo, y en ese caso un boton para reintentar. Un widget que solo se ve en
 * un iframe de otro dominio no puede ser la unica forma de saber que pasa.
 *
 * ## Un token, un intento
 *
 * Supabase acepta cada token una sola vez. Quien usa este componente llama a
 * `captcha.reiniciar()` despues de cada intento, salga bien o mal, y aqui se pide
 * uno nuevo. Si el token caduca antes de enviar, se pide solo.
 */
export function CaptchaDeTurnstile({ captcha, accion }: Props) {
  const { activo, claveDelSitio, reinicio, ponerToken } = captcha;
  const contenedor = useRef<HTMLDivElement>(null);
  const pintado = useRef<{ turnstile: Turnstile; id: string } | null>(null);
  const reinicioVisto = useRef(reinicio);

  const [fase, setFase] = useState<Fase>('comprobando');
  // Sube cuando la persona pulsa «Intentar de nuevo» tras un fallo de carga.
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    const destino = contenedor.current;

    if (!activo || claveDelSitio === null || destino === null) {
      return;
    }

    let vigente = true;

    cargarTurnstile()
      .then((turnstile) => {
        if (!vigente) {
          return;
        }

        const id = turnstile.render(destino, {
          sitekey: claveDelSitio,
          action: accion,
          theme: temaDeLaAplicacion(),
          size: 'flexible',
          language: 'es',
          appearance: 'interaction-only',
          callback: (token) => {
            if (vigente) {
              ponerToken(token);
              setFase('listo');
            }
          },
          'expired-callback': () => {
            if (vigente) {
              ponerToken(null);
              setFase('comprobando');
            }
          },
          'error-callback': () => {
            if (vigente) {
              ponerToken(null);
              setFase('fallo');
            }
          },
          'timeout-callback': () => {
            if (vigente) {
              ponerToken(null);
              setFase('comprobando');
            }
          },
        });

        pintado.current = { turnstile, id };
      })
      .catch(() => {
        if (vigente) {
          ponerToken(null);
          setFase('fallo');
        }
      });

    return () => {
      vigente = false;

      if (pintado.current !== null) {
        try {
          pintado.current.turnstile.remove(pintado.current.id);
        } catch {
          // Si Cloudflare ya lo quito, no hay nada que limpiar.
        }

        pintado.current = null;
      }
    };
  }, [activo, claveDelSitio, accion, ponerToken, intento]);

  // La pantalla pidio un token nuevo (el anterior ya se uso o caduco).
  useEffect(() => {
    if (reinicioVisto.current === reinicio) {
      return;
    }

    reinicioVisto.current = reinicio;

    if (pintado.current !== null) {
      setFase('comprobando');
      pintado.current.turnstile.reset(pintado.current.id);
    }
  }, [reinicio]);

  if (!activo) {
    return null;
  }

  return (
    <div className="captcha">
      <div ref={contenedor} className="captcha__widget" />

      <p className="campo__ayuda captcha__estado" role="status">
        {TEXTO_POR_FASE[fase]}
      </p>

      {fase === 'fallo' && (
        <button
          type="button"
          className="acceso__enlace acceso__enlace--boton"
          onClick={() => {
            setFase('comprobando');
            setIntento((vez) => vez + 1);
          }}
        >
          Intentar de nuevo
        </button>
      )}
    </div>
  );
}
