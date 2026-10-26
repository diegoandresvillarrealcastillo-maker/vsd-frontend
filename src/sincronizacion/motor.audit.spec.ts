import { IDBFactory } from 'fake-indexeddb';
import 'fake-indexeddb/auto';
import { afterEach, expect, it, vi } from 'vitest';
import { alCambiarLaSesion, cicloActual, reiniciarElCicloParaLasPruebas } from './ciclo.ts';
import { nuevaOperacion } from './cola.ts';
const auth = vi.hoisted(() => ({ persona: 'audit-A' }));
vi.mock('../infraestructura/supabase/cliente.ts', () => ({
  supabase: () => ({
    auth: {
      getSession: () =>
        Promise.resolve({
          data: { session: { user: { id: auth.persona }, access_token: 'fake-' + auth.persona } },
        }),
    },
  }),
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  reiniciarElCicloParaLasPruebas();
});
it('audit: motor must not send A payload authenticated as B after IndexedDB await', async () => {
  globalThis.indexedDB = new IDBFactory();
  reiniciarElCicloParaLasPruebas();
  auth.persona = 'audit-A';
  const sent: { token: string | null; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const direccion = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
      if (direccion.endsWith('/health'))
        return Promise.resolve(new Response('{}', { status: 200 }));
      sent.push({
        token: new Headers(init?.headers).get('Authorization'),
        body: JSON.parse(init?.body as string),
      });
      return Promise.resolve(
        new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );
    }),
  );
  await alCambiarLaSesion('audit-A', { persistente: true });
  const a = cicloActual()!;
  await a.almacen.agregarOperacion(
    nuevaOperacion(
      {
        operationId: '11111111-1111-4111-8111-111111111111',
        tipo: 'diario.escribir',
        entidad: 'diario:A',
        payload: {
          clientOperationId: '11111111-1111-4111-8111-111111111111',
          dia: '2026-10-25',
          titulo: 'PRIVADO_DE_A',
          contenido: { type: 'doc', content: [] },
        },
      },
      new Date(),
    ),
  );
  let enter!: () => void;
  let release!: () => void;
  const entered = new Promise<void>((r) => {
    enter = r;
  });
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const original = a.almacen.guardarOperacion.bind(a.almacen);
  vi.spyOn(a.almacen, 'guardarOperacion').mockImplementationOnce(async (op) => {
    await original(op);
    enter();
    await gate;
  });
  const pending = a.motor.sincronizar('manual').catch(() => undefined);
  await entered;
  auth.persona = 'audit-B';
  await alCambiarLaSesion('audit-B', { persistente: true });
  release();
  await pending;
  expect(sent).toEqual([]);
});
