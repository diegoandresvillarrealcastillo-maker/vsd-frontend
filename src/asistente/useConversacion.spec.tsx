import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RespuestaDelAsistente } from '../infraestructura/api/asistente.ts';
import { ErrorDeLaApi } from '../infraestructura/api/clienteHttp.ts';
import type { ReglasLocales } from '../infraestructura/api/reglasLocales.ts';
import { fijarLaZonaDeLaCuenta } from '../tiempo/zonaHoraria.ts';
import contratoJson from './contrato/reglas-locales.json';
import { useConversacion, type Mensaje } from './useConversacion.ts';

/**
 * La conversacion con VSD IA, sin pantalla (SCRUM-141): lo que se responde, con que forma y
 * cuando. La pantalla completa esta en `Asistente.spec.tsx`.
 */
const { preguntarAlAsistente } = vi.hoisted(() => ({ preguntarAlAsistente: vi.fn() }));

vi.mock('../infraestructura/api/asistente.ts', async (importar) => ({
  ...(await importar<typeof import('../infraestructura/api/asistente.ts')>()),
  preguntarAlAsistente,
}));

const REGLAS = (contratoJson as unknown as { paquete: ReglasLocales }).paquete;

const DEL_SERVIDOR: RespuestaDelAsistente = {
  intencion: 'como_duermo_mejor',
  mensaje: 'Descansar mejor casi siempre empieza por la rutina.',
  recursos: [],
  senalDeRiesgo: false,
  incluyeLineasDeAtencion: false,
};

function conLaRed(hay: boolean) {
  return vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(hay);
}

beforeEach(() => {
  fijarLaZonaDeLaCuenta('America/Bogota');
  preguntarAlAsistente.mockResolvedValue(DEL_SERVIDOR);
});

afterEach(() => {
  vi.restoreAllMocks();
  preguntarAlAsistente.mockReset();
});

async function escribir(
  gancho: { result: { current: ReturnType<typeof useConversacion> } },
  texto: string,
) {
  await act(async () => {
    await gancho.result.current.enviar(texto);
  });
}

const deAsistente = (mensaje: Mensaje | undefined) =>
  mensaje?.de === 'asistente' ? mensaje : undefined;

