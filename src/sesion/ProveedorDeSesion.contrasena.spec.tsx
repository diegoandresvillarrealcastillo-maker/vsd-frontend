import type { Session } from '@supabase/supabase-js';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { olvidarPreferenciaDePestana } from '../infraestructura/supabase/almacenamiento.ts';
import { olvidarLosDatosDeLaSesionActual } from '../sincronizacion/ciclo.ts';
import { ProveedorDeSesion } from './ProveedorDeSesion.tsx';
import type { ResultadoDeAcceso } from './SesionContexto.ts';
import { useSesion } from './useSesion.ts';

/**
 * Cambiar la contrasena cierra la sesion de los demas dispositivos (SCRUM-154).
 *
 * Cambiarla porque alguien mas pudo entrar no sirve de nada si esa persona
 * conserva su sesion. Se prueba por las dos vias de cambio —la del enlace del
 * correo y la del perfil con codigo— y por lo que pasa cuando la parte de cerrar
 * falla: la contrasena ya cambio, asi que no es un error, pero hay que decirlo.
 */
const { getSession, onAuthStateChange, signOut, updateUser } = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock('../infraestructura/supabase/cliente.ts', () => ({
  supabase: () => ({ auth: { getSession, onAuthStateChange, signOut, updateUser } }),
}));
vi.mock('../notificaciones/navegador.ts', () => ({
  dejarDeAvisarAEsteNavegador: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../foto/archivosDeLaPersona.ts', () => ({ olvidarLosArchivosDeLaPersona: vi.fn() }));
vi.mock('../sincronizacion/ciclo.ts', () => ({
  alCambiarLaSesion: vi.fn().mockResolvedValue(undefined),
  olvidarLosDatosDeLaSesionActual: vi.fn().mockResolvedValue(undefined),
}));

const SESION = { user: { id: 'id-de-ana', email: 'ana@ejemplo.test' } } as Session;
const NUEVA = 'UnaClave#Nueva9';

/** Cambia la contrasena por la via de pedido y deja a la vista el resultado. */
function Cambiar({ via }: { via: 'enlace' | 'codigo' }) {
  const { cambiarContrasena, cambiarContrasenaConCodigo } = useSesion();
  const [resultado, setResultado] = useState<ResultadoDeAcceso | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={() =>
          void (
            via === 'enlace'
              ? cambiarContrasena(NUEVA)
              : cambiarContrasenaConCodigo(NUEVA, ' 123456 ')
          ).then(setResultado)
        }
      >
        Cambiar
      </button>
      <output>{resultado === null ? 'sin resultado' : JSON.stringify(resultado)}</output>
    </>
  );
}

async function cambiar(via: 'enlace' | 'codigo'): Promise<ResultadoDeAcceso> {
  render(
    <ProveedorDeSesion>
      <Cambiar via={via} />
    </ProveedorDeSesion>,
  );

  await userEvent
    .setup({ delay: null })
    .click(await screen.findByRole('button', { name: 'Cambiar' }));

  const salida = await screen.findByText(/"ok":/);

  return JSON.parse(salida.textContent ?? '') as ResultadoDeAcceso;
}

beforeEach(() => {
  getSession.mockResolvedValue({ data: { session: SESION } });
  onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  updateUser.mockResolvedValue({ error: null });
  signOut.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.clearAllMocks();
  olvidarPreferenciaDePestana();
});

describe.each([['enlace'], ['codigo']] as const)('al cambiar la contrasena por el %s', (via) => {
  it('cierra la sesion de los demas dispositivos, y solo de los demas', async () => {
    const resultado = await cambiar(via);

    expect(updateUser).toHaveBeenCalledOnce();
    // `others` deja abierta esta sesion. Con `global` o `local` la persona
    // quedaria fuera justo despues de cambiar la contrasena.
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith({ scope: 'others' });
    expect(resultado).toEqual({
      ok: true,
      mensaje: 'Cerramos tu sesión en los demás dispositivos.',
    });
  });

  it('primero cambia la contrasena y despues cierra las demas', async () => {
    await cambiar(via);

    expect(updateUser.mock.invocationCallOrder[0]).toBeLessThan(
      signOut.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('esta sesion se queda: no se olvida nada de lo guardado en este equipo', async () => {
    await cambiar(via);

    expect(olvidarLosDatosDeLaSesionActual).not.toHaveBeenCalled();
  });

  it('si la contrasena no cambia, no se cierra ninguna sesion', async () => {
    updateUser.mockResolvedValue({
      error: { code: 'same_password', status: 422, message: 'igual' },
    });

    const resultado = await cambiar(via);

    expect(signOut).not.toHaveBeenCalled();
    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toContain('distinta de la actual');
  });

  it('si no se pueden cerrar las demas, la contrasena queda cambiada y se avisa', async () => {
    signOut.mockResolvedValue({ error: { code: 'unexpected_failure', status: 500, message: 'x' } });

    const resultado = await cambiar(via);

    expect(resultado.ok).toBe(true);
    expect(resultado.mensaje).toContain('No pudimos cerrar tu sesión en los demás dispositivos');
  });

  it('lo mismo si la llamada se cae del todo', async () => {
    signOut.mockRejectedValue(new TypeError('Failed to fetch'));

    const resultado = await cambiar(via);

    expect(resultado.ok).toBe(true);
    expect(resultado.mensaje).toContain('No pudimos cerrar tu sesión en los demás dispositivos');
  });
});

describe('la via del perfil', () => {
  it('manda el codigo sin espacios', async () => {
    await cambiar('codigo');

    expect(updateUser).toHaveBeenCalledWith({ password: NUEVA, nonce: '123456' });
  });
});

describe('la via del enlace', () => {
  it('manda solo la contrasena', async () => {
    await cambiar('enlace');

    expect(updateUser).toHaveBeenCalledWith({ password: NUEVA });
  });
});
