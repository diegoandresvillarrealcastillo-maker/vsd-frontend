import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SesionPublicada } from '../infraestructura/api/sesionesPublicadas.ts';
import {
  buscarSesionPublicadaConCopia,
  claveDelSendero,
  consultarSesionesHechasConCopia,
  precargarLosSenderos,
  traerSesionesPublicadasConCopia,
} from './sesionesPublicadasLocal.ts';

const { buscar, hechas, leerSiCambio, cola, leerConCopia, leerSoloLaCopia } = vi.hoisted(() => ({
  buscar: vi.fn(),
  hechas: vi.fn(),
  leerSiCambio: vi.fn(),
  cola: vi.fn(),
  leerConCopia: vi.fn(),
  leerSoloLaCopia: vi.fn(),
}));

vi.mock('../infraestructura/api/sesionesPublicadas.ts', () => ({
  buscarSesionPublicada: buscar,
  consultarSesionesHechas: hechas,
}));
vi.mock('../infraestructura/api/clienteHttp.ts', () => ({ leerSiCambio }));
vi.mock('./panelLocal.ts', () => ({ leerLosResultadosDeLaCola: cola }));
vi.mock('./lecturas.ts', () => ({ leerConCopia, leerSoloLaCopia }));

const sesion = (id: string, parametros?: Readonly<Record<string, unknown>>): SesionPublicada => ({
  id,
  idActividad: `actividad-${id}`,
  titulo: `Sesion ${id}`,
  actividad: `Actividad ${id}`,
  nivel: 1,
  ...(parametros ? { parametros } : {}),
});

beforeEach(() => {
  vi.clearAllMocks();
  cola.mockResolvedValue([]);
  leerSoloLaCopia.mockResolvedValue(null);
  leerConCopia.mockImplementation(
    async (_key: string, traer: (etag: string | null) => Promise<unknown>) => {
      const respuesta = await traer(null);
      const valor =
        typeof respuesta === 'object' && respuesta !== null && 'valor' in respuesta
          ? respuesta.valor
          : respuesta;
      return { valor, deLaCopia: false, guardadoEn: null };
    },
  );
});

describe('sesionesPublicadasLocal', () => {
  it('lee catálogo con y sin señal, usando una copia nueva del catálogo', async () => {
    const senal = new AbortController().signal;
    leerSiCambio.mockResolvedValue({ estado: 'nuevo', valor: [sesion('s1')], etag: 'e1' });
    expect(claveDelSendero('emociones')).toBe('sendero:sesiones:emociones');
    await traerSesionesPublicadasConCopia('emociones', senal);
    expect(leerSiCambio).toHaveBeenCalledWith('/api/catalogo/sesiones/emociones', {
      etag: null,
      senal,
    });
    await traerSesionesPublicadasConCopia('bienestar');
    expect(leerSiCambio).toHaveBeenLastCalledWith('/api/catalogo/sesiones/bienestar', {
      etag: null,
    });
  });

  it('combina avances locales y remotos, filtra IDs de otro módulo y elimina duplicados', async () => {
    hechas.mockResolvedValue(['s1', 'otra', 's1']);
    cola.mockResolvedValue([
      { tipo: 'resultado.registrar', payload: { idSesion: 's2' } },
      { tipo: 'resultado.registrar', payload: { idSesion: 'otra' } },
      { tipo: 'resultado.registrar', payload: { idSesion: 4 } },
      { tipo: 'otra.operacion', payload: { idSesion: 's1' } },
      { tipo: 'resultado.registrar', payload: null },
    ]);
    await expect(
      consultarSesionesHechasConCopia('cognicion', [sesion('s1'), sesion('s2')]),
    ).resolves.toEqual(['s1', 's2']);
  });

  it('mantiene el avance local sin red y propaga una cancelación', async () => {
    leerConCopia.mockRejectedValue(new TypeError('sin conexión'));
    cola.mockResolvedValue([{ tipo: 'resultado.registrar', payload: { idSesion: 's1' } }]);
    await expect(consultarSesionesHechasConCopia('bienestar', [sesion('s1')])).resolves.toEqual([
      's1',
    ]);
    const controller = new AbortController();
    controller.abort();
    await expect(
      consultarSesionesHechasConCopia('bienestar', [sesion('s1')], controller.signal),
    ).rejects.toThrow('sin conexión');
  });

  it('abre parámetros desde el catálogo guardado sin llamar al servidor', async () => {
    leerSoloLaCopia.mockImplementation((key: string) =>
      key === claveDelSendero('emociones')
        ? [sesion('s1', { mecanismo: 'parejas', cartas: ['a', 'b'] })]
        : null,
    );
    await expect(buscarSesionPublicadaConCopia('s1')).resolves.toEqual({
      id: 's1',
      idActividad: 'actividad-s1',
      titulo: 'Sesion s1',
      nivel: 1,
      parametros: { mecanismo: 'parejas', cartas: ['a', 'b'] },
    });
    expect(buscar).not.toHaveBeenCalled();
  });

  it('usa la búsqueda de respaldo si falta contenido local o la sesión no está en caché', async () => {
    leerSoloLaCopia.mockResolvedValue([sesion('legacy')]);
    buscar.mockResolvedValue({
      id: 'legacy',
      idActividad: 'actividad-legacy',
      titulo: 'Sesion legacy',
      nivel: 1,
      parametros: { paso: 1 },
    });
    await expect(buscarSesionPublicadaConCopia('legacy')).resolves.toMatchObject({
      id: 'legacy',
      parametros: { paso: 1 },
    });
    await expect(buscarSesionPublicadaConCopia('no-cache')).resolves.toMatchObject({
      id: 'legacy',
    });
    expect(buscar).toHaveBeenCalledTimes(2);
  });

  it('precarga catálogo y progreso de cognición, bienestar y emociones', async () => {
    leerSiCambio.mockResolvedValue({ estado: 'nuevo', valor: [], etag: null });
    hechas.mockResolvedValue([]);
    await precargarLosSenderos();
    expect(leerSiCambio).toHaveBeenCalledTimes(3);
    expect(hechas).toHaveBeenCalledTimes(3);
  });
});
