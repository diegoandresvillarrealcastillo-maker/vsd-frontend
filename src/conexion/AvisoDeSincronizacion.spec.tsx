import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LINEAS_DE_RESPALDO_DE_COLOMBIA } from '../paginas/actividad/lineasParaMostrar.ts';
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
