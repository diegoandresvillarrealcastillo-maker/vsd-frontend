import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { retirarLaFoto, subirLaFoto } from '../../foto/fotoDePerfil.ts';
import { FotoRechazada, prepararLaFoto } from '../../foto/prepararLaFoto.ts';
import { ErrorDeLaApi } from '../../infraestructura/api/clienteHttp.ts';
import type { Cuenta } from '../../infraestructura/api/cuenta.ts';
import { TuFoto } from './TuFoto.tsx';

/**
 * La seccion «Tu foto» del perfil (SCRUM-120).
 *
 * El recorte y la compresion (`prepararLaFoto`) y el guardado (`subirLaFoto`)
 * se simulan: se prueban aparte. Lo que se comprueba aqui es lo que ve y hace la
 * persona: que se pueda elegir, cambiar y quitar, con teclado y con lector de
 * pantalla, y que cada fallo diga que hacer.
 */
const { foto, fijarLaFoto } = vi.hoisted(() => {
  const estado: { url: string | null } = { url: null };

  return {
    foto: estado,
    fijarLaFoto: (url: string | null) => {
      estado.url = url;
    },
  };
});

vi.mock('../../foto/fotoDePerfil.ts', () => ({
  useFotoDePerfil: () => foto.url,
  subirLaFoto: vi.fn(),
  retirarLaFoto: vi.fn(),
}));
vi.mock('../../foto/prepararLaFoto.ts', async (importarOriginal) => ({
  ...(await importarOriginal<typeof import('../../foto/prepararLaFoto.ts')>()),
  prepararLaFoto: vi.fn(),
}));

const CUENTA_CON_FOTO = {
  id: 'una-cuenta',
  foto: { actualizadaEl: '2026-10-09T15:30:00.000Z' },
} as unknown as Cuenta;
const CUENTA_SIN_FOTO = { id: 'una-cuenta', foto: null } as unknown as Cuenta;

const LISTA = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
const ARCHIVO = new File([new Uint8Array(2000)], 'verano.jpg', { type: 'image/jpeg' });

function pintar() {
  const actualizarCuenta = vi.fn();

  render(<TuFoto actualizarCuenta={actualizarCuenta} />);

  return { actualizarCuenta };
}

/** El `userEvent` de una persona que elige cualquier archivo, aunque el selector filtre. */
const usuario = () => userEvent.setup({ applyAccept: false });

const entrada = (): HTMLInputElement => screen.getByLabelText(/Elegir una foto|Cambiar la foto/);

