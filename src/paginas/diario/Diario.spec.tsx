import type { Session } from '@supabase/supabase-js';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorDeLaApi } from '../../infraestructura/api/clienteHttp.ts';
import { cuantosH1, fallosDeAccesibilidad } from '../../pruebas/axe.ts';
import { SesionContexto, type EstadoDeSesion } from '../../sesion/SesionContexto.ts';
import { fijarLaZonaDeLaCuenta } from '../../tiempo/zonaHoraria.ts';
import { diaDe, diasAntes } from './calendarioDelDiario.ts';
import { Diario } from './Diario.tsx';

/**
 * La pantalla del diario (SCRUM-96), con la API simulada y el editor de verdad.
 */
const { api, cargasDelEditorDeDiagramas } = vi.hoisted(() => ({
  api: {
    consultarElDiario: vi.fn(),
    escribirEnElDiario: vi.fn(),
    editarAnotacion: vi.fn(),
  },
  cargasDelEditorDeDiagramas: { veces: 0 },
}));

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
  render(
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

beforeEach(() => {
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
  vi.clearAllMocks();
});

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

  it('si falla, se puede reintentar con la misma operacion', async () => {
    api.escribirEnElDiario
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(guardadaCon({ id: 'reintentada' }));

    pintar();
    await escribirEnElLienzo('Sin red');
    await usuario.click(screen.getByRole('button', { name: 'Guardar anotación' }));
    await usuario.click(await within(historial()).findByRole('button', { name: 'Reintentar' }));

    await waitFor(() => expect(api.escribirEnElDiario).toHaveBeenCalledTimes(2));

    const [primera, segunda] = api.escribirEnElDiario.mock.calls.map(
      ([cuerpo]) => (cuerpo as Record<string, unknown>).clientOperationId,
    );

    expect(segunda).toBe(primera);
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

    const enviado = api.escribirEnElDiario.mock.calls[0]?.[0] as {
      adjuntos: { id: string; tipo: string }[];
    };

    expect(enviado.adjuntos).toHaveLength(1);
    expect(enviado.adjuntos[0]?.tipo).toBe('diagrama');
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
