import type { Session } from '@supabase/supabase-js';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorDeLaApi } from '../../infraestructura/api/clienteHttp.ts';
import { abrirUnAlmacenDePrueba, cerrarElAlmacenDePrueba } from '../../pruebas/almacenDePrueba.ts';
import { cuantosH1, fallosDeAccesibilidad } from '../../pruebas/axe.ts';
import { AlmacenLleno } from '../../sincronizacion/almacenLocal.ts';
import { cicloActual } from '../../sincronizacion/ciclo.ts';
import { CLAVE_DE_LAS_COPIAS_DEL_DIARIO } from '../../sincronizacion/diarioLocal.ts';
import { SesionContexto, type EstadoDeSesion } from '../../sesion/SesionContexto.ts';
import { fijarLaZonaDeLaCuenta } from '../../tiempo/zonaHoraria.ts';
import { diaDe, diasAntes } from './calendarioDelDiario.ts';
import { Diario } from './Diario.tsx';

/**
 * La pantalla del diario (SCRUM-96), con la API simulada y el editor de verdad.
 */
const { api, cargasDelEditorDeDiagramas, hayConexionConLaApi } = vi.hoisted(() => ({
  api: {
    consultarElDiario: vi.fn(),
    escribirEnElDiario: vi.fn(),
    editarAnotacion: vi.fn(),
  },
  cargasDelEditorDeDiagramas: { veces: 0 },
  hayConexionConLaApi: vi.fn(),
}));

// Lo que se escribe entra a la cola de este equipo y lo envia el motor de verdad
// (SCRUM-139): solo se simula la red.
vi.mock('../../infraestructura/api/conexion.ts', () => ({ hayConexionConLaApi }));

// El semaforo flota en esta pantalla (SCRUM-98); aqui no se prueba.
vi.mock('../../infraestructura/api/pendientes.ts', () => ({
  consultarElSemaforo: () => Promise.resolve({ pendientes: [], recordatorio: null }),
}));
vi.mock('../../infraestructura/api/aviso.ts', () => ({
  consultarLaVersionDelAviso: () => Promise.resolve('1.0'),
}));
vi.mock('../../infraestructura/api/cuenta.ts', () => ({
  darDeAltaLaCuenta: () => Promise.resolve({ mascota: null }),
}));
vi.mock('../../infraestructura/api/diario.ts', async (importar) => ({
  ...(await importar<typeof import('../../infraestructura/api/diario.ts')>()),
  ...api,
}));

// El editor de diagramas de verdad es Excalidraw, que no cabe en jsdom. El
// doble cuenta cuando se carga: esa carga es la que no puede pasar si nadie
// inserta un diagrama.
vi.mock('./EditorDeDiagrama.tsx', () => {
  cargasDelEditorDeDiagramas.veces += 1;

  return {
    default: ({ alTerminar }: { alTerminar: (datos: Record<string, unknown> | null) => void }) => (
      <div role="dialog" aria-label="Editor de diagramas">
        <button type="button" onClick={() => alTerminar({ elements: [] })}>
          Listo
        </button>
      </div>
    ),
  };
});

const usuario = userEvent.setup({ delay: null });

// La zona de Colombia se fija **antes** de calcular el dia: `preparacion.ts` la
// fija antes de cada prueba, pero esta linea corre al importar el archivo, y
// con la zona del equipo. En el CI (UTC), entre las 7 p. m. y la medianoche en
// Colombia "hoy" salia un dia adelantado y la prueba fallaba (SCRUM-130).
fijarLaZonaDeLaCuenta('America/Bogota');

const HOY = diaDe(new Date());
const AYER = diasAntes(HOY, 1);

function haceMinutos(minutos: number): string {
  return new Date(Date.now() - minutos * 60_000).toISOString();
}

function documentoCon(texto: string) {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: texto }] }],
  };
}

function anotacion(extra: Record<string, unknown>) {
  const creadaEn = haceMinutos(10);

  return {
    id: '33333333-3333-4333-a333-000000000001',
    dia: HOY,
    titulo: null,
    contenido: documentoCon('Desayuné temprano'),
    adjuntos: [],
    version: 1,
    creadaEn,
    editadaEn: creadaEn,
    editableHasta: new Date(Date.parse(creadaEn) + 60 * 60_000).toISOString(),
    ...extra,
  };
}

function guardadaCon(extra: Record<string, unknown>) {
  return { ...anotacion(extra), sugiereAcompanamiento: false, lineasDeAtencion: [] };
}