beforeEach(() => {
  fijarLaFoto(null);
  vi.mocked(prepararLaFoto).mockResolvedValue(LISTA);
  vi.mocked(subirLaFoto).mockResolvedValue(CUENTA_CON_FOTO);
  vi.mocked(retirarLaFoto).mockResolvedValue(CUENTA_SIN_FOTO);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('TuFoto, sin foto', () => {
  it('es un apartado con su titulo, y dice que es opcional y que solo la ve quien la pone', () => {
    pintar();

    const apartado = screen.getByRole('region', { name: 'Tu foto' });

    expect(apartado).toHaveTextContent('Es opcional y solo la ves tú');
    expect(apartado).toHaveTextContent('tu foto original no sale de él');
  });

  it('muestra el icono de siempre, no una imagen', () => {
    pintar();

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('ofrece elegir una foto y no ofrece quitar la que no hay', () => {
    pintar();

    expect(screen.getByLabelText('Elegir una foto')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Quitar/ })).not.toBeInTheDocument();
  });

  it('la entrada solo ofrece .jpg y .png', () => {
    pintar();

    const aceptados = entrada().accept.split(',');

    expect(aceptados).toEqual(
      expect.arrayContaining(['image/jpeg', 'image/png', '.jpg', '.jpeg', '.png']),
    );
    expect(aceptados).not.toContain('image/*');
    expect(entrada().type).toBe('file');
  });

  it('la entrada se alcanza con teclado: es la que recibe el foco, no un boton escondido', async () => {
    pintar();

    await userEvent.setup().tab();

    expect(entrada()).toHaveFocus();
  });
});

describe('TuFoto, con foto', () => {
  beforeEach(() => {
    fijarLaFoto('blob:la-foto');
  });

  it('la muestra, con un texto alternativo que dice que es la suya', () => {
    pintar();

    const imagen = screen.getByRole('img', { name: 'Tu foto de perfil' });

    expect(imagen).toHaveAttribute('src', 'blob:la-foto');
  });

  it('ofrece cambiarla y quitarla', () => {
    pintar();

    expect(screen.getByLabelText('Cambiar la foto')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar la foto' })).toBeEnabled();
    expect(screen.queryByLabelText('Elegir una foto')).not.toBeInTheDocument();
  });
});

describe('elegir una foto', () => {
  it('la prepara, la guarda, avisa a la pantalla con la cuenta que volvio y lo dice', async () => {
    const { actualizarCuenta } = pintar();

    await usuario().upload(entrada(), ARCHIVO);

    expect(prepararLaFoto).toHaveBeenCalledWith(ARCHIVO);
    expect(subirLaFoto).toHaveBeenCalledWith(LISTA);
    expect(actualizarCuenta).toHaveBeenCalledWith(CUENTA_CON_FOTO);
    expect(await screen.findByRole('status')).toHaveTextContent('Listo, esta es tu foto.');
  });

  it('manda a guardar lo que salio de prepararla, y no el archivo original', async () => {
    pintar();

    await usuario().upload(entrada(), ARCHIVO);

    await waitFor(() => {
      expect(subirLaFoto).toHaveBeenCalledOnce();
    });
    expect(subirLaFoto).not.toHaveBeenCalledWith(ARCHIVO);
  });

  it('mientras trabaja lo dice, y no deja empezar otra cosa', async () => {
    let terminar!: (cuenta: Cuenta) => void;

    vi.mocked(subirLaFoto).mockReturnValue(
      new Promise<Cuenta>((resolver) => {
        terminar = resolver;
      }),
    );
    fijarLaFoto('blob:la-foto');
    pintar();

    await usuario().upload(entrada(), ARCHIVO);

    expect(await screen.findByRole('status')).toHaveTextContent('Preparando y guardando tu foto…');
    expect(entrada()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Quitar la foto' })).toBeDisabled();

    terminar(CUENTA_CON_FOTO);

    await waitFor(() => {
      expect(entrada()).toBeEnabled();
    });
    expect(screen.getByRole('button', { name: 'Quitar la foto' })).toBeEnabled();
  });

  it('se puede volver a elegir el mismo archivo: la entrada se vacia', async () => {
    pintar();

    const persona = usuario();

    await persona.upload(entrada(), ARCHIVO);
    await screen.findByRole('status');
    await persona.upload(entrada(), ARCHIVO);

    await waitFor(() => {
      expect(subirLaFoto).toHaveBeenCalledTimes(2);
    });
    expect(entrada().value).toBe('');
  });

  it('cerrar el selector sin elegir nada no hace nada', async () => {
    pintar();

    await usuario().upload(entrada(), []);

    expect(prepararLaFoto).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('un aviso anterior se va al empezar otra vez', async () => {
    vi.mocked(prepararLaFoto).mockRejectedValueOnce(new FotoRechazada('tipo'));
    pintar();

    const persona = usuario();

    await persona.upload(entrada(), ARCHIVO);
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await persona.upload(entrada(), ARCHIVO);

    expect(await screen.findByRole('status')).toHaveTextContent('Listo');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('cuando la foto no sirve, dice que hacer y no guarda nada', () => {
  it.each([
    ['tipo', 'elige un archivo .jpg o .png'],
    ['pesado', 'menos de 10 MB'],
    ['ilegible', 'No se pudo abrir esa imagen'],
    ['no-cabe', 'menos de 50 KB'],
  ] as const)('%s', async (motivo, texto) => {
    vi.mocked(prepararLaFoto).mockRejectedValue(new FotoRechazada(motivo));
    const { actualizarCuenta } = pintar();

    await usuario().upload(entrada(), ARCHIVO);

    expect(await screen.findByRole('alert')).toHaveTextContent(texto);
    expect(subirLaFoto).not.toHaveBeenCalled();
    expect(actualizarCuenta).not.toHaveBeenCalled();
    expect(entrada()).toBeEnabled();
  });

  it('un archivo que no es .jpg ni .png, aunque el selector lo haya dejado pasar', async () => {
    // El navegador de verdad lo deja pasar si la persona elige «todos los archivos».
    vi.mocked(prepararLaFoto).mockRejectedValue(new FotoRechazada('tipo'));
    pintar();

    await usuario().upload(entrada(), new File(['GIF89a'], 'gato.gif', { type: 'image/gif' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('.jpg o .png');
  });

  it('si la API la rechaza, dice por que segun su codigo, y no pinta la cuenta', async () => {
    vi.mocked(subirLaFoto).mockRejectedValue(
      new ErrorDeLaApi(413, 'texto de la API', undefined, 'FOTO_DEMASIADO_PESADA'),
    );
    const { actualizarCuenta } = pintar();

    await usuario().upload(entrada(), ARCHIVO);

    expect(await screen.findByRole('alert')).toHaveTextContent('menos de 50 KB');
    expect(actualizarCuenta).not.toHaveBeenCalled();
  });

  it('sin conexion, lo dice y deja reintentar', async () => {
    vi.mocked(subirLaFoto).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    pintar();

    const persona = usuario();

    await persona.upload(entrada(), ARCHIVO);

    expect(await screen.findByRole('alert')).toHaveTextContent('Revisa tu conexión');

    await persona.upload(entrada(), ARCHIVO);

    expect(await screen.findByRole('status')).toHaveTextContent('Listo');
  });

  it('el almacenamiento caido dice que se reintente', async () => {
    vi.mocked(subirLaFoto).mockRejectedValue(
      new ErrorDeLaApi(503, 'x', undefined, 'ALMACENAMIENTO_NO_DISPONIBLE'),
    );
    pintar();

    await usuario().upload(entrada(), ARCHIVO);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo guardar tu foto ahora mismo',
    );
  });
});

describe('quitar la foto', () => {
  beforeEach(() => {
    fijarLaFoto('blob:la-foto');
  });

  it('la quita, avisa a la pantalla con la cuenta que volvio y lo dice', async () => {
    const { actualizarCuenta } = pintar();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Quitar la foto' }));

    expect(retirarLaFoto).toHaveBeenCalledOnce();
    expect(actualizarCuenta).toHaveBeenCalledWith(CUENTA_SIN_FOTO);
    expect(await screen.findByRole('status')).toHaveTextContent('Quitaste tu foto.');
  });

  it('mientras la quita, lo dice y no deja hacer otra cosa', async () => {
    let terminar!: (cuenta: Cuenta) => void;

    vi.mocked(retirarLaFoto).mockReturnValue(
      new Promise<Cuenta>((resolver) => {
        terminar = resolver;
      }),
    );
    pintar();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Quitar la foto' }));

    expect(screen.getByRole('button', { name: 'Quitando…' })).toBeDisabled();
    expect(entrada()).toBeDisabled();

    terminar(CUENTA_SIN_FOTO);
    await screen.findByRole('status');
  });

  it('el foco no se pierde: pasa a elegir una foto cuando el boton de quitar desaparece', async () => {
    pintar();

    const persona = userEvent.setup();

    await persona.tab(); // la entrada
    await persona.tab(); // quitar
    await persona.keyboard('{Enter}');
    fijarLaFoto(null);

    await waitFor(() => {
      expect(entrada()).toHaveFocus();
    });
  });

  it('si falla, lo dice, la foto se queda y se puede reintentar', async () => {
    vi.mocked(retirarLaFoto).mockRejectedValueOnce(
      new ErrorDeLaApi(503, 'x', undefined, 'ALMACENAMIENTO_NO_DISPONIBLE'),
    );
    const { actualizarCuenta } = pintar();

    const persona = userEvent.setup();

    await persona.click(screen.getByRole('button', { name: 'Quitar la foto' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo quitar tu foto ahora mismo',
    );
    expect(actualizarCuenta).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Quitar la foto' })).toBeEnabled();

    await persona.click(screen.getByRole('button', { name: 'Quitar la foto' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Quitaste tu foto.');
  });
});
