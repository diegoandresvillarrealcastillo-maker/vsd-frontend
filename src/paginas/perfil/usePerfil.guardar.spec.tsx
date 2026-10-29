import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Cuenta } from '../../infraestructura/api/cuenta.ts';
import { abrirUnAlmacenDePrueba, cerrarElAlmacenDePrueba } from '../../pruebas/almacenDePrueba.ts';
import { usePerfil } from './usePerfil.ts';

/**
 * `guardar` del perfil con el contexto de quien empezo una operacion que ya iba por la mitad
 * (SCRUM-317): lo segundo que se pide (por ejemplo, dejar la mascota propia como acompanante) tiene
 * que salir con la sesion de quien empezo, o no salir.
 */
const { cambiarPreferencias, darDeAltaLaCuenta } = vi.hoisted(() => ({
  cambiarPreferencias: vi.fn(),
  darDeAltaLaCuenta: vi.fn(),
}));

vi.mock('../../infraestructura/api/aviso.ts', () => ({
  consultarLaVersionDelAviso: () => Promise.resolve('prueba'),
}));
vi.mock('../../infraestructura/api/cuenta.ts', () => ({
  cambiarPreferencias,
  darDeAltaLaCuenta,
  consultarLaCuentaPropia: darDeAltaLaCuenta,
}));

const CUENTA = {
  id: 'persona-a',
  correo: 'a@example.test',
  nombre: 'Ana',
  rol: 'usuario',
  modulosActivos: ['cognicion'],
  mascota: null,
} as unknown as Cuenta;

beforeEach(async () => {
  await abrirUnAlmacenDePrueba('persona-a');
  darDeAltaLaCuenta.mockResolvedValue(CUENTA);
});

afterEach(() => {
  cerrarElAlmacenDePrueba();
  vi.clearAllMocks();
});

describe('usePerfil: guardar', () => {
  it('lleva a la peticion el contexto de quien empezo la operacion', async () => {
    const contexto = { persona: 'persona-a', vigente: () => true };

    cambiarPreferencias.mockResolvedValue({ ...CUENTA, nombre: 'Nueva' });

    const gancho = renderHook(() => usePerfil());

    await waitFor(() => {
      expect(gancho.result.current.estado.fase).toBe('listo');
    });
    await gancho.result.current.guardar({ nombre: 'Nueva' }, contexto);

    expect(cambiarPreferencias).toHaveBeenCalledWith({ nombre: 'Nueva' }, undefined, contexto);
  });

  it('si la peticion se descarta porque la sesion cambio, no pinta esa cuenta y lanza', async () => {
    cambiarPreferencias.mockRejectedValue(new DOMException('La sesion cambio', 'AbortError'));

    const gancho = renderHook(() => usePerfil());

    await waitFor(() => {
      expect(gancho.result.current.estado.fase).toBe('listo');
    });
    await expect(
      gancho.result.current.guardar(
        { nombre: 'Nueva' },
        { persona: 'persona-a', vigente: () => false },
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });

    const { estado } = gancho.result.current;

    expect(estado.fase === 'listo' ? estado.cuenta.nombre : null).toBe('Ana');
  });
});
