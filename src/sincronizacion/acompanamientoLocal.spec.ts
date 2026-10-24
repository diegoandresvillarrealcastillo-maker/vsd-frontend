import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CLAVE_DEL_ACOMPANAMIENTO,
  comoAcompanamiento,
  leerElAcompanamiento,
} from './acompanamientoLocal.ts';
import { alCambiarLaSesion, reiniciarElCicloParaLasPruebas } from './ciclo.ts';
import { leerSoloLaCopia } from './lecturas.ts';

/**
 * El acompanamiento con copia en este dispositivo (SCRUM-177): se lee del servidor y se guarda solo el
 * nivel y las lineas, para que sin conexion se siga viendo lo ultimo que se supo.
 */
const { consultarElAcompanamiento } = vi.hoisted(() => ({ consultarElAcompanamiento: vi.fn() }));

vi.mock('../infraestructura/api/acompanamiento.ts', () => ({ consultarElAcompanamiento }));

const NO_RECORDADA = { persistente: false };
const LINEA = { id: 'l-1', titulo: 'Línea 192, opción 4', tipo: 'contacto', cobertura: 'nacional' };
const CRITICO = { nivel: 'critico', lineasDeAtencion: [LINEA] };

beforeEach(async () => {
  consultarElAcompanamiento.mockResolvedValue(CRITICO);
  reiniciarElCicloParaLasPruebas();
  await alCambiarLaSesion('ana', NO_RECORDADA);
});

afterEach(() => {
  vi.clearAllMocks();
  reiniciarElCicloParaLasPruebas();
});

describe('leerElAcompanamiento', () => {
  it('lee del servidor y deja guardado solo el nivel y las lineas', async () => {
    const lectura = await leerElAcompanamiento();

    expect(lectura.valor).toEqual(CRITICO);
    expect(lectura.deLaCopia).toBe(false);
    expect(await leerSoloLaCopia(CLAVE_DEL_ACOMPANAMIENTO)).toEqual(CRITICO);
  });

  it('sin conexion, devuelve la copia y dice que lo es: las lineas siguen a mano', async () => {
    await leerElAcompanamiento();
    consultarElAcompanamiento.mockRejectedValue(new TypeError('Failed to fetch'));

    const lectura = await leerElAcompanamiento();

    expect(lectura.valor).toEqual(CRITICO);
    expect(lectura.deLaCopia).toBe(true);
  });

  it('sin conexion y sin copia, falla: nunca se inventa un aviso', async () => {
    consultarElAcompanamiento.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(leerElAcompanamiento()).rejects.toBeInstanceOf(TypeError);
  });

  it('lo que llega con otra forma se lee como «ninguno» y no rompe nada', async () => {
    consultarElAcompanamiento.mockResolvedValue({ nivel: 'urgente', lineasDeAtencion: [LINEA] });

    expect((await leerElAcompanamiento()).valor).toEqual({
      nivel: 'ninguno',
      lineasDeAtencion: [],
    });
  });
});

describe('comoAcompanamiento', () => {
  it.each([['ninguno'], ['moderado'], ['critico']])('entiende el nivel %s', (nivel) => {
    expect(comoAcompanamiento({ nivel, lineasDeAtencion: [] }).nivel).toBe(nivel);
  });

  it.each([[null], [undefined], [7], ['critico'], [[]], [{}], [{ nivel: 3 }], [{ nivel: 'otro' }]])(
    '%j se lee como «ninguno»: nunca se inventa un aviso',
    (basura) => {
      expect(comoAcompanamiento(basura)).toEqual({ nivel: 'ninguno', lineasDeAtencion: [] });
    },
  );

  it('deja fuera las lineas sin identificador, titulo o tipo, y conserva las demas', () => {
    const lectura = comoAcompanamiento({
      nivel: 'critico',
      lineasDeAtencion: [LINEA, { id: '', titulo: 'x', tipo: 'contacto' }, { id: 'a' }, 7, null],
    });

    expect(lectura.lineasDeAtencion).toEqual([LINEA]);
  });

  it('sin lista de lineas, una vacia: la pantalla usa las de respaldo del pais', () => {
    expect(comoAcompanamiento({ nivel: 'critico' }).lineasDeAtencion).toEqual([]);
  });
});