function sesion(): EstadoDeSesion {
  const vacio = vi.fn();

  return {
    sesion: { user: { email: 'alguien@ejemplo.test' } } as Session,
    cargando: false,
    correo: 'alguien@ejemplo.test',
    registrarse: vacio,
    entrar: vacio,
    entrarConGoogle: vacio,
    pedirRecuperacion: vacio,
    cambiarContrasena: vacio,
    pedirCodigoDeVerificacion: vacio,
    cambiarContrasenaConCodigo: vacio,
    salir: vacio,
  };
}

function pintar() {
  return render(
    <SesionContexto.Provider value={sesion()}>
      <MemoryRouter>
        <Diario />
      </MemoryRouter>
    </SesionContexto.Provider>,
  );
}

function lienzo(): HTMLElement {
  return screen.getByRole('textbox', { name: 'Lo que quieres escribir' });
}

async function escribirEnElLienzo(texto: string) {
  await usuario.click(lienzo());
  await usuario.type(lienzo(), texto);
}

function historial(): HTMLElement {
  return screen.getByRole('region', { name: 'Tus días' });
}

beforeAll(() => {
  // ProseMirror mide la seleccion para desplazarse hasta ella; jsdom no mide.
  const rectangulo = () => new DOMRect(0, 0, 0, 0);
  Range.prototype.getBoundingClientRect = rectangulo;
  Range.prototype.getClientRects = () => Object.assign([], { item: () => null });
  document.elementFromPoint = () => null;
});

beforeEach(async () => {
  hayConexionConLaApi.mockResolvedValue(true);
  await abrirUnAlmacenDePrueba();
  api.consultarElDiario.mockResolvedValue([
    anotacion({}),
    anotacion({
      id: '33333333-3333-4333-a333-000000000002',
      dia: AYER,
      contenido: documentoCon('Lo de ayer'),
      creadaEn: haceMinutos(60 * 20),
      editableHasta: haceMinutos(60 * 19),
    }),
  ]);
  cargasDelEditorDeDiagramas.veces = 0;
});

afterEach(() => {
  cerrarElAlmacenDePrueba();
  // Sin esto, un valor de `...Once` que no se uso se le colaria a la prueba siguiente.
  api.consultarElDiario.mockReset();
  api.escribirEnElDiario.mockReset();
  api.editarAnotacion.mockReset();
  vi.useRealTimers();
  vi.clearAllMocks();
});

function sinConexion() {
  hayConexionConLaApi.mockResolvedValue(false);
  api.consultarElDiario.mockRejectedValue(new TypeError('Failed to fetch'));
}

/** Vuelve la conexion y el motor envia lo que haya, como hace el disparador de verdad. */
async function volverLaConexion() {
  hayConexionConLaApi.mockResolvedValue(true);
  await act(async () => {
    await cicloActual()?.motor.sincronizar('conexion');
  });
}

async function laCola() {
  return (await cicloActual()?.almacen.operaciones()) ?? [];
}

async function guardarEscribiendo(texto: string) {
  await escribirEnElLienzo(texto);
  await usuario.click(screen.getByRole('button', { name: 'Guardar anotación' }));
}

describe('Mi diario, accesibilidad (C-03)', () => {
  it('no tiene fallos de accesibilidad y tiene un solo h1', async () => {
    pintar();
    await within(historial()).findByRole('heading', { name: 'Hoy' });

    expect(await fallosDeAccesibilidad()).toEqual([]);
    expect(cuantosH1()).toBe(1);
  });
});

describe('Mi diario, el historial', () => {
  it('agrupa por dia, con la hora de cada anotacion', async () => {
    pintar();

    expect(await within(historial()).findByRole('heading', { name: 'Hoy' })).toBeInTheDocument();
    expect(within(historial()).getByRole('heading', { name: 'Ayer' })).toBeInTheDocument();
    expect(within(historial()).getByText('Desayuné temprano')).toBeInTheDocument();
    expect(api.consultarElDiario).toHaveBeenCalledWith(diasAntes(HOY, 29), HOY, expect.anything());
  });

  it('solo la de dentro de su hora se puede editar, y dice cuanto le queda', async () => {
    pintar();

    const editar = await within(historial()).findAllByRole('button', { name: /^Editar · / });

    expect(editar).toHaveLength(1);
    expect(editar[0]).toHaveTextContent('Editar · quedan 50 min');
  });
});

