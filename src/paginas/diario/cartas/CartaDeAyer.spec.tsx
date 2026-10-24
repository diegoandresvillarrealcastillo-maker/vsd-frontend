import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorDeLaApi } from '../../../infraestructura/api/clienteHttp.ts';
import {
  abrirUnAlmacenDePrueba,
  cerrarElAlmacenDePrueba,
} from '../../../pruebas/almacenDePrueba.ts';
import { fallosDeAccesibilidad } from '../../../pruebas/axe.ts';
import { cicloActual } from '../../../sincronizacion/ciclo.ts';
import { diasAntes } from '../../../tiempo/dias.ts';
import { fijarLaZonaDeLaCuenta } from '../../../tiempo/zonaHoraria.ts';
import { diaDe } from '../calendarioDelDiario.ts';
import { CartaDeAyer } from './CartaDeAyer.tsx';

/**
 * La tarjeta «Ayer te dejaste esto» (SCRUM-230): la cola y el almacen de verdad, la API simulada.
 */
const { api, hayConexionConLaApi } = vi.hoisted(() => ({
  api: {
    consultarCartasEnEspera: vi.fn(),
    abrirCarta: vi.fn(),
    borrarAnotacion: vi.fn(),
  },
  hayConexionConLaApi: vi.fn(),
}));

vi.mock('../../../infraestructura/api/conexion.ts', () => ({ hayConexionConLaApi }));
vi.mock('../../../infraestructura/api/diario.ts', async (importar) => ({
  ...(await importar<typeof import('../../../infraestructura/api/diario.ts')>()),
  ...api,
}));

const usuario = userEvent.setup({ delay: null });

fijarLaZonaDeLaCuenta('America/Bogota');

const HOY = diaDe(new Date());
const AYER = diasAntes(HOY, 1);
const ANTEAYER = diasAntes(HOY, 2);

const DE_AYER = { id: 'c-ayer', dia: AYER };
const DE_ANTEAYER = { id: 'c-anteayer', dia: ANTEAYER };

/** Lo que el servidor entrega al abrirla: ya sin sello y con su texto. */
function abierta(id: string, texto: string) {
  const creadaEn = new Date().toISOString();

  return {
    id,
    dia: AYER,
    titulo: 'Carta a mí de mañana',
    contenido: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: texto }] }],
    },
    adjuntos: [],
    version: 1,
    creadaEn,
    editadaEn: creadaEn,
    editableHasta: creadaEn,
    carta: true,
    sellada: false,
  };
}

async function laCola() {
  return (await cicloActual()?.almacen.operaciones()) ?? [];
}

beforeEach(async () => {
  hayConexionConLaApi.mockResolvedValue(true);
  await abrirUnAlmacenDePrueba();
  api.consultarCartasEnEspera.mockResolvedValue([DE_AYER]);
  api.borrarAnotacion.mockResolvedValue(undefined);
});

