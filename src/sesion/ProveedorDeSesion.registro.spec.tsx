import type { Session } from '@supabase/supabase-js';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { olvidarPreferenciaDePestana } from '../infraestructura/supabase/almacenamiento.ts';
import { ProveedorDeSesion } from './ProveedorDeSesion.tsx';
import type { ResultadoDeAcceso } from './SesionContexto.ts';
import { useSesion } from './useSesion.ts';

/**
 * El registro con correo: lo que se le pide a Supabase al crear la identidad
 * (T-03 de la auditoria 360).
 *
 * Dos cosas importan aqui. Que sin las dos casillas **no se llame a nadie**, y
 * que lo que viaje en la identidad sea la constancia de lo aceptado y nada
 * personal mas: la fecha de nacimiento no va, porque no hace falta para crear la
 * identidad y lo que se pone en `user_metadata` viaja despues dentro del token de
 * cada peticion.
 */
const { getSession, onAuthStateChange, signOut, signUp, consultarLosTextosVigentes } = vi.hoisted(
  () => ({
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signOut: vi.fn(),
    signUp: vi.fn(),
    consultarLosTextosVigentes: vi.fn(),
  }),
);

vi.mock('../infraestructura/supabase/cliente.ts', () => ({
  supabase: () => ({ auth: { getSession, onAuthStateChange, signOut, signUp } }),
}));
vi.mock('../infraestructura/api/aviso.ts', () => ({ consultarLosTextosVigentes }));
vi.mock('../notificaciones/navegador.ts', () => ({
  dejarDeAvisarAEsteNavegador: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../foto/archivosDeLaPersona.ts', () => ({ olvidarLosArchivosDeLaPersona: vi.fn() }));
vi.mock('../sincronizacion/ciclo.ts', () => ({
  alCambiarLaSesion: vi.fn().mockResolvedValue(undefined),
  olvidarLosDatosDeLaSesionActual: vi.fn().mockResolvedValue(undefined),
}));

/** Lo que se le deja a Supabase en la identidad: la constancia de lo aceptado. */
interface DatosDeLaIdentidad {
  version_aviso: string;
  version_terminos: string;
  acepto_en: string;
}

const DATOS = { correo: 'ana@ejemplo.test', contrasena: 'UnaContrasena#2026' };

let resultado: ResultadoDeAcceso | undefined;

function Registrar({ aviso, terminos }: { aviso: boolean; terminos: boolean }) {
  const { registrarse } = useSesion();

  return (
    <button
      type="button"
      onClick={() =>
        void registrarse({ ...DATOS, aceptaElAviso: aviso, aceptaLosTerminos: terminos }).then(
          (devuelto) => {
            resultado = devuelto;
          },
        )
      }
    >
      Registrar
    </button>
  );
}

async function registrar(aviso: boolean, terminos: boolean) {
  render(
    <ProveedorDeSesion>
      <Registrar aviso={aviso} terminos={terminos} />
    </ProveedorDeSesion>,
  );

  await userEvent.click(screen.getByRole('button', { name: 'Registrar' }));
  await waitFor(() => {
    expect(resultado).toBeDefined();
  });
}

beforeEach(() => {
  resultado = undefined;
  getSession.mockResolvedValue({ data: { session: null as Session | null } });
  signOut.mockResolvedValue({ error: null });
  signUp.mockResolvedValue({ error: null });
  consultarLosTextosVigentes.mockResolvedValue({ aviso: '2026-09-1', terminos: '2026-10-1' });
  onAuthStateChange.mockImplementation(() => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  }));
});

afterEach(() => {
  vi.clearAllMocks();
  olvidarPreferenciaDePestana();
});

describe('registrarse', () => {
  it.each([
    ['sin ninguna', false, false],
    ['sin la del aviso de privacidad', false, true],
    ['sin la de los terminos', true, false],
  ])('%s, no llama a nadie y lo dice', async (_caso, aviso, terminos) => {
    await registrar(aviso, terminos);

    expect(resultado).toMatchObject({ ok: false });
    expect(resultado?.mensaje).toMatch(/aviso de privacidad y los términos/);
    expect(signUp).not.toHaveBeenCalled();
    expect(consultarLosTextosVigentes).not.toHaveBeenCalled();
  });

  it('con las dos casillas crea la identidad con la constancia de lo aceptado', async () => {
    await registrar(true, true);

    expect(resultado).toMatchObject({ ok: true });
    expect(signUp).toHaveBeenCalledTimes(1);

    const [peticion] = signUp.mock.calls[0] as [
      { email: string; password: string; options: { data: DatosDeLaIdentidad } },
    ];

    expect(peticion.email).toBe('ana@ejemplo.test');
    expect(peticion.options.data).toMatchObject({
      version_aviso: '2026-09-1',
      version_terminos: '2026-10-1',
    });
    expect(Date.parse(peticion.options.data.acepto_en)).not.toBeNaN();
  });

  it('las versiones salen de la API: el proveedor no las inventa', async () => {
    consultarLosTextosVigentes.mockResolvedValue({ aviso: '2027-01-1', terminos: '2027-02-2' });

    await registrar(true, true);

    const [peticion] = signUp.mock.calls[0] as [{ options: { data: DatosDeLaIdentidad } }];

    expect(peticion.options.data).toMatchObject({
      version_aviso: '2027-01-1',
      version_terminos: '2027-02-2',
    });
  });

  it('en la identidad no viaja nada personal mas: ni fecha de nacimiento ni nombre', async () => {
    await registrar(true, true);

    const [peticion] = signUp.mock.calls[0] as [{ options: { data: DatosDeLaIdentidad } }];

    expect(Object.keys(peticion.options.data).sort()).toEqual([
      'acepto_en',
      'version_aviso',
      'version_terminos',
    ]);
  });

  it('si no se pueden saber las versiones vigentes, no se crea nada', async () => {
    // Registrar con una version supuesta seria guardar un consentimiento que nadie
    // puede demostrar.
    consultarLosTextosVigentes.mockRejectedValue(new TypeError('Failed to fetch'));

    await registrar(true, true);

    expect(resultado).toMatchObject({ ok: false });
    expect(signUp).not.toHaveBeenCalled();
  });
});
