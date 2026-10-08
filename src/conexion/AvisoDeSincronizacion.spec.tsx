import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LINEAS_DE_RESPALDO_DE_COLOMBIA } from '../paginas/actividad/lineasParaMostrar.ts';
import { nombreDeLaActividad } from '../sincronizacion/catalogoLocal.ts';
import {
  descartarElAviso,
  pedirVerLaLista,
  type AvisoVisible,
  type EstadoDeLaSincronizacion,
} from '../sincronizacion/estado.ts';
import { AvisoDeSincronizacion } from './AvisoDeSincronizacion.tsx';

const mundo = vi.hoisted(() => ({
  aviso: null as AvisoVisible | null,
}));

vi.mock('../sincronizacion/catalogoLocal.ts', () => ({
  nombreDeLaActividad: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('../sincronizacion/estado.ts', () => ({
  useSincronizacion: () => ({ aviso: mundo.aviso }) as unknown as EstadoDeLaSincronizacion,
  descartarElAviso: vi.fn(),
  pedirVerLaLista: vi.fn(),
}));

let numero = 0;

function aviso(cambios: Partial<AvisoVisible> = {}): AvisoVisible {
  numero += 1;

  return {
    id: numero,
    texto: 'Volviste a tener conexión. Enviamos 3 cambios que estaban guardados en este equipo.',
    tono: 'exito',
    enviadas: 3,
    verLista: false,
    pedirEntrar: false,
    sugiereAcompanamiento: false,
    lineasDeAtencion: [],
    orientaciones: [],
    ...cambios,
  };
}

function pintar() {
  return render(
    <MemoryRouter>
      <AvisoDeSincronizacion />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mundo.aviso = null;
  vi.mocked(descartarElAviso).mockClear();
  vi.mocked(pedirVerLaLista).mockClear();
  vi.mocked(nombreDeLaActividad).mockReset();
  vi.mocked(nombreDeLaActividad).mockResolvedValue(null);
});

describe('AvisoDeSincronizacion: la region', () => {
  it('esta SIEMPRE en el documento, vacia, para que el lector de pantalla anuncie lo que llegue', () => {
    pintar();

    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('el aviso aparece dentro de ella', () => {
    mundo.aviso = aviso();
    pintar();

    expect(
      within(screen.getByRole('status')).getByText(
        'Volviste a tener conexión. Enviamos 3 cambios que estaban guardados en este equipo.',
      ),
    ).toBeInTheDocument();
  });

  it('no roba el foco al aparecer', () => {
    mundo.aviso = aviso({ verLista: true });
    pintar();

    expect(document.body).toHaveFocus();
  });

  it('cuando llega un aviso, la region es la misma: se anuncia el cambio', () => {
    const { rerender } = pintar();
    const region = screen.getByRole('status');

    mundo.aviso = aviso();
    rerender(
      <MemoryRouter>
        <AvisoDeSincronizacion />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toBe(region);
  });

  it('dos avisos con el mismo texto son dos avisos: el segundo se pinta de nuevo', () => {
    mundo.aviso = aviso({ texto: 'Igual' });

    const { rerender } = pintar();
    const primera = screen.getByText('Igual');

    mundo.aviso = aviso({ texto: 'Igual' });
    rerender(
      <MemoryRouter>
        <AvisoDeSincronizacion />
      </MemoryRouter>,
    );

    expect(screen.getByText('Igual')).not.toBe(primera);
  });
});

describe('AvisoDeSincronizacion: el tono', () => {
  it.each(['exito', 'atencion', 'info'] as const)('%s se marca en la tarjeta', (tono) => {
    mundo.aviso = aviso({ tono });
    pintar();

    expect(document.querySelector(`.aviso-sincronizacion__tarjeta--${tono}`)).not.toBeNull();
  });
});

describe('AvisoDeSincronizacion: lo que se puede hacer', () => {
  it('siempre se puede cerrar', async () => {
    mundo.aviso = aviso();
    pintar();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(descartarElAviso).toHaveBeenCalledTimes(1);
  });

  it('sin nada que ver, solo "Cerrar"', () => {
    mundo.aviso = aviso();
    pintar();

    expect(screen.queryByRole('button', { name: 'Ver la lista' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Entrar' })).toBeNull();
  });

  it('si algo no salio, "Ver la lista" abre la lista y quita el aviso', async () => {
    mundo.aviso = aviso({ verLista: true, tono: 'atencion' });
    pintar();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ver la lista' }));

    expect(pedirVerLaLista).toHaveBeenCalledTimes(1);
    expect(descartarElAviso).toHaveBeenCalledTimes(1);
  });

  it('si la sesion vencio, lleva a entrar, y el aviso se quita', async () => {
    mundo.aviso = aviso({ pedirEntrar: true, tono: 'atencion' });
    pintar();

    const enlace = screen.getByRole('link', { name: 'Entrar' });

    expect(enlace).toHaveAttribute('href', '/acceso');

    await userEvent.setup().click(enlace);

    expect(descartarElAviso).toHaveBeenCalledTimes(1);
  });

  it('se maneja con el teclado', async () => {
    const usuario = userEvent.setup();

    mundo.aviso = aviso({ verLista: true });
    pintar();
    await usuario.tab();

    expect(screen.getByRole('button', { name: 'Ver la lista' })).toHaveFocus();

    await usuario.tab();
    await usuario.keyboard('{Enter}');

    expect(descartarElAviso).toHaveBeenCalledTimes(1);
  });
});

describe('AvisoDeSincronizacion: el acompanamiento', () => {
  it('si lo enviado lo sugiere, ofrece las lineas que mando la API', () => {
    mundo.aviso = aviso({
      sugiereAcompanamiento: true,
      lineasDeAtencion: [
        {
          id: 'l1',
          titulo: 'Línea de prueba',
          descripcion: 'Atiende todo el dia.',
          tipo: 'contacto',
          cobertura: 'nacional',
        },
      ],
    });
    pintar();

    expect(screen.getByText(/Si te sirve hablarlo con alguien/)).toBeInTheDocument();
    expect(screen.getByText('Línea de prueba')).toBeInTheDocument();
    expect(screen.getByText(/Atiende todo el dia\./)).toBeInTheDocument();
  });

  it('nunca se queda sin un telefono: si la API no mando lineas, las de respaldo', () => {
    mundo.aviso = aviso({ sugiereAcompanamiento: true, lineasDeAtencion: [] });
    pintar();

    for (const linea of LINEAS_DE_RESPALDO_DE_COLOMBIA) {
      expect(screen.getByText(linea.titulo)).toBeInTheDocument();
    }
  });

  it('sin sugerencia no hay lineas', () => {
    mundo.aviso = aviso({ sugiereAcompanamiento: false });
    pintar();

    expect(screen.queryByText(/Si te sirve hablarlo con alguien/)).toBeNull();
  });

  it('el tono es de acompanar: nada de alarmas', () => {
    mundo.aviso = aviso({ sugiereAcompanamiento: true });
    pintar();

    expect(screen.queryByText(/urgente|alerta|peligro/i)).toBeNull();
  });
});

describe('AvisoDeSincronizacion: la orientacion al sincronizar (SCRUM-138)', () => {
  it('un resultado hecho sin conexion se ensena con el nombre de la actividad y su nivel', async () => {
    vi.mocked(nombreDeLaActividad).mockResolvedValue('Cómo dormiste anoche');
    mundo.aviso = aviso({
      orientaciones: [{ activityId: 'a1', nivelOrientativo: 'favorable' }],
    });
    pintar();

    expect(await screen.findByText('Tu resultado de «Cómo dormiste anoche»:')).toBeInTheDocument();
    expect(screen.getByText(/Vas bien\. Sigue así\./)).toBeInTheDocument();
    expect(nombreDeLaActividad).toHaveBeenCalledWith('a1');
  });

  it('con el mismo texto que la pantalla de la actividad, en sus tres niveles', async () => {
    mundo.aviso = aviso({
      orientaciones: [
        { activityId: 'a1', nivelOrientativo: 'favorable' },
        { activityId: 'a2', nivelOrientativo: 'en_seguimiento' },
        { activityId: 'a3', nivelOrientativo: 'requiere_atencion' },
      ],
    });
    pintar();
    await screen.findAllByText(/Tu resultado de/);

    expect(screen.getByText(/Vas bien\. Sigue así\./)).toBeInTheDocument();
    expect(screen.getByText(/Va razonable, con margen para mejorar\./)).toBeInTheDocument();
    expect(screen.getByText(/Conviene prestarle atención estos días\./)).toBeInTheDocument();
  });

  it('si no se sabe como se llama, dice "una actividad" y no inventa nada', async () => {
    mundo.aviso = aviso({
      orientaciones: [{ activityId: 'a1', nivelOrientativo: 'favorable' }],
    });
    pintar();

    expect(await screen.findByText('Tu resultado de «una actividad»:')).toBeInTheDocument();
  });

  it('el nombre llega un instante despues y reemplaza al texto de respaldo', async () => {
    let resolver: (nombre: string) => void = () => undefined;

    vi.mocked(nombreDeLaActividad).mockReturnValue(
      new Promise<string>((resolve) => {
        resolver = resolve;
      }),
    );
    mundo.aviso = aviso({
      orientaciones: [{ activityId: 'a1', nivelOrientativo: 'favorable' }],
    });
    pintar();

    expect(screen.getByText('Tu resultado de «una actividad»:')).toBeInTheDocument();

    await act(async () => {
      resolver('Parejas de cartas');
      await Promise.resolve();
    });

    expect(screen.getByText('Tu resultado de «Parejas de cartas»:')).toBeInTheDocument();
  });

  it('un nombre que llega cuando el aviso ya se quito no rompe nada', async () => {
    let resolver: (nombre: string) => void = () => undefined;

    vi.mocked(nombreDeLaActividad).mockReturnValue(
      new Promise<string>((resolve) => {
        resolver = resolve;
      }),
    );
    mundo.aviso = aviso({
      orientaciones: [{ activityId: 'a1', nivelOrientativo: 'favorable' }],
    });

    const { unmount } = pintar();

    unmount();

    await act(async () => {
      resolver('Tarde');
      await Promise.resolve();
    });

    expect(document.body.textContent).toBe('');
  });

  it('nunca dice un numero: ni puntaje ni "nivel 8"', async () => {
    mundo.aviso = aviso({
      orientaciones: [{ activityId: 'a1', nivelOrientativo: 'requiere_atencion' }],
    });
    pintar();
    await screen.findByText(/Tu resultado de/);

    expect(screen.getByRole('status').textContent).not.toMatch(
      /\d+ (de|sobre) \d+|nivel \d|puntaje/i,
    );
  });

  it('sin orientaciones, no hay lista de resultados', () => {
    mundo.aviso = aviso({ orientaciones: [] });
    pintar();

    expect(screen.queryByText(/Tu resultado de/)).toBeNull();
  });

  it('cada resultado tiene su renglon, aunque sean de la misma actividad', async () => {
    mundo.aviso = aviso({
      orientaciones: [
        { activityId: 'a1', nivelOrientativo: 'favorable' },
        { activityId: 'a1', nivelOrientativo: 'en_seguimiento' },
      ],
    });
    pintar();

    expect(await screen.findAllByText(/Tu resultado de/)).toHaveLength(2);
  });
});
