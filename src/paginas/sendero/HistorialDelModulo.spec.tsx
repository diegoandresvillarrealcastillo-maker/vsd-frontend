import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorDeLaApi } from '../../infraestructura/api/clienteHttp.ts';
import type { PaginaDelHistorial } from '../../infraestructura/api/historial.ts';
import { cuantosH1, fallosDeAccesibilidad } from '../../pruebas/axe.ts';
import { fijarLaZonaDeLaCuenta } from '../../tiempo/zonaHoraria.ts';
import { HistorialDelModulo } from './HistorialDelModulo.tsx';

/**
 * El historial de un modulo (SCRUM-184), con la API simulada y la pantalla de verdad.
 */
const { consultarElHistorial } = vi.hoisted(() => ({ consultarElHistorial: vi.fn() }));

vi.mock('../../infraestructura/api/historial.ts', () => ({ consultarElHistorial }));

const usuario = userEvent.setup({ delay: null });

fijarLaZonaDeLaCuenta('America/Bogota');

function hecho(n: number, dia: string, hora: string, nombre = 'Cómo dormiste anoche') {
  return {
    id: `h${String(n)}`,
    actividad: { id: 'a1', nombre },
    dia,
    // 15:00 UTC es las 10:00 a. m. en Bogota.
    hechaEn: `${dia}T${hora}:00.000Z`,
  };
}

function pagina(hechos: PaginaDelHistorial['hechos'], siguientePagina: string | null = null) {
  return { hechos, siguientePagina };
}

function pintar() {
  return render(<HistorialDelModulo modulo="bienestar" titulo="Bienestar" hoy="2026-10-02" />);
}

