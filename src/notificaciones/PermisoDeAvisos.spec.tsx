import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermisoNegadoError, type CapacidadDelNavegador } from './navegador.ts';
import { avisosYaPreguntados, olvidarQueYaSePregunto } from './memoriaDelPermiso.ts';
import { PermisoDeAvisos } from './PermisoDeAvisos.tsx';

/**
 * La ventana que ofrece los avisos (SCRUM-188).
 *
 * Lo que se vigila: que el permiso **solo se pide con un clic** (nunca al abrirse), que no
 * insiste, que no ofrece lo que no puede cumplir (navegador sin soporte, avisos no
 * disponibles, permiso ya negado) y que en iPhone explica como instalar la aplicacion en vez de
 * pedir un permiso que alli no existe.
 */
const { capacidadDelNavegador, permisoDeAvisos, suscribirNavegador } = vi.hoisted(() => ({
  capacidadDelNavegador: vi.fn(),
  permisoDeAvisos: vi.fn(),
  suscribirNavegador: vi.fn(),
}));

const { consultarLasNotificaciones, suscribirEsteNavegador } = vi.hoisted(() => ({
  consultarLasNotificaciones: vi.fn(),
  suscribirEsteNavegador: vi.fn(),
}));

vi.mock('./navegador.ts', async (importar) => ({
  ...(await importar<typeof import('./navegador.ts')>()),
  capacidadDelNavegador,
  permisoDeAvisos,
  suscribirNavegador,
}));

vi.mock('../infraestructura/api/notificaciones.ts', () => ({
  consultarLasNotificaciones,
  suscribirEsteNavegador,
}));

const CUENTA = '11111111-1111-4111-8111-111111111111';
const OTRA = '22222222-2222-4222-9222-222222222222';
const usuario = userEvent.setup({ delay: null });

function preparar(
  capacidad: CapacidadDelNavegador = 'lista',
  permiso: NotificationPermission = 'default',
  disponible = true,
) {
  capacidadDelNavegador.mockReturnValue(capacidad);
  permisoDeAvisos.mockReturnValue(permiso);
  consultarLasNotificaciones.mockResolvedValue({
    disponible,
    clavePublica: disponible ? 'clave-publica' : null,
  });
}

beforeEach(() => {
  capacidadDelNavegador.mockReset();
  permisoDeAvisos.mockReset();
  suscribirNavegador.mockReset();
  consultarLasNotificaciones.mockReset();
  suscribirEsteNavegador.mockReset();
  olvidarQueYaSePregunto(CUENTA);
  olvidarQueYaSePregunto(OTRA);
});

