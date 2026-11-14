import { beforeEach, describe, expect, it, vi } from 'vitest';

const { elPanel, elAcceso } = vi.hoisted(() => ({ elPanel: vi.fn(), elAcceso: vi.fn() }));

// Cada modulo avisa cuando alguien lo importa: asi se ve cual se pidio sin bajar las pantallas de verdad.
vi.mock('../paginas/panel/Panel.tsx', () => {
  elPanel();

  return { Panel: () => null };
});
vi.mock('../paginas/autenticacion/Acceso.tsx', () => {
  elAcceso();

  return { Acceso: () => null };
});

import { precargarLaPrimeraPantalla } from './paginas.ts';

beforeEach(() => {
  elPanel.mockClear();
  elAcceso.mockClear();
});

describe('precargarLaPrimeraPantalla (SCRUM-283)', () => {
  it('con una sesion guardada pide el panel, que es adonde va, sin esperar a comprobarla', async () => {
    precargarLaPrimeraPantalla(true);
    await vi.dynamicImportSettled();

    expect(elPanel).toHaveBeenCalled();
    expect(elAcceso).not.toHaveBeenCalled();
  });

  it('sin sesion pide el acceso, que es lo primero que abre quien quiere entrar', async () => {
    precargarLaPrimeraPantalla(false);
    await vi.dynamicImportSettled();

    expect(elAcceso).toHaveBeenCalled();
    expect(elPanel).not.toHaveBeenCalled();
  });
});
