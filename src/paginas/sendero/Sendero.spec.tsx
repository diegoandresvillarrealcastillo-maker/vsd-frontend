import type { Session } from '@supabase/supabase-js';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Cuenta } from '../../infraestructura/api/cuenta.ts';
import type { ProgresoDelModulo } from '../../infraestructura/api/progreso.ts';
import { abrirUnAlmacenDePrueba, cerrarElAlmacenDePrueba } from '../../pruebas/almacenDePrueba.ts';
import { cuantosH1, fallosDeAccesibilidad } from '../../pruebas/axe.ts';
import { RUTAS, rutaDeModulo } from '../../rutas/rutas.ts';
import { encolar } from '../../sincronizacion/ciclo.ts';
import { SesionContexto, type EstadoDeSesion } from '../../sesion/SesionContexto.ts';
import { Sendero } from './Sendero.tsx';

/**
 * El sendero de un modulo, con la API simulada y la pantalla de verdad.
 */
const { consultarLaVersionDelAviso, darDeAltaLaCuenta, consultarElProgreso } = vi.hoisted(() => ({
  consultarLaVersionDelAviso: vi.fn(),
  darDeAltaLaCuenta: vi.fn(),
  consultarElProgreso: vi.fn(),
}));

// El semaforo flota en esta pantalla (SCRUM-98); aqui no se prueba.
vi.mock('../../infraestructura/api/pendientes.ts', () => ({
  consultarElSemaforo: () => Promise.resolve({ pendientes: [], recordatorio: null }),
}));
vi.mock('../../infraestructura/api/aviso.ts', () => ({ consultarLaVersionDelAviso }));
vi.mock('../../infraestructura/api/cuenta.ts', () => ({ darDeAltaLaCuenta }));
vi.mock('../../infraestructura/api/progreso.ts', () => ({ consultarElProgreso }));

const CUENTA: Cuenta = {
  id: '11111111-1111-4111-8111-111111111111',
  correo: 'marina@ejemplo.test',
  rol: 'usuario',
  nombre: 'Marina',
  consentimiento: { versionPolitica: '2026-09-1', aceptadoEn: '2026-09-26T15:00:00.000Z' },
  registradoEn: '2026-09-26T15:00:00.000Z',
  modulosActivos: ['bienestar'],
  mascota: null,
  diarioConRecomendaciones: false,
  zonaHoraria: 'America/Bogota',
};

/** Tres sesiones hechas y nada todavia hoy. */
const BIENESTAR: ProgresoDelModulo = {
  modulo: 'bienestar',
  sesiones: 3,
  etapa: { numero: 1, esTemporada: false, sesionesHechas: 3, sesionesDeLaEtapa: 5 },
  hoy: [
    {
      id: '0acd0000-0000-4000-8000-000000000002',
      nombre: 'Cómo dormiste anoche',
      descripcion: 'Anota cuánto y cómo dormiste.',
      hecha: false,
      frecuencia: { tipo: 'diaria' },
    },
    {
      id: '0acd0000-0000-4000-8000-000000000003',
      nombre: 'Estiramientos',
      hecha: false,
      frecuencia: { tipo: 'semanal', dias: [1, 4] },
    },
    {
      id: '0acd0000-0000-4000-8000-000000000004',
      nombre: 'Tu punto de partida',
      hecha: false,
      frecuencia: { tipo: 'unica' },
    },
  ],
};

const usuario = userEvent.setup({ delay: null });

