import type { Session } from '@supabase/supabase-js';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Cuenta } from '../../infraestructura/api/cuenta.ts';
import type { HechoDelHistorial } from '../../infraestructura/api/historial.ts';
import type { ProgresoDelModulo } from '../../infraestructura/api/progreso.ts';
import { abrirUnAlmacenDePrueba, cerrarElAlmacenDePrueba } from '../../pruebas/almacenDePrueba.ts';
import { cuantosH1, fallosDeAccesibilidad } from '../../pruebas/axe.ts';
import { rachaDePrueba } from '../../pruebas/rachaDePrueba.ts';
import { olvidarLaRacha } from '../../racha/memoriaDeLaRacha.ts';
import { RUTAS, rutaDeActividad } from '../../rutas/rutas.ts';
import { SesionContexto, type EstadoDeSesion } from '../../sesion/SesionContexto.ts';
import { diaEnLaZona, fijarLaZonaDeLaCuenta } from '../../tiempo/zonaHoraria.ts';
import { MiActividad } from './MiActividad.tsx';

/**
 * «Mi actividad» (SCRUM-296), con la API simulada y la pantalla de verdad.
 */
const {
  consultarLaVersionDelAviso,
  darDeAltaLaCuenta,
  consultarElProgreso,
  consultarElHistorial,
  consultarLaRacha,
} = vi.hoisted(() => ({
  consultarLaVersionDelAviso: vi.fn(),
  darDeAltaLaCuenta: vi.fn(),
  consultarElProgreso: vi.fn(),
  consultarElHistorial: vi.fn(),
  consultarLaRacha: vi.fn(),
}));

// El semaforo flota en esta pantalla; aqui no se prueba.
vi.mock('../../infraestructura/api/pendientes.ts', () => ({
  consultarElSemaforo: () => Promise.resolve({ pendientes: [], recordatorio: null }),
}));
vi.mock('../../infraestructura/api/aviso.ts', () => ({ consultarLaVersionDelAviso }));
vi.mock('../../infraestructura/api/cuenta.ts', () => ({ darDeAltaLaCuenta }));
vi.mock('../../infraestructura/api/progreso.ts', () => ({ consultarElProgreso }));
vi.mock('../../infraestructura/api/historial.ts', () => ({ consultarElHistorial }));
vi.mock('../../infraestructura/api/racha.ts', () => ({ consultarLaRacha }));

fijarLaZonaDeLaCuenta('America/Bogota');

const CUENTA: Cuenta = {
  id: '11111111-1111-4111-8111-111111111111',
  correo: 'marina@ejemplo.test',
  rol: 'usuario',
  nombre: 'Marina',
  consentimiento: { versionPolitica: '2026-09-1', aceptadoEn: '2026-09-26T15:00:00.000Z' },
  registradoEn: '2026-09-26T15:00:00.000Z',
  modulosActivos: ['bienestar', 'cognicion'],
  mascota: null,
  diarioConRecomendaciones: false,
  acompanamientoPorDias: false,
  zonaHoraria: 'America/Bogota',
};

const SUENO = '0acd0000-0000-4000-8000-000000000002';
const PAREJAS = '0acd0000-0000-4000-8000-000000000010';
const ATENCION = '0acd0000-0000-4000-8000-000000000011';

/** Doce sesiones; lo de hoy ya esta hecho. */
const BIENESTAR: ProgresoDelModulo = {
  modulo: 'bienestar',
  sesiones: 12,
  etapa: { numero: 1, esTemporada: false, sesionesHechas: 12, sesionesDeLaEtapa: 20 },
  hoy: [
    {
      id: SUENO,
      nombre: 'Cómo dormiste anoche',
      descripcion: 'Anota cuánto y cómo dormiste.',
      hecha: true,
      frecuencia: { tipo: 'diaria' },
    },
  ],
};

