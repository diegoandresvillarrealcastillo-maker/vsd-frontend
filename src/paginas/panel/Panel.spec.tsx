import type { Session } from '@supabase/supabase-js';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorDeLaApi } from '../../infraestructura/api/clienteHttp.ts';
import type { Cuenta } from '../../infraestructura/api/cuenta.ts';
import type { ProgresoDelModulo } from '../../infraestructura/api/progreso.ts';
import { abrirUnAlmacenDePrueba, cerrarElAlmacenDePrueba } from '../../pruebas/almacenDePrueba.ts';
import { cuantosH1, fallosDeAccesibilidad } from '../../pruebas/axe.ts';
import { SesionContexto, type EstadoDeSesion } from '../../sesion/SesionContexto.ts';
import { encolar } from '../../sincronizacion/ciclo.ts';
import { Panel } from './Panel.tsx';

/**
 * El dashboard, con la API simulada y el resto de verdad.
 *
 * Se simulan los modulos de API y **no** el gancho que los usa: asi la prueba
 * recorre lo que de verdad puede fallar —el orden de las llamadas, los tres
 * estados, el reintento— en lugar de comprobar que un doble devuelve lo que se
 * le dijo que devolviera.
 */
const { consultarLaVersionDelAviso, darDeAltaLaCuenta, cambiarPreferencias, consultarElProgreso } =
  vi.hoisted(() => ({
    consultarLaVersionDelAviso: vi.fn(),
    darDeAltaLaCuenta: vi.fn(),
    cambiarPreferencias: vi.fn(),
    consultarElProgreso: vi.fn(),
  }));

// El semaforo flota en esta pantalla (SCRUM-98); aqui no se prueba.
vi.mock('../../infraestructura/api/pendientes.ts', () => ({
  consultarElSemaforo: () => Promise.resolve({ pendientes: [], recordatorio: null }),
}));
vi.mock('../../infraestructura/api/aviso.ts', () => ({ consultarLaVersionDelAviso }));
vi.mock('../../infraestructura/api/cuenta.ts', () => ({ darDeAltaLaCuenta, cambiarPreferencias }));
vi.mock('../../infraestructura/api/progreso.ts', () => ({ consultarElProgreso }));

const CUENTA: Cuenta = {
  id: '11111111-1111-4111-8111-111111111111',
  correo: 'alguien@ucundinamarca.edu.co',
  rol: 'usuario',
  nombre: 'Marina',
  consentimiento: { versionPolitica: '2026-09-1', aceptadoEn: '2026-09-26T15:00:00.000Z' },
  registradoEn: '2026-09-26T15:00:00.000Z',
  modulosActivos: ['cognicion', 'bienestar'],
  mascota: null,
  diarioConRecomendaciones: false,
  zonaHoraria: 'America/Bogota',
};

const PROGRESO: ProgresoDelModulo[] = [
  {
    modulo: 'cognicion',
    sesiones: 7,
    etapa: { numero: 2, esTemporada: false, sesionesHechas: 2, sesionesDeLaEtapa: 10 },
    hoy: [
      { id: '0acd0000-0000-4000-8000-000000000001', nombre: 'Parejas', tipo: 'juego', hecha: true },
    ],
  },
  {
    modulo: 'bienestar',
    sesiones: 3,
    etapa: { numero: 1, esTemporada: false, sesionesHechas: 3, sesionesDeLaEtapa: 5 },
    hoy: [
      {
        id: '0acd0000-0000-4000-8000-000000000002',
        nombre: 'Cómo dormiste anoche',
        tipo: 'bitacora',
        descripcion: 'Anota cuánto y cómo dormiste.',
        hecha: false,
      },
      { id: '0acd0000-0000-4000-8000-000000000003', nombre: 'Movimiento del día', hecha: false },
    ],
  },
];

function estado(parcial: Partial<EstadoDeSesion>): EstadoDeSesion {
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
    ...parcial,
  };
}