describe('useConversacion: sin conexion, con las reglas', () => {
  beforeEach(() => {
    conLaRed(false);
  });

  it('una senal de riesgo: el mismo mensaje, las lineas de su pais y la senal puesta', async () => {
    const gancho = renderHook(() => useConversacion(REGLAS, 'Luma'));

    await escribir(gancho, 'quiero morirme');

    const respuesta = deAsistente(gancho.result.current.mensajes[1]);

    expect(respuesta?.sinConexion).toBe(true);
    expect(respuesta?.respuesta).toMatchObject({
      // Como en el servidor: la senal de riesgo siempre es "me siento mal".
      intencion: 'me_siento_mal',
      mensaje: REGLAS.riesgo.mensaje,
      senalDeRiesgo: true,
      incluyeLineasDeAtencion: true,
    });
    expect(respuesta?.respuesta.recursos.map((linea) => linea.titulo)).toEqual(
      REGLAS.paises.CO?.lineas.map((linea) => linea.titulo),
    );
  });

  it('un saludo: sin recursos, sin senal y sin decir que lleva lineas', async () => {
    const gancho = renderHook(() => useConversacion(REGLAS, 'Luma'));

    await escribir(gancho, 'hola');

    expect(deAsistente(gancho.result.current.mensajes[1])).toMatchObject({
      sinConexion: true,
      respuesta: {
        intencion: 'saludo',
        recursos: [],
        senalDeRiesgo: false,
        incluyeLineasDeAtencion: false,
      },
    });
  });

  it('donde buscar ayuda: con las lineas, y dice que las lleva, pero no es una senal de riesgo', async () => {
    const gancho = renderHook(() => useConversacion(REGLAS, 'Luma'));

    await escribir(gancho, 'donde busco ayuda');

    const respuesta = deAsistente(gancho.result.current.mensajes[1]);

    expect(respuesta?.respuesta).toMatchObject({
      intencion: 'donde_busco_ayuda',
      senalDeRiesgo: false,
      incluyeLineasDeAtencion: true,
    });
    expect(respuesta?.respuesta.recursos.length).toBeGreaterThan(0);
  });

  it('una ayuda sin lineas no dice que las lleva', async () => {
    const sinLineas: ReglasLocales = {
      ...REGLAS,
      intenciones: [
        { intencion: 'una', patrones: ['hablemos'], mensaje: 'Aqui estoy.', conLineas: false },
      ],
    };
    const gancho = renderHook(() => useConversacion(sinLineas, 'Luma'));

    await escribir(gancho, 'hablemos');

    expect(deAsistente(gancho.result.current.mensajes[1])?.respuesta).toMatchObject({
      recursos: [],
      incluyeLineasDeAtencion: false,
    });
  });

  it('las lineas son las de la zona de la cuenta en el momento de preguntar', async () => {
    const gancho = renderHook(() => useConversacion(REGLAS, 'Luma'));

    fijarLaZonaDeLaCuenta('Europe/Madrid');
    await escribir(gancho, 'quiero morirme');

    expect(
      deAsistente(gancho.result.current.mensajes[1])?.respuesta.recursos.map(
        (linea) => linea.titulo,
      ),
    ).toEqual(REGLAS.paises.ES?.lineas.map((linea) => linea.titulo));
  });

  it('el nombre de la mascota se tiene en cuenta', async () => {
    const con = renderHook(() => useConversacion(REGLAS, 'Luma'));
    const sin = renderHook(() => useConversacion(REGLAS, 'Chispita'));

    await escribir(con, 'hola luma');
    await escribir(sin, 'hola luma');

    expect(deAsistente(con.result.current.mensajes[1])?.respuesta.intencion).toBe('saludo');
    expect(sin.result.current.mensajes[1]).toMatchObject({ de: 'fallo', motivo: 'exige-conexion' });
  });

  it('lo que exige conexion: un fallo con lo que se escribio, para poder reintentarlo', async () => {
    const gancho = renderHook(() => useConversacion(REGLAS, 'Luma'));

    await escribir(gancho, '  como duermo mejor  ');

    expect(gancho.result.current.mensajes).toEqual([
      expect.objectContaining({ de: 'persona', texto: 'como duermo mejor' }),
      expect.objectContaining({
        de: 'fallo',
        motivo: 'exige-conexion',
        pregunta: 'como duermo mejor',
      }),
    ]);
    expect(preguntarAlAsistente).not.toHaveBeenCalled();
  });

  it('no queda esperando ni se queda con una peticion en curso', async () => {
    const gancho = renderHook(() => useConversacion(REGLAS, 'Luma'));

    await escribir(gancho, 'hola');

    expect(gancho.result.current.esperando).toBe(false);

    // Y se puede escribir otra enseguida.
    await escribir(gancho, 'gracias');

    expect(gancho.result.current.mensajes).toHaveLength(4);
  });

  it('un texto vacio no se envia ni se responde', async () => {
    const gancho = renderHook(() => useConversacion(REGLAS, 'Luma'));

    await escribir(gancho, '   ');

    expect(gancho.result.current.mensajes).toEqual([]);
  });

  it('los mensajes llevan un numero distinto cada uno', async () => {
    const gancho = renderHook(() => useConversacion(REGLAS, 'Luma'));

    await escribir(gancho, 'hola');
    await escribir(gancho, 'gracias');

    const ids = gancho.result.current.mensajes.map((mensaje) => mensaje.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('useConversacion: sin conexion y sin reglas', () => {
  it('no se responde nada: se dice que no hay conexion, como antes', async () => {
    conLaRed(false);

    const gancho = renderHook(() => useConversacion(null, 'Luma'));

    await escribir(gancho, 'hola');

    expect(gancho.result.current.mensajes[1]).toMatchObject({
      de: 'fallo',
      motivo: 'sin-conexion',
    });
    expect(preguntarAlAsistente).not.toHaveBeenCalled();
  });

  it('ni siquiera una senal de riesgo: sin reglas no se inventa nada', async () => {
    conLaRed(false);

    const gancho = renderHook(() => useConversacion(null, 'Luma'));

    await escribir(gancho, 'quiero morirme');

    expect(gancho.result.current.mensajes[1]).toMatchObject({
      de: 'fallo',
      motivo: 'sin-conexion',
    });
  });
});

describe('useConversacion: con conexion', () => {
  beforeEach(() => {
    conLaRed(true);
  });

  it('pregunta al servidor y lo que responde se ve tal cual, sin marcarlo como sin conexion', async () => {
    const gancho = renderHook(() => useConversacion(REGLAS, 'Luma'));

    await escribir(gancho, 'hola');

    expect(preguntarAlAsistente).toHaveBeenCalledWith('hola', expect.any(AbortSignal));
    const respuesta = deAsistente(gancho.result.current.mensajes[1]);

    expect(respuesta?.respuesta).toEqual(DEL_SERVIDOR);
    expect(respuesta?.sinConexion).toBe(false);
  });

  it('si la peticion no llega, prueba lo basico antes de rendirse', async () => {
    preguntarAlAsistente.mockRejectedValue(new TypeError('Failed to fetch'));

    const gancho = renderHook(() => useConversacion(REGLAS, 'Luma'));

    await escribir(gancho, 'hola');

    expect(deAsistente(gancho.result.current.mensajes[1])).toMatchObject({
      sinConexion: true,
      respuesta: { intencion: 'saludo' },
    });
  });

  it('y si no se puede, dice que eso exige conexion', async () => {
    preguntarAlAsistente.mockRejectedValue(new TypeError('Failed to fetch'));

    const gancho = renderHook(() => useConversacion(REGLAS, 'Luma'));

    await escribir(gancho, 'como duermo mejor');

    expect(gancho.result.current.mensajes[1]).toMatchObject({
      de: 'fallo',
      motivo: 'exige-conexion',
    });
  });

  it('sin reglas, una peticion que no llega es lo de siempre: sin conexion', async () => {
    preguntarAlAsistente.mockRejectedValue(new TypeError('Failed to fetch'));

    const gancho = renderHook(() => useConversacion(null, 'Luma'));

    await escribir(gancho, 'hola');

    expect(gancho.result.current.mensajes[1]).toMatchObject({
      de: 'fallo',
      motivo: 'sin-conexion',
    });
  });

  it.each([
    [500, 'otro'],
    [429, 'muchas'],
  ])('un %s del servidor se respeta: no se responde por el', async (estado, motivo) => {
    preguntarAlAsistente.mockRejectedValue(new ErrorDeLaApi(estado, 'No'));

    const gancho = renderHook(() => useConversacion(REGLAS, 'Luma'));

    await escribir(gancho, 'hola');

    expect(gancho.result.current.mensajes[1]).toMatchObject({ de: 'fallo', motivo });
  });

  it('reintentar no repite lo que la persona escribio', async () => {
    preguntarAlAsistente.mockRejectedValueOnce(new ErrorDeLaApi(500, 'No'));

    const gancho = renderHook(() => useConversacion(REGLAS, 'Luma'));

    await escribir(gancho, 'como duermo mejor');
    await act(async () => {
      await gancho.result.current.enviar('como duermo mejor', { reintento: true });
    });

    const personas = gancho.result.current.mensajes.filter((mensaje) => mensaje.de === 'persona');

    expect(personas).toHaveLength(1);
    expect(deAsistente(gancho.result.current.mensajes[2])?.respuesta).toEqual(DEL_SERVIDOR);
  });
});
