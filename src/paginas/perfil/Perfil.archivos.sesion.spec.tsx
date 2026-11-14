import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  olvidarLosArchivosDeLaPersona,
  sincronizarLosArchivosDeLaPersona,
} from '../../foto/archivosDeLaPersona.ts';
import { sincronizarLaFoto, useFotoDePerfil } from '../../foto/fotoDePerfil.ts';
import { useMascotaPropia } from '../../foto/mascotaPropia.ts';
import type { Cuenta } from '../../infraestructura/api/cuenta.ts';
import { alCambiarLaSesion, reiniciarElCicloParaLasPruebas } from '../../sincronizacion/ciclo.ts';
import { TuFoto } from './TuFoto.tsx';
import { TuMascotaPropia } from './TuMascotaPropia.tsx';

/**
 * La foto y la mascota propia cuando la sesion cambia a mitad (SCRUM-317, H-04 de la revision del
 * 29/10/2026).
 *
 * Las pantallas, la foto en memoria, el cliente HTTP y el ciclo son los de verdad; solo se simulan
 * el recorte de la foto, el servidor (`fetch`) y quien es la sesion de Supabase. A empieza a subir
 * (o quitar) algo, sale, y entra B. Nada de lo de A puede salir con la sesion de B ni quedar en la
 * foto en memoria que ve B.
 */

const { prepararLaFoto, identidad } = vi.hoisted(() => {
  const quien: { id: string | null; token: string } = { id: 'persona-a', token: 'token-de-a' };

  return { prepararLaFoto: vi.fn(), identidad: quien };
});

vi.mock('../../foto/prepararLaFoto.ts', async (importarOriginal) => ({
  ...(await importarOriginal<typeof import('../../foto/prepararLaFoto.ts')>()),
  prepararLaFoto,
}));
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
const CUENTA_A_CON_FOTO = cuentaDe('persona-a', { foto: { actualizadaEl: MARCA } });
const CUENTA_A_CON_MASCOTA = cuentaDe('persona-a', { mascotaPropia: { actualizadaEl: MARCA } });
const CUENTA_B = cuentaDe('persona-b', { foto: { actualizadaEl: MARCA } });

/** Lo que mandaria el navegador, y como contestarlo cuando el servidor quiera. */
interface Peticion {
  readonly metodo: string;
  readonly ruta: string;
  readonly autorizacion: string | null;
  readonly cuerpo: unknown;
  readonly senal: AbortSignal | null;
  readonly responder: (cuerpo: unknown) => void;
}

let peticiones: Peticion[];
const direcciones = new Map<Blob, string>();

const FOTO_DE_A = new Blob(['FOTO_PRIVADA_DE_A'], { type: 'image/jpeg' });
const FOTO_DE_B = new Blob(['FOTO_DE_B'], { type: 'image/jpeg' });

function laSolicitud(metodo: string, ruta: string): Peticion | undefined {
  return peticiones.find((una) => una.metodo === metodo && una.ruta.endsWith(ruta));
}

/** Lo que ve cualquier pantalla de la foto en memoria, sin depender de la pantalla del perfil. */
function Sonda() {
  const foto = useFotoDePerfil();
  const mascota = useMascotaPropia();

  return (
    <>
      <output data-testid="foto">{foto ?? 'ninguna'}</output>
      <output data-testid="mascota">{mascota.url ?? 'ninguna'}</output>
    </>
  );
}

const fotoQueSeVe = () => screen.getByTestId('foto').textContent;

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

function elegirLaFoto(): void {
  fireEvent.change(screen.getByLabelText('Elegir una foto'), {
    target: { files: [new File(['original'], 'a.png', { type: 'image/png' })] },
  });
}

function elegirElSvg(): void {
  fireEvent.change(screen.getByLabelText('Subir mi dibujo'), {
    target: {
      files: [
        new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'a.svg', { type: 'image/svg+xml' }),
      ],
    },
  });
}

/** La preparacion de la foto (recorte y compresion) que tarda hasta que la prueba la suelta. */
function laPreparacionTarda(): (foto: Blob) => void {
  let soltar: (foto: Blob) => void = () => undefined;

  prepararLaFoto.mockReturnValue(
    new Promise<Blob>((resolver) => {
      soltar = resolver;
    }),
  );

  return soltar;
}

