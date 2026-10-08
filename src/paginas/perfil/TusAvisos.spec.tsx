import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  CambiosDeHoras,
  CambiosDeRecordatorios,
  EstadoDeLasNotificaciones,
} from '../../infraestructura/api/notificaciones.ts';
import { fijarLaZonaDeLaCuenta } from '../../tiempo/zonaHoraria.ts';
import { TusAvisos } from './TusAvisos.tsx';

/**
 * Los avisos del perfil (SCRUM-102), con la API y el navegador simulados:
 * jsdom no tiene Web Push.
 */
const api = vi.hoisted(() => ({
  consultarLasNotificaciones: vi.fn(),
  cambiarHorasDeAviso: vi.fn(),
  cambiarRecordatoriosDelDia: vi.fn(),
  suscribirEsteNavegador: vi.fn(),
  soltarEsteNavegadorDelServidor: vi.fn(),
}));

const navegador = vi.hoisted(() => {
  class PermisoNegadoError extends Error {
    readonly permiso: NotificationPermission;

    constructor(permiso: NotificationPermission) {
      super('sin permiso');
      this.permiso = permiso;
    }
  }

  return {
    PermisoNegadoError,
    capacidadDelNavegador: vi.fn(),
    permisoDeAvisos: vi.fn(),
    suscripcionActual: vi.fn(),
    suscribirNavegador: vi.fn(),
    soltarNavegador: vi.fn(),
  };
});

vi.mock('../../infraestructura/api/notificaciones.ts', () => api);
vi.mock('../../notificaciones/navegador.ts', () => navegador);

/**
 * Se prueba con "reducir movimiento" pedido en el sistema.
 *
 * Las opciones de cada tarjeta se despliegan y se pliegan con una animacion, y
 * jsdom no pinta nada: la salida de un resorte no termina a tiempo para una
 * prueba. Con ese ajuste el despliegue aparece y desaparece de golpe, que es lo
 * que hay que comprobar aqui (que sale del arbol y deja de recibir el foco). El
 * movimiento en si se ve en el navegador.
 */
window.matchMedia = (consulta: string) => ({
  matches: consulta.includes('prefers-reduced-motion'),
  media: consulta,
  onchange: null,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  addListener: () => undefined,
  removeListener: () => undefined,
  dispatchEvent: () => false,
});

const DISPONIBLE: EstadoDeLasNotificaciones = {
  disponible: true,
  clavePublica: 'clave-publica-de-prueba',
  horaSemaforo: null,
  horaRacha: null,
  recordatorioManana: false,
  recordatorioNoche: false,
};

const SUSCRIPCION = {
  endpoint: 'https://push.example.com/este-navegador',
  keys: { p256dh: 'clave-p256dh', auth: 'clave-auth' },
};

const ACTIVIDADES = 'Actividades y bienestar';
const SEMAFORO = 'Pendientes del semáforo';
const HORA_PERSONALIZADA = 'Hora del aviso personalizado';
const HORA_DEL_SEMAFORO = 'Hora del aviso: Pendientes del semáforo';

const usuario = userEvent.setup({ delay: null });

/** Lo que una prueba cambia del estado de partida; sin `undefined` explicito. */
type Partida = {
  [K in keyof EstadoDeLasNotificaciones]?: Exclude<EstadoDeLasNotificaciones[K], undefined>;
};

/**
 * Un servidor de mentira que guarda lo que se le manda. Como el real: lo que no
 * viene en el cambio se queda, y cada respuesta trae el estado completo.
 */
function servidorCon(inicial: Partida): void {
  let actual: EstadoDeLasNotificaciones = { ...DISPONIBLE, ...inicial };

  api.consultarLasNotificaciones.mockImplementation(() => Promise.resolve(actual));
  api.cambiarHorasDeAviso.mockImplementation((cambios: CambiosDeHoras) => {
    actual = { ...actual, ...cambios };

    return Promise.resolve(actual);
  });
  api.cambiarRecordatoriosDelDia.mockImplementation((cambios: CambiosDeRecordatorios) => {
    actual = {
      ...actual,
      recordatorioManana: cambios.manana ?? actual.recordatorioManana ?? false,
      recordatorioNoche: cambios.noche ?? actual.recordatorioNoche ?? false,
    };

    return Promise.resolve(actual);
  });
}

