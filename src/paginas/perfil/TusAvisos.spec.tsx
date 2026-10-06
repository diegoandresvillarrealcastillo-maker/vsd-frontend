import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EstadoDeLasNotificaciones } from '../../infraestructura/api/notificaciones.ts';
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

const usuario = userEvent.setup({ delay: null });

function seccion() {
  return screen.getByRole('region', { name: 'Avisos' });
}

beforeEach(() => {
  api.consultarLasNotificaciones.mockResolvedValue(DISPONIBLE);
  api.cambiarHorasDeAviso.mockImplementation((cambios: Record<string, string | null>) =>
    Promise.resolve({ ...DISPONIBLE, ...cambios }),
  );
  // Como el servidor: lo que no viene en el cambio se queda.
  api.cambiarRecordatoriosDelDia.mockImplementation(
    (cambios: { manana?: boolean; noche?: boolean }) =>
      Promise.resolve({
        ...DISPONIBLE,
        recordatorioManana: cambios.manana ?? DISPONIBLE.recordatorioManana,
        recordatorioNoche: cambios.noche ?? DISPONIBLE.recordatorioNoche,
      }),
  );
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
  it('explica que nunca dicen nada de salud, y empiezan apagados', async () => {
    render(<TusAvisos />);

    const semaforo = await screen.findByRole('switch', { name: 'Pendientes del semáforo' });

    expect(seccion()).toHaveTextContent('Nunca dicen nada de tu salud');
    expect(semaforo).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('switch', { name: 'Un momento para ti' })).toHaveAttribute(
      'aria-checked',
      'false',
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
      expect(screen.getByRole('switch', { name: 'Pendientes del semáforo' })).toBeInTheDocument();
    });

    it('si ya los bloqueo, dice donde desbloquearlos', async () => {
      navegador.permisoDeAvisos.mockReturnValue('denied');

      render(<TusAvisos />);

      expect(await screen.findByText(/configuración del sitio/)).toBeInTheDocument();
    });
  });

  describe('los recordatorios del dia, a las 8:00 y a las 20:00 (SCRUM-127)', () => {
    const MANANA = 'Buenos días';
    const NOCHE = 'Cierre del día';

    it('empiezan apagados, en su propio grupo, y dicen a que hora llegan y en que zona', async () => {
      render(<TusAvisos />);

      const grupo = await screen.findByRole('group', { name: 'Recordatorios del día' });

      expect(within(grupo).getByRole('switch', { name: MANANA })).toHaveAttribute(
        'aria-checked',
        'false',
      );
      expect(within(grupo).getByRole('switch', { name: NOCHE })).toHaveAttribute(
        'aria-checked',
        'false',
      );
      // La hora no se elige: no hay campo de hora en este grupo.
      expect(grupo.querySelector('input[type="time"]')).toBeNull();
      // Se lee en la zona de la cuenta, en palabras (las pruebas fijan Bogota).
      expect(grupo).toHaveTextContent('8:00 a. m. y a las 8:00 p. m.');
      expect(grupo).toHaveTextContent('hora estándar de Colombia');
    });

    it('cada interruptor explica lo que hace, para el lector de pantalla', async () => {
      render(<TusAvisos />);

      const manana = await screen.findByRole('switch', { name: MANANA });
      const noche = screen.getByRole('switch', { name: NOCHE });

      expect(manana).toHaveAccessibleDescription(/A las 8:00 a\. m\., una invitación/);
      expect(noche).toHaveAccessibleDescription(/solo si hoy aún no hiciste ninguna actividad/);
      expect(noche).toHaveAccessibleDescription(/llega solo la que toque primero/);
    });

    it('encender el de la manana no toca el de la noche', async () => {
      render(<TusAvisos />);

      await usuario.click(await screen.findByRole('switch', { name: MANANA }));

      expect(api.cambiarRecordatoriosDelDia).toHaveBeenCalledWith({ manana: true });
      expect(screen.getByRole('switch', { name: MANANA })).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByRole('switch', { name: NOCHE })).toHaveAttribute('aria-checked', 'false');
    });

    it('encender el de la noche, y apagarlo, no toca el de la manana', async () => {
      api.consultarLasNotificaciones.mockResolvedValue({
        ...DISPONIBLE,
        recordatorioManana: true,
        recordatorioNoche: false,
      });
      api.cambiarRecordatoriosDelDia.mockImplementation(
        (cambios: { manana?: boolean; noche?: boolean }) =>
          Promise.resolve({
            ...DISPONIBLE,
            recordatorioManana: true,
            recordatorioNoche: cambios.noche ?? false,
          }),
      );

      render(<TusAvisos />);

      await usuario.click(await screen.findByRole('switch', { name: NOCHE }));
      expect(api.cambiarRecordatoriosDelDia).toHaveBeenLastCalledWith({ noche: true });
      expect(screen.getByRole('switch', { name: NOCHE })).toHaveAttribute('aria-checked', 'true');

      await usuario.click(screen.getByRole('switch', { name: NOCHE }));
      expect(api.cambiarRecordatoriosDelDia).toHaveBeenLastCalledWith({ noche: false });
      expect(screen.getByRole('switch', { name: NOCHE })).toHaveAttribute('aria-checked', 'false');
      expect(screen.getByRole('switch', { name: MANANA })).toHaveAttribute('aria-checked', 'true');
    });

    it('no toca las horas del semaforo ni de "un momento para ti"', async () => {
      render(<TusAvisos />);

      await usuario.click(await screen.findByRole('switch', { name: MANANA }));

      expect(api.cambiarHorasDeAviso).not.toHaveBeenCalled();
    });

    it('se maneja solo con el teclado: foco, Enter y espacio', async () => {
      render(<TusAvisos />);

      const manana = await screen.findByRole('switch', { name: MANANA });

      manana.focus();
      expect(manana).toHaveFocus();

      await usuario.keyboard('{Enter}');
      expect(manana).toHaveAttribute('aria-checked', 'true');

      await usuario.keyboard(' ');
      expect(manana).toHaveAttribute('aria-checked', 'false');
      expect(api.cambiarRecordatoriosDelDia).toHaveBeenCalledTimes(2);
    });

    it('un toque mientras se guarda el anterior no manda otro cambio', async () => {
      let terminar: (estado: EstadoDeLasNotificaciones) => void = () => undefined;

      api.cambiarRecordatoriosDelDia.mockReturnValue(
        new Promise<EstadoDeLasNotificaciones>((resolver) => {
          terminar = resolver;
        }),
      );

      render(<TusAvisos />);

      const manana = await screen.findByRole('switch', { name: MANANA });

      await usuario.click(manana);
      await usuario.click(manana);

      expect(api.cambiarRecordatoriosDelDia).toHaveBeenCalledTimes(1);

      await act(() => {
        terminar({ ...DISPONIBLE, recordatorioManana: true });

        return Promise.resolve();
      });
    });

    it('si no se pudo guardar, lo dice y el interruptor queda como estaba', async () => {
      api.cambiarRecordatoriosDelDia.mockRejectedValue(new TypeError('Failed to fetch'));

      render(<TusAvisos />);

      await usuario.click(await screen.findByRole('switch', { name: NOCHE }));

      expect(within(seccion()).getByRole('alert')).toHaveTextContent('No se pudo guardar');
      expect(screen.getByRole('switch', { name: NOCHE })).toHaveAttribute('aria-checked', 'false');
    });

    describe('si este dispositivo no recibe avisos', () => {
      it('con alguno encendido, avisa que aqui no llegaran', async () => {
        api.consultarLasNotificaciones.mockResolvedValue({
          ...DISPONIBLE,
          recordatorioManana: true,
        });

        render(<TusAvisos />);

        expect(await screen.findByText(/aquí no llegarán/)).toBeInTheDocument();
      });

      it('con los dos apagados, no hay nada que advertir', async () => {
        render(<TusAvisos />);

        await screen.findByRole('switch', { name: MANANA });

        expect(screen.queryByText(/aquí no llegarán/)).not.toBeInTheDocument();
      });

      it('si este dispositivo ya los recibe, tampoco', async () => {
        navegador.suscripcionActual.mockResolvedValue({ endpoint: SUSCRIPCION.endpoint });
        api.consultarLasNotificaciones.mockResolvedValue({
          ...DISPONIBLE,
          recordatorioNoche: true,
        });

        render(<TusAvisos />);

        await screen.findByRole('button', { name: 'Dejar de recibirlos aquí' });

        expect(screen.queryByText(/aquí no llegarán/)).not.toBeInTheDocument();
      });

      it('el navegador bloqueado se explica arriba y los interruptores siguen siendo de la cuenta', async () => {
        navegador.permisoDeAvisos.mockReturnValue('denied');
        api.consultarLasNotificaciones.mockResolvedValue({
          ...DISPONIBLE,
          recordatorioManana: true,
        });

        render(<TusAvisos />);

        expect(await screen.findByText(/configuración del sitio/)).toBeInTheDocument();
        expect(screen.getByRole('switch', { name: MANANA })).toHaveAttribute(
          'aria-checked',
          'true',
        );
        expect(screen.getByText(/aquí no llegarán/)).toBeInTheDocument();
      });

      it('en iPhone sin instalar, se explica como instalarla y se pueden elegir igual', async () => {
        navegador.capacidadDelNavegador.mockReturnValue('iphone-sin-instalar');

        render(<TusAvisos />);

        expect(await screen.findByText(/Agregar a inicio/)).toBeInTheDocument();
        expect(screen.getByRole('switch', { name: NOCHE })).toBeInTheDocument();
      });

      it('en un navegador sin soporte, tambien se explica', async () => {
        navegador.capacidadDelNavegador.mockReturnValue('sin-soporte');

        render(<TusAvisos />);

        expect(await screen.findByText(/no puede recibir avisos/)).toBeInTheDocument();
      });
    });

    it('una API anterior, que no manda estos campos, no los ofrece pero deja lo demas', async () => {
      api.consultarLasNotificaciones.mockResolvedValue({
        disponible: true,
        clavePublica: 'clave-publica-de-prueba',
        horaSemaforo: null,
        horaRacha: null,
      });

      render(<TusAvisos />);

      expect(await screen.findByRole('switch', { name: 'Pendientes del semáforo' })).toBeVisible();
      expect(
        screen.queryByRole('group', { name: 'Recordatorios del día' }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('switch', { name: MANANA })).not.toBeInTheDocument();
    });

    it('sin avisos en el servidor, no se ofrece ninguno', async () => {
      api.consultarLasNotificaciones.mockResolvedValue({ ...DISPONIBLE, disponible: false });

      render(<TusAvisos />);

      await screen.findByText(/todavía no están disponibles/);

      expect(screen.queryByRole('switch', { name: MANANA })).not.toBeInTheDocument();
    });
  });

  describe('las horas', () => {
    it('encender un aviso lo guarda con su hora por defecto, sin tocar el otro', async () => {
      render(<TusAvisos />);

      await usuario.click(await screen.findByRole('switch', { name: 'Pendientes del semáforo' }));

      expect(api.cambiarHorasDeAviso).toHaveBeenCalledWith({ horaSemaforo: '08:00' });
      expect(screen.getByRole('switch', { name: 'Pendientes del semáforo' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
      expect(screen.getByRole('switch', { name: 'Un momento para ti' })).toHaveAttribute(
        'aria-checked',
        'false',
      );
    });

    it('apagar uno no apaga el otro', async () => {
      const ambos = { ...DISPONIBLE, horaSemaforo: '08:00', horaRacha: '19:00' };

      api.consultarLasNotificaciones.mockResolvedValue(ambos);
      // Como el servidor: lo que no viene en el cambio se queda.
      api.cambiarHorasDeAviso.mockImplementation((cambios: Record<string, string | null>) =>
        Promise.resolve({ ...ambos, ...cambios }),
      );

      render(<TusAvisos />);

      await usuario.click(await screen.findByRole('switch', { name: 'Un momento para ti' }));

      expect(api.cambiarHorasDeAviso).toHaveBeenCalledWith({ horaRacha: null });
      expect(screen.getByRole('switch', { name: 'Pendientes del semáforo' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
    });

    it('cambiar la hora la guarda cuando se deja de tocar', async () => {
      api.consultarLasNotificaciones.mockResolvedValue({ ...DISPONIBLE, horaRacha: '19:00' });

      render(<TusAvisos />);

      const hora = await screen.findByLabelText('Hora del aviso: Un momento para ti');

      vi.useFakeTimers();
      fireEvent.change(hora, { target: { value: '21:30' } });

      expect(api.cambiarHorasDeAviso).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(800);
      });

      expect(api.cambiarHorasDeAviso).toHaveBeenCalledWith({ horaRacha: '21:30' });
    });

    it('dice en que zona se lee la hora: la de la cuenta, no siempre la de Colombia (SCRUM-123)', async () => {
      api.consultarLasNotificaciones.mockResolvedValue({ ...DISPONIBLE, horaRacha: '19:00' });
      fijarLaZonaDeLaCuenta('Asia/Tokyo');

      render(<TusAvisos />);

      const hora = await screen.findByLabelText('Hora del aviso: Un momento para ti');

      expect(hora.closest('.perfil__fila')).toHaveTextContent('hora estándar de Japón');
      expect(hora.closest('.perfil__fila')).not.toHaveTextContent('Colombia');
    });

    it('si no se pudo guardar, lo dice', async () => {
      api.cambiarHorasDeAviso.mockRejectedValue(new TypeError('Failed to fetch'));

      render(<TusAvisos />);

      await usuario.click(await screen.findByRole('switch', { name: 'Pendientes del semáforo' }));

      expect(within(seccion()).getByRole('alert')).toHaveTextContent('No se pudo guardar');
      expect(screen.getByRole('switch', { name: 'Pendientes del semáforo' })).toHaveAttribute(
        'aria-checked',
        'false',
      );
    });
  });
});