beforeEach(async () => {
  reiniciarElCicloParaLasPruebas();
  identidad.id = 'persona-a';
  identidad.token = 'token-de-a';
  await alCambiarLaSesion('persona-a', { persistente: false });
  peticiones = [];
  direcciones.clear();
  direcciones.set(FOTO_DE_A, 'blob:foto-de-a');
  direcciones.set(FOTO_DE_B, 'blob:foto-de-b');
  vi.spyOn(URL, 'createObjectURL').mockImplementation(
    (objeto) => direcciones.get(objeto as Blob) ?? 'blob:otra',
  );
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
            cuerpo: opciones?.body ?? null,
            senal: opciones?.signal ?? null,
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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  prepararLaFoto.mockReset();
});

describe('subir la foto', () => {
  it('con la sesion de siempre la sube con el token de quien la eligio y la deja a la vista', async () => {
    const actualizarCuenta = vi.fn();
    const soltar = laPreparacionTarda();

    render(<TuFoto actualizarCuenta={actualizarCuenta} />);
    render(<Sonda />);
    elegirLaFoto();
    soltar(FOTO_DE_A);

    await waitFor(() => {
      expect(laSolicitud('PUT', '/api/cuenta/foto')).toBeDefined();
    });
    expect(laSolicitud('PUT', '/api/cuenta/foto')?.autorizacion).toBe('Bearer token-de-a');
    expect(laSolicitud('PUT', '/api/cuenta/foto')?.cuerpo).toBe(FOTO_DE_A);

    act(() => {
      laSolicitud('PUT', '/api/cuenta/foto')?.responder(CUENTA_A_CON_FOTO);
    });

    expect(await screen.findByText('Listo, esta es tu foto.')).toBeInTheDocument();
    expect(actualizarCuenta).toHaveBeenCalledWith(CUENTA_A_CON_FOTO);
    expect(fotoQueSeVe()).toBe('blob:foto-de-a');
  });

  it('si el token se renueva dentro de la misma sesion, la sube con el nuevo', async () => {
    const soltar = laPreparacionTarda();

    render(<TuFoto actualizarCuenta={vi.fn()} />);
    elegirLaFoto();
    identidad.token = 'token-renovado-de-a';
    soltar(FOTO_DE_A);

    await waitFor(() => {
      expect(laSolicitud('PUT', '/api/cuenta/foto')).toBeDefined();
    });
    expect(laSolicitud('PUT', '/api/cuenta/foto')?.autorizacion).toBe('Bearer token-renovado-de-a');
  });

  it('si A sale y entra B mientras se prepara, la foto de A no se sube con la sesion de B (reproduccion de la auditoria)', async () => {
    const actualizarCuenta = vi.fn();
    const soltar = laPreparacionTarda();
    const vista = render(<TuFoto actualizarCuenta={actualizarCuenta} />);

    render(<Sonda />);
    elegirLaFoto();
    vista.unmount();
    await entraB();
    soltar(FOTO_DE_A);
    await dejarPasarLoPendiente();

    expect(peticiones).toHaveLength(0);
    expect(actualizarCuenta).not.toHaveBeenCalled();
    expect(fotoQueSeVe()).toBe('blob:foto-de-b');
  });

  it('con la pantalla viva pero la sesion de B, no sube nada, no dice que fallo y deja volver a elegir', async () => {
    const actualizarCuenta = vi.fn();
    const soltar = laPreparacionTarda();

    render(<TuFoto actualizarCuenta={actualizarCuenta} />);
    elegirLaFoto();
    await entraB();
    soltar(FOTO_DE_A);
    await dejarPasarLoPendiente();

    expect(peticiones).toHaveLength(0);
    expect(actualizarCuenta).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Elegir una foto|Cambiar la foto/)).toBeEnabled();
  });

  it('con la pantalla viva, si la respuesta de A llega con la sesion de B, no dice nada ni deja ocupado', async () => {
    const actualizarCuenta = vi.fn();
    const soltar = laPreparacionTarda();

    render(<TuFoto actualizarCuenta={actualizarCuenta} />);
    elegirLaFoto();
    soltar(FOTO_DE_A);
    await waitFor(() => {
      expect(laSolicitud('PUT', '/api/cuenta/foto')).toBeDefined();
    });
    await entraB();
    act(() => {
      laSolicitud('PUT', '/api/cuenta/foto')?.responder(CUENTA_A_CON_FOTO);
    });
    await dejarPasarLoPendiente();

    expect(actualizarCuenta).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Elegir una foto|Cambiar la foto/)).toBeEnabled();
  });

  it('si A sale y vuelve a entrar mientras se prepara, tampoco se sube', async () => {
    const soltar = laPreparacionTarda();

    render(<TuFoto actualizarCuenta={vi.fn()} />);
    elegirLaFoto();
    await alCambiarLaSesion(null, { persistente: false });
    await alCambiarLaSesion('persona-a', { persistente: false });
    soltar(FOTO_DE_A);
    await dejarPasarLoPendiente();

    expect(peticiones).toHaveLength(0);
  });

  it('si solo se sale de la pantalla, con la misma sesion, tampoco se sube', async () => {
    const soltar = laPreparacionTarda();
    const vista = render(<TuFoto actualizarCuenta={vi.fn()} />);

    elegirLaFoto();
    vista.unmount();
    soltar(FOTO_DE_A);
    await dejarPasarLoPendiente();

    expect(peticiones).toHaveLength(0);
  });

  it('si la subida de A ya salio y llega la respuesta con la sesion de B, no toca lo que ve B ni avisa a nadie', async () => {
    const actualizarCuenta = vi.fn();
    const soltar = laPreparacionTarda();
    const vista = render(<TuFoto actualizarCuenta={actualizarCuenta} />);

    render(<Sonda />);
    elegirLaFoto();
    soltar(FOTO_DE_A);
    await waitFor(() => {
      expect(laSolicitud('PUT', '/api/cuenta/foto')).toBeDefined();
    });
    vista.unmount();
    await entraB();

    act(() => {
      laSolicitud('PUT', '/api/cuenta/foto')?.responder(CUENTA_A_CON_FOTO);
    });
    await dejarPasarLoPendiente();

    expect(actualizarCuenta).not.toHaveBeenCalled();
    expect(fotoQueSeVe()).toBe('blob:foto-de-b');
  });

  it('al salir de la pantalla se cancela la subida que estaba en vuelo', async () => {
    const soltar = laPreparacionTarda();
    const vista = render(<TuFoto actualizarCuenta={vi.fn()} />);

    elegirLaFoto();
    soltar(FOTO_DE_A);
    await waitFor(() => {
      expect(laSolicitud('PUT', '/api/cuenta/foto')).toBeDefined();
    });

    expect(laSolicitud('PUT', '/api/cuenta/foto')?.senal?.aborted).toBe(false);

    vista.unmount();

    expect(laSolicitud('PUT', '/api/cuenta/foto')?.senal?.aborted).toBe(true);
  });
});

