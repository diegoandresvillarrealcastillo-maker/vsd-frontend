import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MODULOS } from '../panel/modulos.ts';
import { TarjetaDeModulo } from './TarjetaDeModulo.tsx';

/**
 * La tarjeta de un modulo de la portada (SCRUM-313): el efecto de pasar el cursor y lo que pasa con
 * «reducir movimiento».
 *
 * El contenido (nombre, frase, actividades) ya lo prueba `portadaCuadraConLaApp.spec.tsx` sobre la
 * portada entera; aqui se mira la tarjeta sola, que es donde vive el estado de «cursor encima».
 */
const { reducirMovimiento } = vi.hoisted(() => ({ reducirMovimiento: { activo: false } }));

vi.mock('framer-motion', async (importarOriginal) => ({
  ...(await importarOriginal<typeof import('framer-motion')>()),
  useReducedMotion: () => reducirMovimiento.activo,
}));

function pintar() {
  render(
    <TarjetaDeModulo
      modulo="cognicion"
      actividades={['Recuerda los colores', 'Cuentas con calma']}
    />,
  );

  return screen.getByRole('heading', { name: MODULOS.cognicion.titulo }).closest('article')!;
}

/** Lo que dispara un raton al entrar y salir: framer-motion ignora los toques. */
const ENTRA = { pointerType: 'mouse', isPrimary: true } as const;

beforeEach(() => {
  reducirMovimiento.activo = false;
});

describe('la tarjeta de un modulo de la portada', () => {
  it('en reposo no esta activa', () => {
    expect(pintar()).not.toHaveClass('modulo-portada--activa');
  });

  it('lleva la clase de su modulo, de la que sale su color', () => {
    expect(pintar()).toHaveClass('modulo-portada', 'modulo-portada--cognicion');
  });

  // framer-motion procesa el cursor en el siguiente cuadro, no en el mismo instante del evento.
  it('al pasar el cursor se marca como activa y al salir deja de estarlo', async () => {
    const tarjeta = pintar();

    fireEvent.pointerEnter(tarjeta, ENTRA);
    await waitFor(() => {
      expect(tarjeta).toHaveClass('modulo-portada--activa');
    });

    fireEvent.pointerLeave(tarjeta, ENTRA);
    await waitFor(() => {
      expect(tarjeta).not.toHaveClass('modulo-portada--activa');
    });
  });

  it('con movimiento normal, al pasar el cursor se levanta y crece un poco', async () => {
    const tarjeta = pintar();

    fireEvent.pointerEnter(tarjeta, ENTRA);

    await waitFor(() => {
      expect(tarjeta.style.transform).toContain('translateY(-6px)');
    });
    expect(tarjeta.style.transform).toContain('scale(1.015)');
  });

  it('con «reducir movimiento» no se desplaza ni crece, pero el borde sí cambia de color', async () => {
    reducirMovimiento.activo = true;

    const tarjeta = pintar();

    fireEvent.pointerEnter(tarjeta, ENTRA);

    await waitFor(() => {
      expect(tarjeta).toHaveClass('modulo-portada--activa');
    });
    expect(tarjeta.style.transform).toBe('');
  });
});