describe('Mi diario, escribir', () => {
  it('lo escrito aparece al instante en el historial, antes de que responda el servidor', async () => {
    let responder: (valor: unknown) => void = () => undefined;
    api.escribirEnElDiario.mockReturnValue(new Promise((resolver) => (responder = resolver)));

    pintar();
    await within(historial()).findByText('Desayuné temprano');
    await escribirEnElLienzo('Hoy fue un buen día');
    await usuario.click(screen.getByRole('button', { name: 'Guardar anotación' }));

    expect(within(historial()).getByText('Hoy fue un buen día')).toBeInTheDocument();
    expect(within(historial()).getByText('Guardando…')).toBeInTheDocument();

    const enviado = api.escribirEnElDiario.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(enviado).toMatchObject({ dia: HOY, contenido: documentoCon('Hoy fue un buen día') });
    expect(enviado.clientOperationId).toMatch(/^[0-9a-f-]{36}$/);

    responder(
      guardadaCon({
        id: '33333333-3333-4333-a333-000000000009',
        contenido: documentoCon('Hoy fue un buen día'),
      }),
    );

    await waitFor(() =>
      expect(within(historial()).queryByText('Guardando…')).not.toBeInTheDocument(),
    );
    expect(within(historial()).getByText('Hoy fue un buen día')).toBeInTheDocument();
  });

  it('el lienzo queda vacio para la siguiente', async () => {
    api.escribirEnElDiario.mockResolvedValue(guardadaCon({ id: 'nueva' }));

    pintar();
    await escribirEnElLienzo('Una');
    await usuario.click(screen.getByRole('button', { name: 'Guardar anotación' }));

    expect(lienzo()).toHaveTextContent('');
    expect(screen.getByRole('button', { name: 'Guardar anotación' })).toBeDisabled();
  });

  it('si la API no la acepta, sigue en el diario con su texto y se puede reintentar con la misma operacion', async () => {
    api.escribirEnElDiario
      .mockRejectedValueOnce(new ErrorDeLaApi(400, 'Mal', undefined, 'CONTENIDO_INVALIDO'))
      .mockResolvedValueOnce(guardadaCon({ id: 'reintentada' }));

    pintar();
    await escribirEnElLienzo('No la aceptan');
    await usuario.click(screen.getByRole('button', { name: 'Guardar anotación' }));

    const entrada = (await within(historial()).findByText('No la aceptan')).closest('li')!;

    expect(
      await within(entrada).findByText(/No se pudo enviar\. Sigue guardada en este equipo/),
    ).toBeInTheDocument();

    await usuario.click(within(entrada).getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(api.escribirEnElDiario).toHaveBeenCalledTimes(2));

    const [primera, segunda] = api.escribirEnElDiario.mock.calls.map(
      ([cuerpo]) => (cuerpo as Record<string, unknown>).clientOperationId,
    );

    expect(segunda).toBe(primera);
  });

  it('si se corta la red al enviar, queda guardada en este equipo y sale sola cuando vuelve', async () => {
    api.escribirEnElDiario
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(guardadaCon({ id: 'ok', contenido: documentoCon('Se corta') }));

    pintar();
    await escribirEnElLienzo('Se corta');
    await usuario.click(screen.getByRole('button', { name: 'Guardar anotación' }));

    expect(await within(historial()).findByText(/Guardada en este equipo/)).toBeInTheDocument();
    expect(within(historial()).queryByRole('button', { name: 'Reintentar' })).toBeNull();

    await volverLaConexion();

    await waitFor(() => expect(api.escribirEnElDiario).toHaveBeenCalledTimes(2));

    const [primera, segunda] = api.escribirEnElDiario.mock.calls.map(
      ([cuerpo]) => (cuerpo as Record<string, unknown>).clientOperationId,
    );

    expect(segunda).toBe(primera);
    await waitFor(() =>
      expect(within(historial()).queryByText(/Guardada en este equipo/)).not.toBeInTheDocument(),
    );
  });

  it('una respuesta con lineas pero sin senal de acompanamiento no las ensena', async () => {
    api.escribirEnElDiario.mockResolvedValue({
      ...guardadaCon({ id: 'sin-riesgo' }),
      sugiereAcompanamiento: false,
      lineasDeAtencion: [{ id: 'l-1', titulo: 'Línea 1', tipo: 'contacto', cobertura: 'nacional' }],
    });

    pintar();
    await escribirEnElLienzo('un dia normal');
    await usuario.click(screen.getByRole('button', { name: 'Guardar anotación' }));
    await waitFor(() => expect(api.escribirEnElDiario).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(within(historial()).queryByText('Guardando…')).not.toBeInTheDocument(),
    );
    await new Promise((resolver) => setTimeout(resolver, 60));

    expect(screen.queryByRole('region', { name: 'Si te sirve hablarlo con alguien' })).toBeNull();
  });

  it('si no hay espacio en este equipo, lo dice y deja lo escrito en el lienzo', async () => {
    pintar();
    await within(historial()).findByText('Desayuné temprano');
    vi.spyOn(cicloActual()!.almacen, 'agregarOperacion').mockRejectedValue(new AlmacenLleno());
    await guardarEscribiendo('No cabe');

    expect(
      await screen.findByText(/No hay espacio en este equipo para guardar tu anotación/),
    ).toBeInTheDocument();
    expect(lienzo()).toHaveTextContent('No cabe');
    expect(api.escribirEnElDiario).not.toHaveBeenCalled();
  });

  it('mientras se guarda en este equipo, el boton lo dice y no deja guardar dos veces', async () => {
    pintar();
    await within(historial()).findByText('Desayuné temprano');

    const almacen = cicloActual()!.almacen;
    const agregar = almacen.agregarOperacion.bind(almacen);
    let soltar: () => void = () => undefined;

    vi.spyOn(almacen, 'agregarOperacion').mockImplementation(async (operacion) => {
      await new Promise<void>((resolver) => {
        soltar = resolver;
      });

      return agregar(operacion);
    });

    await escribirEnElLienzo('Despacio');
    await usuario.click(screen.getByRole('button', { name: 'Guardar anotación' }));

    expect(await screen.findByRole('button', { name: 'Guardando…' })).toBeDisabled();

    soltar();

    await waitFor(() => expect(lienzo()).toHaveTextContent(''));
    expect(screen.getByRole('button', { name: 'Guardar anotación' })).toBeInTheDocument();
  });

  it('con una senal de riesgo ensena las lineas de atencion', async () => {
    api.escribirEnElDiario.mockResolvedValue({
      ...guardadaCon({ id: 'con-riesgo' }),
      sugiereAcompanamiento: true,
      lineasDeAtencion: [
        { id: 'l-192', titulo: 'Línea 192, opción 4', tipo: 'contacto', cobertura: 'nacional' },
      ],
    });

    pintar();
    await escribirEnElLienzo('ya no puedo mas');
    await usuario.click(screen.getByRole('button', { name: 'Guardar anotación' }));

    const lineas = await screen.findByRole('region', { name: 'Si te sirve hablarlo con alguien' });

    expect(within(lineas).getByText('Línea 192, opción 4')).toBeInTheDocument();
  });
});

