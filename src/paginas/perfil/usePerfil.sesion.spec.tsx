import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { olvidarLosArchivosDeLaPersona } from '../../foto/archivosDeLaPersona.ts';
import { sincronizarLaFoto, useFotoDePerfil } from '../../foto/fotoDePerfil.ts';
import type { Cuenta } from '../../infraestructura/api/cuenta.ts';
import { CLAVE_DE_LA_MASCOTA_DE_LA_CARGA } from '../../mascota/mascotaDeLaCarga.ts';
import { alCambiarLaSesion, reiniciarElCicloParaLasPruebas } from '../../sincronizacion/ciclo.ts';
import { usePerfil } from './usePerfil.ts';

/**
 * Los guardados del perfil (nombre, modulos, mascota elegida, diario, acompanamiento) cuando la
 * sesion cambia a mitad, en la misma linea que SCRUM-315 a 317.
 *
 * El cliente HTTP, los archivos de la persona y el ciclo son los de verdad; solo se simulan el
 * servidor (`fetch`) y quien es la sesion de Supabase. A guarda algo, sale, entra B y despues
 * contesta el servidor. Lo de A no puede dejar su mascota ni su foto en lo que ve B.
 */

const { identidad } = vi.hoisted(() => {
  const quien: { id: string | null; token: string } = { id: 'persona-a', token: 'token-de-a' };

  return { identidad: quien };
});

vi.mock('../../infraestructura/entorno.ts', () => ({
  entorno: { urlDeLaApi: 'https://api.example.test' },
}));
vi.mock('../../infraestructura/supabase/cliente.ts', () => ({
  supabase: () => ({
    auth: {
      getSession: () =>
        Promise.resolve({
          data: {
            session:
              identidad.id === null
                ? null
                : { user: { id: identidad.id }, access_token: identidad.token },
          },
        }),
      signOut: () => Promise.resolve({ error: null }),
    },
  }),
}));

function cuentaDe(id: string, extra: Partial<Cuenta> = {}): Cuenta {
  return {
    id,
    correo: `${id}@example.test`,
    nombre: id,
    rol: 'usuario',
    consentimiento: { versionPolitica: 'prueba', aceptadoEn: '2026-10-28T12:00:00Z' },
    registradoEn: '2026-10-28T12:00:00Z',
    modulosActivos: ['cognicion'],
    mascota: null,
    diarioConRecomendaciones: false,
    acompanamientoPorDias: false,
    zonaHoraria: 'America/Bogota',
    foto: null,
    mascotaPropia: null,
    ...extra,
  };
}

const MARCA = '2026-10-29T12:00:00Z';
const CAMBIOS = { mascota: { forma: 'gato', nombre: 'Michi' } };
/** Lo que contesta el servidor a A: su mascota elegida y una foto suya. */
const RESPUESTA_PARA_A = cuentaDe('persona-a', {
  mascota: CAMBIOS.mascota,
  foto: { actualizadaEl: MARCA },
});
const CUENTA_B = cuentaDe('persona-b', { foto: { actualizadaEl: MARCA } });
const FOTO_DE_B = new Blob(['FOTO_DE_B'], { type: 'image/jpeg' });

/** Lo que mandaria el navegador, y como contestarlo cuando el servidor quiera. */
interface Peticion {
  readonly metodo: string;
  readonly ruta: string;
  readonly autorizacion: string | null;
  readonly responder: (cuerpo: unknown) => void;
}

let peticiones: Peticion[];

function laSolicitud(metodo: string, ruta: string): Peticion | undefined {
  return peticiones.find((una) => una.metodo === metodo && una.ruta.endsWith(ruta));
}

const PREFERENCIAS = '/api/cuenta/preferencias';

/** Empieza a guardar y devuelve como termino: `'guardado'` o el error con el que se cayo. */
function empezarAGuardar(guardar: () => Promise<void>): Promise<unknown> {
  let termino: Promise<unknown> = Promise.resolve();

  act(() => {
    termino = guardar().then(
      () => 'guardado',
      (error: unknown) => error,
    );
  });

  return termino;
}

/** Sale A y entra B, como lo hace la sesion: se olvida lo de A y B llega con su foto. */
async function entraB(): Promise<void> {
  olvidarLosArchivosDeLaPersona();
  identidad.id = null;
  await alCambiarLaSesion(null, { persistente: false });
  identidad.id = 'persona-b';
  identidad.token = 'token-de-b';
  await alCambiarLaSesion('persona-b', { persistente: false });
  act(() => {
    sincronizarLaFoto(CUENTA_B, FOTO_DE_B);
  });
}

async function dejarPasarLoPendiente(): Promise<void> {
  for (let vuelta = 0; vuelta < 5; vuelta += 1) {
    await act(async () => {
      await new Promise<void>((seguir) => setTimeout(seguir, 10));
    });
  }
}

