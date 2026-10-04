import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EstadoDeLasNotificaciones } from '../../infraestructura/api/notificaciones.ts';
import { TusAvisos } from './TusAvisos.tsx';

/**
 * Los avisos del perfil (SCRUM-102), con la API y el navegador simulados:
 * jsdom no tiene Web Push.
 */
const api = vi.hoisted(() => ({
  consultarLasNotificaciones: vi.fn(),
  cambiarHorasDeAviso: vi.fn(),
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