describe('Mi diario, corregir', () => {
  it('dentro de su hora la corrige con su version', async () => {
    api.editarAnotacion.mockResolvedValue(
      guardadaCon({ version: 2, contenido: documentoCon('Desayuné temprano y salí') }),
    );

    pintar();
    await usuario.click(await within(historial()).findByRole('button', { name: /^Editar · / }));

    expect(screen.getByText(/Corrigiendo la anotación de las/)).toBeInTheDocument();
    expect(lienzo()).toHaveTextContent('Desayuné temprano');

    await usuario.type(lienzo(), ' y salí');
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(api.editarAnotacion).toHaveBeenCalledTimes(1));
    expect(api.editarAnotacion.mock.calls[0]?.[1]).toMatchObject({ version: 1 });
    expect(await within(historial()).findByText('Desayuné temprano y salí')).toBeInTheDocument();
  });

  it('si ya paso la hora, lo escrito se guarda como una anotacion nueva del mismo dia', async () => {
    api.editarAnotacion.mockRejectedValue(
      new ErrorDeLaApi(409, 'Ya pasó la hora', undefined, 'EDICION_FUERA_DE_PLAZO'),
    );
    api.escribirEnElDiario.mockResolvedValue(guardadaCon({ id: 'copia' }));

    pintar();
    await usuario.click(await within(historial()).findByRole('button', { name: /^Editar · / }));
    await usuario.type(lienzo(), ' y más');
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(api.escribirEnElDiario).toHaveBeenCalledTimes(1));
    expect(api.escribirEnElDiario.mock.calls[0]?.[0]).toMatchObject({ dia: HOY });
    expect(await screen.findByText(/se guardó como una nueva del mismo día/)).toBeInTheDocument();
    // Y la copia dice de donde viene, con el motivo de esta vez.
    expect(
      await screen.findByText(
        /Copia de lo que escribiste en este equipo: la anotación de las .+ ya no se podía corregir porque pasó su primera hora\./,
      ),
    ).toBeInTheDocument();
  });
});

