import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  URL_DE_TURNSTILE,
  cargarTurnstile,
  olvidarLaCargaDeTurnstile,
  type Turnstile,
} from './turnstile.ts';

const FALSO: Turnstile = { render: vi.fn(), reset: vi.fn(), remove: vi.fn() };

function scriptsDeTurnstile(): HTMLScriptElement[] {
  return [...document.head.querySelectorAll<HTMLScriptElement>('script')].filter((script) =>
    script.src.startsWith(URL_DE_TURNSTILE),
  );
}

beforeEach(() => {
  delete window.turnstile;
  olvidarLaCargaDeTurnstile();

  for (const script of scriptsDeTurnstile()) {
    script.remove();
  }
});

afterEach(() => {
  delete window.turnstile;
  olvidarLaCargaDeTurnstile();
});

describe('cargarTurnstile', () => {
  it('si Turnstile ya esta, lo devuelve sin descargar nada', async () => {
    window.turnstile = FALSO;

    await expect(cargarTurnstile()).resolves.toBe(FALSO);
    expect(scriptsDeTurnstile()).toHaveLength(0);
  });

  it('descarga el script de Cloudflare con render explicito, y solo una vez', async () => {
    const primera = cargarTurnstile();
    const segunda = cargarTurnstile();

    const scripts = scriptsDeTurnstile();

    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.src).toBe(`${URL_DE_TURNSTILE}?render=explicit`);
    expect(scripts[0]?.async).toBe(true);

    window.turnstile = FALSO;
    scripts[0]?.dispatchEvent(new Event('load'));

    await expect(primera).resolves.toBe(FALSO);
    await expect(segunda).resolves.toBe(FALSO);
  });

  it('no descarga nada hasta que alguien lo pide', () => {
    expect(scriptsDeTurnstile()).toHaveLength(0);
  });

  it('si el script no se puede descargar, rechaza, lo quita y deja volver a intentarlo', async () => {
    const primera = cargarTurnstile();

    scriptsDeTurnstile()[0]?.dispatchEvent(new Event('error'));

    await expect(primera).rejects.toThrow(/No se pudo descargar/);
    expect(scriptsDeTurnstile()).toHaveLength(0);

    const segunda = cargarTurnstile();

    expect(scriptsDeTurnstile()).toHaveLength(1);

    window.turnstile = FALSO;
    scriptsDeTurnstile()[0]?.dispatchEvent(new Event('load'));

    await expect(segunda).resolves.toBe(FALSO);
  });

  it('si el script carga pero no deja Turnstile disponible, rechaza y deja reintentar', async () => {
    const primera = cargarTurnstile();

    scriptsDeTurnstile()[0]?.dispatchEvent(new Event('load'));

    await expect(primera).rejects.toThrow(/no quedo disponible/);
    expect(scriptsDeTurnstile()).toHaveLength(0);
  });
});
