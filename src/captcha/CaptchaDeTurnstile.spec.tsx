import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { CaptchaDeTurnstile } from './CaptchaDeTurnstile.tsx';
import {
  URL_DE_TURNSTILE,
  olvidarLaCargaDeTurnstile,
  type OpcionesDeTurnstile,
  type Turnstile,
} from './turnstile.ts';
import { useCaptcha } from './useCaptcha.ts';

const CLAVE = '1x00000000000000000000AA';

interface Pintado {
  readonly id: string;
  readonly contenedor: HTMLElement;
  readonly opciones: OpcionesDeTurnstile;
}

let pintados: Pintado[];
let turnstile: {
  render: Mock<Turnstile['render']>;
  reset: Mock<Turnstile['reset']>;
  remove: Mock<Turnstile['remove']>;
};

/** Un Turnstile de mentira que guarda lo que le piden pintar. */
function instalarTurnstile(): void {
  pintados = [];
  turnstile = {
    render: vi.fn<Turnstile['render']>((contenedor, opciones) => {
      const id = `widget-${pintados.length + 1}`;

      pintados.push({ id, contenedor, opciones });

      return id;
    }),
    reset: vi.fn<Turnstile['reset']>(),
    remove: vi.fn<Turnstile['remove']>(),
  };
  window.turnstile = turnstile;
}

function Prueba({ clave = CLAVE }: { clave?: string | null }) {
  const captcha = useCaptcha(clave);

  return (
    <>
      <CaptchaDeTurnstile captcha={captcha} accion="acceso" />
      <p data-testid="token">{captcha.token ?? 'ninguno'}</p>
      <button type="button" onClick={captcha.reiniciar}>
        Reiniciar
      </button>
    </>
  );
}

function scriptsDeTurnstile(): HTMLScriptElement[] {
  return [...document.head.querySelectorAll<HTMLScriptElement>('script')].filter((script) =>
    script.src.startsWith(URL_DE_TURNSTILE),
  );
}

/** El ultimo widget pintado, esperando a que el cargador termine. */
async function elWidget(): Promise<Pintado> {
  await vi.waitFor(() => {
    expect(pintados.length).toBeGreaterThan(0);
  });

  return pintados.at(-1)!;
}

beforeEach(() => {
  olvidarLaCargaDeTurnstile();
  instalarTurnstile();
});

afterEach(() => {
  delete window.turnstile;
  delete document.documentElement.dataset.tema;
  olvidarLaCargaDeTurnstile();

  for (const script of scriptsDeTurnstile()) {
    script.remove();
  }
});

describe('sin clave del sitio', () => {
  it('no pinta nada, no descarga nada y no habla con Cloudflare', () => {
    delete window.turnstile;

    const { container } = render(<Prueba clave={null} />);

    expect(container.querySelector('.captcha')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(scriptsDeTurnstile()).toHaveLength(0);
  });
});

describe('con clave del sitio', () => {
  it('pinta el widget con la clave, la accion, el idioma y el modo que solo molesta si hace falta', async () => {
    render(<Prueba />);

    const { opciones, contenedor } = await elWidget();

    expect(opciones).toMatchObject({
      sitekey: CLAVE,
      action: 'acceso',
      language: 'es',
      size: 'flexible',
      appearance: 'interaction-only',
      theme: 'auto',
    });
    expect(contenedor.className).toContain('captcha__widget');
  });

  it('sigue el tema que la persona eligio en la aplicacion', async () => {
    document.documentElement.dataset.tema = 'oscuro';
    render(<Prueba />);

    expect((await elWidget()).opciones.theme).toBe('dark');
  });

  it('mientras Cloudflare comprueba, lo dice en una region que un lector de pantalla anuncia', async () => {
    render(<Prueba />);
    await elWidget();

    const estado = screen.getByRole('status');

    expect(estado).toHaveTextContent(/Comprobando que eres una persona/);
    expect(estado).toHaveTextContent(/Si aparece una casilla, márcala/);
    expect(screen.getByTestId('token')).toHaveTextContent('ninguno');
  });

  it('cuando Cloudflare da el token, lo entrega y lo dice', async () => {
    render(<Prueba />);

    const { opciones } = await elWidget();

    act(() => opciones.callback('token-1'));

    expect(screen.getByTestId('token')).toHaveTextContent('token-1');
    expect(screen.getByRole('status')).toHaveTextContent('Verificación lista.');
  });

  it('si el token caduca, se retira y se vuelve a esperar', async () => {
    render(<Prueba />);

    const { opciones } = await elWidget();

    act(() => opciones.callback('token-1'));
    act(() => opciones['expired-callback']?.());

    expect(screen.getByTestId('token')).toHaveTextContent('ninguno');
    expect(screen.getByRole('status')).toHaveTextContent(/Comprobando/);
  });

  it('si la persona tarda demasiado en resolver el reto, se vuelve a esperar', async () => {
    render(<Prueba />);

    const { opciones } = await elWidget();

    act(() => opciones['timeout-callback']?.());

    expect(screen.getByRole('status')).toHaveTextContent(/Comprobando/);
  });

  it('un token nuevo pedido por la pantalla reinicia el widget y retira el anterior', async () => {
    const usuario = userEvent.setup({ delay: null });

    render(<Prueba />);

    const { opciones, id } = await elWidget();

    act(() => opciones.callback('token-1'));
    await usuario.click(screen.getByRole('button', { name: 'Reiniciar' }));

    expect(turnstile.reset).toHaveBeenCalledWith(id);
    expect(screen.getByTestId('token')).toHaveTextContent('ninguno');
    expect(screen.getByRole('status')).toHaveTextContent(/Comprobando/);
  });

  it('al quitar la pantalla se quita el widget', async () => {
    const { unmount } = render(<Prueba />);
    const { id } = await elWidget();

    unmount();

    expect(turnstile.remove).toHaveBeenCalledWith(id);
  });
});

describe('cuando algo falla', () => {
  it('un error del widget se dice y deja reintentar', async () => {
    const usuario = userEvent.setup({ delay: null });

    render(<Prueba />);

    const { opciones, id } = await elWidget();

    act(() => opciones['error-callback']?.());

    expect(screen.getByRole('status')).toHaveTextContent(/No pudimos hacer la verificación/);

    await usuario.click(screen.getByRole('button', { name: 'Intentar de nuevo' }));

    // El widget roto se quita y se pinta uno nuevo.
    expect(turnstile.remove).toHaveBeenCalledWith(id);
    await vi.waitFor(() => {
      expect(pintados).toHaveLength(2);
    });
    expect(screen.getByRole('status')).toHaveTextContent(/Comprobando/);
    expect(screen.queryByRole('button', { name: 'Intentar de nuevo' })).toBeNull();
  });

  it('si el script de Cloudflare no se puede descargar, lo dice y deja reintentar', async () => {
    delete window.turnstile;

    const usuario = userEvent.setup({ delay: null });

    render(<Prueba />);

    await vi.waitFor(() => {
      expect(scriptsDeTurnstile()).toHaveLength(1);
    });

    act(() => {
      scriptsDeTurnstile()[0]?.dispatchEvent(new Event('error'));
    });

    await vi.waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/No pudimos hacer la verificación/);
    });

    await usuario.click(screen.getByRole('button', { name: 'Intentar de nuevo' }));

    await vi.waitFor(() => {
      expect(scriptsDeTurnstile()).toHaveLength(1);
    });
  });
});
