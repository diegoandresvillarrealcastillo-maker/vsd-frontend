import { IDBFactory } from 'fake-indexeddb';
import 'fake-indexeddb/auto';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Cuenta } from '../../infraestructura/api/cuenta.ts';
import { nuevaOperacion } from '../../sincronizacion/cola.ts';
import {
  alCambiarLaSesion,
  cicloActual,
  reiniciarElCicloParaLasPruebas,
} from '../../sincronizacion/ciclo.ts';
import { leerSoloLaCopia } from '../../sincronizacion/lecturas.ts';
import { CLAVE_DEL_PANEL, type DatosDelPanel } from '../../sincronizacion/panelLocal.ts';
import { useDatosDelPanel } from './useDatosDelPanel.ts';

/**
 * Lo que una preferencia que tarda no puede hacer cuando la sesion cambia (SCRUM-315, H-01 de la
 * revision del 29/10/2026).
 *
 * El hook, el ciclo y el almacen (IndexedDB simulado) son los de verdad; solo se controla cuando
 * responde la API. A empieza a cambiar una preferencia, sale, y entra B (o vuelve A). La respuesta
 * de A llega tarde: no puede acabar en la copia de nadie, ni cambiar lo que se ve, ni pedir nada
 * con la sesion de quien llego despues.
 */

const { darDeAlta, cambiarPreferencias, consultarElProgreso } = vi.hoisted(() => ({
  darDeAlta: vi.fn(),
  cambiarPreferencias: vi.fn(),
  consultarElProgreso: vi.fn(),
}));

vi.mock('../../infraestructura/api/aviso.ts', () => ({
  consultarLaVersionDelAviso: () => Promise.resolve('prueba'),
}));
vi.mock('../../infraestructura/api/cuenta.ts', () => ({
  darDeAltaLaCuenta: darDeAlta,
  consultarLaCuentaPropia: darDeAlta,
  cambiarPreferencias,
}));
vi.mock('../../infraestructura/api/progreso.ts', () => ({ consultarElProgreso }));

function cuentaDe(nombre: string, modulosActivos: Cuenta['modulosActivos']): Cuenta {
  return {
    id: `id-de-${nombre.toLowerCase()}`,
    correo: `${nombre.toLowerCase()}@example.test`,
    nombre,
    rol: 'usuario',
    consentimiento: { versionPolitica: 'prueba', aceptadoEn: '2026-10-28T12:00:00Z' },
    registradoEn: '2026-10-28T12:00:00Z',
    modulosActivos,
    mascota: null,
    diarioConRecomendaciones: false,
    acompanamientoPorDias: false,
    zonaHoraria: 'America/Bogota',
  };
}

const CUENTA_A = cuentaDe('PRIVADO_A', ['cognicion']);
const CUENTA_A_DESPUES = cuentaDe('PRIVADO_A', ['cognicion', 'emociones']);

/** La sesion de A, con el panel leido, y un cambio de preferencias suyo que todavia no responde. */
async function empezarComoA(cambio: 'activarModulo' | 'completarBienvenida') {
  await alCambiarLaSesion('persona-a', { persistente: true });
  darDeAlta.mockResolvedValue(CUENTA_A);
  consultarElProgreso.mockResolvedValue([]);

  let responder!: (cuenta: Cuenta) => void;

  cambiarPreferencias.mockReturnValue(
    new Promise<Cuenta>((resolver) => {
      responder = resolver;
    }),
  );

  const hook = renderHook(() => useDatosDelPanel());

  await waitFor(() => {
    expect(hook.result.current.estado.fase).toBe('listo');
  });

  let pendiente!: Promise<void>;

  act(() => {
    pendiente =
      cambio === 'activarModulo'
        ? hook.result.current.activarModulo('emociones')
        : hook.result.current.completarBienvenida({ nombre: 'Ana', modulos: ['emociones'] });
  });
  expect(cambiarPreferencias).toHaveBeenCalledOnce();

  return { hook, pendiente, responder };
}

/**
 * Deja pasar lo que una escritura tardia necesitaria para llegar al almacen simulado. El guardado de
 * la copia no se espera (`void guardarElPanel`), asi que sin esto "no se guardo nada" podria cumplirse
 * solo porque se miro demasiado pronto.
 */
async function dejarPasarLoPendiente(): Promise<void> {
  for (let vuelta = 0; vuelta < 5; vuelta += 1) {
    await new Promise<void>((seguir) => setTimeout(seguir, 10));
  }
}

/** Llega la respuesta de A, que tardaba, y se deja pasar todo lo que dispare. */
async function llegaLaRespuestaDeA(
  responder: (cuenta: Cuenta) => void,
  pendiente: Promise<void>,
): Promise<void> {
  await act(async () => {
    responder(CUENTA_A_DESPUES);
    await pendiente;
    await dejarPasarLoPendiente();
  });
}