function pintar(sesion: Partial<EstadoDeSesion> = {}) {
  return render(
    <SesionContexto.Provider value={estado(sesion)}>
      <MemoryRouter>
        <Panel />
      </MemoryRouter>
    </SesionContexto.Provider>,
  );
}

function tarjeta(nombre: RegExp) {
  return screen.getByRole('link', { name: nombre });
}

beforeEach(() => {
  consultarLaVersionDelAviso.mockResolvedValue('version-de-la-api');
  darDeAltaLaCuenta.mockResolvedValue(CUENTA);
  consultarElProgreso.mockResolvedValue(PROGRESO);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Dashboard, accesibilidad (C-03)', () => {
  it('no tiene fallos de accesibilidad y tiene un solo h1', async () => {
    pintar();
    await screen.findByRole('heading', { name: /Hola, Marina/ });

    expect(await fallosDeAccesibilidad()).toEqual([]);
    expect(cuantosH1()).toBe(1);
  });
});

describe('Dashboard', () => {
  describe('la carga', () => {
    it('da de alta la cuenta con la version del aviso vigente y despues pide el progreso', async () => {
      pintar();

      await screen.findByRole('heading', { name: /Hola, Marina/ });

      // La version no la conoce el frontend: la dice la API (SCRUM-85).
      expect(darDeAltaLaCuenta).toHaveBeenCalledWith('version-de-la-api', expect.anything());
      // El progreso necesita la cuenta, asi que va despues del alta.
      expect(darDeAltaLaCuenta.mock.invocationCallOrder[0]).toBeLessThan(
        consultarElProgreso.mock.invocationCallOrder[0] ?? 0,
      );
    });

    it('mientras carga lo dice, en lugar de dejar la pantalla vacia', () => {
      darDeAltaLaCuenta.mockReturnValue(
        new Promise(function sinResolver() {
          // A proposito: la peticion se queda en el aire.
        }),
      );

      pintar();

      expect(screen.getByRole('status')).toHaveTextContent(/Cargando tu espacio/);
    });

    it('si no se puede conectar, lo explica y deja reintentar', async () => {
      darDeAltaLaCuenta.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      pintar();

      // Sin red y sin una copia en este equipo no hay nada que ensenar: se dice que hace falta
      // conectarse una vez (SCRUM-140).
      expect(await screen.findByRole('alert')).toHaveTextContent(
        /Todavía no hay una copia de tu panel en este equipo/,
      );

      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(await screen.findByRole('heading', { name: /Hola, Marina/ })).toBeInTheDocument();
    });

    it('si el aviso cambio justo antes del alta, reintentar vuelve a pedir la version', async () => {
      darDeAltaLaCuenta.mockRejectedValueOnce(
        new ErrorDeLaApi(409, 'da igual', undefined, 'VERSION_DEL_AVISO_NO_VIGENTE'),
      );

      pintar();

      expect(await screen.findByRole('alert')).toHaveTextContent(/acaba de actualizarse/);

      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      await screen.findByRole('heading', { name: /Hola, Marina/ });

      expect(consultarLaVersionDelAviso).toHaveBeenCalledTimes(2);
    });

    it('el correo ya registrado se explica por su codigo', async () => {
      darDeAltaLaCuenta.mockRejectedValue(
        new ErrorDeLaApi(409, 'da igual', undefined, 'CORREO_YA_REGISTRADO'),
      );

      pintar();

      expect(await screen.findByRole('alert')).toHaveTextContent(/otro método de acceso/);
    });

    it('la sesion caducada manda a entrar otra vez', async () => {
      consultarElProgreso.mockRejectedValue(new ErrorDeLaApi(401, 'Tu sesion caduco.'));

      pintar();

      expect(await screen.findByRole('alert')).toHaveTextContent(/Tu sesión caducó/);
    });
  });

  describe('el dock del movil (SCRUM-114)', () => {
    function dock(): HTMLElement {
      const elemento = document.querySelector<HTMLElement>('.app__nav-inferior');

      if (elemento === null) {
        throw new Error('El dock no esta en pantalla');
      }

      return elemento;
    }

    function desplazarA(y: number) {
      Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
      fireEvent.scroll(window);
    }

    // Cada prueba empieza arriba del todo.
    beforeEach(() => {
      Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    });

    it('marca la seccion en la que se esta, y cambia al pulsar otra', async () => {
      pintar();

      await screen.findByRole('heading', { name: /Hola, Marina/ });

      const inicio = within(dock()).getByRole('link', { name: 'Inicio' });
      const progreso = within(dock()).getByRole('link', { name: 'Progreso' });

      expect(inicio).toHaveAttribute('aria-current', 'location');

      await userEvent.click(progreso);

      expect(progreso).toHaveAttribute('aria-current', 'location');
      expect(inicio).not.toHaveAttribute('aria-current');
    });

    it('se aparta al bajar y vuelve al subir', async () => {
      pintar();

      await screen.findByRole('heading', { name: /Hola, Marina/ });

      desplazarA(300);
      expect(dock()).toHaveClass('app__nav-inferior--oculto');

      desplazarA(200);
      expect(dock()).not.toHaveClass('app__nav-inferior--oculto');
    });

    it('arriba del todo no se aparta, y vuelve si recibe el foco', async () => {
      pintar();

      await screen.findByRole('heading', { name: /Hola, Marina/ });

      desplazarA(40);
      expect(dock()).not.toHaveClass('app__nav-inferior--oculto');

      desplazarA(400);
      expect(dock()).toHaveClass('app__nav-inferior--oculto');

      fireEvent.focus(within(dock()).getByRole('link', { name: 'Explorar' }));
      expect(dock()).not.toHaveClass('app__nav-inferior--oculto');
    });
  });

  describe('lo que se ve', () => {
    it('saluda con el nombre de la cuenta', async () => {
      pintar();

      expect(await screen.findByRole('heading', { name: /Hola, Marina\./ })).toBeInTheDocument();
    });

    it('y pregunta por donde empezar, sin genero gramatical (SCRUM-109)', async () => {
      pintar();

      expect(await screen.findByRole('heading', { name: /Hola, Marina/ })).toHaveTextContent(
        '¿Por dónde empezamos hoy?',
      );
    });

    it('el selector de tema esta en la barra y cambia el tema (SCRUM-112)', async () => {
      document.documentElement.dataset.tema = 'oscuro';

      pintar();

      const tema = await screen.findByRole('group', { name: 'Tema de la aplicación' });

      await userEvent.click(within(tema).getByRole('button', { name: 'Tema claro' }));

      expect(document.documentElement.dataset.tema).toBe('claro');
      expect(within(tema).getByRole('button', { name: 'Tema claro' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(localStorage.getItem('vsd.tema')).toBe('claro');

      localStorage.removeItem('vsd.tema');
    });

    it('sin nombre saluda igual, sin inventar uno', async () => {
      darDeAltaLaCuenta.mockResolvedValue({ ...CUENTA, nombre: undefined });

      pintar();

      expect(await screen.findByRole('heading', { name: /^Hola\./ })).toBeInTheDocument();
    });

    it('el avance de hoy sale de lo que dice la API: 1 de 3', async () => {
      pintar();

      await screen.findByRole('heading', { name: /Hola, Marina/ });

      expect(screen.getByText('33%')).toBeInTheDocument();
      expect(
        screen.getByRole('progressbar', { name: 'Actividades de hoy hechas' }),
      ).toHaveAttribute('aria-valuenow', '1');
    });

    it('cada modulo activo muestra su etapa real', async () => {
      pintar();

      await screen.findByRole('heading', { name: /Hola, Marina/ });

      expect(tarjeta(/Cognición/)).toHaveTextContent('Etapa 2 · 2 de 10 sesiones');
      expect(tarjeta(/Cognición/)).toHaveTextContent('20%');
      expect(tarjeta(/Bienestar/)).toHaveTextContent('Etapa 1 · 3 de 5 sesiones');
    });

    it('el modulo que no esta activo se ofrece para añadirlo', async () => {
      pintar();

      expect(await screen.findByRole('button', { name: /Añadir Emociones/ })).toBeInTheDocument();
    });

    it('la ruta del día lista lo que toca hoy, con lo hecho marcado', async () => {
      pintar();

      await screen.findByRole('heading', { name: 'Tu ruta de hoy' });

      expect(screen.getByText('Hecha hoy')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Empezar Cómo dormiste anoche' })).toHaveAttribute(
        'href',
        '/actividad/0acd0000-0000-4000-8000-000000000002',
      );
    });

    it('recomienda la siguiente actividad pendiente, no un texto fijo', async () => {
      pintar();

      const recomendado = await screen.findByRole('complementary');

      expect(within(recomendado).getByRole('heading')).toHaveTextContent('Cómo dormiste anoche');
      expect(within(recomendado).getByRole('link', { name: /Comenzar/ })).toBeInTheDocument();
    });

    it('la mascota acompaña en el dashboard y no celebra con el plan a medias', async () => {
      darDeAltaLaCuenta.mockResolvedValue({
        ...CUENTA,
        mascota: { forma: 'gato', nombre: 'Bigotes' },
      });

      pintar();

      expect(
        await screen.findByRole('button', { name: 'Bigotes, tu mascota' }),
      ).toBeInTheDocument();
      expect(document.querySelector<HTMLElement>('.mascota')?.dataset.expresion).not.toBe(
        'celebrando',
      );
    });

    it('con el plan del dia completo, la mascota celebra', async () => {
      consultarElProgreso.mockResolvedValue(
        PROGRESO.map((uno) => ({ ...uno, hoy: uno.hoy.map((a) => ({ ...a, hecha: true })) })),
      );

      pintar();

      await screen.findByRole('button', { name: 'Fungito, tu mascota' });

      expect(document.querySelector<HTMLElement>('.mascota')?.dataset.expresion).toBe('celebrando');
    });

    it('con todo hecho, lo celebra en lugar de recomendar mas', async () => {
      consultarElProgreso.mockResolvedValue(
        PROGRESO.map((uno) => ({ ...uno, hoy: uno.hoy.map((a) => ({ ...a, hecha: true })) })),
      );

      pintar();

      const recomendado = await screen.findByRole('complementary');

      expect(within(recomendado).getByRole('heading')).toHaveTextContent(
        'Hoy ya hiciste todo tu plan',
      );
    });
  });

  describe('la bienvenida (SCRUM-90)', () => {
    // Una cuenta recien creada: sin nombre y sin modulos.
    const { nombre: _sinNombre, ...sinNombre } = CUENTA;
    const NUEVA: Cuenta = { ...sinNombre, modulosActivos: [] };

    beforeEach(() => {
      darDeAltaLaCuenta.mockResolvedValue(NUEVA);
      consultarElProgreso.mockResolvedValue([]);
    });

    it('una cuenta sin modulos ve la bienvenida y no el dashboard', async () => {
      pintar();

      expect(
        await screen.findByRole('heading', { name: /Te damos la bienvenida/ }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Tu ruta de hoy' })).not.toBeInTheDocument();
      expect(screen.getAllByRole('checkbox')).toHaveLength(3);
      // Las secciones son del dashboard: aqui no llevarian a ningun sitio.
      expect(screen.queryByRole('navigation', { name: 'Secciones' })).not.toBeInTheDocument();
      // Salir de la cuenta, en cambio, sigue disponible.
      expect(screen.getByRole('button', { name: /menú de tu cuenta/ })).toBeInTheDocument();
    });

    it('sin elegir ningun modulo no deja empezar, y lo dice', async () => {
      pintar();

      await userEvent.click(await screen.findByRole('button', { name: /Empezar/ }));

      expect(screen.getByRole('alert')).toHaveTextContent('Elige al menos un módulo');
      expect(cambiarPreferencias).not.toHaveBeenCalled();
    });

    it('guarda el nombre y los modulos elegidos, en orden, y pasa al dashboard', async () => {
      cambiarPreferencias.mockResolvedValue({
        ...NUEVA,
        nombre: 'Marina',
        modulosActivos: ['bienestar', 'emociones'],
      });
      consultarElProgreso.mockResolvedValueOnce([]).mockResolvedValueOnce(PROGRESO);

      pintar();

      await userEvent.type(await screen.findByLabelText(/Cómo quieres que te llamemos/), 'Marina');
      await userEvent.click(screen.getByRole('checkbox', { name: /Emociones/ }));
      await userEvent.click(screen.getByRole('checkbox', { name: /Bienestar/ }));
      await userEvent.click(screen.getByRole('button', { name: /Empezar/ }));

      expect(cambiarPreferencias).toHaveBeenCalledWith({
        nombre: 'Marina',
        modulosActivos: ['bienestar', 'emociones'],
      });
      expect(await screen.findByRole('heading', { name: /Hola, Marina/ })).toBeInTheDocument();
    });

    it('si no escribe nombre, no lo manda', async () => {
      cambiarPreferencias.mockResolvedValue({ ...NUEVA, modulosActivos: ['cognicion'] });

      pintar();

      await userEvent.click(await screen.findByRole('checkbox', { name: /Cognición/ }));
      await userEvent.click(screen.getByRole('button', { name: /Empezar/ }));

      expect(cambiarPreferencias).toHaveBeenCalledWith({ modulosActivos: ['cognicion'] });
    });

    it('marcar y desmarcar un modulo se refleja en la casilla', async () => {
      pintar();

      const emociones = await screen.findByRole('checkbox', { name: /Emociones/ });

      await userEvent.click(emociones);
      expect(emociones).toHaveAttribute('aria-checked', 'true');

      await userEvent.click(emociones);
      expect(emociones).toHaveAttribute('aria-checked', 'false');
    });

    it('si guardar falla, lo dice y deja intentarlo otra vez', async () => {
      cambiarPreferencias.mockRejectedValue(new TypeError('Failed to fetch'));

      pintar();

      await userEvent.click(await screen.findByRole('checkbox', { name: /Bienestar/ }));
      await userEvent.click(screen.getByRole('button', { name: /Empezar/ }));

      expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar');
      expect(screen.getByRole('button', { name: /Empezar/ })).toBeEnabled();
    });

    it('sin conexion se puede elegir pero no empezar, y lo dice (SCRUM-142)', async () => {
      const red = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

      pintar();

      await userEvent.type(await screen.findByLabelText(/Cómo quieres que te llamemos/), 'Marina');
      await userEvent.click(screen.getByRole('checkbox', { name: /Emociones/ }));

      expect(screen.getByRole('status')).toHaveTextContent('Necesitas conexión para esto.');
      expect(screen.getByRole('button', { name: /Empezar/ })).toBeDisabled();
      // Lo elegido y lo escrito se queda como estaba.
      expect(screen.getByRole('checkbox', { name: /Emociones/ })).toHaveAttribute(
        'aria-checked',
        'true',
      );
      expect(screen.getByLabelText(/Cómo quieres que te llamemos/)).toHaveValue('Marina');
      expect(cambiarPreferencias).not.toHaveBeenCalled();

      red.mockReturnValue(true);
    });

    it('con conexion la bienvenida no dice que haga falta nada', async () => {
      pintar();

      await screen.findByRole('heading', { name: /Te damos la bienvenida/ });

      expect(screen.queryByText('Necesitas conexión para esto.')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Empezar/ })).toBeEnabled();
    });
  });

  describe('lo que se puede hacer', () => {
    it('cada modulo activo lleva a su sendero (SCRUM-92)', async () => {
      pintar();

      await screen.findByRole('heading', { name: 'Tu ruta de hoy' });

      expect(tarjeta(/Cognición/)).toHaveAttribute('href', '/modulo/cognicion');
      expect(tarjeta(/Bienestar/)).toHaveAttribute('href', '/modulo/bienestar');
      // La ruta del día sigue mostrando lo de todos los modulos.
      // Hay mas de una lista en la pantalla (el pie lleva la de los documentos
      // legales), asi que se mira que cada actividad este dentro de alguna.
      const listas = screen.getAllByRole('list');

      expect(listas.some((lista) => within(lista).queryByText('Parejas') !== null)).toBe(true);
      expect(
        listas.some((lista) => within(lista).queryByText('Cómo dormiste anoche') !== null),
      ).toBe(true);
    });

    it('lleva el pie con lo que no es y para quien es, y el camino a los documentos (L-03)', async () => {
      pintar();

      await screen.findByRole('heading', { name: 'Tu ruta de hoy' });

      const pie = screen.getByRole('contentinfo');

      expect(pie).toHaveTextContent(/no diagnostica, no formula medicamentos y no reemplaza/i);
      expect(pie).toHaveTextContent('Es solo para mayores de 18 años');
      expect(within(pie).getByRole('link', { name: 'Términos' })).toHaveAttribute(
        'href',
        '/terminos',
      );
      expect(within(pie).getByRole('link', { name: 'Privacidad' })).toHaveAttribute(
        'href',
        '/privacidad',
      );
    });

    it('añadir un modulo lo activa y lo pinta sin recargar', async () => {
      const conEmociones: ProgresoDelModulo = {
        modulo: 'emociones',
        sesiones: 0,
        etapa: { numero: 1, esTemporada: false, sesionesHechas: 0, sesionesDeLaEtapa: 5 },
        hoy: [],
      };

      cambiarPreferencias.mockResolvedValue({
        ...CUENTA,
        modulosActivos: ['cognicion', 'bienestar', 'emociones'],
      });
      // La primera llamada es la de la carga; la segunda, la de despues de
      // activar el modulo.
      consultarElProgreso
        .mockResolvedValueOnce(PROGRESO)
        .mockResolvedValueOnce([...PROGRESO, conEmociones]);

      pintar();

      await userEvent.click(await screen.findByRole('button', { name: /Añadir Emociones/ }));

      expect(cambiarPreferencias).toHaveBeenCalledWith({
        modulosActivos: ['cognicion', 'bienestar', 'emociones'],
      });
      expect(await screen.findByRole('link', { name: /Emociones/ })).toHaveTextContent(
        'Etapa 1 · 0 de 5 sesiones',
      );
      expect(screen.queryByRole('button', { name: /Añadir Emociones/ })).not.toBeInTheDocument();
    });

    it('al añadir el tercer modulo lo celebra, y el aviso se cierra con Escape', async () => {
      cambiarPreferencias.mockResolvedValue({
        ...CUENTA,
        modulosActivos: ['cognicion', 'bienestar', 'emociones'],
      });

      pintar();

      await userEvent.click(await screen.findByRole('button', { name: /Añadir Emociones/ }));

      const aviso = await screen.findByRole('dialog');

      expect(aviso).toHaveTextContent('Ya tienes los tres módulos');
      // El foco entra al aviso, para que con teclado se pueda cerrar enseguida.
      expect(within(aviso).getByRole('button', { name: /Seguir/ })).toHaveFocus();

      await userEvent.keyboard('{Escape}');

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('con el segundo modulo el texto es otro', async () => {
      darDeAltaLaCuenta.mockResolvedValue({ ...CUENTA, modulosActivos: ['cognicion'] });
      consultarElProgreso.mockResolvedValue([PROGRESO[0]]);
      cambiarPreferencias.mockResolvedValue({
        ...CUENTA,
        modulosActivos: ['cognicion', 'bienestar'],
      });

      pintar();

      await userEvent.click(await screen.findByRole('button', { name: /Añadir Bienestar/ }));

      expect(await screen.findByRole('dialog')).toHaveTextContent('tu segundo módulo');

      await userEvent.click(screen.getByRole('button', { name: /Seguir/ }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('sin conexion no se puede añadir un modulo, y lo dice en la propia tarjeta (SCRUM-142)', async () => {
      const red = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

      pintar();

      const boton = await screen.findByRole('button', { name: /Añadir Emociones/ });

      expect(boton).toBeDisabled();
      expect(screen.getByRole('status')).toHaveTextContent('Necesitas conexión para esto.');

      await userEvent.click(boton);

      expect(cambiarPreferencias).not.toHaveBeenCalled();

      red.mockReturnValue(true);
    });

    it('con conexion añadir un modulo no dice que haga falta nada', async () => {
      pintar();

      expect(await screen.findByRole('button', { name: /Añadir Emociones/ })).toBeEnabled();
      expect(screen.queryByText('Necesitas conexión para esto.')).not.toBeInTheDocument();
    });

    it('si añadir falla, lo dice en la propia tarjeta', async () => {
      cambiarPreferencias.mockRejectedValue(new TypeError('Failed to fetch'));

      pintar();

      await userEvent.click(await screen.findByRole('button', { name: /Añadir Emociones/ }));

      expect(await screen.findByText(/No se pudo añadir/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Añadir Emociones/ })).toBeEnabled();
    });

    it('el menu de la cuenta muestra el correo, deja salir y se cierra con Escape', async () => {
      const salir = vi.fn();

      pintar({ salir });

      await userEvent.click(await screen.findByRole('button', { name: /menú de tu cuenta/ }));

      expect(screen.getByText(CUENTA.correo)).toBeInTheDocument();

      await userEvent.keyboard('{Escape}');

      expect(screen.queryByText(CUENTA.correo)).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /menú de tu cuenta/ }));
      await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

      expect(salir).toHaveBeenCalled();
    });
  });
});

describe('Dashboard sin conexion (SCRUM-140)', () => {
  beforeEach(async () => {
    await abrirUnAlmacenDePrueba();
  });

  afterEach(() => {
    cerrarElAlmacenDePrueba();
    darDeAltaLaCuenta.mockReset();
  });

  it('se abre con la copia de este equipo, y dice de cuando es', async () => {
    const primera = pintar();

    await screen.findByRole('heading', { name: /Hola, Marina/ });
    primera.unmount();
    darDeAltaLaCuenta.mockRejectedValue(new TypeError('Failed to fetch'));

    pintar();

    expect(await screen.findByRole('heading', { name: /Hola, Marina/ })).toBeInTheDocument();
    expect(screen.getByText(/Datos de hace un momento/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('en cuanto vuelve la conexion se pone al dia y deja de decirlo', async () => {
    const primera = pintar();

    await screen.findByRole('heading', { name: /Hola, Marina/ });
    primera.unmount();
    darDeAltaLaCuenta.mockRejectedValue(new TypeError('Failed to fetch'));
    pintar();
    await screen.findByText(/Datos de hace/);

    darDeAltaLaCuenta.mockResolvedValue({ ...CUENTA, nombre: 'Marina Isabel' });
    fireEvent(window, new Event('online'));

    expect(await screen.findByRole('heading', { name: /Hola, Marina Isabel/ })).toBeInTheDocument();
    expect(screen.queryByText(/Datos de hace/)).toBeNull();
  });

  it('con conexion no hay nada que decir de la copia', async () => {
    pintar();

    await screen.findByRole('heading', { name: /Hola, Marina/ });

    expect(screen.queryByText(/Datos de hace/)).toBeNull();
  });

  it('lo que se hizo sin conexion se dice, para que se sepa que se contara al enviarse', async () => {
    const primera = pintar();

    await screen.findByRole('heading', { name: /Hola, Marina/ });
    primera.unmount();
    darDeAltaLaCuenta.mockRejectedValue(new TypeError('Failed to fetch'));
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
      await screen.findByText(/Lo que hiciste sin conexión se contará cuando se envíe/),
    ).toBeInTheDocument();
  });

  it('sin nada hecho sin conexion, no dice eso', async () => {
    const primera = pintar();

    await screen.findByRole('heading', { name: /Hola, Marina/ });
    primera.unmount();
    darDeAltaLaCuenta.mockRejectedValue(new TypeError('Failed to fetch'));

    pintar();

    await screen.findByText(/Datos de hace/);

    expect(screen.queryByText(/se contará cuando se envíe/)).toBeNull();
  });
});