describe('Mi diario, sin conexion (SCRUM-139)', () => {
  it('se abre sin conexion: ensena lo que habia guardado en este equipo, y lo dice', async () => {
    const primera = pintar();

    await within(historial()).findByText('Desayuné temprano');
    primera.unmount();
    sinConexion();

    pintar();

    expect(
      await screen.findByText(/Estás viendo lo que tenías guardado en este equipo/),
    ).toBeInTheDocument();
    expect(await within(historial()).findByText('Desayuné temprano')).toBeInTheDocument();
    expect(within(historial()).getByText('Lo de ayer')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('sin conexion y sin copia, explica que hace falta conectarse una vez, y deja reintentar', async () => {
    sinConexion();

    pintar();

    expect(
      await screen.findByText(/Todavía no hay una copia de tu diario en este equipo/),
    ).toBeInTheDocument();

    hayConexionConLaApi.mockResolvedValue(true);
    api.consultarElDiario.mockResolvedValue([anotacion({})]);
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await within(historial()).findByText('Desayuné temprano')).toBeInTheDocument();
  });

  it('con la copia a la vista, en cuanto vuelve la conexion se pone al dia', async () => {
    const primera = pintar();

    await within(historial()).findByText('Desayuné temprano');
    primera.unmount();
    sinConexion();
    pintar();
    await screen.findByText(/Estás viendo lo que tenías guardado en este equipo/);

    hayConexionConLaApi.mockResolvedValue(true);
    api.consultarElDiario.mockResolvedValue([
      anotacion({ contenido: documentoCon('Lo nuevo del servidor') }),
    ]);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(await within(historial()).findByText('Lo nuevo del servidor')).toBeInTheDocument();
    expect(screen.queryByText(/Estás viendo lo que tenías guardado en este equipo/)).toBeNull();
  });

  it('lo que se escribe aparece al instante, guardado en este equipo, y no toca la API', async () => {
    const antes = Date.now();

    pintar();
    await within(historial()).findByText('Desayuné temprano');
    sinConexion();
    await guardarEscribiendo('Escrito sin red');

    const entrada = (await within(historial()).findByText('Escrito sin red')).closest('li')!;

    expect(within(entrada).getByText(/Guardada en este equipo/)).toBeInTheDocument();
    expect(api.escribirEnElDiario).not.toHaveBeenCalled();

    const cola = await laCola();

    expect(cola).toHaveLength(1);
    expect(cola[0]).toMatchObject({ tipo: 'diario.escribir', estado: 'pendiente' });
    // La hora que viaja es la del dispositivo: sin red, la de cuando llegue seria mentira.
    expect(
      Date.parse((cola[0]?.payload as { escritaEn: string }).escritaEn),
    ).toBeGreaterThanOrEqual(antes);

    api.escribirEnElDiario.mockResolvedValue(
      guardadaCon({ id: 'servidor-1', contenido: documentoCon('Escrito sin red') }),
    );
    await volverLaConexion();

    await waitFor(() =>
      expect(within(historial()).queryByText(/Guardada en este equipo/)).not.toBeInTheDocument(),
    );
    expect(api.escribirEnElDiario).toHaveBeenCalledTimes(1);
    expect(within(historial()).getAllByText('Escrito sin red')).toHaveLength(1);
  });

  it('cerrar y volver a abrir no pierde lo escrito, y llega una sola vez', async () => {
    const primera = pintar();

    await within(historial()).findByText('Desayuné temprano');
    sinConexion();
    await guardarEscribiendo('No lo pierdo');
    await within(historial()).findByText('No lo pierdo');
    primera.unmount();

    pintar();

    expect(await within(historial()).findByText('No lo pierdo')).toBeInTheDocument();
    expect(await within(historial()).findByText(/Guardada en este equipo/)).toBeInTheDocument();

    api.escribirEnElDiario.mockResolvedValue(
      guardadaCon({ id: 'servidor-1', contenido: documentoCon('No lo pierdo') }),
    );
    await volverLaConexion();

    await waitFor(() =>
      expect(within(historial()).queryByText(/Guardada en este equipo/)).not.toBeInTheDocument(),
    );
    expect(api.escribirEnElDiario).toHaveBeenCalledTimes(1);
    expect(within(historial()).getAllByText('No lo pierdo')).toHaveLength(1);
  });

  it('lo escrito sin conexion que pide acompanar ensena las lineas de atencion cuando sale', async () => {
    pintar();
    await within(historial()).findByText('Desayuné temprano');
    sinConexion();
    await guardarEscribiendo('ya no puedo mas');
    await within(historial()).findByText(/Guardada en este equipo/);

    api.escribirEnElDiario.mockResolvedValue({
      ...guardadaCon({ id: 'con-riesgo' }),
      sugiereAcompanamiento: true,
      lineasDeAtencion: [
        { id: 'l-192', titulo: 'Línea 192, opción 4', tipo: 'contacto', cobertura: 'nacional' },
      ],
    });
    await volverLaConexion();

    const lineas = await screen.findByRole('region', { name: 'Si te sirve hablarlo con alguien' });

    expect(within(lineas).getByText('Línea 192, opción 4')).toBeInTheDocument();
  });

  it('lo recien escrito dice que queda una hora justa, no un minuto de mas', async () => {
    pintar();
    await within(historial()).findByText('Desayuné temprano');
    sinConexion();
    await guardarEscribiendo('Recien escrito');

    const entrada = (await within(historial()).findByText('Recien escrito')).closest('li')!;

    expect(
      within(entrada).getByRole('button', { name: /^Editar · quedan 60 min$/ }),
    ).toBeInTheDocument();
  });

  it('el reloj de la pantalla sigue corriendo: los minutos que quedan bajan solos', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date', 'setInterval', 'clearInterval'] });
    pintar();

    expect(
      await within(historial()).findByRole('button', { name: /^Editar · quedan 50 min$/ }),
    ).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(31 * 60_000);
    });

    expect(
      await within(historial()).findByRole('button', { name: /^Editar · quedan (19|20) min$/ }),
    ).toBeInTheDocument();
  });

  it('si la hora para corregir pasa mientras se escribe, se guarda como nueva, marcada, y lo dice', async () => {
    api.consultarElDiario.mockResolvedValue([
      anotacion({ editableHasta: new Date(Date.now() + 2 * 60_000).toISOString() }),
    ]);
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date', 'setInterval', 'clearInterval'] });
    pintar();
    await usuario.click(await within(historial()).findByRole('button', { name: /^Editar · / }));
    hayConexionConLaApi.mockResolvedValue(false);
    act(() => {
      vi.advanceTimersByTime(3 * 60_000);
    });
    await usuario.type(lienzo(), ' y mas');
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText(/se guardó como una nueva del mismo día/)).toBeInTheDocument();

    const [operacion] = await laCola();

    expect(operacion).toMatchObject({ tipo: 'diario.escribir' });
    expect(operacion?.payload).toMatchObject({
      dia: HOY,
      copiaDe: '33333333-3333-4333-a333-000000000001',
      motivo: 'EDICION_FUERA_DE_PLAZO',
    });
    expect(api.editarAnotacion).not.toHaveBeenCalled();
  });

  it('si la original ya no esta a la vista, la copia lo dice sin inventar cual era', async () => {
    await cicloActual()!.almacen.guardarLectura(
      CLAVE_DE_LAS_COPIAS_DEL_DIARIO,
      {
        valor: { 'copia-9': { copiaDe: 'otra-que-no-se-ve', motivo: 'VERSION_DESACTUALIZADA' } },
        etag: null,
      },
      new Date(),
    );
    api.consultarElDiario.mockResolvedValue([
      anotacion({ id: 'copia-9', contenido: documentoCon('Una copia') }),
    ]);

    pintar();

    const copia = (await within(historial()).findByText('Una copia')).closest('li')!;

    expect(
      within(copia).getByText(
        /Copia de lo que escribiste en este equipo: la anotación original se había cambiado desde otro dispositivo y no quisimos pisarla\./,
      ),
    ).toBeInTheDocument();
  });

  it('sin sesion no hay donde guardar: lo dice y deja lo escrito en el lienzo', async () => {
    pintar();
    await within(historial()).findByText('Desayuné temprano');
    cerrarElAlmacenDePrueba();
    await guardarEscribiendo('No te vayas');

    expect(
      await screen.findByText(/No pudimos guardar tu anotación en este equipo/),
    ).toBeInTheDocument();
    expect(lienzo()).toHaveTextContent('No te vayas');
    expect(api.escribirEnElDiario).not.toHaveBeenCalled();
  });

  describe('corregir', () => {
    it('se ve la correccion, y al volver la conexion se manda con la version que tenia el dispositivo', async () => {
      pintar();
      await usuario.click(await within(historial()).findByRole('button', { name: /^Editar · / }));
      sinConexion();
      await usuario.type(lienzo(), ' y salí');

      const corregido = lienzo().textContent ?? '';

      await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

      const entrada = (await within(historial()).findByText(corregido)).closest('li')!;

      expect(within(entrada).getByText(/Guardada en este equipo/)).toBeInTheDocument();
      expect(api.editarAnotacion).not.toHaveBeenCalled();

      api.editarAnotacion.mockResolvedValue(
        guardadaCon({ version: 2, contenido: documentoCon(corregido) }),
      );
      await volverLaConexion();

      await waitFor(() => expect(api.editarAnotacion).toHaveBeenCalledTimes(1));

      const [id, cambios] = api.editarAnotacion.mock.calls[0] as [string, Record<string, unknown>];

      expect(id).toBe('33333333-3333-4333-a333-000000000001');
      expect(cambios).toMatchObject({ version: 1 });
      // La hora de la correccion es la del dispositivo, y el dia solo era para la copia.
      expect(cambios.editadaEn).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(cambios).not.toHaveProperty('dia');
      await waitFor(() =>
        expect(within(historial()).queryByText(/Guardada en este equipo/)).not.toBeInTheDocument(),
      );
    });

    it('una anotacion escrita sin conexion se corrige sin conexion: sale la creacion y luego la correccion', async () => {
      pintar();
      await within(historial()).findByText('Desayuné temprano');
      sinConexion();
      await guardarEscribiendo('Primer borrador');

      const escrita = (await within(historial()).findByText('Primer borrador')).closest('li')!;

      await usuario.click(within(escrita).getByRole('button', { name: /^Editar · / }));
      await usuario.type(lienzo(), ' y más');

      const corregido = lienzo().textContent ?? '';

      await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

      // Una sola anotacion, con la correccion puesta.
      expect(await within(historial()).findByText(corregido)).toBeInTheDocument();
      expect(within(historial()).queryByText('Primer borrador')).not.toBeInTheDocument();
      expect((await laCola()).map((operacion) => operacion.tipo)).toEqual([
        'diario.escribir',
        'diario.editar',
      ]);

      api.escribirEnElDiario.mockResolvedValue(
        guardadaCon({ id: 'servidor-7', version: 1, contenido: documentoCon('Primer borrador') }),
      );
      api.editarAnotacion.mockResolvedValue(
        guardadaCon({
          id: 'servidor-7',
          version: 2,
          contenido: documentoCon(corregido),
        }),
      );
      await volverLaConexion();
      await volverLaConexion();

      await waitFor(() => expect(api.editarAnotacion).toHaveBeenCalledTimes(1));
      expect(api.escribirEnElDiario).toHaveBeenCalledTimes(1);
      expect(api.editarAnotacion.mock.calls[0]?.[0]).toBe('servidor-7');
      expect(api.editarAnotacion.mock.calls[0]?.[1]).toMatchObject({ version: 1 });
      expect(await within(historial()).findByText(corregido)).toBeInTheDocument();
      expect(within(historial()).getAllByText(corregido)).toHaveLength(1);
    });

    describe('cuando otro dispositivo cambio la anotacion (ADR 0009)', () => {
      async function corregirYQueChoque() {
        // Lo que dice el servidor despues de que el otro dispositivo cambio la anotacion.
        api.consultarElDiario.mockResolvedValueOnce([anotacion({})]).mockResolvedValue([
          anotacion({
            version: 2,
            contenido: documentoCon('Lo que escribió el otro dispositivo'),
          }),
        ]);
        api.editarAnotacion.mockRejectedValue(
          new ErrorDeLaApi(409, 'Cambió', undefined, 'VERSION_DESACTUALIZADA'),
        );
        api.escribirEnElDiario.mockResolvedValue(
          guardadaCon({
            id: 'copia-1',
            contenido: documentoCon('Desayuné temprano y salí'),
            creadaEn: haceMinutos(1),
          }),
        );

        const abierta = pintar();

        await usuario.click(await within(historial()).findByRole('button', { name: /^Editar · / }));
        await usuario.type(lienzo(), ' y salí');
        await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        return abierta;
      }

      it('lo escrito aqui se guarda como una copia, marcada, con su origen, y se avisa', async () => {
        await corregirYQueChoque();

        expect(await screen.findByText(/Para no pisar ninguna de las dos/)).toBeInTheDocument();

        const copia = (await within(historial()).findByText('Desayuné temprano y salí')).closest(
          'li',
        )!;

        expect(within(copia).getByText('Copia')).toBeInTheDocument();
        expect(
          within(copia).getByText(
            /Copia de lo que escribiste en este equipo: la anotación de las .+ se había cambiado desde otro dispositivo y no quisimos pisarla\./,
          ),
        ).toBeInTheDocument();
        // La original no se pisa: se ve como la dejo el otro dispositivo.
        expect(
          await within(historial()).findByText('Lo que escribió el otro dispositivo'),
        ).toBeInTheDocument();
        expect(api.escribirEnElDiario.mock.calls[0]?.[0]).toMatchObject({ dia: HOY });

        // El aviso se cierra con "Entendido"; la copia, con su marca, se queda.
        await usuario.click(screen.getByRole('button', { name: 'Entendido' }));

        expect(screen.queryByText(/Para no pisar ninguna de las dos/)).toBeNull();
        expect(within(historial()).getByText('Copia')).toBeInTheDocument();
      });

      it('la marca de copia se queda: al abrir otra vez, incluso sin conexion, sigue siendo copia', async () => {
        const abierta = await corregirYQueChoque();

        await within(historial()).findByText('Copia');
        abierta.unmount();
        sinConexion();

        pintar();

        expect(await within(historial()).findByText('Copia')).toBeInTheDocument();
        expect(within(historial()).getByText('Desayuné temprano y salí')).toBeInTheDocument();
      });

      it('si la correccion ya estaba aplicada (se perdio la respuesta), no hace ninguna copia ni avisa', async () => {
        api.editarAnotacion.mockRejectedValue(
          new ErrorDeLaApi(409, 'Cambió', undefined, 'VERSION_DESACTUALIZADA'),
        );

        pintar();
        await usuario.click(await within(historial()).findByRole('button', { name: /^Editar · / }));
        await usuario.type(lienzo(), ' y salí');

        const corregido = lienzo().textContent ?? '';

        // Cuando se pregunte lo que tiene el servidor, ya tiene lo mismo que se queria escribir.
        api.consultarElDiario.mockResolvedValue([
          anotacion({ version: 2, contenido: documentoCon(corregido) }),
        ]);
        await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await waitFor(() => expect(api.editarAnotacion).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(api.consultarElDiario).toHaveBeenCalledTimes(2));

        expect(api.escribirEnElDiario).not.toHaveBeenCalled();
        expect(await within(historial()).findByText(corregido)).toBeInTheDocument();
        expect(screen.queryByText(/Para no pisar ninguna de las dos/)).toBeNull();
        expect(within(historial()).queryByText('Copia')).toBeNull();
      });
    });
  });
});