function seccion() {
  return screen.getByRole('region', { name: 'Avisos' });
}

function interruptor(nombre: string) {
  return screen.getByRole('switch', { name: nombre });
}

function chip(nombre: RegExp) {
  return screen.getByRole('checkbox', { name: nombre });
}

beforeEach(() => {
  servidorCon({});
  api.suscribirEsteNavegador.mockResolvedValue(undefined);
  api.soltarEsteNavegadorDelServidor.mockResolvedValue(undefined);
  navegador.capacidadDelNavegador.mockReturnValue('lista');
  navegador.permisoDeAvisos.mockReturnValue('default');
  navegador.suscripcionActual.mockResolvedValue(null);
  navegador.suscribirNavegador.mockResolvedValue(SUSCRIPCION);
  navegador.soltarNavegador.mockResolvedValue(SUSCRIPCION.endpoint);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('Tus avisos', () => {
  it('explica que nunca dicen nada de salud, y las dos tarjetas empiezan apagadas y sin opciones', async () => {
    render(<TusAvisos />);

    const actividades = await screen.findByRole('switch', { name: ACTIVIDADES });

    expect(seccion()).toHaveTextContent('Nunca dicen nada de tu salud');
    expect(actividades).toHaveAttribute('aria-checked', 'false');
    expect(interruptor(SEMAFORO)).toHaveAttribute('aria-checked', 'false');
    // Apagadas, no ocupan sitio: no hay chips ni campo de hora.
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Hora del aviso/)).not.toBeInTheDocument();
  });

  it('son solo dos tarjetas, cada una con su interruptor', async () => {
    render(<TusAvisos />);

    await screen.findByRole('switch', { name: ACTIVIDADES });

    expect(within(seccion()).getAllByRole('switch')).toHaveLength(2);
  });

  it('cada tarjeta explica lo que hace, para el lector de pantalla', async () => {
    render(<TusAvisos />);

    const actividades = await screen.findByRole('switch', { name: ACTIVIDADES });

    expect(actividades).toHaveAccessibleDescription(/La de la mañana llega siempre/);
    expect(actividades).toHaveAccessibleDescription(
      /solo si ese día aún no hiciste ninguna actividad/,
    );
    expect(interruptor(SEMAFORO)).toHaveAccessibleDescription(
      'Te avisamos cuántos pendientes tienes para que te organices.',
    );
  });

  it('si el servidor no tiene avisos, lo dice y no ofrece nada', async () => {
    api.consultarLasNotificaciones.mockResolvedValue({ ...DISPONIBLE, disponible: false });

    render(<TusAvisos />);

    expect(await screen.findByText(/todavía no están disponibles/)).toBeInTheDocument();
    expect(within(seccion()).queryByRole('switch')).not.toBeInTheDocument();
    expect(within(seccion()).queryByRole('button')).not.toBeInTheDocument();
  });

  describe('este dispositivo', () => {
    it('pide permiso, suscribe el navegador y lo manda al servidor', async () => {
      render(<TusAvisos />);

      await usuario.click(
        await screen.findByRole('button', { name: 'Recibir avisos en este dispositivo' }),
      );

      expect(navegador.suscribirNavegador).toHaveBeenCalledWith('clave-publica-de-prueba');
      expect(api.suscribirEsteNavegador).toHaveBeenCalledWith(SUSCRIPCION);
      expect(within(seccion()).getByRole('status')).toHaveTextContent('este dispositivo recibirá');
      expect(screen.getByRole('button', { name: 'Dejar de recibirlos aquí' })).toBeInTheDocument();
    });

    it('sin permiso, lo dice y la aplicacion sigue igual', async () => {
      navegador.suscribirNavegador.mockRejectedValue(new navegador.PermisoNegadoError('denied'));

      render(<TusAvisos />);

      await usuario.click(
        await screen.findByRole('button', { name: 'Recibir avisos en este dispositivo' }),
      );

      expect(api.suscribirEsteNavegador).not.toHaveBeenCalled();
      expect(within(seccion()).getByRole('alert')).toHaveTextContent('Bloqueaste los avisos');
    });

    it('dejar de recibirlos suelta el navegador aqui y en el servidor', async () => {
      navegador.suscripcionActual.mockResolvedValue({ endpoint: SUSCRIPCION.endpoint });

      render(<TusAvisos />);

      await usuario.click(await screen.findByRole('button', { name: 'Dejar de recibirlos aquí' }));

      expect(api.soltarEsteNavegadorDelServidor).toHaveBeenCalledWith(SUSCRIPCION.endpoint);
      expect(navegador.soltarNavegador).toHaveBeenCalled();
      expect(
        screen.getByRole('button', { name: 'Recibir avisos en este dispositivo' }),
      ).toBeInTheDocument();
    });

    it('en iPhone sin instalar explica como instalarla', async () => {
      navegador.capacidadDelNavegador.mockReturnValue('iphone-sin-instalar');

      render(<TusAvisos />);

      expect(await screen.findByText(/Agregar a inicio/)).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Recibir avisos en este dispositivo' }),
      ).not.toBeInTheDocument();
      // Las horas son de la cuenta: se eligen igual, para el resto de sus dispositivos.
      expect(interruptor(SEMAFORO)).toBeInTheDocument();
    });

    it('si ya los bloqueo, dice donde desbloquearlos', async () => {
      navegador.permisoDeAvisos.mockReturnValue('denied');

      render(<TusAvisos />);

      expect(await screen.findByText(/configuración del sitio/)).toBeInTheDocument();
    });

    it('en un navegador sin soporte, tambien se explica', async () => {
      navegador.capacidadDelNavegador.mockReturnValue('sin-soporte');

      render(<TusAvisos />);

      expect(await screen.findByText(/no puede recibir avisos/)).toBeInTheDocument();
    });
  });

  describe('si este dispositivo no recibe avisos', () => {
    it('con alguno encendido, avisa que aqui no llegaran', async () => {
      servidorCon({ recordatorioManana: true });

      render(<TusAvisos />);

      expect(await screen.findByText(/aquí no llegarán/)).toBeInTheDocument();
    });

    it('lo mismo con el semaforo o con la hora propia', async () => {
      servidorCon({ horaSemaforo: '08:00' });

      render(<TusAvisos />);

      expect(await screen.findByText(/aquí no llegarán/)).toBeInTheDocument();
    });

    it('con todos apagados, no hay nada que advertir', async () => {
      render(<TusAvisos />);

      await screen.findByRole('switch', { name: ACTIVIDADES });

      expect(screen.queryByText(/aquí no llegarán/)).not.toBeInTheDocument();
    });

    it('si este dispositivo ya los recibe, tampoco', async () => {
      navegador.suscripcionActual.mockResolvedValue({ endpoint: SUSCRIPCION.endpoint });
      servidorCon({ recordatorioNoche: true });

      render(<TusAvisos />);

      await screen.findByRole('button', { name: 'Dejar de recibirlos aquí' });

      expect(screen.queryByText(/aquí no llegarán/)).not.toBeInTheDocument();
    });

    it('el navegador bloqueado se explica arriba y las tarjetas siguen siendo de la cuenta', async () => {
      navegador.permisoDeAvisos.mockReturnValue('denied');
      servidorCon({ recordatorioManana: true });

      render(<TusAvisos />);

      expect(await screen.findByText(/configuración del sitio/)).toBeInTheDocument();
      expect(interruptor(ACTIVIDADES)).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByText(/aquí no llegarán/)).toBeInTheDocument();
    });

    it('en iPhone sin instalar, se explica como instalarla y se pueden elegir igual', async () => {
      navegador.capacidadDelNavegador.mockReturnValue('iphone-sin-instalar');
      servidorCon({ recordatorioNoche: true });

      render(<TusAvisos />);

      expect(await screen.findByText(/Agregar a inicio/)).toBeInTheDocument();
      expect(chip(/Noche/)).toBeChecked();
    });
  });

  describe('actividades y bienestar', () => {
    it('encenderla sin nada elegido antes deja la mañana y la noche, en una sola llamada', async () => {
      render(<TusAvisos />);

      await usuario.click(await screen.findByRole('switch', { name: ACTIVIDADES }));

      expect(api.cambiarRecordatoriosDelDia).toHaveBeenCalledTimes(1);
      expect(api.cambiarRecordatoriosDelDia).toHaveBeenCalledWith({ manana: true, noche: true });
      expect(api.cambiarHorasDeAviso).not.toHaveBeenCalled();
      expect(interruptor(ACTIVIDADES)).toHaveAttribute('aria-checked', 'true');
      expect(await screen.findByRole('checkbox', { name: /Mañana/ })).toBeChecked();
      expect(chip(/Noche/)).toBeChecked();
      expect(chip(/Personalizado/)).not.toBeChecked();
    });

    it('los chips dicen a que hora llegan la mañana y la noche', async () => {
      servidorCon({ recordatorioManana: true });

      render(<TusAvisos />);

      expect(await screen.findByRole('checkbox', { name: /Mañana.*8:00 a\. m\./ })).toBeChecked();
      expect(chip(/Noche.*8:00 p\. m\./)).not.toBeChecked();
    });

    it('dice en que zona se leen las horas, y que si se viaja se ajustan solas', async () => {
      servidorCon({ recordatorioManana: true });

      render(<TusAvisos />);

      const nota = await screen.findByText(/Las horas son de tu zona horaria/);

      // Las pruebas fijan Bogota.
      expect(nota).toHaveTextContent('hora estándar de Colombia');
      expect(nota).toHaveTextContent('Si viajas, se ajustan solas.');
    });

    it('esa aclaración va una sola vez, aunque estén los tres chips', async () => {
      servidorCon({ recordatorioManana: true, recordatorioNoche: true, horaRacha: '19:00' });

      render(<TusAvisos />);

      await screen.findByRole('checkbox', { name: /Personalizado/ });

      expect(screen.getAllByText(/hora estándar de Colombia/)).toHaveLength(1);
    });

    it('cada chip guarda solo lo suyo y no toca a los demás', async () => {
      servidorCon({ recordatorioManana: true });

      render(<TusAvisos />);

      await usuario.click(await screen.findByRole('checkbox', { name: /Noche/ }));

      expect(api.cambiarRecordatoriosDelDia).toHaveBeenLastCalledWith({ noche: true });
      expect(chip(/Noche/)).toBeChecked();
      expect(chip(/Mañana/)).toBeChecked();

      await usuario.click(chip(/Mañana/));

      expect(api.cambiarRecordatoriosDelDia).toHaveBeenLastCalledWith({ manana: false });
      expect(chip(/Mañana/)).not.toBeChecked();
      expect(chip(/Noche/)).toBeChecked();
      expect(api.cambiarHorasDeAviso).not.toHaveBeenCalled();
    });

    it('«Personalizado» enciende la hora propia, con 19:00 al empezar, y muestra el selector de hora', async () => {
      servidorCon({ recordatorioManana: true });

      render(<TusAvisos />);

      await usuario.click(await screen.findByRole('checkbox', { name: /Personalizado/ }));

      expect(api.cambiarHorasDeAviso).toHaveBeenCalledWith({ horaRacha: '19:00' });
      expect(api.cambiarRecordatoriosDelDia).not.toHaveBeenCalled();
      expect(await screen.findByLabelText(HORA_PERSONALIZADA)).toHaveValue('19:00');
    });

    it('sin «Personalizado» no hay selector de hora', async () => {
      servidorCon({ recordatorioManana: true });

      render(<TusAvisos />);

      await screen.findByRole('checkbox', { name: /Mañana/ });

      expect(screen.queryByLabelText(HORA_PERSONALIZADA)).not.toBeInTheDocument();
    });

    it('cambiar la hora propia la guarda cuando se deja de tocar', async () => {
      servidorCon({ horaRacha: '19:00' });

      render(<TusAvisos />);

      const hora = await screen.findByLabelText(HORA_PERSONALIZADA);

      vi.useFakeTimers();
      fireEvent.change(hora, { target: { value: '21:30' } });

      expect(api.cambiarHorasDeAviso).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(800);
      });

      expect(api.cambiarHorasDeAviso).toHaveBeenCalledWith({ horaRacha: '21:30' });
    });

    it('dice en que zona se lee la hora: la de la cuenta, no siempre la de Colombia (SCRUM-123)', async () => {
      servidorCon({ horaRacha: '19:00' });
      fijarLaZonaDeLaCuenta('Asia/Tokyo');

      render(<TusAvisos />);

      const nota = await screen.findByText(/Las horas son de tu zona horaria/);

      expect(nota).toHaveTextContent('hora estándar de Japón');
      expect(nota).not.toHaveTextContent('Colombia');
    });

    it('una hora a medio guardar no vuelve a encender el chip que se apagó', async () => {
      servidorCon({ recordatorioManana: true, horaRacha: '19:00' });

      render(<TusAvisos />);

      const hora = await screen.findByLabelText(HORA_PERSONALIZADA);

      vi.useFakeTimers();
      fireEvent.change(hora, { target: { value: '21:30' } });

      await act(async () => {
        fireEvent.click(chip(/Personalizado/));
        await vi.advanceTimersByTimeAsync(2000);
      });

      expect(api.cambiarHorasDeAviso).toHaveBeenCalledTimes(1);
      expect(api.cambiarHorasDeAviso).toHaveBeenCalledWith({ horaRacha: null });
    });

    it('quitar el ultimo chip apaga la tarjeta, esconde sus opciones y devuelve el foco al interruptor', async () => {
      servidorCon({ recordatorioManana: true });

      render(<TusAvisos />);

      await usuario.click(await screen.findByRole('checkbox', { name: /Mañana/ }));

      expect(api.cambiarRecordatoriosDelDia).toHaveBeenCalledWith({ manana: false });
      await waitFor(() =>
        expect(interruptor(ACTIVIDADES)).toHaveAttribute('aria-checked', 'false'),
      );
      await waitFor(() => expect(screen.queryAllByRole('checkbox')).toHaveLength(0));
      expect(interruptor(ACTIVIDADES)).toHaveFocus();
    });

    it('apagarla apaga los tres avisos, uno detrás de otro, y esconde las opciones', async () => {
      servidorCon({ recordatorioManana: true, recordatorioNoche: true, horaRacha: '19:00' });

      render(<TusAvisos />);

      await usuario.click(await screen.findByRole('switch', { name: ACTIVIDADES }));

      expect(api.cambiarRecordatoriosDelDia).toHaveBeenCalledWith({ manana: false, noche: false });
      expect(api.cambiarHorasDeAviso).toHaveBeenCalledWith({ horaRacha: null });
      // Uno detras de otro: la respuesta de uno trae el estado completo, y en
      // paralelo la ultima en llegar podria desmentir a la otra.
      expect(api.cambiarRecordatoriosDelDia.mock.invocationCallOrder[0]).toBeLessThan(
        api.cambiarHorasDeAviso.mock.invocationCallOrder[0] ?? 0,
      );
      await waitFor(() => expect(screen.queryAllByRole('checkbox')).toHaveLength(0));
      expect(screen.queryByLabelText(HORA_PERSONALIZADA)).not.toBeInTheDocument();
      expect(interruptor(ACTIVIDADES)).toHaveAttribute('aria-checked', 'false');
    });

    it('al encenderla de nuevo vuelve lo que tenia, con su hora', async () => {
      servidorCon({ recordatorioNoche: true, horaRacha: '20:30' });

      render(<TusAvisos />);

      await usuario.click(await screen.findByRole('switch', { name: ACTIVIDADES }));
      await waitFor(() => expect(screen.queryAllByRole('checkbox')).toHaveLength(0));

      api.cambiarRecordatoriosDelDia.mockClear();
      api.cambiarHorasDeAviso.mockClear();

      await usuario.click(interruptor(ACTIVIDADES));

      expect(api.cambiarRecordatoriosDelDia).toHaveBeenCalledWith({ noche: true });
      expect(api.cambiarHorasDeAviso).toHaveBeenCalledWith({ horaRacha: '20:30' });
      expect(await screen.findByRole('checkbox', { name: /Noche/ })).toBeChecked();
      expect(chip(/Mañana/)).not.toBeChecked();
      expect(await screen.findByLabelText(HORA_PERSONALIZADA)).toHaveValue('20:30');
    });

    it('si el primer cambio falla al encenderla, no manda el segundo', async () => {
      servidorCon({ recordatorioNoche: true, horaRacha: '20:30' });

      render(<TusAvisos />);

      await usuario.click(await screen.findByRole('switch', { name: ACTIVIDADES }));
      await waitFor(() => expect(screen.queryAllByRole('checkbox')).toHaveLength(0));

      api.cambiarHorasDeAviso.mockClear();
      api.cambiarRecordatoriosDelDia.mockRejectedValue(new TypeError('Failed to fetch'));

      await usuario.click(interruptor(ACTIVIDADES));

      expect(api.cambiarHorasDeAviso).not.toHaveBeenCalled();
      expect(within(seccion()).getByRole('alert')).toHaveTextContent('No se pudo guardar');
      expect(interruptor(ACTIVIDADES)).toHaveAttribute('aria-checked', 'false');
    });

    it('si no se pudo guardar un chip, lo dice y el chip queda como estaba', async () => {
      servidorCon({ recordatorioManana: true });
      render(<TusAvisos />);

      const noche = await screen.findByRole('checkbox', { name: /Noche/ });

      api.cambiarRecordatoriosDelDia.mockRejectedValue(new TypeError('Failed to fetch'));
      await usuario.click(noche);

      expect(within(seccion()).getByRole('alert')).toHaveTextContent('No se pudo guardar');
      expect(chip(/Noche/)).not.toBeChecked();
    });

    it('si no se pudo guardar, la tarjeta apagada sigue apagada', async () => {
      api.cambiarRecordatoriosDelDia.mockRejectedValue(new TypeError('Failed to fetch'));

      render(<TusAvisos />);

      await usuario.click(await screen.findByRole('switch', { name: ACTIVIDADES }));

      expect(within(seccion()).getByRole('alert')).toHaveTextContent('No se pudo guardar');
      expect(interruptor(ACTIVIDADES)).toHaveAttribute('aria-checked', 'false');
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('con la noche y la hora propia a la vez, avisa que llega solo una', async () => {
      servidorCon({ recordatorioNoche: true, horaRacha: '19:00' });

      render(<TusAvisos />);

      expect(await screen.findByText(/llega solo la que toque primero/)).toBeInTheDocument();
    });

    it('con solo una de las dos, no lo dice', async () => {
      servidorCon({ recordatorioNoche: true });

      render(<TusAvisos />);

      await screen.findByRole('checkbox', { name: /Noche/ });

      expect(screen.queryByText(/llega solo la que toque primero/)).not.toBeInTheDocument();
    });

    it('un toque mientras se guarda el anterior no manda otro cambio', async () => {
      let terminar: (estado: EstadoDeLasNotificaciones) => void = () => undefined;

      api.cambiarRecordatoriosDelDia.mockReturnValue(
        new Promise<EstadoDeLasNotificaciones>((resolver) => {
          terminar = resolver;
        }),
      );

      render(<TusAvisos />);

      const tarjeta = await screen.findByRole('switch', { name: ACTIVIDADES });

      await usuario.click(tarjeta);
      await usuario.click(tarjeta);

      expect(api.cambiarRecordatoriosDelDia).toHaveBeenCalledTimes(1);

      await act(() => {
        terminar({ ...DISPONIBLE, recordatorioManana: true, recordatorioNoche: true });

        return Promise.resolve();
      });
    });

    it('se maneja solo con el teclado: foco, Enter y espacio, en el interruptor y en los chips', async () => {
      servidorCon({ recordatorioManana: true });

      render(<TusAvisos />);

      const noche = await screen.findByRole('checkbox', { name: /Noche/ });

      noche.focus();
      expect(noche).toHaveFocus();

      await usuario.keyboard(' ');
      expect(noche).toBeChecked();
      expect(api.cambiarRecordatoriosDelDia).toHaveBeenLastCalledWith({ noche: true });

      await usuario.keyboard(' ');
      expect(noche).not.toBeChecked();
      expect(api.cambiarRecordatoriosDelDia).toHaveBeenLastCalledWith({ noche: false });

      const semaforo = interruptor(SEMAFORO);

      semaforo.focus();
      await usuario.keyboard('{Enter}');
      expect(semaforo).toHaveAttribute('aria-checked', 'true');
    });

    it('no toca la hora del semaforo', async () => {
      render(<TusAvisos />);

      await usuario.click(await screen.findByRole('switch', { name: ACTIVIDADES }));

      for (const [cambios] of api.cambiarHorasDeAviso.mock.calls) {
        expect(cambios).not.toHaveProperty('horaSemaforo');
      }
    });

    describe('con una API anterior, que no manda los recordatorios fijos', () => {
      const SIN_RECORDATORIOS: EstadoDeLasNotificaciones = {
        disponible: true,
        clavePublica: 'clave-publica-de-prueba',
        horaSemaforo: null,
        horaRacha: null,
      };

      it('ofrece solo la hora propia y deja lo demás', async () => {
        api.consultarLasNotificaciones.mockResolvedValue(SIN_RECORDATORIOS);
        api.cambiarHorasDeAviso.mockImplementation((cambios: CambiosDeHoras) =>
          Promise.resolve({ ...SIN_RECORDATORIOS, ...cambios }),
        );

        render(<TusAvisos />);

        await usuario.click(await screen.findByRole('switch', { name: ACTIVIDADES }));

        expect(api.cambiarHorasDeAviso).toHaveBeenCalledWith({ horaRacha: '19:00' });
        expect(api.cambiarRecordatoriosDelDia).not.toHaveBeenCalled();
        expect(await screen.findByRole('checkbox', { name: /Personalizado/ })).toBeChecked();
        expect(screen.queryByRole('checkbox', { name: /Mañana/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('checkbox', { name: /Noche/ })).not.toBeInTheDocument();
        expect(interruptor(SEMAFORO)).toBeInTheDocument();
      });
    });
  });

  describe('pendientes del semaforo', () => {
    it('encenderla la guarda con su hora por defecto, y muestra el selector de hora', async () => {
      render(<TusAvisos />);

      await usuario.click(await screen.findByRole('switch', { name: SEMAFORO }));

      expect(api.cambiarHorasDeAviso).toHaveBeenCalledWith({ horaSemaforo: '08:00' });
      expect(interruptor(SEMAFORO)).toHaveAttribute('aria-checked', 'true');
      expect(await screen.findByLabelText(HORA_DEL_SEMAFORO)).toHaveValue('08:00');
      expect(interruptor(ACTIVIDADES)).toHaveAttribute('aria-checked', 'false');
    });

    it('apagarla esconde la hora y no apaga la otra tarjeta', async () => {
      servidorCon({ horaSemaforo: '08:00', horaRacha: '19:00' });

      render(<TusAvisos />);

      await usuario.click(await screen.findByRole('switch', { name: SEMAFORO }));

      expect(api.cambiarHorasDeAviso).toHaveBeenCalledWith({ horaSemaforo: null });
      await waitFor(() =>
        expect(screen.queryByLabelText(HORA_DEL_SEMAFORO)).not.toBeInTheDocument(),
      );
      expect(interruptor(ACTIVIDADES)).toHaveAttribute('aria-checked', 'true');
    });

    it('al encenderla de nuevo conserva la hora que se habia escrito', async () => {
      servidorCon({ horaSemaforo: '07:15' });

      render(<TusAvisos />);

      await usuario.click(await screen.findByRole('switch', { name: SEMAFORO }));
      await waitFor(() =>
        expect(screen.queryByLabelText(HORA_DEL_SEMAFORO)).not.toBeInTheDocument(),
      );

      await usuario.click(interruptor(SEMAFORO));

      expect(api.cambiarHorasDeAviso).toHaveBeenLastCalledWith({ horaSemaforo: '07:15' });
    });

    it('cambiar la hora la guarda cuando se deja de tocar', async () => {
      servidorCon({ horaSemaforo: '08:00' });

      render(<TusAvisos />);

      const hora = await screen.findByLabelText(HORA_DEL_SEMAFORO);

      vi.useFakeTimers();
      fireEvent.change(hora, { target: { value: '09:40' } });

      expect(api.cambiarHorasDeAviso).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(800);
      });

      expect(api.cambiarHorasDeAviso).toHaveBeenCalledWith({ horaSemaforo: '09:40' });
    });

    it('una hora a medio guardar no vuelve a encender el aviso que se apagó', async () => {
      servidorCon({ horaSemaforo: '08:00' });

      render(<TusAvisos />);

      const hora = await screen.findByLabelText(HORA_DEL_SEMAFORO);

      vi.useFakeTimers();
      fireEvent.change(hora, { target: { value: '09:40' } });

      await act(async () => {
        fireEvent.click(interruptor(SEMAFORO));
        await vi.advanceTimersByTimeAsync(2000);
      });

      expect(api.cambiarHorasDeAviso).toHaveBeenCalledTimes(1);
      expect(api.cambiarHorasDeAviso).toHaveBeenCalledWith({ horaSemaforo: null });
    });

    it('una hora incompleta no se guarda', async () => {
      servidorCon({ horaSemaforo: '08:00' });

      render(<TusAvisos />);

      const hora = await screen.findByLabelText(HORA_DEL_SEMAFORO);

      vi.useFakeTimers();
      fireEvent.change(hora, { target: { value: '' } });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      expect(api.cambiarHorasDeAviso).not.toHaveBeenCalled();
    });

    it('dice en que zona se lee la hora', async () => {
      servidorCon({ horaSemaforo: '08:00' });
      fijarLaZonaDeLaCuenta('Asia/Tokyo');

      render(<TusAvisos />);

      const hora = await screen.findByLabelText(HORA_DEL_SEMAFORO);

      expect(hora.closest('.perfil__fila')).toHaveTextContent('hora estándar de Japón');
    });

    it('si no se pudo guardar, lo dice y la tarjeta sigue apagada', async () => {
      api.cambiarHorasDeAviso.mockRejectedValue(new TypeError('Failed to fetch'));

      render(<TusAvisos />);

      await usuario.click(await screen.findByRole('switch', { name: SEMAFORO }));

      expect(within(seccion()).getByRole('alert')).toHaveTextContent('No se pudo guardar');
      expect(interruptor(SEMAFORO)).toHaveAttribute('aria-checked', 'false');
    });
  });
});
