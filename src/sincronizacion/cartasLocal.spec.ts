import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { alCambiarLaSesion, cicloActual, reiniciarElCicloParaLasPruebas } from './ciclo.ts';
import {
  CLAVE_DE_LAS_CARTAS_EN_ESPERA,
  leerLasCartasEnEspera,
  quitarLaCartaDeLaCopia,
} from './cartasLocal.ts';
import { nuevaOperacion, type Operacion } from './cola.ts';
import { leerSoloLaCopia } from './lecturas.ts';

/**
 * Las cartas que esperan, con copia en este dispositivo (SCRUM-230): se lee del servidor y se guarda solo
 * el identificador y el dia, para que la tarjeta aparezca y se pueda borrar sin conexion.
 */
const { consultarCartasEnEspera } = vi.hoisted(() => ({ consultarCartasEnEspera: vi.fn() }));

vi.mock('../infraestructura/api/diario.ts', async (importar) => ({
  ...(await importar<typeof import('../infraestructura/api/diario.ts')>()),
  consultarCartasEnEspera,
}));

const NO_RECORDADA = { persistente: false };
const AYER = { id: 'c-ayer', dia: '2026-10-22' };
const ANTES = { id: 'c-antes', dia: '2026-10-20' };

let contador = 0;

/** Una operacion en la cola, en el estado que se diga. */
async function agregar(
  tipo: Operacion['tipo'],
  payload: unknown,
  cambios: Partial<Operacion> = {},
): Promise<void> {
  contador += 1;

  const almacen = cicloActual()!.almacen;
  const agregada = await almacen.agregarOperacion(
    nuevaOperacion(
      {
        operationId: `op-${String(contador)}`,
        tipo,
        entidad: `diario:e-${String(contador)}`,
        payload,
      },
      new Date('2026-10-23T11:30:00.000Z'),
    ),
  );

  await almacen.guardarOperacion({ ...agregada, ...cambios });
}

beforeEach(async () => {
  contador = 0;
  consultarCartasEnEspera.mockResolvedValue([AYER, ANTES]);
  reiniciarElCicloParaLasPruebas();
  await alCambiarLaSesion('ana', NO_RECORDADA);
});

afterEach(() => {
  vi.clearAllMocks();
  reiniciarElCicloParaLasPruebas();
});

describe('leerLasCartasEnEspera', () => {
  it('lee del servidor y deja guardado solo el identificador y el dia', async () => {
    const lectura = await leerLasCartasEnEspera();

    expect(lectura.valor).toEqual([AYER, ANTES]);
    expect(lectura.deLaCopia).toBe(false);
    expect(await leerSoloLaCopia(CLAVE_DE_LAS_CARTAS_EN_ESPERA)).toEqual([AYER, ANTES]);
  });

  it('sin conexion, devuelve la copia y dice que lo es', async () => {
    await leerLasCartasEnEspera();
    consultarCartasEnEspera.mockRejectedValue(new TypeError('Failed to fetch'));

    const lectura = await leerLasCartasEnEspera();

    expect(lectura.valor).toEqual([AYER, ANTES]);
    expect(lectura.deLaCopia).toBe(true);
  });

  it('sin conexion y sin copia, falla: nunca se inventa una carta', async () => {
    consultarCartasEnEspera.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(leerLasCartasEnEspera()).rejects.toBeInstanceOf(TypeError);
  });

  it('una carta que ya se mando borrar desde este equipo no vuelve a ofrecerse, aunque el servidor la tenga', async () => {
    await agregar('diario.borrar', { id: AYER.id });

    const lectura = await leerLasCartasEnEspera();

    expect(lectura.valor).toEqual([ANTES]);
  });

  it('el borrado ya enviado no esconde nada: el servidor ya no la trae', async () => {
    await agregar('diario.borrar', { id: AYER.id }, { estado: 'hecha' });

    expect((await leerLasCartasEnEspera()).valor).toEqual([AYER, ANTES]);
  });

  it('lo guardado que no tiene la forma de una carta se deja fuera', async () => {
    consultarCartasEnEspera.mockResolvedValue([
      AYER,
      { id: '', dia: '2026-10-21' },
      { id: 'x' },
      7,
    ]);

    expect((await leerLasCartasEnEspera()).valor).toEqual([AYER]);
  });
});

describe('quitarLaCartaDeLaCopia', () => {
  it('la saca de la copia: sin conexion no vuelve a ofrecerse', async () => {
    await leerLasCartasEnEspera();

    await quitarLaCartaDeLaCopia(AYER.id);

    expect(await leerSoloLaCopia(CLAVE_DE_LAS_CARTAS_EN_ESPERA)).toEqual([ANTES]);
  });

  it('sin copia no hace nada y no falla', async () => {
    await expect(quitarLaCartaDeLaCopia(AYER.id)).resolves.toBeUndefined();

    expect(await leerSoloLaCopia(CLAVE_DE_LAS_CARTAS_EN_ESPERA)).toBeNull();
  });

  it('una que no esta no cambia las demas', async () => {
    await leerLasCartasEnEspera();

    await quitarLaCartaDeLaCopia('c-otra');

    expect(await leerSoloLaCopia(CLAVE_DE_LAS_CARTAS_EN_ESPERA)).toEqual([AYER, ANTES]);
  });
});
