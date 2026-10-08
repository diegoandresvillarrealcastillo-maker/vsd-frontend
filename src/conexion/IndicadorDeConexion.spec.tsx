import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EstadoDeLaSincronizacion } from '../sincronizacion/estado.ts';
import { contarCambios, indicadorDe, type EstadoDeLaConexion } from '../sincronizacion/resumen.ts';
import { nuevaOperacion, type Operacion } from '../sincronizacion/cola.ts';
import { IndicadorDeConexion } from './IndicadorDeConexion.tsx';

/**
 * El indicador de la barra (SCRUM-137). El almacen de estado es un doble que cada
 * prueba mueve a mano: aqui se prueba lo que se ve y como se maneja.
 */
const mundo = vi.hoisted(() => ({
  estado: null as unknown as EstadoDeLaSincronizacion,
}));

vi.mock('../sincronizacion/estado.ts', () => ({
  useSincronizacion: () => mundo.estado,
  sincronizarAhora: vi.fn(),
  reintentar: vi.fn(),
  descartar: vi.fn(),
}));
vi.mock('../sincronizacion/acciones.ts', () => ({
  cuantosDependenDe: vi.fn(() => Promise.resolve(0)),
}));

let contador = 0;

function operacion(cambios: Partial<Operacion> = {}): Operacion {
  contador += 1;

  return {
    ...nuevaOperacion(
      {
        operationId: `op-${String(contador)}`,
        tipo: 'diario.escribir',
        entidad: `diario:${String(contador)}`,
        payload: {},
      },
      new Date(),
    ),
    orden: contador,
    ...cambios,
  };
}

function estado(
  cambios: Partial<EstadoDeLaSincronizacion> & {
    operaciones?: Operacion[];
    conexion?: EstadoDeLaConexion;
  } = {},
): EstadoDeLaSincronizacion {
  const { operaciones = [], conexion = 'con_conexion', sincronizando = false, ...resto } = cambios;
  const contadores = contarCambios(operaciones);

  return {
    hayAlmacen: true,
    conexion,
    sincronizando,
    contadores,
    cambios: [],
    indicador: indicadorDe(conexion, sincronizando, contadores),
    ultimaSincronizacion: null,
    aviso: null,
    peticionDeLista: 0,
    ...resto,
  };
}

beforeEach(() => {
  mundo.estado = estado();
});

function boton(): HTMLElement {
  return screen.getByRole('button', { name: /estado de la sincronización/i });
}

describe('IndicadorDeConexion: lo que se ve', () => {
  it('con todo enviado es solo un icono, con nombre pero sin texto visible', () => {
    render(<IndicadorDeConexion />);

    expect(boton()).toHaveAccessibleName('Todo enviado. Ver el estado de la sincronización');
    expect(boton()).toHaveTextContent('');
    expect(boton()).toHaveClass('conexion__boton--discreto');
  });

  it('sin conexion y con cambios guardados, lo dice como en el ticket', () => {
    mundo.estado = estado({
      conexion: 'sin_conexion',
      operaciones: [operacion(), operacion(), operacion()],
    });
    render(<IndicadorDeConexion />);

    expect(boton()).toHaveTextContent('Sin conexión · 3 cambios guardados en este equipo');
    expect(boton()).toHaveTextContent('3');
  });

  it('el nombre del boton EMPIEZA por lo que se ve (para quien lo dicta por voz)', () => {
    mundo.estado = estado({ conexion: 'sin_conexion', operaciones: [operacion()] });
    render(<IndicadorDeConexion />);

    expect(boton()).toHaveAccessibleName(
      'Sin conexión · 1 cambio guardado en este equipo. Ver el estado de la sincronización',
    );
  });

  it('el numerito es decorativo: ya esta en el texto y en el nombre', () => {
    mundo.estado = estado({ operaciones: [operacion(), operacion()] });
    render(<IndicadorDeConexion />);

    const numero = within(boton()).getByText('2');

    expect(numero).toHaveAttribute('aria-hidden', 'true');
  });

  it('sin cambios no hay numerito', () => {
    render(<IndicadorDeConexion />);

    expect(within(boton()).queryByText('0')).toBeNull();
  });

  it('con algo por enviar, lo dice', () => {
    mundo.estado = estado({ operaciones: [operacion()] });
    render(<IndicadorDeConexion />);

    expect(boton()).toHaveTextContent('1 cambio por enviar');
    expect(boton()).toHaveClass('conexion__boton--aviso');
    expect(boton()).not.toHaveClass('conexion__boton--discreto');
  });

  it('con algo que necesita a la persona, el tono es de atencion', () => {
    mundo.estado = estado({ operaciones: [operacion({ estado: 'requiere_atencion' })] });
    render(<IndicadorDeConexion />);

    expect(boton()).toHaveTextContent('1 cambio necesita tu atención');
    expect(boton()).toHaveClass('conexion__boton--atencion');
  });

  it('mientras envia, gira el icono', () => {
    mundo.estado = estado({ sincronizando: true, operaciones: [operacion()] });
    render(<IndicadorDeConexion />);

    expect(boton()).toHaveTextContent('Sincronizando…');
    expect(boton()).toHaveClass('conexion__boton--sincronizando');
  });

  it('sin conexion no gira, aunque se intente enviar', () => {
    mundo.estado = estado({
      conexion: 'sin_conexion',
      sincronizando: true,
      operaciones: [operacion()],
    });
    render(<IndicadorDeConexion />);

    expect(boton()).not.toHaveClass('conexion__boton--sincronizando');
  });
});