/** Cuantas veces se pidio el progreso: la lectura del panel de A, y nada mas. */
const SOLO_LA_LECTURA_INICIAL = 1;

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  reiniciarElCicloParaLasPruebas();
  vi.clearAllMocks();
});

afterEach(async () => {
  cleanup();
  await alCambiarLaSesion(null, { persistente: true });
  reiniciarElCicloParaLasPruebas();
});

describe.each(['activarModulo', 'completarBienvenida'] as const)(
  'una preferencia de A que tarda (%s)',
  (cambio) => {
    it('que termina cuando ya entro B no deja nada de A en la copia de B', async () => {
      const { hook, pendiente, responder } = await empezarComoA(cambio);

      hook.unmount();
      await alCambiarLaSesion(null, { persistente: true });
      await alCambiarLaSesion('persona-b', { persistente: true });
      expect(cicloActual()?.persona).toBe('persona-b');

      await llegaLaRespuestaDeA(responder, pendiente);

      // La copia de B queda vacia: ni la cuenta de A, ni su progreso.
      expect(await leerSoloLaCopia<DatosDelPanel>(CLAVE_DEL_PANEL)).toBeNull();
      // Y no se le pidio el progreso a nadie con la sesion de B.
      expect(consultarElProgreso).toHaveBeenCalledTimes(SOLO_LA_LECTURA_INICIAL);
    });

    it('que termina cuando A volvio a entrar tampoco la guarda: comparar la persona no basta', async () => {
      const { hook, pendiente, responder } = await empezarComoA(cambio);

      hook.unmount();
      await alCambiarLaSesion(null, { persistente: true });
      await alCambiarLaSesion('persona-a', { persistente: true });

      await llegaLaRespuestaDeA(responder, pendiente);

      // Lo que A tenia guardado al leer el panel sigue igual: el cambio tardio no se aplica.
      const copia = await leerSoloLaCopia<DatosDelPanel>(CLAVE_DEL_PANEL);

      expect(copia?.cuenta.modulosActivos).toEqual(['cognicion']);
      expect(consultarElProgreso).toHaveBeenCalledTimes(SOLO_LA_LECTURA_INICIAL);
    });

    it('que ya cambio la cuenta pero espera el progreso cuando la sesion cambia, tampoco se guarda', async () => {
      await alCambiarLaSesion('persona-a', { persistente: true });
      darDeAlta.mockResolvedValue(CUENTA_A);
      cambiarPreferencias.mockResolvedValue(CUENTA_A_DESPUES);

      let darElProgreso!: (progreso: []) => void;

      consultarElProgreso.mockResolvedValueOnce([]).mockReturnValueOnce(
        new Promise<[]>((resolver) => {
          darElProgreso = resolver;
        }),
      );

      const hook = renderHook(() => useDatosDelPanel());

      await waitFor(() => {
        expect(hook.result.current.estado.fase).toBe('listo');
      });

      let pendiente!: Promise<void>;

      act(() => {
        pendiente =
          cambio === 'activarModulo'
            ? hook.result.current.activarModulo('emociones')
            : hook.result.current.completarBienvenida({ nombre: 'Ana', modulos: ['emociones'] });
      });
      await waitFor(() => {
        expect(consultarElProgreso).toHaveBeenCalledTimes(2);
      });

      hook.unmount();
      await alCambiarLaSesion(null, { persistente: true });
      await alCambiarLaSesion('persona-b', { persistente: true });

      await act(async () => {
        darElProgreso([]);
        await pendiente;
        await dejarPasarLoPendiente();
      });

      expect(await leerSoloLaCopia<DatosDelPanel>(CLAVE_DEL_PANEL)).toBeNull();
    });

    it('que termina cuando ya salio no cambia lo que se ve ni falla', async () => {
      const { hook, pendiente, responder } = await empezarComoA(cambio);

      await alCambiarLaSesion(null, { persistente: true });

      await expect(llegaLaRespuestaDeA(responder, pendiente)).resolves.toBeUndefined();

      const estado = hook.result.current.estado;

      expect(estado.fase === 'listo' && estado.cuenta.modulosActivos).toEqual(['cognicion']);
    });

    it('que termina despues de desmontar, con la misma sesion, no toca la copia', async () => {
      const { hook, pendiente, responder } = await empezarComoA(cambio);

      hook.unmount();

      await expect(llegaLaRespuestaDeA(responder, pendiente)).resolves.toBeUndefined();

      const copia = await leerSoloLaCopia<DatosDelPanel>(CLAVE_DEL_PANEL);

      expect(copia?.cuenta.modulosActivos).toEqual(['cognicion']);
    });

    it('las dos peticiones salen con el contexto de A: dejan de valer cuando la sesion cambia', async () => {
      const { pendiente, responder } = await empezarComoA(cambio);

      const [, senalDeLaPreferencia, contextoDeLaPreferencia] = cambiarPreferencias.mock
        .calls[0] as [unknown, AbortSignal, { persona: string; vigente: () => boolean }];

      expect(senalDeLaPreferencia).toBeInstanceOf(AbortSignal);
      expect(contextoDeLaPreferencia.persona).toBe('persona-a');
      expect(contextoDeLaPreferencia.vigente()).toBe(true);

      // La segunda peticion existe solo si la sesion sigue siendo la misma: se comprueba con A.
      await act(async () => {
        responder(CUENTA_A_DESPUES);
        await pendiente;
      });

      const [senalDelProgreso, contextoDelProgreso] = consultarElProgreso.mock.calls[1] as [
        AbortSignal,
        { persona: string; vigente: () => boolean },
      ];

      expect(senalDelProgreso).toBeInstanceOf(AbortSignal);
      expect(contextoDelProgreso.persona).toBe('persona-a');
      expect(contextoDelProgreso.vigente()).toBe(true);

      await alCambiarLaSesion(null, { persistente: true });

      expect(contextoDeLaPreferencia.vigente()).toBe(false);
      expect(contextoDelProgreso.vigente()).toBe(false);
    });

    it('con la sesion de siempre se muestra y se guarda como antes', async () => {
      const { hook, pendiente, responder } = await empezarComoA(cambio);

      await llegaLaRespuestaDeA(responder, pendiente);

      const estado = hook.result.current.estado;

      expect(estado.fase === 'listo' && estado.cuenta.modulosActivos).toEqual([
        'cognicion',
        'emociones',
      ]);
      await waitFor(async () => {
        const copia = await leerSoloLaCopia<DatosDelPanel>(CLAVE_DEL_PANEL);

        expect(copia?.cuenta.modulosActivos).toEqual(['cognicion', 'emociones']);
      });
    });

    it('si falla con la sesion de siempre, el error le llega a quien pulso', async () => {
      await alCambiarLaSesion('persona-a', { persistente: true });
      darDeAlta.mockResolvedValue(CUENTA_A);
      consultarElProgreso.mockResolvedValue([]);
      cambiarPreferencias.mockRejectedValue(new Error('sin conexion'));

      const hook = renderHook(() => useDatosDelPanel());

      await waitFor(() => {
        expect(hook.result.current.estado.fase).toBe('listo');
      });

      await expect(
        cambio === 'activarModulo'
          ? hook.result.current.activarModulo('emociones')
          : hook.result.current.completarBienvenida({ nombre: '', modulos: ['emociones'] }),
      ).rejects.toThrow('sin conexion');
    });
  },
);