describe('PermisoDeAvisos', () => {
  describe('cuando ofrece los avisos', () => {
    it('explica que son y que nunca hablan de la salud', async () => {
      preparar();

      render(<PermisoDeAvisos cuenta={CUENTA} />);

      const dialogo = await screen.findByRole('dialog', { name: /te avisemos/i });

      expect(dialogo).toHaveAccessibleDescription(/nunca dicen nada de tu salud/i);
      expect(screen.getByRole('button', { name: 'Activar avisos' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Ahora no' })).toBeInTheDocument();
    });

    it('no pide el permiso al abrirse: solo con un clic', async () => {
      preparar();

      render(<PermisoDeAvisos cuenta={CUENTA} />);
      await screen.findByRole('dialog');

      expect(suscribirNavegador).not.toHaveBeenCalled();
    });

    it('al activar suscribe este navegador con la clave del servidor y lo celebra con calma', async () => {
      preparar();
      suscribirNavegador.mockResolvedValue({ endpoint: 'https://push.example/a', keys: {} });
      suscribirEsteNavegador.mockResolvedValue(undefined);

      render(<PermisoDeAvisos cuenta={CUENTA} />);
      await usuario.click(await screen.findByRole('button', { name: 'Activar avisos' }));

      await waitFor(() => {
        expect(suscribirNavegador).toHaveBeenCalledWith('clave-publica');
      });
      expect(suscribirEsteNavegador).toHaveBeenCalled();
      expect(await screen.findByText(/este dispositivo recibirá tus avisos/i)).toBeInTheDocument();
      // Y dice donde se eligen: el servidor guarda cuales llegan y a que hora.
      expect(screen.getByText(/en tu perfil/i)).toBeInTheDocument();
    });

    it('si no da permiso no pasa nada: lo dice sin reproche y no vuelve a preguntar', async () => {
      preparar();
      suscribirNavegador.mockRejectedValue(new PermisoNegadoError('denied'));

      render(<PermisoDeAvisos cuenta={CUENTA} />);
      await usuario.click(await screen.findByRole('button', { name: 'Activar avisos' }));

      expect(await screen.findByText(/cuando quieras/i)).toBeInTheDocument();
      expect(screen.queryByRole('alert')).toBeNull();
      expect(avisosYaPreguntados(CUENTA)).toBe(true);
    });

    it('si falla por otra cosa (sin conexion) lo dice y no lo da por contestado', async () => {
      preparar();
      suscribirNavegador.mockRejectedValue(new TypeError('Failed to fetch'));

      render(<PermisoDeAvisos cuenta={CUENTA} />);
      await usuario.click(await screen.findByRole('button', { name: 'Activar avisos' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(/conexión/i);
      expect(avisosYaPreguntados(CUENTA)).toBe(false);
    });

    it('«Ahora no» cierra y no vuelve a ofrecerlos solo', async () => {
      preparar();

      const { unmount } = render(<PermisoDeAvisos cuenta={CUENTA} />);
      await usuario.click(await screen.findByRole('button', { name: 'Ahora no' }));

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(avisosYaPreguntados(CUENTA)).toBe(true);

      unmount();
      render(<PermisoDeAvisos cuenta={CUENTA} />);

      await waitFor(() => {
        expect(consultarLasNotificaciones).toHaveBeenCalledTimes(1);
      });
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('Escape es «Ahora no»', async () => {
      preparar();

      render(<PermisoDeAvisos cuenta={CUENTA} />);

      // El dialogo escucha Escape y recibe el foco en el mismo efecto: con el foco dentro ya escucha.
      // Con la maquina cargada, el dialogo puede estar en pantalla un instante antes.
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Activar avisos' })).toHaveFocus();
      });
      await usuario.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });
      expect(avisosYaPreguntados(CUENTA)).toBe(true);
    });

    it('es de cada cuenta: lo contestado por una no lo oculta a otra', async () => {
      preparar();
      const primera = render(<PermisoDeAvisos cuenta={OTRA} />);

      await usuario.click(await screen.findByRole('button', { name: 'Ahora no' }));
      primera.unmount();

      render(<PermisoDeAvisos cuenta={CUENTA} />);

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('cuando no ofrece nada', () => {
    it.each([
      ['el navegador no recibe avisos', 'sin-soporte', 'default', true],
      ['el permiso ya se nego y no se puede volver a pedir', 'lista', 'denied', true],
      ['ya hay permiso', 'lista', 'granted', true],
      ['el servidor todavia no tiene avisos', 'lista', 'default', false],
    ] as const)('%s', async (_motivo, capacidad, permiso, disponible) => {
      preparar(capacidad, permiso, disponible);

      const { container } = render(<PermisoDeAvisos cuenta={CUENTA} />);

      await waitFor(() => {
        expect(container).toBeEmptyDOMElement();
      });
      expect(suscribirNavegador).not.toHaveBeenCalled();
    });

    it('sin conexion no pinta nada ni da error: se intentara otro dia', async () => {
      preparar();
      consultarLasNotificaciones.mockRejectedValue(new TypeError('Failed to fetch'));

      const { container } = render(<PermisoDeAvisos cuenta={CUENTA} />);

      await waitFor(() => {
        expect(consultarLasNotificaciones).toHaveBeenCalled();
      });
      expect(container).toBeEmptyDOMElement();
      expect(avisosYaPreguntados(CUENTA)).toBe(false);
    });
  });

  describe('en iPhone, sin instalar', () => {
    it('explica como instalar la aplicacion y no pide un permiso que alli no existe', async () => {
      preparar('iphone-sin-instalar');

      render(<PermisoDeAvisos cuenta={CUENTA} />);

      const dialogo = await screen.findByRole('dialog', { name: /instala/i });

      expect(dialogo).toHaveAccessibleDescription(/pantalla de inicio/i);
      expect(screen.queryByRole('button', { name: 'Activar avisos' })).toBeNull();
      expect(suscribirNavegador).not.toHaveBeenCalled();
    });

    it('«Entendido» lo cierra y no insiste', async () => {
      preparar('iphone-sin-instalar');

      render(<PermisoDeAvisos cuenta={CUENTA} />);
      await usuario.click(await screen.findByRole('button', { name: 'Entendido' }));

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(avisosYaPreguntados(CUENTA)).toBe(true);
    });

    it('no necesita al servidor para explicarlo', async () => {
      preparar('iphone-sin-instalar');
      consultarLasNotificaciones.mockRejectedValue(new TypeError('Failed to fetch'));

      render(<PermisoDeAvisos cuenta={CUENTA} />);

      expect(await screen.findByRole('dialog', { name: /instala/i })).toBeInTheDocument();
    });
  });

  it('ningun texto apura, exige ni reprocha', async () => {
    preparar();

    const { container } = render(<PermisoDeAvisos cuenta={CUENTA} />);
    await screen.findByRole('dialog');

    expect(container.textContent).not.toMatch(
      /debes|tienes que|obligatori|no olvides|perd|castig/i,
    );
  });
});
