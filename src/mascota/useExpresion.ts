import { useCallback, useEffect, useRef, useState } from 'react';

import { formatoEn, zonaActual } from '../tiempo/zonaHoraria.ts';
import type { Expresion } from './personajes.ts';

/** Cuanto dura cada estado pasajero. */
const SALUDO_MS = 5_000;
const TOQUE_MS = 4_000;
const CELEBRACION_MS = 8_000;
/** Sin tocar nada durante este rato, la mascota se duerme. */
export const INACTIVIDAD_MS = 120_000;

/** Que ya saludo en esta pestaña. No es un dato personal: es una marca. */
const CLAVE_DEL_SALUDO = 'vsd-h:mascota-saludo';

const EVENTOS_DE_ACTIVIDAD = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;

/** La hora en la zona de la persona (SCRUM-123): de noche es de noche donde ella esta. */
function horaLocal(fecha: Date): number {
  return Number(
    formatoEn(zonaActual(), 'en-US', { hour: 'numeric', hourCycle: 'h23' }).format(fecha),
  );
}

/** De diez de la noche a seis de la manana. */
export function esDeNoche(fecha: Date): boolean {
  const hora = horaLocal(fecha);

  return hora >= 22 || hora < 6;
}

function yaSaludo(): boolean {
  try {
    return sessionStorage.getItem(CLAVE_DEL_SALUDO) !== null;
  } catch {
    return true;
  }
}

function marcarSaludo(): void {
  try {
    sessionStorage.setItem(CLAVE_DEL_SALUDO, '1');
  } catch {
    // Sin almacenamiento saludara en cada pantalla, y no pasa nada.
  }
}

/**
 * Que cara pone la mascota (SCRUM-99).
 *
 * De mas a menos importante:
 * 1. **Celebrando** un rato cuando la pantalla lo pide: plan del dia completo,
 *    modulo desbloqueado.
 * 2. **Feliz** un momento despues de tocarla.
 * 3. **Dormida** de noche o tras dos minutos sin actividad. Cualquier toque o
 *    tecla la despierta.
 * 4. **Feliz** al entrar, la primera vez en la pestaña.
 * 5. **Normal** el resto del tiempo.
 */
export function useExpresion(celebrar: boolean): {
  readonly expresion: Expresion;
  readonly alTocar: () => void;
} {
  const [saludando, setSaludando] = useState(() => !yaSaludo());
  const [tocada, setTocada] = useState(false);
  const [noche, setNoche] = useState(() => esDeNoche(new Date()));
  const [inactiva, setInactiva] = useState(false);
  const [celebracionTerminada, setCelebracionTerminada] = useState(false);
  const [celebrarAntes, setCelebrarAntes] = useState(celebrar);
  const temporizadorDelToque = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cada vez que la pantalla vuelve a pedir celebrar, se celebra de nuevo.
  if (celebrar !== celebrarAntes) {
    setCelebrarAntes(celebrar);

    if (celebrar) {
      setCelebracionTerminada(false);
    }
  }

  useEffect(() => {
    marcarSaludo();

    const temporizador = setTimeout(() => setSaludando(false), SALUDO_MS);

    return () => clearTimeout(temporizador);
  }, []);

  useEffect(() => {
    if (!celebrar || celebracionTerminada) {
      return undefined;
    }

    const temporizador = setTimeout(() => setCelebracionTerminada(true), CELEBRACION_MS);

    return () => clearTimeout(temporizador);
  }, [celebrar, celebracionTerminada]);

  useEffect(() => {
    const reloj = setInterval(() => setNoche(esDeNoche(new Date())), 60_000);

    return () => clearInterval(reloj);
  }, []);

  useEffect(() => {
    let temporizador = setTimeout(() => setInactiva(true), INACTIVIDAD_MS);

    function alActuar() {
      clearTimeout(temporizador);
      setInactiva(false);
      temporizador = setTimeout(() => setInactiva(true), INACTIVIDAD_MS);
    }

    for (const evento of EVENTOS_DE_ACTIVIDAD) {
      document.addEventListener(evento, alActuar, { passive: true, capture: true });
    }

    return () => {
      clearTimeout(temporizador);

      for (const evento of EVENTOS_DE_ACTIVIDAD) {
        document.removeEventListener(evento, alActuar, { capture: true });
      }
    };
  }, []);

  useEffect(
    () => () => {
      if (temporizadorDelToque.current !== null) {
        clearTimeout(temporizadorDelToque.current);
      }
    },
    [],
  );

  const alTocar = useCallback(() => {
    setTocada(true);

    if (temporizadorDelToque.current !== null) {
      clearTimeout(temporizadorDelToque.current);
    }

    temporizadorDelToque.current = setTimeout(() => setTocada(false), TOQUE_MS);
  }, []);

  let expresion: Expresion = 'normal';

  if (celebrar && !celebracionTerminada) {
    expresion = 'celebrando';
  } else if (tocada) {
    expresion = 'feliz';
  } else if (noche || inactiva) {
    expresion = 'dormida';
  } else if (saludando) {
    expresion = 'feliz';
  }

  return { expresion, alTocar };
}