function sesion(): EstadoDeSesion {
  const vacio = vi.fn();

  return {
    sesion: { user: { email: CUENTA.correo } } as Session,
    cargando: false,
    correo: CUENTA.correo,
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

function pintar(ruta: string = rutaDeModulo('bienestar')) {
  return render(
    <SesionContexto.Provider value={sesion()}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path={RUTAS.MODULO} element={<Sendero />} />
          <Route path={RUTAS.PANEL} element={<p>Panel</p>} />
        </Routes>
      </MemoryRouter>
    </SesionContexto.Provider>,
  );
}

function conProgreso(parcial: Partial<ProgresoDelModulo>) {
  consultarElProgreso.mockResolvedValue([{ ...BIENESTAR, ...parcial }]);
}

beforeEach(() => {
  consultarLaVersionDelAviso.mockResolvedValue('version-de-la-api');
  darDeAltaLaCuenta.mockResolvedValue(CUENTA);
  consultarElProgreso.mockResolvedValue([BIENESTAR]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Sendero, accesibilidad (C-03)', () => {
  it('no tiene fallos de accesibilidad y tiene un solo h1', async () => {
    pintar();
    await screen.findByRole('heading', { name: 'Bienestar' });

    expect(await fallosDeAccesibilidad()).toEqual([]);
    expect(cuantosH1()).toBe(1);
  });

  it('tampoco con la hoja de lo de hoy abierta', async () => {
    pintar();
    await usuario.click(await screen.findByRole('button', { name: /Ver lo de hoy/ }));
    await screen.findByRole('dialog');

    expect(await fallosDeAccesibilidad()).toEqual([]);
  });

  it('la hoja se cierra al pulsar el fondo, y no al pulsar dentro', async () => {
    pintar();
    await usuario.click(await screen.findByRole('button', { name: /Ver lo de hoy/ }));

    const hoja = screen.getByRole('dialog');

    await usuario.click(within(hoja).getByRole('heading', { name: 'Lo de hoy' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // El fondo es el elemento que la rodea, sin rol de control.
    const fondo = hoja.parentElement;

    expect(fondo).not.toBeNull();
    await usuario.click(fondo!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Sendero', () => {
  describe('el camino', () => {
    it('muestra la etapa actual con lo hecho, el punto de hoy y la meta', async () => {
      pintar();

      expect(await screen.findByRole('heading', { name: 'Bienestar' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Etapa 1' })).toBeInTheDocument();
      expect(screen.getByText('3 de 5 sesiones')).toBeInTheDocument();

      const puntos = within(screen.getByRole('list', { name: 'Sesiones de la Etapa 1' }));

      expect(puntos.getAllByRole('listitem')).toHaveLength(5);
      expect(puntos.getByRole('img', { name: 'Sesión 1: hecha' })).toBeInTheDocument();
      expect(puntos.getByRole('img', { name: 'Sesión 3: hecha' })).toBeInTheDocument();
      expect(
        puntos.getByRole('button', { name: /Hoy, sesión 4: 0 de 3 actividades hechas/ }),
      ).toBeInTheDocument();
      expect(
        puntos.getByRole('img', { name: 'Sesión 5, la meta de la etapa: por hacer' }),
      ).toBeInTheDocument();
    });

    it('con algo hecho hoy, hoy ya cuenta como sesion', async () => {
      conProgreso({
        sesiones: 4,
        etapa: { numero: 1, esTemporada: false, sesionesHechas: 4, sesionesDeLaEtapa: 5 },
        hoy: BIENESTAR.hoy.map((actividad, indice) => ({ ...actividad, hecha: indice === 0 })),
      });

      pintar();

      expect(await screen.findByText('4 de 5 sesiones')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Hoy, sesión 4: 1 de 3 actividades hechas/ }),
      ).toBeInTheDocument();
    });

    it('el dia que completa la etapa la ve cerrada, y no salta a la siguiente', async () => {
      // Para la API ya va en la etapa 2; el sendero muestra hoy como la meta de
      // la etapa 1.
      conProgreso({
        sesiones: 5,
        etapa: { numero: 2, esTemporada: false, sesionesHechas: 0, sesionesDeLaEtapa: 10 },
        hoy: BIENESTAR.hoy.map((actividad) => ({ ...actividad, hecha: true })),
      });

      pintar();

      expect(await screen.findByRole('heading', { name: 'Etapa 1' })).toBeInTheDocument();
      expect(screen.getByText('5 de 5 sesiones')).toBeInTheDocument();
      expect(screen.getByText(/Hoy completaste la Etapa 1/)).toBeInTheDocument();
      expect(screen.getByText('Etapa 2 · 10 sesiones')).toBeInTheDocument();
    });

    it('las etapas anteriores van plegadas y la siguiente, bloqueada', async () => {
      conProgreso({
        sesiones: 17,
        etapa: { numero: 3, esTemporada: false, sesionesHechas: 2, sesionesDeLaEtapa: 15 },
        hoy: [],
      });

      pintar();

      expect(await screen.findByText('2 etapas completadas')).toBeInTheDocument();
      expect(screen.getByText('Etapa 1 · 5 sesiones')).toBeInTheDocument();
      expect(screen.getByText('Etapa 2 · 10 sesiones')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Etapa 3' })).toBeInTheDocument();
      expect(screen.getByText('Etapa 4 · 20 sesiones')).toBeInTheDocument();
      expect(screen.getByText('Se abre al completar esta etapa.')).toBeInTheDocument();
    });

    it('tras la etapa 4 vienen las temporadas', async () => {
      conProgreso({
        sesiones: 52,
        etapa: { numero: 1, esTemporada: true, sesionesHechas: 2, sesionesDeLaEtapa: 25 },
        hoy: [],
      });

      pintar();

      expect(await screen.findByRole('heading', { name: 'Temporada 1' })).toBeInTheDocument();
      expect(screen.getByText('Temporada actual')).toBeInTheDocument();
      expect(screen.getByText('4 etapas completadas')).toBeInTheDocument();
      expect(screen.getByText('Temporada 2 · 25 sesiones')).toBeInTheDocument();
    });
  });

  describe('lo de hoy', () => {
    it('el punto de hoy abre lo que toca, con su frecuencia y su enlace', async () => {
      pintar();

      await usuario.click(await screen.findByRole('button', { name: /Hoy, sesión 4/ }));

      const hoja = screen.getByRole('dialog', { name: 'Lo de hoy' });

      expect(within(hoja).getByText('Diaria')).toBeInTheDocument();
      expect(within(hoja).getByText('Lun · Jue')).toBeInTheDocument();
      expect(within(hoja).getByText('Una vez')).toBeInTheDocument();
      expect(
        within(hoja).getByRole('link', { name: 'Empezar Cómo dormiste anoche' }),
      ).toHaveAttribute('href', '/actividad/0acd0000-0000-4000-8000-000000000002');
      // El foco entra a la hoja, para poder cerrarla enseguida con teclado.
      expect(within(hoja).getByRole('button', { name: 'Cerrar' })).toHaveFocus();
    });

    it('se cierra con Escape y el foco vuelve al punto de hoy', async () => {
      pintar();

      const punto = await screen.findByRole('button', { name: /Hoy, sesión 4/ });

      await usuario.click(punto);
      await usuario.keyboard('{Escape}');

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(punto).toHaveFocus();
    });

    it('tambien se abre desde el boton, y lo hecho se marca', async () => {
      conProgreso({
        sesiones: 4,
        hoy: BIENESTAR.hoy.map((actividad, indice) => ({ ...actividad, hecha: indice === 0 })),
      });

      pintar();

      await usuario.click(await screen.findByRole('button', { name: 'Ver lo de hoy · 1 de 3' }));

      const hoja = screen.getByRole('dialog');

      expect(within(hoja).getByText('Hecha hoy')).toBeInTheDocument();
      expect(within(hoja).getByText('1 de 3')).toBeInTheDocument();

      await usuario.click(within(hoja).getByRole('button', { name: 'Cerrar' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('un dia sin nada que hacer lo dice', async () => {
      conProgreso({ hoy: [] });

      pintar();

      await usuario.click(await screen.findByRole('button', { name: 'Ver lo de hoy' }));

      expect(screen.getByRole('dialog')).toHaveTextContent('Hoy no te toca nada en este módulo');
    });
  });

  describe('la mascota (SCRUM-99)', () => {
    function expresion(): string | undefined {
      return document.querySelector<HTMLElement>('.mascota')?.dataset.expresion;
    }

    it('acompaña en el sendero, y celebra cuando lo de hoy esta hecho', async () => {
      darDeAltaLaCuenta.mockResolvedValue({
        ...CUENTA,
        mascota: { forma: 'ori', nombre: 'Hilo' },
      });
      conProgreso({
        sesiones: 4,
        hoy: BIENESTAR.hoy.map((actividad) => ({ ...actividad, hecha: true })),
      });

      pintar();

      expect(await screen.findByRole('button', { name: 'Hilo, tu mascota' })).toBeInTheDocument();
      expect(expresion()).toBe('celebrando');
    });

    it('con lo de hoy a medias no celebra', async () => {
      pintar();

      await screen.findByRole('button', { name: 'Fungito, tu mascota' });

      expect(expresion()).not.toBe('celebrando');
    });
  });

  describe('lo que no sale bien', () => {
    it('un modulo que no tiene activo lo dice y lleva al panel', async () => {
      consultarElProgreso.mockResolvedValue([{ ...BIENESTAR, modulo: 'cognicion' }]);

      pintar();

      expect(
        await screen.findByText('Todavía no tienes Bienestar entre tus módulos.'),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Añadirlo desde tu panel' })).toHaveAttribute(
        'href',
        RUTAS.PANEL,
      );
    });

    it('un modulo que no existe no llama a la API', () => {
      pintar('/modulo/astrologia');

      expect(screen.getByRole('alert')).toHaveTextContent('Ese módulo no existe');
      expect(consultarElProgreso).not.toHaveBeenCalled();
    });

    it('si no se puede conectar, lo explica y deja reintentar', async () => {
      consultarElProgreso.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      pintar();

      // Sin red y sin una copia en este equipo no hay nada que ensenar (SCRUM-140).
      expect(await screen.findByRole('alert')).toHaveTextContent(
        /Todavía no hay una copia de tu panel en este equipo/,
      );

      await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(await screen.findByRole('heading', { name: 'Etapa 1' })).toBeInTheDocument();
    });

    it('siempre se puede volver al panel', async () => {
      pintar();

      await screen.findByRole('heading', { name: 'Etapa 1' });

      expect(screen.getByRole('link', { name: 'Volver a tu panel' })).toHaveAttribute(
        'href',
        RUTAS.PANEL,
      );
    });
  });
});

describe('Sendero sin conexion (SCRUM-140)', () => {
  beforeEach(async () => {
    await abrirUnAlmacenDePrueba();
  });

  afterEach(() => {
    cerrarElAlmacenDePrueba();
    darDeAltaLaCuenta.mockReset();
  });

  async function conLaCopiaGuardada() {
    const primera = pintar();

    await screen.findByRole('heading', { name: 'Etapa 1' });
    primera.unmount();
    darDeAltaLaCuenta.mockRejectedValue(new TypeError('Failed to fetch'));
  }

  it('se abre con la copia de este equipo, y dice de cuando es', async () => {
    await conLaCopiaGuardada();

    pintar();

    expect(await screen.findByRole('heading', { name: 'Etapa 1' })).toBeInTheDocument();
    expect(screen.getByText(/Datos de hace un momento/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Hoy, sesión 4: 0 de 3 actividades hechas/ }),
    ).toBeInTheDocument();
  });

  it('lo que se hizo hoy sin conexion sale hecho, y se dice que se contara al enviarse', async () => {
    await conLaCopiaGuardada();
    await encolar({
      operationId: 'res-1',
      tipo: 'resultado.registrar',
      entidad: 'resultado:res-1',
      payload: {
        clientOperationId: 'res-1',
        activityId: '0acd0000-0000-4000-8000-000000000002',
        completedAt: new Date().toISOString(),
      },
    });

    pintar();

    expect(
      await screen.findByRole('button', { name: /Hoy, sesión 4: 1 de 3 actividades hechas/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Lo que hiciste sin conexión se contará cuando se envíe/),
    ).toBeInTheDocument();
  });

  it('con conexion no hay nada que decir de la copia', async () => {
    pintar();

    await screen.findByRole('heading', { name: 'Etapa 1' });

    expect(screen.queryByText(/Datos de hace/)).toBeNull();
  });
});