beforeEach(() => {
  consultarElHistorial.mockResolvedValue(pagina([]));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('HistorialDelModulo (SCRUM-184)', () => {
  it('mientras llega muestra la carga y lo dice', async () => {
    consultarElHistorial.mockReturnValue(new Promise(() => undefined));

    pintar();

    expect(await screen.findByRole('status')).toHaveTextContent('Cargando tu historial…');
  });

  it('pide la primera pagina del modulo, sin cursor', async () => {
    pintar();

    await screen.findByText(/Todavía no hay nada en tu historial/);

    const [modulo, opciones] = consultarElHistorial.mock.calls[0] as [
      string,
      { senal: unknown; pagina?: string },
    ];

    expect(modulo).toBe('bienestar');
    expect(opciones.senal).toBeInstanceOf(AbortSignal);
    expect(opciones).not.toHaveProperty('pagina');
  });

  it('sin nada hecho, un vacio que invita y no reclama', async () => {
    pintar();

    const vacio = (await screen.findByText(/Todavía no hay nada en tu historial/)).closest(
      '.estado-vacio',
    );

    expect(vacio).not.toBeNull();
    expect(vacio).toHaveTextContent('Cuando hagas una actividad de Bienestar, aparece aquí.');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('agrupa por dia, del mas reciente al mas antiguo, con hoy y ayer por su nombre', async () => {
    consultarElHistorial.mockResolvedValue(
      pagina([
        hecho(3, '2026-10-02', '20:30'),
        hecho(2, '2026-10-02', '15:00', 'Estiramientos'),
        hecho(1, '2026-10-01', '13:00'),
        hecho(0, '2026-09-27', '13:00'),
      ]),
    );

    pintar();

    const seccion = await screen.findByRole('region', { name: 'Tu historial' });
    const dias = within(seccion)
      .getAllByRole('heading', { level: 3 })
      .map((titulo) => titulo.textContent);

    expect(dias).toEqual(['Hoy', 'Ayer', 'Domingo, 27 de septiembre']);

    const hoy = within(seccion).getByRole('list', { name: 'Hoy' });

    expect(within(hoy).getAllByRole('listitem')).toHaveLength(2);
    expect(within(hoy).getAllByRole('listitem')[0]).toHaveTextContent(/3:30 p\. m\./u);
    expect(within(hoy).getAllByRole('listitem')[0]).toHaveTextContent('Cómo dormiste anoche');
  });

  it('solo dice que hizo y cuando: nada de puntajes ni de como le fue', async () => {
    consultarElHistorial.mockResolvedValue(pagina([hecho(1, '2026-10-02', '15:00')]));

    pintar();

    const seccion = await screen.findByRole('region', { name: 'Tu historial' });

    expect(seccion.textContent).not.toMatch(/puntaje|nivel|resultado|%/iu);
  });

  it('«Ver más» pide la pagina siguiente con su cursor y la suma a lo que ya se ve', async () => {
    consultarElHistorial
      .mockResolvedValueOnce(pagina([hecho(2, '2026-10-02', '15:00')], 'cursor-1'))
      .mockResolvedValueOnce(pagina([hecho(1, '2026-10-01', '15:00', 'Estiramientos')]));

    pintar();

    await usuario.click(await screen.findByRole('button', { name: 'Ver más' }));

    expect(await screen.findByText('Estiramientos')).toBeInTheDocument();
    expect(screen.getByText('Cómo dormiste anoche')).toBeInTheDocument();
    expect(consultarElHistorial.mock.calls[1]?.[1]).toMatchObject({ pagina: 'cursor-1' });
    // Sin mas paginas, el boton se va.
    expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument();
  });

  it('un hecho que llega dos veces no se repite', async () => {
    consultarElHistorial
      .mockResolvedValueOnce(pagina([hecho(1, '2026-10-02', '15:00')], 'cursor-1'))
      .mockResolvedValueOnce(
        pagina([hecho(1, '2026-10-02', '15:00'), hecho(0, '2026-10-01', '15:00')]),
      );

    pintar();

    await usuario.click(await screen.findByRole('button', { name: 'Ver más' }));
    await screen.findByRole('heading', { name: 'Ayer' });

    expect(screen.getAllByText('Cómo dormiste anoche')).toHaveLength(2);
  });

  it('mientras trae la siguiente, el boton lo dice y no deja pedirla dos veces', async () => {
    let entregar: (valor: PaginaDelHistorial) => void = () => undefined;

    consultarElHistorial.mockResolvedValueOnce(
      pagina([hecho(2, '2026-10-02', '15:00')], 'cursor-1'),
    );
    consultarElHistorial.mockReturnValueOnce(
      new Promise<PaginaDelHistorial>((resolver) => {
        entregar = resolver;
      }),
    );

    pintar();

    await usuario.click(await screen.findByRole('button', { name: 'Ver más' }));

    const cargando = await screen.findByRole('button', { name: 'Cargando…' });

    expect(cargando).toBeDisabled();

    entregar(pagina([]));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Cargando…' })).not.toBeInTheDocument(),
    );
    expect(consultarElHistorial).toHaveBeenCalledTimes(2);
  });

  describe('cuando no se puede', () => {
    it('sin conexion lo dice con calma y deja reintentar, sin tirar lo de hoy', async () => {
      consultarElHistorial.mockRejectedValue(new TypeError('Failed to fetch'));

      pintar();

      const aviso = await screen.findByRole('alert');

      expect(aviso).toHaveTextContent(/hace falta conexión/);
      expect(aviso).toHaveTextContent(/lo de hoy/i);

      consultarElHistorial.mockResolvedValue(pagina([hecho(1, '2026-10-02', '15:00')]));
      await usuario.click(within(aviso).getByRole('button', { name: 'Reintentar' }));

      expect(await screen.findByText('Cómo dormiste anoche')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('un error del servidor se explica sin culpar a la persona', async () => {
      consultarElHistorial.mockRejectedValue(new ErrorDeLaApi(500, 'Algo falló.'));

      pintar();

      expect(await screen.findByRole('alert')).toBeInTheDocument();
    });

    it('si falla «Ver más», lo que ya se veia sigue ahi', async () => {
      consultarElHistorial.mockResolvedValueOnce(
        pagina([hecho(1, '2026-10-02', '15:00')], 'cursor-1'),
      );
      consultarElHistorial.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      pintar();

      await usuario.click(await screen.findByRole('button', { name: 'Ver más' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(/hace falta conexión/);
      expect(screen.getByText('Cómo dormiste anoche')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Ver más' })).toBeEnabled();
    });
  });

  it('no tiene fallos de accesibilidad y no suma ningun h1', async () => {
    consultarElHistorial.mockResolvedValue(
      pagina([hecho(2, '2026-10-02', '15:00'), hecho(1, '2026-10-01', '15:00')], 'cursor-1'),
    );

    const { container } = pintar();

    await screen.findByRole('region', { name: 'Tu historial' });

    expect(await fallosDeAccesibilidad()).toEqual([]);
    expect(cuantosH1(container)).toBe(0);
  });
});
