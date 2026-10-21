import type { Session } from '@supabase/supabase-js';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fallosDeAccesibilidad } from '../../pruebas/axe.ts';
import { abrirUnAlmacenDePrueba, cerrarElAlmacenDePrueba } from '../../pruebas/almacenDePrueba.ts';
import { rachaDePrueba } from '../../pruebas/rachaDePrueba.ts';
import { olvidarLaRacha, recordarLaRacha } from '../../racha/memoriaDeLaRacha.ts';
import { sprite } from '../../mascota/sprites.ts';
import { rutaDeActividad, RUTAS } from '../../rutas/rutas.ts';
import { SesionContexto, type EstadoDeSesion } from '../../sesion/SesionContexto.ts';
import { Actividad } from './Actividad.tsx';

/**
 * La pantalla de una actividad con su aspecto nuevo (SCRUM-173): el color del modulo, la
 * cabecera y, sobre todo, que la mascota que acompana sea la que la persona tiene elegida en su
 * cuenta, tanto mientras hace la actividad como al terminarla.
 */
const {
  buscarActividad,
  registrarResultado,
  hayConexionConLaApi,
  consultarLaCuentaPropia,
  consultarLaRacha,
} = vi.hoisted(() => ({
  buscarActividad: vi.fn(),
  registrarResultado: vi.fn(),
  hayConexionConLaApi: vi.fn(),
  consultarLaCuentaPropia: vi.fn(),
  consultarLaRacha: vi.fn(),
}));

vi.mock('../../sincronizacion/catalogoLocal.ts', () => ({
  buscarActividadConCopia: buscarActividad,
  nombreDeLaActividad: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('../../infraestructura/api/conexion.ts', () => ({ hayConexionConLaApi }));
vi.mock('../../infraestructura/api/resultados.ts', () => ({ registrarResultado }));
vi.mock('../../infraestructura/api/racha.ts', () => ({ consultarLaRacha }));
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

const ANA = '11111111-1111-4111-8111-111111111111';

function sesion(id?: string): EstadoDeSesion {
  const vacio = vi.fn();

  return {
    sesion: {
      user: { ...(id === undefined ? {} : { id }), email: 'alguien@ejemplo.test' },
    } as Session,
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

function pintar(cuenta?: string) {
  return render(
    <SesionContexto.Provider value={sesion(cuenta)}>
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
  olvidarLaRacha();
  consultarLaRacha.mockResolvedValue(rachaDePrueba());
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

  it('empieza por arriba aunque se llegue desde una pantalla desplazada', async () => {
    const fijarElDesplazamiento = vi.fn();

    Object.defineProperty(document.documentElement, 'scrollTop', {
      configurable: true,
      get: () => 300,
      set: fijarElDesplazamiento,
    });

    try {
      pintar();

      await screen.findByRole('heading', { level: 1, name: 'Cómo dormiste anoche' });

      expect(fijarElDesplazamiento).toHaveBeenCalledWith(0);
    } finally {
      Reflect.deleteProperty(document.documentElement, 'scrollTop');
    }
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

describe('La racha al terminar una actividad (SCRUM-243)', () => {
  beforeEach(() => {
    // Ayer iba en 11 y hoy todavia no habia hecho nada; el servidor dira que hoy ya sumo.
    recordarLaRacha(ANA, rachaDePrueba({ dias: 11, hechoHoy: false }));
    consultarLaRacha.mockResolvedValue(rachaDePrueba({ dias: 12, hechoHoy: true }));
  });

  it('con un resultado normal, la primera actividad del dia celebra la racha con la mascota', async () => {
    pintar(ANA);

    await usuario.click(await screen.findByRole('button', { name: 'Terminar' }));
    await screen.findByRole('heading', { level: 1, name: 'Listo' });

    // Sale a los 1,2 s de ver el resultado: mas que la espera por omision de la busqueda.
    const celebracion = await screen.findByRole(
      'dialog',
      { name: '¡12 días seguidos!' },
      { timeout: 4_000 },
    );

    expect(celebracion).toHaveAttribute('data-escena', 'dia');
    // La mascota del dialogo es la de la cuenta, con su cara de celebracion.
    await waitFor(() =>
      expect(celebracion.querySelector('.viva-voz__cara img')?.getAttribute('src')).toBe(
        sprite('gato', 'celebrando'),
      ),
    );
  });

  it('cuando el resultado pide acompanar no hay celebracion ni confeti, y las lineas siguen a la vista', async () => {
    registrarResultado.mockResolvedValue({
      id: 'r-2',
      activityId: SUENO,
      nivelOrientativo: 'requiere_atencion',
      sugiereAcompanamiento: true,
      lineasDeAtencion: [
        {
          id: 'linea-1',
          titulo: 'Línea de prueba',
          descripcion: 'Una línea para hablar con alguien.',
          cobertura: 'nacional',
        },
      ],
      metadata: {},
      completedAt: '2026-10-12T15:00:00.000Z',
    });

    pintar(ANA);

    await usuario.click(await screen.findByRole('button', { name: 'Terminar' }));
    await screen.findByRole('heading', { level: 1, name: 'Listo' });

    // Primero llega la linea tranquila con los dias: eso es que ya se pidio la racha...
    expect(await screen.findByText('Racha: 12 días')).toBeInTheDocument();

    // ...y la celebracion, que de otra forma saldria a los 1,2 segundos, no sale.
    await new Promise((resolver) => setTimeout(resolver, 1_600));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.querySelector('.confeti')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Si te sirve hablarlo con alguien' })).toBeVisible();
    expect(screen.getByText('Línea de prueba')).toBeVisible();
  });

  it('la segunda actividad del dia termina como siempre, sin celebrar otra vez', async () => {
    recordarLaRacha(ANA, rachaDePrueba({ dias: 12, hechoHoy: true }));

    pintar(ANA);

    await usuario.click(await screen.findByRole('button', { name: 'Terminar' }));
    await screen.findByRole('heading', { level: 1, name: 'Listo' });
    await waitFor(() => expect(consultarLaRacha).toHaveBeenCalled());
    await new Promise((resolver) => setTimeout(resolver, 1_600));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('sin cuenta (sin id de usuario) la actividad termina igual y no se pide la racha', async () => {
    pintar();

    await usuario.click(await screen.findByRole('button', { name: 'Terminar' }));
    await screen.findByRole('heading', { level: 1, name: 'Listo' });

    expect(consultarLaRacha).not.toHaveBeenCalled();
  });

  it('si la racha no se puede pedir, el resultado se ve completo y sin errores', async () => {
    consultarLaRacha.mockRejectedValue(new TypeError('Failed to fetch'));

    pintar(ANA);

    await usuario.click(await screen.findByRole('button', { name: 'Terminar' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Listo' })).toBeInTheDocument();
    await waitFor(() => expect(consultarLaRacha).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
