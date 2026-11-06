import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';

import type { ActividadDeHoy } from '../../infraestructura/api/progreso.ts';
import { rutaDeActividad } from '../../rutas/rutas.ts';

interface Posicion {
  readonly arriba: number;
  readonly izquierda: number;
}

interface Propiedades {
  readonly ancla: HTMLElement;
  readonly actividad: ActividadDeHoy;
  readonly idSesion?: string;
  readonly alCerrar: () => void;
}

/** Una sola accion, junto al nodo que la abrio. No interrumpe el desplazamiento del arbol. */
export function PopoverDeActividad({ ancla, actividad, idSesion, alCerrar }: Propiedades) {
  const tarjeta = useRef<HTMLDivElement>(null);
  const accion = useRef<HTMLAnchorElement>(null);
  const [posicion, setPosicion] = useState<Posicion | null>(null);

  useEffect(() => {
    const colocar = () => {
      // La envoltura no salta: la tarjeta sigue junto al nodo mientras el boton rebota.
      const punto = (ancla.closest('.arbol-sesiones__nodo') ?? ancla).getBoundingClientRect();
      if (punto.bottom < 0 || punto.top > window.innerHeight) {
        alCerrar();
        return;
      }
      const ancho = Math.min(224, window.innerWidth - 24);
      const alto = tarjeta.current?.offsetHeight ?? 108;
      const encima = punto.bottom + alto + 12 > window.innerHeight;

      setPosicion({
        arriba: Math.max(12, encima ? punto.top - alto - 10 : punto.bottom + 10),
        izquierda: Math.max(
          12,
          Math.min(punto.left + punto.width / 2 - ancho / 2, window.innerWidth - ancho - 12),
        ),
      });
    };

    const cerrarPorFuera = (evento: PointerEvent) => {
      const destino = evento.target;
      if (
        destino instanceof Node &&
        !tarjeta.current?.contains(destino) &&
        !ancla.contains(destino)
      ) {
        alCerrar();
      }
    };
    const cerrarConEscape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        alCerrar();
        ancla.focus();
      }
    };

    colocar();
    accion.current?.focus();
    window.addEventListener('resize', colocar);
    window.addEventListener('scroll', colocar, true);
    document.addEventListener('pointerdown', cerrarPorFuera);
    document.addEventListener('keydown', cerrarConEscape);
    return () => {
      window.removeEventListener('resize', colocar);
      window.removeEventListener('scroll', colocar, true);
      document.removeEventListener('pointerdown', cerrarPorFuera);
      document.removeEventListener('keydown', cerrarConEscape);
    };
  }, [ancla, alCerrar]);

  return createPortal(
    <div
      ref={tarjeta}
      role="dialog"
      aria-label={`Actividad: ${actividad.nombre}`}
      className="sendero__popover"
      style={
        posicion === null
          ? { visibility: 'hidden' }
          : { top: posicion.arriba, left: posicion.izquierda }
      }
    >
      <p className="sendero__popover-texto">Empieza cuando quieras</p>
      <Link
        ref={accion}
        className="sendero__popover-accion"
        to={`${rutaDeActividad(actividad.id)}${idSesion === undefined ? '' : `?sesion=${encodeURIComponent(idSesion)}`}`}
        aria-label={`Comenzar ${actividad.nombre}`}
      >
        Comenzar
      </Link>
    </div>,
    ancla.closest('.app') ?? document.body,
  );
}
