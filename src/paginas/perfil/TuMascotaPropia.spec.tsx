import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PESO_MAXIMO_DEL_SVG } from '../../foto/comprobarElSvg.ts';
import { retirarLaMascotaPropia, subirLaMascotaPropia } from '../../foto/mascotaPropia.ts';
import { ErrorDeLaApi } from '../../infraestructura/api/clienteHttp.ts';
import type { Cuenta } from '../../infraestructura/api/cuenta.ts';
import { TuMascotaPropia } from './TuMascotaPropia.tsx';

/**
 * El apartado «Tu propia mascota» del perfil (SCRUM-122).
 *
 * El guardado (`subirLaMascotaPropia`) y la API se simulan: se prueban aparte. Lo
 * que se comprueba aqui es lo que ve y hace la persona: que se pueda subir,
 * cambiar y quitar, con teclado y con lector de pantalla, que la primera quede
 * como su acompanante, y que cada fallo diga que hacer.
 */
const { dibujo, fijarElDibujo } = vi.hoisted(() => {
  const estado: { url: string | null } = { url: null };

  return {
    dibujo: estado,
    fijarElDibujo: (url: string | null) => {
      estado.url = url;
    },
  };
});

vi.mock('../../foto/mascotaPropia.ts', () => ({
  useMascotaPropia: () => ({ url: dibujo.url, cargando: false }),
  subirLaMascotaPropia: vi.fn(),
  retirarLaMascotaPropia: vi.fn(),
}));

const MARCA = '2026-10-12T15:30:00.000Z';

function cuentaDe(parcial: Partial<Cuenta>): Cuenta {
  return { id: 'una-cuenta', mascota: null, mascotaPropia: null, ...parcial } as unknown as Cuenta;
}

const SIN_MASCOTA_PROPIA = cuentaDe({});
const CON_MASCOTA_PROPIA = cuentaDe({ mascotaPropia: { actualizadaEl: MARCA } });
const ELEGIDA_LA_PROPIA = cuentaDe({
  mascota: { forma: 'propia', nombre: 'Luma' },
  mascotaPropia: { actualizadaEl: MARCA },
});

const ARCHIVO = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'mascota.svg', {
  type: 'image/svg+xml',
});

function pintar(cuenta: Cuenta = SIN_MASCOTA_PROPIA) {
  const guardar = vi.fn().mockResolvedValue(undefined);
  const actualizarCuenta = vi.fn();
  const alPintar = (cuentaActual: Cuenta) => (
    <TuMascotaPropia cuenta={cuentaActual} guardar={guardar} actualizarCuenta={actualizarCuenta} />
  );
  const { rerender } = render(alPintar(cuenta));

  return {
    guardar,
    actualizarCuenta,
    /** La pantalla recibe otra cuenta, como cuando la API devuelve la nueva. */
    conLaCuenta: (otra: Cuenta) => {
      rerender(alPintar(otra));
    },
  };
}

/** El `userEvent` de una persona que elige cualquier archivo, aunque el selector filtre. */
const usuario = () => userEvent.setup({ applyAccept: false });

const entrada = (): HTMLInputElement => screen.getByLabelText(/Subir mi dibujo|Cambiar mi dibujo/);