beforeEach(async () => {
  reiniciarElCicloParaLasPruebas();
  identidad.id = 'persona-a';
  identidad.token = 'token-de-a';
  await alCambiarLaSesion('persona-a', { persistente: false });
  peticiones = [];
  localStorage.clear();
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:otra');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(
      (entrada, opciones) =>
        new Promise<Response>((resolver, rechazar) => {
          const cabeceras = opciones?.headers as Headers;

          peticiones.push({
            metodo: opciones?.method ?? 'GET',
            ruta:
              typeof entrada === 'string'
                ? entrada
                : entrada instanceof URL
                  ? entrada.href
                  : entrada.url,
            autorizacion: cabeceras.get('Authorization'),
            responder: (cuerpo) => {
              resolver(Response.json(cuerpo));
            },
          });
          opciones?.signal?.addEventListener('abort', () => {
            rechazar(new DOMException('abortado', 'AbortError'));
          });
        }),
    ),
  );
});

afterEach(() => {
  cleanup();
  olvidarLosArchivosDeLaPersona();
  reiniciarElCicloParaLasPruebas();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('usePerfil: guardar cuando la sesion cambia a mitad', () => {
  it('con la sesion de siempre lo guarda con el token de quien lo pidio y deja su mascota', async () => {
    const { result } = renderHook(() => usePerfil());
    const termino = empezarAGuardar(() => result.current.guardar(CAMBIOS));

    await waitFor(() => {
      expect(laSolicitud('PATCH', PREFERENCIAS)).toBeDefined();
    });
    expect(laSolicitud('PATCH', PREFERENCIAS)?.autorizacion).toBe('Bearer token-de-a');

    act(() => {
      laSolicitud('PATCH', PREFERENCIAS)?.responder(RESPUESTA_PARA_A);
    });

    expect(await termino).toBe('guardado');
    expect(localStorage.getItem(CLAVE_DE_LA_MASCOTA_DE_LA_CARGA)).toBe('gato');
  });

  it('sin sesion anotada (la pantalla sola) sigue guardando como siempre', async () => {
    reiniciarElCicloParaLasPruebas();

    const { result } = renderHook(() => usePerfil());
    const termino = empezarAGuardar(() => result.current.guardar(CAMBIOS));

    await waitFor(() => {
      expect(laSolicitud('PATCH', PREFERENCIAS)).toBeDefined();
    });
    act(() => {
      laSolicitud('PATCH', PREFERENCIAS)?.responder(RESPUESTA_PARA_A);
    });

    expect(await termino).toBe('guardado');
  });

  it('si A sale y entra B antes de que conteste el servidor, lo de A no llega a lo que ve B', async () => {
    const { result } = renderHook(() => ({ perfil: usePerfil(), foto: useFotoDePerfil() }));
    const termino = empezarAGuardar(() => result.current.perfil.guardar(CAMBIOS));

    await waitFor(() => {
      expect(laSolicitud('PATCH', PREFERENCIAS)).toBeDefined();
    });
    await entraB();

    expect(result.current.foto).toBe('blob:otra');

    act(() => {
      laSolicitud('PATCH', PREFERENCIAS)?.responder(RESPUESTA_PARA_A);
    });
    await dejarPasarLoPendiente();

    // La mascota de la pantalla de carga es de quien entro despues, no de A.
    expect(localStorage.getItem(CLAVE_DE_LA_MASCOTA_DE_LA_CARGA)).toBeNull();
    // La foto de B sigue a la vista y no se pidio ninguna con el token de B por una cuenta ajena.
    expect(result.current.foto).toBe('blob:otra');
    expect(peticiones.filter((una) => una.ruta.endsWith('/api/cuenta/foto'))).toEqual([]);
    expect(await termino).toMatchObject({ name: 'AbortError' });
  });

  it('si A sale y vuelve a entrar, lo que pidio antes de salir tampoco se aplica', async () => {
    const { result } = renderHook(() => usePerfil());
    const termino = empezarAGuardar(() => result.current.guardar(CAMBIOS));

    await waitFor(() => {
      expect(laSolicitud('PATCH', PREFERENCIAS)).toBeDefined();
    });
    olvidarLosArchivosDeLaPersona();
    identidad.id = null;
    await alCambiarLaSesion(null, { persistente: false });
    identidad.id = 'persona-a';
    identidad.token = 'token-de-a-otra-vez';
    await alCambiarLaSesion('persona-a', { persistente: false });
    act(() => {
      laSolicitud('PATCH', PREFERENCIAS)?.responder(RESPUESTA_PARA_A);
    });
    await dejarPasarLoPendiente();

    expect(await termino).toMatchObject({ name: 'AbortError' });
    expect(localStorage.getItem(CLAVE_DE_LA_MASCOTA_DE_LA_CARGA)).toBeNull();
  });

  it('si el token se renueva dentro de la misma sesion, la respuesta se aplica', async () => {
    const { result } = renderHook(() => usePerfil());
    const termino = empezarAGuardar(() => result.current.guardar(CAMBIOS));

    await waitFor(() => {
      expect(laSolicitud('PATCH', PREFERENCIAS)).toBeDefined();
    });
    identidad.token = 'token-renovado-de-a';
    act(() => {
      laSolicitud('PATCH', PREFERENCIAS)?.responder(RESPUESTA_PARA_A);
    });

    expect(await termino).toBe('guardado');
    expect(localStorage.getItem(CLAVE_DE_LA_MASCOTA_DE_LA_CARGA)).toBe('gato');
  });
});