/** Cinco sesiones; lo de hoy esta por hacer: de ahi sale «Continuar mi recorrido». */
const COGNICION: ProgresoDelModulo = {
  modulo: 'cognicion',
  sesiones: 1,
  etapa: { numero: 1, esTemporada: false, sesionesHechas: 1, sesionesDeLaEtapa: 20 },
  hoy: [
    {
      id: PAREJAS,
      nombre: 'Parejas',
      descripcion: 'Encuentra las parejas de cartas.',
      hecha: false,
      frecuencia: { tipo: 'diaria' },
    },
  ],
};

const usuario = userEvent.setup({ delay: null });

function sesion(): EstadoDeSesion {
  const vacio = vi.fn();

  return {
    sesion: { user: { id: CUENTA.id, email: CUENTA.correo } } as Session,
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

function pintar() {
  return render(
    <SesionContexto.Provider value={sesion()}>
      <MemoryRouter initialEntries={[RUTAS.MI_ACTIVIDAD]}>
        <Routes>
          <Route path={RUTAS.MI_ACTIVIDAD} element={<MiActividad />} />
          <Route path={RUTAS.PANEL} element={<p>Panel</p>} />
        </Routes>
      </MemoryRouter>
    </SesionContexto.Provider>,
  );
}

function hecho(
  n: number,
  dia: string,
  nombre: string,
  idDeLaActividad = `a${String(n)}`,
  hora = '15:00',
): HechoDelHistorial {
  return {
    id: `h${String(n)}`,
    actividad: { id: idDeLaActividad, nombre },
    dia,
    // 15:00 UTC es las 10:00 a. m. en Bogota.
    hechaEn: `${dia}T${hora}:00.000Z`,
  };
}

/** Lo que el servidor dice de cada modulo; el que no se nombra no tiene nada. */
function conHistorial(porModulo: Partial<Record<'bienestar' | 'cognicion', HechoDelHistorial[]>>) {
  consultarElHistorial.mockImplementation((modulo: 'bienestar' | 'cognicion') =>
    Promise.resolve({ hechos: porModulo[modulo] ?? [], siguientePagina: null }),
  );
}

/** Cinco actividades en los tres dias hechos de la semana de prueba (19, 20 y 21 de octubre). */
function laSemanaDeEjemplo() {
  conHistorial({
    bienestar: [
      hecho(1, '2026-10-21', 'Cómo dormiste anoche', SUENO, '20:30'),
      hecho(2, '2026-10-20', 'Estiramientos'),
      hecho(3, '2026-10-19', 'Respirar'),
    ],
    cognicion: [
      hecho(4, '2026-10-21', 'Parejas', PAREJAS, '23:00'),
      hecho(5, '2026-10-20', 'Atención sostenida', ATENCION),
    ],
  });
}

beforeEach(() => {
  olvidarLaRacha();
  consultarLaVersionDelAviso.mockResolvedValue('version-de-la-api');
  darDeAltaLaCuenta.mockResolvedValue(CUENTA);
  consultarElProgreso.mockResolvedValue([BIENESTAR, COGNICION]);
  consultarLaRacha.mockResolvedValue(rachaDePrueba());
  laSemanaDeEjemplo();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Mi actividad, la pantalla (SCRUM-296)', () => {
  it('mientras llega lo de la cuenta muestra la carga y lo dice', async () => {
    consultarElProgreso.mockReturnValue(new Promise(() => undefined));

    pintar();

    expect(await screen.findByRole('status')).toHaveTextContent('Cargando tu actividad…');
  });

  it('tiene un solo h1, «Mi actividad», y sin fallos de accesibilidad', async () => {
    pintar();

    expect(await screen.findByRole('heading', { level: 1, name: 'Mi actividad' })).toBeVisible();
    await screen.findByText(/Participaste 3 días/);

    expect(await fallosDeAccesibilidad()).toEqual([]);
    expect(cuantosH1()).toBe(1);
  });

  it('resume la semana en dias y actividades, y dice cual fue la ultima', async () => {
    pintar();

    expect(
      await screen.findByText('Participaste 3 días y completaste 5 actividades.'),
    ).toBeInTheDocument();
    // La mas reciente de todos los modulos: Parejas, el 21 a las 23:00 UTC.
    expect(screen.getByText('Tu última actividad fue «Parejas».')).toBeInTheDocument();
  });

  it('pinta la semana de la racha, de lunes a domingo', async () => {
    pintar();

    const semana = await screen.findByRole('list', { name: 'Tu semana' });

    expect(within(semana).getAllByRole('listitem')).toHaveLength(7);
    expect(within(semana).getByText('lunes: hecho')).toBeInTheDocument();
    expect(within(semana).getByText('jueves: todavía no')).toBeInTheDocument();
  });

  it('cuenta las sesiones de cada modulo activo y deja fuera el que no tiene', async () => {
    pintar();

    const sesiones = await screen.findByRole('list', { name: 'Sesiones completadas' });
    const [bienestar, cognicion, ...otros] = within(sesiones).getAllByRole('listitem');

    expect(otros).toEqual([]);
    expect(bienestar).toHaveTextContent('Bienestar');
    expect(bienestar).toHaveTextContent('12 sesiones');
    expect(cognicion).toHaveTextContent('Cognición');
    expect(cognicion).toHaveTextContent('1 sesión');
    expect(cognicion).not.toHaveTextContent('1 sesiones');
  });

  it('lista las ultimas actividades con su dia y un enlace para repetirlas', async () => {
    pintar();

    const ultimas = await screen.findByRole('list', { name: 'Últimas actividades' });
    const filas = within(ultimas).getAllByRole('listitem');

    // Cinco, de la mas reciente a la mas antigua.
    expect(filas).toHaveLength(5);
    expect(filas[0]).toHaveTextContent('Parejas');
    expect(filas[0]).toHaveTextContent('Cognición');
    expect(filas[1]).toHaveTextContent('Cómo dormiste anoche');
    expect(filas[1]).toHaveTextContent('Miércoles, 21 de octubre');

    expect(within(filas[0]!).getByRole('link', { name: 'Repetir Parejas' })).toHaveAttribute(
      'href',
      rutaDeActividad(PAREJAS),
    );
  });

  it('muestra solo las cinco ultimas aunque haya mas', async () => {
    conHistorial({
      bienestar: [1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
        hecho(n, '2026-10-20', `Actividad ${String(n)}`, `a${String(n)}`, `1${String(n)}:00`),
      ),
    });

    pintar();

    const ultimas = await screen.findByRole('list', { name: 'Últimas actividades' });

    expect(within(ultimas).getAllByRole('listitem')).toHaveLength(5);
    expect(within(ultimas).getByText('Actividad 8')).toBeInTheDocument();
    expect(within(ultimas).queryByText('Actividad 3')).not.toBeInTheDocument();
  });

  it('dice «Hoy» a lo que se hizo hoy', async () => {
    conHistorial({
      bienestar: [hecho(1, diaEnLaZona(new Date()), 'Respirar')],
    });

    pintar();

    const ultimas = await screen.findByRole('list', { name: 'Últimas actividades' });

    expect(within(ultimas).getByText('Hoy')).toBeInTheDocument();
  });

  it('pide el historial de cada modulo activo, y de ningun otro', async () => {
    pintar();

    await screen.findByText(/Participaste 3 días/);

    const pedidos = consultarElHistorial.mock.calls.map(([modulo]) => modulo as string);

    expect(pedidos.sort()).toEqual(['bienestar', 'cognicion']);
  });

  it('«Continuar mi recorrido» lleva a la siguiente actividad pendiente de hoy', async () => {
    pintar();

    const continuar = await screen.findByRole('link', { name: /Continuar mi recorrido/ });

    expect(continuar).toHaveAttribute('href', rutaDeActividad(PAREJAS));
    expect(
      screen.getByText('Parejas', { selector: '.mi-actividad__siguiente-nombre' }),
    ).toBeVisible();
  });

  it('con todo lo de hoy hecho no inventa una siguiente: dice que descanse y lleva al panel', async () => {
    consultarElProgreso.mockResolvedValue([
      BIENESTAR,
      { ...COGNICION, hoy: COGNICION.hoy.map((uno) => ({ ...uno, hecha: true })) },
    ]);

    pintar();

    expect(await screen.findByText('Hoy ya hiciste todo tu plan')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Continuar mi recorrido/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a tu panel' })).toHaveAttribute(
      'href',
      RUTAS.PANEL,
    );
  });

  it('no califica: ni puntajes ni porcentajes', async () => {
    pintar();

    await screen.findByText(/Participaste 3 días/);

    expect(document.querySelector('main')?.textContent).not.toMatch(/puntaje|puntos|%|nivel/i);
  });

  it('la navegacion marca «Mi actividad» como la pagina actual, arriba y en el dock', async () => {
    pintar();

    await screen.findByRole('heading', { level: 1, name: 'Mi actividad' });

    // `hidden`: el CSS esconde el dock en el computador y la barra en el movil, pero las dos estan.
    const navegaciones = screen.getAllByRole('navigation', { hidden: true });

    expect(navegaciones).toHaveLength(2);

    for (const navegacion of navegaciones) {
      expect(
        within(navegacion).getByRole('link', { name: 'Mi actividad', hidden: true }),
      ).toHaveAttribute('aria-current', 'page');
    }
  });
});

describe('Mi actividad, color y vida por modulo (SCRUM-311)', () => {
  /** Una actividad de Bienestar hecha hace un instante, junto a lo antiguo de la semana de ejemplo. */
  function conUnaRecienHecha() {
    conHistorial({
      bienestar: [
        {
          id: 'reciente',
          actividad: { id: SUENO, nombre: 'Respirar' },
          dia: diaEnLaZona(new Date()),
          hechaEn: new Date().toISOString(),
        },
        hecho(2, '2026-10-20', 'Estiramientos'),
      ],
      cognicion: [hecho(5, '2026-10-20', 'Atención sostenida', ATENCION)],
    });
  }

  function tarjetaDe(nombre: 'Bienestar' | 'Cognición'): HTMLElement {
    const sesiones = screen.getByRole('list', { name: 'Sesiones completadas' });

    return within(sesiones)
      .getAllByRole('listitem')
      .find((uno) => uno.textContent.includes(nombre))!;
  }

  it('cada modulo pinta su cifra de sesiones en grande, con su color', async () => {
    pintar();

    const sesiones = await screen.findByRole('list', { name: 'Sesiones completadas' });
    const [bienestar, cognicion] = within(sesiones).getAllByRole('listitem');

    expect(bienestar!.querySelector('.mi-actividad__modulo-numero')).toHaveTextContent(/^12$/);
    expect(cognicion!.querySelector('.mi-actividad__modulo-numero')).toHaveTextContent(/^1$/);
    // El color del modulo llega a la tarjeta por las variables que ya usaba el icono.
    expect(bienestar!.style.getPropertyValue('--modulo-acento')).toBe(
      'var(--app-bienestar-acento)',
    );
    expect(cognicion!.style.getPropertyValue('--modulo-acento')).toBe(
      'var(--app-cognicion-acento)',
    );
  });

  it('lo que se hizo hace un momento marca la tarjeta del modulo y su fila', async () => {
    conUnaRecienHecha();

    pintar();

    const ultimas = await screen.findByRole('list', { name: 'Últimas actividades' });
    const filas = within(ultimas).getAllByRole('listitem');

    expect(filas[0]).toHaveClass('mi-actividad__hecho--reciente');
    expect(filas[0]).toHaveTextContent('Respirar');
    expect(filas[1]).not.toHaveClass('mi-actividad__hecho--reciente');
    // Solo el modulo donde se hizo se marca: Cognicion no tiene nada reciente.
    expect(tarjetaDe('Bienestar')).toHaveClass('mi-actividad__modulo--reciente');
    expect(tarjetaDe('Cognición')).not.toHaveClass('mi-actividad__modulo--reciente');
  });

  it('lo que se hizo hace horas o dias no lleva la marca', async () => {
    pintar();

    await screen.findByRole('list', { name: 'Últimas actividades' });

    expect(document.querySelector('.mi-actividad__hecho--reciente')).toBeNull();
    expect(document.querySelector('.mi-actividad__modulo--reciente')).toBeNull();
  });

  it('sin poder leer el historial no se marca nada como reciente', async () => {
    consultarElHistorial.mockRejectedValue(new TypeError('Failed to fetch'));

    pintar();

    await screen.findByText(/Para ver tus últimas actividades hace falta conexión/);

    expect(document.querySelector('.mi-actividad__modulo--reciente')).toBeNull();
    expect(document.querySelector('.mi-actividad__hecho--reciente')).toBeNull();
  });

  it('lo reciente es solo color y movimiento: no agrega texto ni califica', async () => {
    conUnaRecienHecha();

    pintar();

    await screen.findByText(/Participaste/);

    expect(document.querySelector('main')?.textContent).not.toMatch(/puntaje|puntos|%|nivel|nuev/i);
    expect(await fallosDeAccesibilidad()).toEqual([]);
  });
});

describe('Mi actividad, lo que falta por leer (SCRUM-296)', () => {
  it('un historial vacio invita y no reclama', async () => {
    conHistorial({});

    pintar();

    expect(await screen.findByText('Todavía no hay actividades')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sin conexion para el historial lo dice con calma, y lo demas sigue ahi', async () => {
    consultarElHistorial.mockRejectedValue(new TypeError('Failed to fetch'));

    pintar();

    expect(
      await screen.findByText(/Para ver tus últimas actividades hace falta conexión/),
    ).toBeInTheDocument();
    // La semana y las sesiones vienen de lo guardado: no dependen del historial.
    expect(screen.getByText('Participaste 3 días esta semana.')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Sesiones completadas' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Continuar mi recorrido/ })).toBeInTheDocument();
  });

  it('«Reintentar» vuelve a pedir el historial', async () => {
    consultarElHistorial.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    consultarElHistorial.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    pintar();

    await usuario.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(
      await screen.findByText('Participaste 3 días y completaste 5 actividades.'),
    ).toBeInTheDocument();
  });

  it('sin saber la semana no dice que no hubo actividad', async () => {
    consultarLaRacha.mockRejectedValue(new TypeError('Failed to fetch'));

    pintar();

    expect(
      await screen.findByText(/Tu semana aparece aquí cuando haya conexión/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/todavía no hay actividad/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Participaste/)).not.toBeInTheDocument();
  });

  it('una semana sin nada se dice con calma', async () => {
    consultarLaRacha.mockResolvedValue(
      rachaDePrueba({
        semana: rachaDePrueba().semana.map((dia) => ({ ...dia, estado: 'sinActividad' as const })),
      }),
    );
    conHistorial({});

    pintar();

    expect(
      await screen.findByText(
        'Esta semana todavía no hay actividad. Cuando quieras, aquí empieza.',
      ),
    ).toBeInTheDocument();
  });

  it('si no se puede leer la cuenta, lo dice y deja reintentar', async () => {
    consultarElProgreso.mockRejectedValue(new Error('boom'));

    pintar();

    const aviso = await screen.findByRole('alert');

    expect(within(aviso).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});

describe('Mi actividad sin conexion (SCRUM-296, SCRUM-140)', () => {
  beforeEach(async () => {
    await abrirUnAlmacenDePrueba();
  });

  afterEach(() => {
    cerrarElAlmacenDePrueba();
    darDeAltaLaCuenta.mockReset();
  });

  it('se abre con la copia de este equipo, y dice de cuando es', async () => {
    const primera = pintar();

    await screen.findByRole('list', { name: 'Sesiones completadas' });
    primera.unmount();
    darDeAltaLaCuenta.mockRejectedValue(new TypeError('Failed to fetch'));
    consultarElHistorial.mockRejectedValue(new TypeError('Failed to fetch'));

    pintar();

    await waitFor(() => {
      expect(screen.getByText(/Datos de hace un momento/)).toBeInTheDocument();
    });
    expect(screen.getByRole('list', { name: 'Sesiones completadas' })).toHaveTextContent(
      '12 sesiones',
    );
  });
});