describe('IndicadorDeConexion: el panel', () => {
  it('cerrado por omision', () => {
    render(<IndicadorDeConexion />);

    expect(boton()).toHaveAttribute('aria-expanded', 'false');
    expect(boton()).not.toHaveAttribute('aria-controls');
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('al pulsar, se abre, y el boton lo dice y apunta a el', async () => {
    render(<IndicadorDeConexion />);

    await userEvent.setup().click(boton());

    const panel = screen.getByRole('region', { name: 'Lo guardado en este equipo' });

    expect(boton()).toHaveAttribute('aria-expanded', 'true');
    expect(boton()).toHaveAttribute('aria-controls', panel.id);
    expect(boton()).toHaveAccessibleName('Todo enviado. Cerrar el estado de la sincronización');
  });

  it('al volver a pulsar, se cierra', async () => {
    const usuario = userEvent.setup();

    render(<IndicadorDeConexion />);
    await usuario.click(boton());
    await usuario.click(boton());

    expect(screen.queryByRole('region')).toBeNull();
    expect(boton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('Escape lo cierra y el foco vuelve al boton, aunque estuviera dentro del panel', async () => {
    const usuario = userEvent.setup();

    render(<IndicadorDeConexion />);
    await usuario.click(boton());
    // Quien navega con el teclado esta dentro del panel, no en el boton.
    screen.getByRole('button', { name: 'Sincronizar ahora' }).focus();
    await usuario.keyboard('{Escape}');

    expect(screen.queryByRole('region')).toBeNull();
    expect(boton()).toHaveFocus();
  });

  it('pulsar fuera lo cierra', async () => {
    const usuario = userEvent.setup();

    render(
      <>
        <p>Otra parte de la pantalla</p>
        <IndicadorDeConexion />
      </>,
    );
    await usuario.click(boton());
    await usuario.click(screen.getByText('Otra parte de la pantalla'));

    expect(screen.queryByRole('region')).toBeNull();
  });

  it('pulsar dentro NO lo cierra', async () => {
    const usuario = userEvent.setup();

    render(<IndicadorDeConexion />);
    await usuario.click(boton());
    await usuario.click(screen.getByRole('heading', { name: 'Lo guardado en este equipo' }));

    expect(screen.getByRole('region')).toBeInTheDocument();
  });

  it('su boton "Cerrar" lo cierra y devuelve el foco al indicador', async () => {
    const usuario = userEvent.setup();

    render(<IndicadorDeConexion />);
    await usuario.click(boton());
    await usuario.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(screen.queryByRole('region')).toBeNull();
    expect(boton()).toHaveFocus();
  });

  it('cerrado, no escucha teclas ni clics de la pagina', async () => {
    const usuario = userEvent.setup();

    render(<IndicadorDeConexion />);
    await usuario.keyboard('{Escape}');
    await usuario.click(document.body);

    expect(boton()).not.toHaveFocus();
  });
});

describe('IndicadorDeConexion: cuando un aviso pide ver la lista', () => {
  it('abre el panel y lleva el foco al titulo', () => {
    const { rerender } = render(<IndicadorDeConexion />);

    expect(screen.queryByRole('region')).toBeNull();

    mundo.estado = estado({ peticionDeLista: 1 });
    rerender(<IndicadorDeConexion />);

    expect(screen.getByRole('region')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Lo guardado en este equipo' })).toHaveFocus();
  });

  it('una vez atendida, no vuelve a abrirse al pintar otra vez', async () => {
    const usuario = userEvent.setup();
    const { rerender } = render(<IndicadorDeConexion />);

    mundo.estado = estado({ peticionDeLista: 1 });
    rerender(<IndicadorDeConexion />);
    await usuario.click(screen.getByRole('button', { name: 'Cerrar' }));
    rerender(<IndicadorDeConexion />);

    expect(screen.queryByRole('region')).toBeNull();
  });

  it('otra peticion la vuelve a abrir', async () => {
    const usuario = userEvent.setup();
    const { rerender } = render(<IndicadorDeConexion />);

    mundo.estado = estado({ peticionDeLista: 1 });
    rerender(<IndicadorDeConexion />);
    await usuario.click(screen.getByRole('button', { name: 'Cerrar' }));
    mundo.estado = estado({ peticionDeLista: 2 });
    rerender(<IndicadorDeConexion />);

    expect(screen.getByRole('region')).toBeInTheDocument();
  });

  it('una peticion de antes de existir el indicador no lo abre', () => {
    mundo.estado = estado({ peticionDeLista: 5 });
    render(<IndicadorDeConexion />);

    expect(screen.queryByRole('region')).toBeNull();
  });

  it('si la persona lo abre ella, el foco no se mueve de donde estaba', async () => {
    render(<IndicadorDeConexion />);

    await userEvent.setup().click(boton());

    expect(screen.getByRole('heading', { name: 'Lo guardado en este equipo' })).not.toHaveFocus();
  });
});