describe('Mi diario, los diagramas', () => {
  it('el editor de diagramas no se descarga hasta que se inserta uno', async () => {
    pintar();
    await escribirEnElLienzo('Sin diagramas');

    expect(cargasDelEditorDeDiagramas.veces).toBe(0);

    await usuario.click(screen.getByRole('button', { name: 'Diagrama' }));

    expect(await screen.findByRole('dialog', { name: 'Editor de diagramas' })).toBeInTheDocument();
    expect(cargasDelEditorDeDiagramas.veces).toBe(1);
  });

  it('al terminarlo queda en el texto y viaja en los adjuntos', async () => {
    api.escribirEnElDiario.mockResolvedValue(guardadaCon({ id: 'con-diagrama' }));

    pintar();
    await usuario.click(screen.getByRole('button', { name: 'Diagrama' }));
    await usuario.click(await screen.findByRole('button', { name: 'Listo' }));

    expect(await screen.findByRole('button', { name: 'Editar diagrama' })).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Guardar anotación' }));
    await waitFor(() => expect(api.escribirEnElDiario).toHaveBeenCalledTimes(1));

    const enviado = api.escribirEnElDiario.mock.calls[0]?.[0] as {
      adjuntos: { id: string; tipo: string }[];
    };

    expect(enviado.adjuntos).toHaveLength(1);
    expect(enviado.adjuntos[0]?.tipo).toBe('diagrama');
  });

  it('un diagrama escrito sin conexion viaja en la cola', async () => {
    pintar();
    await within(historial()).findByText('Desayuné temprano');
    sinConexion();
    await usuario.click(screen.getByRole('button', { name: 'Diagrama' }));
    await usuario.click(await screen.findByRole('button', { name: 'Listo' }));
    await usuario.click(screen.getByRole('button', { name: 'Guardar anotación' }));

    await waitFor(async () => expect(await laCola()).toHaveLength(1));

    const { adjuntos } = (await laCola())[0]?.payload as { adjuntos: { tipo: string }[] };

    expect(adjuntos).toHaveLength(1);
    expect(adjuntos[0]?.tipo).toBe('diagrama');
  });
});

