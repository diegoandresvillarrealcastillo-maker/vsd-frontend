import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RUTAS } from '../../rutas/rutas.ts';
import { SesionContexto, type EstadoDeSesion } from '../../sesion/SesionContexto.ts';
import { Acceso } from './Acceso.tsx';
import { Registro } from './Registro.tsx';

/**
 * Entrar con Google en modo de prueba (SCRUM-74): el boton se ve, y debajo dice que solo entran
 * las cuentas autorizadas. Sin ese aviso, quien no esta en la lista de evaluadores de Google
 * llega a un error de Google sin camino de vuelta y cree que la aplicacion esta rota.
 */
const ajustes = vi.hoisted(() => ({ conGoogle: true, googleEnPrueba: true }));

vi.mock('../../infraestructura/entorno.ts', async (importarOriginal) => {
  const original = await importarOriginal<typeof import('../../infraestructura/entorno.ts')>();

  return {
    ...original,
    entorno: {
      ...original.entorno,
      get conGoogle() {
        return ajustes.conGoogle;
      },
      get googleEnPrueba() {
        return ajustes.googleEnPrueba;
      },
    },
  };
});

function estado(): EstadoDeSesion {
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
  };
}

function pintar(pantalla: React.ReactNode) {
  return render(
    <SesionContexto.Provider value={estado()}>
      <MemoryRouter initialEntries={[RUTAS.ACCESO]}>
        <Routes>
          <Route path={RUTAS.ACCESO} element={pantalla} />
        </Routes>
      </MemoryRouter>
    </SesionContexto.Provider>,
  );
}

afterEach(() => {
  ajustes.conGoogle = true;
  ajustes.googleEnPrueba = true;
});

describe.each([
  ['el acceso', <Acceso key="a" />],
  ['el registro', <Registro key="r" />],
])('%s con Google en modo de prueba', (_nombre, pantalla) => {
  it('ofrece el boton y avisa de que solo entran las cuentas autorizadas', () => {
    pintar(pantalla);

    expect(screen.getByRole('button', { name: /con Google/i })).toBeInTheDocument();
    expect(screen.getByTestId('aviso-de-google-en-prueba')).toHaveTextContent(
      /solo funciona con las cuentas que el equipo autorizó/,
    );
    expect(screen.getByTestId('aviso-de-google-en-prueba')).toHaveTextContent(
      /correo y contraseña/,
    );
  });

  it('con Google abierto a todos no hay aviso', () => {
    ajustes.googleEnPrueba = false;

    pintar(pantalla);

    expect(screen.getByRole('button', { name: /con Google/i })).toBeInTheDocument();
    expect(screen.queryByTestId('aviso-de-google-en-prueba')).not.toBeInTheDocument();
  });

  it('sin Google no hay boton ni aviso', () => {
    ajustes.conGoogle = false;
    ajustes.googleEnPrueba = false;

    pintar(pantalla);

    expect(screen.queryByRole('button', { name: /Google/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('aviso-de-google-en-prueba')).not.toBeInTheDocument();
  });
});