beforeEach(() => {
  fijarElDibujo(null);
  vi.mocked(subirLaMascotaPropia).mockResolvedValue(CON_MASCOTA_PROPIA);
  vi.mocked(retirarLaMascotaPropia).mockResolvedValue(SIN_MASCOTA_PROPIA);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('TuMascotaPropia, sin mascota propia', () => {
  it('es un apartado con su titulo, y dice que solo la ve quien la sube y que se rehace', () => {
    pintar();

    const apartado = screen.getByRole('region', { name: 'Tu propia mascota' });

    expect(apartado).toHaveTextContent('Solo lo ves tú');
    expect(apartado).toHaveTextContent('lo rehacemos solo con formas y colores');
  });

  it('muestra el icono de siempre, no una imagen', () => {
    pintar();

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('ofrece subir un dibujo y no ofrece quitar el que no hay', () => {
    pintar();

    expect(screen.getByLabelText('Subir mi dibujo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Quitar/ })).not.toBeInTheDocument();
  });

  it('la entrada solo ofrece SVG', () => {
    pintar();

    const aceptados = entrada().accept.split(',');

    expect(aceptados).toEqual(expect.arrayContaining(['image/svg+xml', '.svg']));
    expect(aceptados).not.toContain('image/*');
    expect(entrada().type).toBe('file');
  });

  it('la entrada se alcanza con teclado: es la que recibe el foco, no un boton escondido', async () => {
    pintar();

    await userEvent.setup().tab();

    expect(entrada()).toHaveFocus();
  });

  it('trae la guia de como preparar el dibujo, cerrada', () => {
    pintar();

    const guia = screen.getByText('Cómo preparar mi dibujo').closest('details');

    expect(guia).toBeInTheDocument();
    expect(guia).not.toHaveAttribute('open');
  });
});

describe('TuMascotaPropia, con mascota propia', () => {
  beforeEach(() => {
    fijarElDibujo('blob:mi-mascota');
  });

  it('la muestra, con un texto alternativo que dice que es la suya', () => {
    pintar(CON_MASCOTA_PROPIA);

    expect(screen.getByRole('img', { name: 'Tu mascota propia' })).toHaveAttribute(
      'src',
      'blob:mi-mascota',
    );
  });

  it('ofrece cambiarla y quitarla', () => {
    pintar(CON_MASCOTA_PROPIA);

    expect(screen.getByLabelText('Cambiar mi dibujo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar mi mascota' })).toBeEnabled();
    expect(screen.queryByLabelText('Subir mi dibujo')).not.toBeInTheDocument();
  });

  it('si el dibujo todavia no llega, ofrece lo mismo con el icono en su lugar', () => {
    fijarElDibujo(null);
    pintar(CON_MASCOTA_PROPIA);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar mi mascota' })).toBeEnabled();
  });
});

describe('subir la primera mascota propia', () => {
  it('manda el archivo tal cual, sin leerlo ni tocarlo', async () => {
    pintar();

    await usuario().upload(entrada(), ARCHIVO);

    await waitFor(() => {
      expect(subirLaMascotaPropia).toHaveBeenCalledOnce();
    });
    // El mismo archivo, no una copia: quien decide que se admite es el servidor.
    expect(vi.mocked(subirLaMascotaPropia).mock.calls[0]?.[0]).toBe(ARCHIVO);
  });

  it('la deja como su acompanante, con el nombre de fabrica, y lo dice', async () => {
    const { guardar, actualizarCuenta } = pintar();

    await usuario().upload(entrada(), ARCHIVO);

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Listo, tu mascota ya te acompaña.',
    );
    expect(guardar).toHaveBeenCalledWith({
      mascota: { forma: 'propia', nombre: 'Mi mascota' },
    });
    // La pantalla se pinta con la cuenta que devuelve el guardado de la eleccion.
    expect(actualizarCuenta).not.toHaveBeenCalled();
  });

  it('quien tenia a Ori sin cambiarle el nombre, pasa a «Mi mascota»', async () => {
    vi.mocked(subirLaMascotaPropia).mockResolvedValue({
      ...CON_MASCOTA_PROPIA,
      mascota: { forma: 'ori', nombre: 'Ori' },
    });
    const { guardar } = pintar();

    await usuario().upload(entrada(), ARCHIVO);
    await screen.findByRole('status');

    expect(guardar).toHaveBeenCalledWith({
      mascota: { forma: 'propia', nombre: 'Mi mascota' },
    });
  });

  it('quien le habia puesto su nombre a su mascota lo conserva', async () => {
    vi.mocked(subirLaMascotaPropia).mockResolvedValue({
      ...CON_MASCOTA_PROPIA,
      mascota: { forma: 'ori', nombre: 'Papelito' },
    });
    const { guardar } = pintar();

    await usuario().upload(entrada(), ARCHIVO);
    await screen.findByRole('status');

    expect(guardar).toHaveBeenCalledWith({
      mascota: { forma: 'propia', nombre: 'Papelito' },
    });
  });

  it('si no se pudo dejar como la elegida, el dibujo ya esta guardado: lo dice y pinta la cuenta', async () => {
    const { guardar, actualizarCuenta } = pintar();

    guardar.mockRejectedValue(new TypeError('Failed to fetch'));

    await usuario().upload(entrada(), ARCHIVO);

    const aviso = await screen.findByRole('alert');

    expect(aviso).toHaveTextContent('Tu dibujo se guardó');
    expect(aviso).toHaveTextContent('Elígelo en «Tu mascota»');
    expect(actualizarCuenta).toHaveBeenCalledWith(CON_MASCOTA_PROPIA);
  });

  it('mientras trabaja lo dice, y no deja empezar otra cosa', async () => {
    let terminar!: (cuenta: Cuenta) => void;

    vi.mocked(subirLaMascotaPropia).mockReturnValue(
      new Promise<Cuenta>((resolver) => {
        terminar = resolver;
      }),
    );
    pintar();

    await usuario().upload(entrada(), ARCHIVO);

    expect(await screen.findByRole('status')).toHaveTextContent('Revisando y guardando tu dibujo…');
    expect(entrada()).toBeDisabled();

    terminar(CON_MASCOTA_PROPIA);

    await waitFor(() => {
      expect(entrada()).toBeEnabled();
    });
  });
});

describe('cambiar la mascota propia que ya se tenia', () => {
  it('la guarda y pinta la cuenta, sin tocar cual esta elegida', async () => {
    const { guardar, actualizarCuenta } = pintar(CON_MASCOTA_PROPIA);

    await usuario().upload(entrada(), ARCHIVO);

    expect(await screen.findByRole('status')).toHaveTextContent('Listo, esta es tu mascota.');
    expect(actualizarCuenta).toHaveBeenCalledWith(CON_MASCOTA_PROPIA);
    expect(guardar).not.toHaveBeenCalled();
  });
});

describe('elegir un archivo', () => {
  it('se puede volver a elegir el mismo archivo: la entrada se vacia', async () => {
    pintar(CON_MASCOTA_PROPIA);

    const persona = usuario();

    await persona.upload(entrada(), ARCHIVO);
    await screen.findByRole('status');
    await persona.upload(entrada(), ARCHIVO);

    await waitFor(() => {
      expect(subirLaMascotaPropia).toHaveBeenCalledTimes(2);
    });
    expect(entrada().value).toBe('');
  });

  it('cerrar el selector sin elegir nada no hace nada', async () => {
    pintar();

    await usuario().upload(entrada(), []);

    expect(subirLaMascotaPropia).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('un aviso anterior no se queda mientras trabaja de nuevo', async () => {
    let terminar!: (cuenta: Cuenta) => void;

    vi.mocked(subirLaMascotaPropia)
      .mockRejectedValueOnce(new ErrorDeLaApi(400, 'x', undefined, 'MASCOTA_SVG_NO_ADMITIDO'))
      .mockReturnValueOnce(
        new Promise<Cuenta>((resolver) => {
          terminar = resolver;
        }),
      );
    pintar(CON_MASCOTA_PROPIA);

    const persona = usuario();

    await persona.upload(entrada(), ARCHIVO);
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await persona.upload(entrada(), ARCHIVO);

    // Todavia no termino: el fallo de antes no puede seguir a la vista.
    expect(await screen.findByRole('status')).toHaveTextContent('Revisando y guardando');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    terminar(CON_MASCOTA_PROPIA);
    await screen.findByText('Listo, esta es tu mascota.');
  });

  it('un aviso anterior se va al empezar otra vez', async () => {
    vi.mocked(subirLaMascotaPropia).mockRejectedValueOnce(
      new ErrorDeLaApi(400, 'x', undefined, 'MASCOTA_SVG_NO_ADMITIDO'),
    );
    pintar(CON_MASCOTA_PROPIA);

    const persona = usuario();

    await persona.upload(entrada(), ARCHIVO);
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await persona.upload(entrada(), ARCHIVO);

    expect(await screen.findByRole('status')).toHaveTextContent('Listo');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('cuando el dibujo no sirve, dice que hacer y no guarda nada', () => {
  it('un archivo que no es SVG se rechaza sin salir del navegador', async () => {
    const { guardar, actualizarCuenta } = pintar();

    await usuario().upload(entrada(), new File(['\x89PNG'], 'gato.png', { type: 'image/png' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('termine en .svg');
    expect(subirLaMascotaPropia).not.toHaveBeenCalled();
    expect(guardar).not.toHaveBeenCalled();
    expect(actualizarCuenta).not.toHaveBeenCalled();
    expect(entrada()).toBeEnabled();
  });

  it('uno que pesa mas de 100 KB se rechaza sin salir del navegador', async () => {
    pintar();

    await usuario().upload(
      entrada(),
      new File([new Uint8Array(PESO_MAXIMO_DEL_SVG + 1)], 'grande.svg', {
        type: 'image/svg+xml',
      }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('menos de 100 KB');
    expect(subirLaMascotaPropia).not.toHaveBeenCalled();
  });

  it.each([
    ['MASCOTA_SVG_PELIGROSO', 'por seguridad'],
    ['MASCOTA_SVG_NO_ADMITIDO', 'textos, imágenes, filtros o estilos'],
    ['MASCOTA_SVG_NO_ES_UN_SVG', 'no es un SVG válido'],
    ['MASCOTA_SVG_DEMASIADO_COMPLEJO', 'demasiado complejo'],
    ['ALMACENAMIENTO_NO_DISPONIBLE', 'No se pudo guardar tu mascota ahora mismo'],
  ])('si la API dice %s, lo explica y no pinta la cuenta', async (codigo, texto) => {
    vi.mocked(subirLaMascotaPropia).mockRejectedValue(
      new ErrorDeLaApi(400, 'x', undefined, codigo),
    );
    const { guardar, actualizarCuenta } = pintar();

    await usuario().upload(entrada(), ARCHIVO);

    expect(await screen.findByRole('alert')).toHaveTextContent(texto);
    expect(guardar).not.toHaveBeenCalled();
    expect(actualizarCuenta).not.toHaveBeenCalled();
    expect(entrada()).toBeEnabled();
  });

  it('sin conexion, lo dice y deja reintentar', async () => {
    vi.mocked(subirLaMascotaPropia).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    pintar();

    const persona = usuario();

    await persona.upload(entrada(), ARCHIVO);

    expect(await screen.findByRole('alert')).toHaveTextContent('Revisa tu conexión');

    await persona.upload(entrada(), ARCHIVO);

    expect(await screen.findByRole('status')).toHaveTextContent('Listo');
  });
});

describe('quitar la mascota propia', () => {
  beforeEach(() => {
    fijarElDibujo('blob:mi-mascota');
  });

  it('la quita, pinta la cuenta que volvio y lo dice', async () => {
    const { actualizarCuenta } = pintar(CON_MASCOTA_PROPIA);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Quitar mi mascota' }));

    expect(retirarLaMascotaPropia).toHaveBeenCalledOnce();
    expect(actualizarCuenta).toHaveBeenCalledWith(SIN_MASCOTA_PROPIA);
    expect(await screen.findByRole('status')).toHaveTextContent('Quitaste tu mascota propia.');
    expect(screen.getByRole('status')).not.toHaveTextContent('vuelve a ser');
  });

  it('si era la elegida, dice con quien vuelve a acompanarla', async () => {
    vi.mocked(retirarLaMascotaPropia).mockResolvedValue(
      cuentaDe({ mascota: { forma: 'fungito', nombre: 'Luma' }, mascotaPropia: null }),
    );
    pintar(ELEGIDA_LA_PROPIA);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Quitar mi mascota' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Quitaste tu mascota propia. Tu acompañante vuelve a ser Fungito.',
    );
  });

  it('mientras la quita, lo dice y no deja hacer otra cosa', async () => {
    let terminar!: (cuenta: Cuenta) => void;

    vi.mocked(retirarLaMascotaPropia).mockReturnValue(
      new Promise<Cuenta>((resolver) => {
        terminar = resolver;
      }),
    );
    pintar(CON_MASCOTA_PROPIA);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Quitar mi mascota' }));

    expect(screen.getByRole('button', { name: 'Quitando…' })).toBeDisabled();
    expect(entrada()).toBeDisabled();

    terminar(SIN_MASCOTA_PROPIA);
    await screen.findByRole('status');
  });

  it('el foco no se pierde: pasa a subir un dibujo cuando el boton de quitar desaparece', async () => {
    const { conLaCuenta } = pintar(CON_MASCOTA_PROPIA);

    const persona = userEvent.setup();

    await persona.tab(); // la entrada
    await persona.tab(); // quitar
    await persona.keyboard('{Enter}');
    conLaCuenta(SIN_MASCOTA_PROPIA);

    await waitFor(() => {
      expect(entrada()).toHaveFocus();
    });
  });

  it('un aviso anterior no se queda mientras la quita de nuevo', async () => {
    let terminar!: (cuenta: Cuenta) => void;

    vi.mocked(retirarLaMascotaPropia)
      .mockRejectedValueOnce(new ErrorDeLaApi(503, 'x', undefined, 'ALMACENAMIENTO_NO_DISPONIBLE'))
      .mockReturnValueOnce(
        new Promise<Cuenta>((resolver) => {
          terminar = resolver;
        }),
      );
    pintar(CON_MASCOTA_PROPIA);

    const persona = userEvent.setup();

    await persona.click(screen.getByRole('button', { name: 'Quitar mi mascota' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await persona.click(screen.getByRole('button', { name: 'Quitar mi mascota' }));

    expect(screen.getByRole('button', { name: 'Quitando…' })).toBeDisabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    terminar(SIN_MASCOTA_PROPIA);
    await screen.findByText('Quitaste tu mascota propia.');
  });

  it('si falla, lo dice, la mascota se queda y se puede reintentar', async () => {
    vi.mocked(retirarLaMascotaPropia).mockRejectedValueOnce(
      new ErrorDeLaApi(503, 'x', undefined, 'ALMACENAMIENTO_NO_DISPONIBLE'),
    );
    const { actualizarCuenta } = pintar(CON_MASCOTA_PROPIA);

    const persona = userEvent.setup();

    await persona.click(screen.getByRole('button', { name: 'Quitar mi mascota' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo quitar tu mascota ahora mismo',
    );
    expect(actualizarCuenta).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Quitar mi mascota' })).toBeEnabled();

    await persona.click(screen.getByRole('button', { name: 'Quitar mi mascota' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Quitaste tu mascota propia.');
  });
});