describe('Mi diario, la barra de formato con raton', () => {
  it('pulsar un boton no le quita el foco al texto, para no perder la seleccion', () => {
    pintar();

    const barra = screen.getByRole('toolbar', { name: 'Formato del texto' });
    const evento = new MouseEvent('mousedown', { bubbles: true, cancelable: true });

    within(barra).getByRole('button', { name: 'Color verde' }).dispatchEvent(evento);

    expect(evento.defaultPrevented).toBe(true);
  });

  it('los selectores si se abren con normalidad', () => {
    pintar();

    const evento = new MouseEvent('mousedown', { bubbles: true, cancelable: true });

    screen.getByRole('combobox', { name: 'Tipo de letra' }).dispatchEvent(evento);

    expect(evento.defaultPrevented).toBe(false);
  });
});

describe('Mi diario, con teclado', () => {
  it('la barra de formato son botones que dicen si estan activos', async () => {
    pintar();
    await escribirEnElLienzo('negrita');

    const negrita = within(screen.getByRole('toolbar', { name: 'Formato del texto' })).getByRole(
      'button',
      { name: 'Negrita' },
    );

    expect(negrita).toHaveAttribute('aria-pressed', 'false');

    await usuario.click(negrita);

    expect(negrita).toHaveAttribute('aria-pressed', 'true');
  });
});