afterEach(() => {
  cerrarElAlmacenDePrueba();
  api.consultarCartasEnEspera.mockReset();
  api.abrirCarta.mockReset();
  api.borrarAnotacion.mockReset();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('La tarjeta «Ayer te dejaste esto»', () => {
  it('sin ninguna carta esperando no pinta nada: ni un hueco ni una carta inventada', async () => {
    api.consultarCartasEnEspera.mockResolvedValue([]);

    const { container } = render(<CartaDeAyer />);

    await waitFor(() => {
      expect(api.consultarCartasEnEspera).toHaveBeenCalled();
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('sin conexion y sin copia tampoco pinta nada, y no lo dice como un error', async () => {
    api.consultarCartasEnEspera.mockRejectedValue(new TypeError('Failed to fetch'));

    const { container } = render(<CartaDeAyer />);

    await waitFor(() => {
      expect(api.consultarCartasEnEspera).toHaveBeenCalled();
    });
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('ofrece la carta de ayer con dos acciones del mismo peso y sin ensenar su texto', async () => {
    render(<CartaDeAyer />);

    expect(await screen.findByRole('heading', { name: 'Ayer te dejaste esto' })).toBeVisible();

    const leerla = screen.getByRole('button', { name: 'Leerla' });
    const borrarla = screen.getByRole('button', { name: 'Borrar sin leerla' });

    // La misma pildora: ninguna empuja hacia la otra.
    expect(leerla.className).toBe(borrarla.className);
    expect(api.abrirCarta).not.toHaveBeenCalled();
  });

  it('una carta de antes de ayer dice de cuando es, sin decir «ayer»', async () => {
    api.consultarCartasEnEspera.mockResolvedValue([DE_ANTEAYER]);

    render(<CartaDeAyer />);

    const titulo = await screen.findByRole('heading', { level: 2 });

    expect(titulo.textContent).toMatch(/^Te dejaste esto el /);
    expect(titulo.textContent).not.toMatch(/ayer te dejaste/i);
  });

  it('no tiene fallos de accesibilidad, ni abierta la confirmacion de borrar', async () => {
    render(<CartaDeAyer />);
    await screen.findByRole('button', { name: 'Leerla' });

    expect(await fallosDeAccesibilidad()).toEqual([]);

    await usuario.click(screen.getByRole('button', { name: 'Borrar sin leerla' }));

    expect(await fallosDeAccesibilidad()).toEqual([]);
  });
});

describe('Leerla', () => {
  it('abre la carta, ensena su texto, lleva el foco al titulo y dice que se queda en el diario', async () => {
    api.abrirCarta.mockResolvedValue(abierta('c-ayer', 'Mañana te toca respirar'));

    render(<CartaDeAyer />);
    await usuario.click(await screen.findByRole('button', { name: 'Leerla' }));

    expect(await screen.findByText('Mañana te toca respirar')).toBeVisible();
    expect(api.abrirCarta).toHaveBeenCalledWith('c-ayer', expect.any(AbortSignal));
    expect(screen.getByRole('heading', { name: 'Ayer te dejaste esto' })).toHaveFocus();
    expect(screen.getByText(/Se queda en tu diario/)).toBeVisible();
  });

  it('cerrarla quita la tarjeta cuando no hay otra carta', async () => {
    api.abrirCarta.mockResolvedValue(abierta('c-ayer', 'Hola'));

    const { container } = render(<CartaDeAyer />);
    await usuario.click(await screen.findByRole('button', { name: 'Leerla' }));
    await usuario.click(await screen.findByRole('button', { name: 'Cerrar' }));

    expect(container).toBeEmptyDOMElement();
  });

  it('con dos cartas ofrece la mas reciente, y al cerrar la leida ofrece la siguiente', async () => {
    api.consultarCartasEnEspera.mockResolvedValue([DE_AYER, DE_ANTEAYER]);
    api.abrirCarta.mockResolvedValue(abierta('c-ayer', 'La de ayer'));

    render(<CartaDeAyer />);
    await usuario.click(await screen.findByRole('button', { name: 'Leerla' }));
    await usuario.click(await screen.findByRole('button', { name: 'Cerrar' }));

    expect((await screen.findByRole('heading', { level: 2 })).textContent).toMatch(
      /^Te dejaste esto el /,
    );
    expect(screen.getByRole('button', { name: 'Leerla' })).toBeVisible();
  });

  it('sin conexion lo dice con calma y deja borrarla sin leerla', async () => {
    api.abrirCarta.mockRejectedValue(new TypeError('Failed to fetch'));

    render(<CartaDeAyer />);
    await usuario.click(await screen.findByRole('button', { name: 'Leerla' }));

    expect(await screen.findByText(/Para leerla hace falta conexión/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Leerla' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Borrar sin leerla' })).toBeEnabled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('si todavia no es el dia, lo dice y no pinta nada de la carta', async () => {
    api.abrirCarta.mockRejectedValue(
      new ErrorDeLaApi(409, 'La carta está sellada', undefined, 'CARTA_PARA_MANANA'),
    );

    render(<CartaDeAyer />);
    await usuario.click(await screen.findByRole('button', { name: 'Leerla' }));

    expect(
      await screen.findByText(/Todavía no: esta carta se puede leer desde mañana/),
    ).toBeVisible();
  });

  it('si se borro desde otro dispositivo, la tarjeta se va sin alarmar', async () => {
    api.abrirCarta.mockRejectedValue(
      new ErrorDeLaApi(404, 'No existe', undefined, 'ANOTACION_NO_ENCONTRADA'),
    );

    const { container } = render(<CartaDeAyer />);
    await usuario.click(await screen.findByRole('button', { name: 'Leerla' }));

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('un fallo que no es de red no repite nada de la carta y deja reintentar', async () => {
    api.abrirCarta.mockRejectedValue(new ErrorDeLaApi(500, 'Falló', undefined, 'ERROR_INTERNO'));

    render(<CartaDeAyer />);
    await usuario.click(await screen.findByRole('button', { name: 'Leerla' }));

    expect(await screen.findByText(/No se pudo abrir ahora/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Leerla' })).toBeEnabled();
  });
});

describe('Borrar sin leerla', () => {
  it('pide una segunda pulsacion, y «Mejor no» devuelve el foco al boton y no borra nada', async () => {
    render(<CartaDeAyer />);
    await usuario.click(await screen.findByRole('button', { name: 'Borrar sin leerla' }));

    expect(screen.getByText('¿Borrarla sin leerla? No se puede deshacer.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sí, borrarla' })).toHaveFocus();

    await usuario.click(screen.getByRole('button', { name: 'Mejor no' }));

    expect(screen.queryByText(/No se puede deshacer/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Borrar sin leerla' })).toHaveFocus();
    expect(await laCola()).toHaveLength(0);
    expect(api.borrarAnotacion).not.toHaveBeenCalled();
  });

  it('borra de verdad: entra a la cola, sale a la API con el identificador y la tarjeta lo dice', async () => {
    render(<CartaDeAyer />);
    await usuario.click(await screen.findByRole('button', { name: 'Borrar sin leerla' }));
    await usuario.click(screen.getByRole('button', { name: 'Sí, borrarla' }));

    expect(await screen.findByText(/la borraste sin leerla/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Entendido' })).toHaveFocus();
    expect(api.abrirCarta).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(api.borrarAnotacion).toHaveBeenCalledWith('c-ayer');
    });
  });

  it('sin conexion queda guardado en este equipo, lo dice, y la carta no vuelve a ofrecerse', async () => {
    hayConexionConLaApi.mockResolvedValue(false);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    render(<CartaDeAyer />);
    await usuario.click(await screen.findByRole('button', { name: 'Borrar sin leerla' }));
    await usuario.click(screen.getByRole('button', { name: 'Sí, borrarla' }));

    expect(await screen.findByText(/Se borra del todo en cuanto vuelva la conexión/)).toBeVisible();

    const cola = await laCola();

    expect(cola).toHaveLength(1);
    expect(cola[0]).toMatchObject({ tipo: 'diario.borrar', payload: { id: 'c-ayer' } });
    expect(api.borrarAnotacion).not.toHaveBeenCalled();

    // Aunque el servidor siga teniendola: lo ya mandado a borrar no se vuelve a ofrecer.
    await usuario.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByRole('button', { name: 'Leerla' })).toBeNull();
  });

  it('«Entendido» ofrece la siguiente carta, si hay', async () => {
    api.consultarCartasEnEspera.mockResolvedValue([DE_AYER, DE_ANTEAYER]);

    render(<CartaDeAyer />);
    await usuario.click(await screen.findByRole('button', { name: 'Borrar sin leerla' }));
    await usuario.click(screen.getByRole('button', { name: 'Sí, borrarla' }));
    await usuario.click(await screen.findByRole('button', { name: 'Entendido' }));

    expect((await screen.findByRole('heading', { level: 2 })).textContent).toMatch(
      /^Te dejaste esto el /,
    );
  });

  it('si no se pudo guardar el borrado en este equipo, lo dice y la carta sigue ahi', async () => {
    render(<CartaDeAyer />);
    await usuario.click(await screen.findByRole('button', { name: 'Borrar sin leerla' }));

    // Se cierra la sesion con la tarjeta a la vista: ya no hay donde guardar.
    cerrarElAlmacenDePrueba();
    await usuario.click(screen.getByRole('button', { name: 'Sí, borrarla' }));

    expect(await screen.findByText(/No pudimos borrarla en este momento/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Leerla' })).toBeVisible();
    expect(api.borrarAnotacion).not.toHaveBeenCalled();
  });
});