describe('lo pendiente de cada persona se conserva', () => {
  it('la cola de B sigue ahi cuando llega tarde la respuesta de A', async () => {
    const { hook, pendiente, responder } = await empezarComoA('activarModulo');

    hook.unmount();
    await alCambiarLaSesion(null, { persistente: true });
    await alCambiarLaSesion('persona-b', { persistente: true });
    await cicloActual()?.almacen.agregarOperacion(
      nuevaOperacion(
        {
          operationId: 'operacion-de-b',
          tipo: 'diario.escribir',
          entidad: 'diario:b',
          payload: { contenido: 'PRIVADO_B' },
        },
        new Date(),
      ),
    );

    await llegaLaRespuestaDeA(responder, pendiente);

    const operaciones = (await cicloActual()?.almacen.operaciones()) ?? [];

    expect(operaciones.map((operacion) => operacion.operationId)).toEqual(['operacion-de-b']);
  });

  it('lo que A dejo pendiente sigue en su almacen cuando vuelve', async () => {
    const { hook, pendiente, responder } = await empezarComoA('activarModulo');

    await cicloActual()?.almacen.agregarOperacion(
      nuevaOperacion(
        {
          operationId: 'operacion-de-a',
          tipo: 'diario.escribir',
          entidad: 'diario:a',
          payload: { contenido: 'PENDIENTE_DE_A' },
        },
        new Date(),
      ),
    );
    hook.unmount();
    await alCambiarLaSesion(null, { persistente: true });
    await llegaLaRespuestaDeA(responder, pendiente);
    await alCambiarLaSesion('persona-a', { persistente: true });

    const operaciones = (await cicloActual()?.almacen.operaciones()) ?? [];

    expect(operaciones.map((operacion) => operacion.operationId)).toEqual(['operacion-de-a']);
  });
});
