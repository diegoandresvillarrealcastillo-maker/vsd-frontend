import type { Session } from '@supabase/supabase-js';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fallosDeAccesibilidad } from '../../pruebas/axe.ts';
import { abrirUnAlmacenDePrueba, cerrarElAlmacenDePrueba } from '../../pruebas/almacenDePrueba.ts';
import { sprite } from '../../mascota/sprites.ts';
import { rutaDeActividad, RUTAS } from '../../rutas/rutas.ts';
import { SesionContexto, type EstadoDeSesion } from '../../sesion/SesionContexto.ts';
import { Actividad } from './Actividad.tsx';

/**
 * La pantalla de una actividad con su aspecto nuevo (SCRUM-173): el color del modulo, la
 * cabecera y, sobre todo, que la mascota que acompana sea la que la persona tiene elegida en su
 * cuenta, tanto mientras hace la actividad como al terminarla.
 */
const { buscarActividad, registrarResultado, hayConexionConLaApi, consultarLaCuentaPropia } =
  vi.hoisted(() => ({
    buscarActividad: vi.fn(),
    registrarResultado: vi.fn(),
    hayConexionConLaApi: vi.fn(),
    consultarLaCuentaPropia: vi.fn(),
  }));

vi.mock('../../sincronizacion/catalogoLocal.ts', () => ({
  buscarActividadConCopia: buscarActividad,
  nombreDeLaActividad: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('../../infraestructura/api/conexion.ts', () => ({ hayConexionConLaApi }));
vi.mock('../../infraestructura/api/resultados.ts', () => ({ registrarResultado }));
vi.mock('../../infraestructura/api/cuenta.ts', async (importarOriginal) => ({
  ...(await importarOriginal<typeof import('../../infraestructura/api/cuenta.ts')>()),
  consultarLaCuentaPropia,
}));

/** «Como dormiste anoche»: se puede terminar con lo que trae por defecto. */
const SUENO = '0acd0000-0000-4000-8000-000000000004';

const usuario = userEvent.setup({ delay: null });

function ficha(categoria: string) {
  return {
    actividad: {
      id: SUENO,
      nombre: 'Cómo dormiste anoche',
      tipo: 'bitacora',
      descripcion: 'Cuatro preguntas rápidas.',
      produceNivel: true,
    },
    categoria: { id: 'cat-1', nombre: categoria, actividades: [] },
  };
}

function sesion(): EstadoDeSesion {
  const vacio = vi.fn();

  return {
    sesion: { user: { email: 'alguien@ejemplo.test' } } as Session,
    cargando: false,
    correo: 'alguien@ejemplo.test',
    registrarse: vacio,
    entrar: vacio,
    entrarConGoogle: vacio,
    pedirRecuperacion: vacio,
    cambiarContrasena: vacio,
    pedirCodigoDeVerificacion: vacio,
    cambiarContrasenaConCodigo: vacio,
    salir: vacio,
  };
}

function pintar() {
  return render(
    <SesionContexto.Provider value={sesion()}>
      <MemoryRouter initialEntries={[rutaDeActividad(SUENO)]}>
        <Routes>
          <Route path={RUTAS.ACTIVIDAD} element={<Actividad />} />
        </Routes>
      </MemoryRouter>
    </SesionContexto.Provider>,
  );
}

const carasDeLaMascota = (): (string | null)[] =>
  [...document.querySelectorAll('.viva-voz__cara img, .viva-logro__mascota img')].map((imagen) =>
    imagen.getAttribute('src'),
  );

beforeEach(async () => {
  hayConexionConLaApi.mockResolvedValue(true);
  buscarActividad.mockResolvedValue(ficha('Bienestar'));
  consultarLaCuentaPropia.mockResolvedValue({ mascota: { forma: 'gato', nombre: 'Michi' } });
  registrarResultado.mockResolvedValue({
    id: 'r-1',
    activityId: SUENO,
    nivelOrientativo: 'favorable',
    sugiereAcompanamiento: false,
    metadata: {},
    completedAt: '2026-10-12T15:00:00.000Z',
  });
  await abrirUnAlmacenDePrueba();
});

afterEach(() => {
  cerrarElAlmacenDePrueba();
  vi.clearAllMocks();
});

describe('La pantalla de una actividad', () => {
  it('toma el color del modulo de la actividad', async () => {
    const { container } = pintar();

    await screen.findByRole('heading', { level: 1, name: 'Cómo dormiste anoche' });

    expect(container.querySelector('.actividad')).toHaveAttribute('data-modulo', 'bienestar');
  });

  it.each([
    ['Cognición', 'cognicion'],
    ['Emociones', 'emociones'],
  ])('en %s se pinta con el color de %s', async (categoria, modulo) => {
    buscarActividad.mockResolvedValue(ficha(categoria));

    const { container } = pintar();

    await screen.findByRole('heading', { level: 1 });

    expect(container.querySelector('.actividad')).toHaveAttribute('data-modulo', modulo);
  });

  it('una categoria desconocida se ve con el color neutro, sin romperse', async () => {
    buscarActividad.mockResolvedValue(ficha('Otra cosa'));

    const { container } = pintar();

    await screen.findByRole('heading', { level: 1, name: 'Cómo dormiste anoche' });

    expect(container.querySelector('.actividad')).not.toHaveAttribute('data-modulo');
  });

  it('la cabecera lleva el nombre, la categoria y la descripcion; y el fondo es adorno', async () => {
    const { container } = pintar();

    await screen.findByRole('heading', { level: 1, name: 'Cómo dormiste anoche' });

    expect(screen.getByText('Cuatro preguntas rápidas.')).toBeInTheDocument();
    expect(container.querySelector('.viva-heroe__categoria')).toHaveTextContent('Bienestar');
    expect(container.querySelector('.viva-fondo')).toHaveAttribute('aria-hidden', 'true');
  });

  it('tiene un solo encabezado de primer nivel y ningun fallo de accesibilidad', async () => {
    const { container } = pintar();

    await screen.findByRole('heading', { level: 1, name: 'Cómo dormiste anoche' });

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(await fallosDeAccesibilidad(container)).toEqual([]);
  });
});

describe('La mascota de la actividad es la de la cuenta', () => {
  it('mientras se hace la actividad', async () => {
    pintar();

    await screen.findByRole('heading', { level: 1 });

    await waitFor(() => expect(carasDeLaMascota()).toContain(sprite('gato', 'normal')));
    expect(carasDeLaMascota()).not.toContain(sprite('fungito', 'normal'));
  });

  it('y al terminar, en el logro, es la misma', async () => {
    pintar();

    await usuario.click(await screen.findByRole('button', { name: 'Terminar' }));

    await screen.findByRole('heading', { level: 1, name: 'Listo' });

    await waitFor(() => expect(carasDeLaMascota()).toContain(sprite('gato', 'celebrando')));
    // Una sola consulta por pantalla: la mecanica y el logro comparten la mascota.
    expect(consultarLaCuentaPropia).toHaveBeenCalledTimes(1);
  });

  it('sin cuenta que consultar se acompana con la de siempre', async () => {
    consultarLaCuentaPropia.mockRejectedValue(new TypeError('Failed to fetch'));

    pintar();

    await screen.findByRole('heading', { level: 1 });

    expect(carasDeLaMascota()).toContain(sprite('fungito', 'normal'));
  });
});