describe('quitar la foto', () => {
  function conLaFotoDeA() {
    act(() => {
      sincronizarLaFoto(CUENTA_A_CON_FOTO, FOTO_DE_A);
    });
  }

  it('con la sesion de siempre la quita con el token de quien la tiene', async () => {
    const actualizarCuenta = vi.fn();

    conLaFotoDeA();
    render(<TuFoto actualizarCuenta={actualizarCuenta} />);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar la foto' }));

    await waitFor(() => {
      expect(laSolicitud('DELETE', '/api/cuenta/foto')).toBeDefined();
    });
    expect(laSolicitud('DELETE', '/api/cuenta/foto')?.autorizacion).toBe('Bearer token-de-a');

    act(() => {
      laSolicitud('DELETE', '/api/cuenta/foto')?.responder(cuentaDe('persona-a'));
    });

    expect(await screen.findByText('Quitaste tu foto.')).toBeInTheDocument();
    expect(actualizarCuenta).toHaveBeenCalledOnce();
  });

  it('si la respuesta de A llega con la sesion de B, no borra ni cambia lo que ve B', async () => {
    const actualizarCuenta = vi.fn();

    conLaFotoDeA();
    const vista = render(<TuFoto actualizarCuenta={actualizarCuenta} />);

    render(<Sonda />);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar la foto' }));
    await waitFor(() => {
      expect(laSolicitud('DELETE', '/api/cuenta/foto')).toBeDefined();
    });
    vista.unmount();
    await entraB();

    act(() => {
      laSolicitud('DELETE', '/api/cuenta/foto')?.responder(cuentaDe('persona-a'));
    });
    await dejarPasarLoPendiente();

    expect(actualizarCuenta).not.toHaveBeenCalled();
    expect(fotoQueSeVe()).toBe('blob:foto-de-b');
  });

  it('con la pantalla viva, si la respuesta de A llega con la sesion de B, no dice nada ni deja ocupado', async () => {
    const actualizarCuenta = vi.fn();

    conLaFotoDeA();
    render(<TuFoto actualizarCuenta={actualizarCuenta} />);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar la foto' }));
    await waitFor(() => {
      expect(laSolicitud('DELETE', '/api/cuenta/foto')).toBeDefined();
    });
    await entraB();
    act(() => {
      laSolicitud('DELETE', '/api/cuenta/foto')?.responder(cuentaDe('persona-a'));
    });
    await dejarPasarLoPendiente();

    expect(actualizarCuenta).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar la foto' })).toBeEnabled();
  });

  it('al salir de la pantalla se cancela la peticion que estaba en vuelo', async () => {
    conLaFotoDeA();
    const vista = render(<TuFoto actualizarCuenta={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Quitar la foto' }));
    await waitFor(() => {
      expect(laSolicitud('DELETE', '/api/cuenta/foto')).toBeDefined();
    });
    vista.unmount();

    expect(laSolicitud('DELETE', '/api/cuenta/foto')?.senal?.aborted).toBe(true);
  });
});

describe('volver a pedir la foto de A cuando ya es otra la sesion (la recarga)', () => {
  it('la foto de A que llega tarde no se queda en lo que ve B', async () => {
    render(<Sonda />);
    act(() => {
      sincronizarLosArchivosDeLaPersona(CUENTA_A_CON_FOTO);
    });
    await waitFor(() => {
      expect(laSolicitud('GET', '/api/cuenta/foto')).toBeDefined();
    });
    await entraB();

    act(() => {
      // El servidor contesta con los bytes, que son una foto de A.
      laSolicitud('GET', '/api/cuenta/foto')?.responder(null);
    });
    await dejarPasarLoPendiente();

    expect(fotoQueSeVe()).toBe('blob:foto-de-b');
  });
});

describe('subir la mascota propia', () => {
  function pintarLaMascota() {
    const guardar = vi.fn().mockResolvedValue(undefined);
    const actualizarCuenta = vi.fn();
    const vista = render(
      <TuMascotaPropia
        cuenta={cuentaDe('persona-a')}
        guardar={guardar}
        actualizarCuenta={actualizarCuenta}
      />,
    );

    return { guardar, actualizarCuenta, vista };
  }

  it('con la sesion de siempre la sube con el token de quien la eligio y la deja como su acompanante', async () => {
    const { guardar } = pintarLaMascota();

    elegirElSvg();
    await waitFor(() => {
      expect(laSolicitud('PUT', '/api/cuenta/mascota-propia')).toBeDefined();
    });
    expect(laSolicitud('PUT', '/api/cuenta/mascota-propia')?.autorizacion).toBe(
      'Bearer token-de-a',
    );

    act(() => {
      laSolicitud('PUT', '/api/cuenta/mascota-propia')?.responder(CUENTA_A_CON_MASCOTA);
    });

    await waitFor(() => {
      expect(guardar).toHaveBeenCalledOnce();
    });
    // Lo segundo que se pide (dejarla como acompanante) tambien es de quien la subio.
    expect(guardar).toHaveBeenCalledWith(
      expect.objectContaining({ mascota: expect.anything() as unknown }),
      expect.objectContaining({ persona: 'persona-a' }),
    );
  });

  it('si la respuesta de A llega con la sesion de B, no pide nada mas con la sesion de B ni toca lo que ve B', async () => {
    const { guardar, actualizarCuenta, vista } = pintarLaMascota();

    render(<Sonda />);
    elegirElSvg();
    await waitFor(() => {
      expect(laSolicitud('PUT', '/api/cuenta/mascota-propia')).toBeDefined();
    });
    vista.unmount();
    await entraB();

    act(() => {
      laSolicitud('PUT', '/api/cuenta/mascota-propia')?.responder(CUENTA_A_CON_MASCOTA);
    });
    await dejarPasarLoPendiente();

    expect(guardar).not.toHaveBeenCalled();
    expect(actualizarCuenta).not.toHaveBeenCalled();
    expect(peticiones).toHaveLength(1);
    expect(screen.getByTestId('mascota').textContent).toBe('ninguna');
    expect(fotoQueSeVe()).toBe('blob:foto-de-b');
  });

  it('si cambia la sesion mientras se deja como acompanante, no dice que se guardo ni que fallo', async () => {
    let rechazarGuardar: (error: unknown) => void = () => undefined;
    const guardar = vi.fn().mockReturnValue(
      new Promise<void>((_resolver, rechazar) => {
        rechazarGuardar = rechazar;
      }),
    );
    const actualizarCuenta = vi.fn();

    render(
      <TuMascotaPropia
        cuenta={cuentaDe('persona-a')}
        guardar={guardar}
        actualizarCuenta={actualizarCuenta}
      />,
    );
    elegirElSvg();
    await waitFor(() => {
      expect(laSolicitud('PUT', '/api/cuenta/mascota-propia')).toBeDefined();
    });
    act(() => {
      laSolicitud('PUT', '/api/cuenta/mascota-propia')?.responder(CUENTA_A_CON_MASCOTA);
    });
    await waitFor(() => {
      expect(guardar).toHaveBeenCalledOnce();
    });
    await entraB();
    // Con el contexto de A, el cliente HTTP descarta la peticion de lo segundo.
    act(() => {
      rechazarGuardar(new DOMException('La sesion cambio', 'AbortError'));
    });
    await dejarPasarLoPendiente();

    expect(actualizarCuenta).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('con la pantalla viva, si la respuesta de A llega con la sesion de B, no dice nada ni deja ocupado', async () => {
    const { guardar, actualizarCuenta } = pintarLaMascota();

    elegirElSvg();
    await waitFor(() => {
      expect(laSolicitud('PUT', '/api/cuenta/mascota-propia')).toBeDefined();
    });
    await entraB();
    act(() => {
      laSolicitud('PUT', '/api/cuenta/mascota-propia')?.responder(CUENTA_A_CON_MASCOTA);
    });
    await dejarPasarLoPendiente();

    expect(guardar).not.toHaveBeenCalled();
    expect(actualizarCuenta).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Subir mi dibujo|Cambiar mi dibujo/)).toBeEnabled();
  });

  it('al salir de la pantalla se cancela la subida que estaba en vuelo', async () => {
    const { vista } = pintarLaMascota();

    elegirElSvg();
    await waitFor(() => {
      expect(laSolicitud('PUT', '/api/cuenta/mascota-propia')).toBeDefined();
    });
    vista.unmount();

    expect(laSolicitud('PUT', '/api/cuenta/mascota-propia')?.senal?.aborted).toBe(true);
  });
});

describe('quitar la mascota propia', () => {
  it('al salir de la pantalla se cancela la peticion que estaba en vuelo', async () => {
    const vista = render(
      <TuMascotaPropia
        cuenta={CUENTA_A_CON_MASCOTA}
        guardar={vi.fn()}
        actualizarCuenta={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Quitar mi mascota' }));
    await waitFor(() => {
      expect(laSolicitud('DELETE', '/api/cuenta/mascota-propia')).toBeDefined();
    });
    vista.unmount();

    expect(laSolicitud('DELETE', '/api/cuenta/mascota-propia')?.senal?.aborted).toBe(true);
  });

  it('con la pantalla viva, si la respuesta de A llega con la sesion de B, no dice nada ni deja ocupado', async () => {
    const actualizarCuenta = vi.fn();

    render(
      <TuMascotaPropia
        cuenta={CUENTA_A_CON_MASCOTA}
        guardar={vi.fn()}
        actualizarCuenta={actualizarCuenta}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Quitar mi mascota' }));
    await waitFor(() => {
      expect(laSolicitud('DELETE', '/api/cuenta/mascota-propia')).toBeDefined();
    });
    await entraB();
    act(() => {
      laSolicitud('DELETE', '/api/cuenta/mascota-propia')?.responder(cuentaDe('persona-a'));
    });
    await dejarPasarLoPendiente();

    expect(actualizarCuenta).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar mi mascota' })).toBeEnabled();
  });

  it('si la respuesta de A llega con la sesion de B, no cambia lo que ve B ni avisa a nadie', async () => {
    const actualizarCuenta = vi.fn();
    const vista = render(
      <TuMascotaPropia
        cuenta={CUENTA_A_CON_MASCOTA}
        guardar={vi.fn()}
        actualizarCuenta={actualizarCuenta}
      />,
    );

    render(<Sonda />);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar mi mascota' }));
    await waitFor(() => {
      expect(laSolicitud('DELETE', '/api/cuenta/mascota-propia')).toBeDefined();
    });
    expect(laSolicitud('DELETE', '/api/cuenta/mascota-propia')?.autorizacion).toBe(
      'Bearer token-de-a',
    );
    vista.unmount();
    await entraB();

    act(() => {
      laSolicitud('DELETE', '/api/cuenta/mascota-propia')?.responder(cuentaDe('persona-a'));
    });
    await dejarPasarLoPendiente();

    expect(actualizarCuenta).not.toHaveBeenCalled();
    expect(fotoQueSeVe()).toBe('blob:foto-de-b');
  });
});
