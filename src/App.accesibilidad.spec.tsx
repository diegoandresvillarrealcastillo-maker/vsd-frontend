import type { Session } from '@supabase/supabase-js';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { App } from './App.tsx';
import { cuantosH1, fallosDeAccesibilidad } from './pruebas/axe.ts';
import { RUTAS } from './rutas/rutas.ts';
import { SesionContexto, type EstadoDeSesion } from './sesion/SesionContexto.ts';

/**
 * Accesibilidad de las pantallas publicas y de acceso (C-03 y SEO-04 de la auditoria
 * 360): axe sobre la pagina ya pintada, y un solo encabezado de primer nivel por
 * pantalla.
 *
 * Las pantallas que piden datos a la API tienen su prueba en su propio archivo, que
 * ya sabe simularla.
 */
function estado(parcial: Partial<EstadoDeSesion> = {}): EstadoDeSesion {
  const vacio = vi.fn().mockResolvedValue({ ok: true });

  return {
    sesion: null,
    cargando: false,
    correo: null,
    registrarse: vacio,
    entrar: vacio,
    entrarConGoogle: vacio,
    pedirRecuperacion: vacio,
    cambiarContrasena: vacio,
    pedirCodigoDeVerificacion: vacio,
    cambiarContrasenaConCodigo: vacio,
    salir: vi.fn(),
    ...parcial,
  };
}

// Basta con que no sea `null`: es lo que deja el enlace del correo.
const SESION = { access_token: 'de-mentira', user: { id: 'u1' } } as unknown as Session;

const PANTALLAS: readonly (readonly [string, string, EstadoDeSesion])[] = [
  ['la portada', RUTAS.INICIO, estado()],
  ['entrar', RUTAS.ACCESO, estado()],
  ['crear una cuenta', RUTAS.REGISTRO, estado()],
  ['pedir una contrasena nueva', RUTAS.RECUPERAR, estado()],
  ['elegir la contrasena nueva', RUTAS.CONTRASENA_NUEVA, estado({ sesion: SESION })],
];

describe.each(PANTALLAS)('%s', (_nombre, ruta, sesion) => {
  function pintar() {
    return render(
      <SesionContexto.Provider value={sesion}>
        <MemoryRouter initialEntries={[ruta]}>
          <App />
        </MemoryRouter>
      </SesionContexto.Provider>,
    );
  }

  it('no tiene fallos de accesibilidad', async () => {
    pintar();
    await screen.findAllByRole('heading');

    expect(await fallosDeAccesibilidad()).toEqual([]);
  });

  it('tiene un solo encabezado de primer nivel', async () => {
    pintar();
    await screen.findAllByRole('heading');

    expect(cuantosH1()).toBe(1);
  });
});
