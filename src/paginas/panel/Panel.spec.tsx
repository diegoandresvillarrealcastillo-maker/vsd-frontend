import type { Session } from '@supabase/supabase-js';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorDeLaApi } from '../../infraestructura/api/clienteHttp.ts';
import { SesionContexto, type EstadoDeSesion } from '../../sesion/SesionContexto.ts';
import { Panel } from './Panel.tsx';

/**
 * El panel, con la API simulada y el resto de verdad.
 *
 * Se simulan los dos modulos de API y **no** el gancho que los usa: asi la
 * prueba recorre lo que de verdad puede fallar —el orden de las llamadas, los
 * tres estados, el reintento— en lugar de comprobar que un doble devuelve lo
 * que se le dijo que devolviera.
 */
const { consultarLaVersionDelAviso, darDeAltaLaCuenta, traerElCatalogo } = vi.hoisted(() => ({
  consultarLaVersionDelAviso: vi.fn(),
  darDeAltaLaCuenta: vi.fn(),
  traerElCatalogo: vi.fn(),
}));

vi.mock('../../infraestructura/api/aviso.ts', () => ({ consultarLaVersionDelAviso }));
vi.mock('../../infraestructura/api/cuenta.ts', () => ({ darDeAltaLaCuenta }));
vi.mock('../../infraestructura/api/catalogo.ts', () => ({ traerElCatalogo }));

const CUENTA = {
  id: '11111111-1111-4111-8111-111111111111',
  correo: 'alguien@ucundinamarca.edu.co',
  rol: 'usuario',
  consentimiento: { versionPolitica: '2026-09-1', aceptadoEn: '2026-09-26T15:00:00.000Z' },
  registradoEn: '2026-09-26T15:00:00.000Z',
};

const CATALOGO = [
  {
    id: '0cat0000-0000-4000-8000-000000000001',
    nombre: 'Cognición',
    descripcion: 'Ejercicios breves de memoria y atención.',
    actividades: [
      {
        id: '0acd0000-0000-4000-8000-000000000001',
        nombre: 'Parejas de cartas',
        tipo: 'juego',
        descripcion: 'Encuentra las parejas iguales.',
        produceNivel: true,
      },
      {
        id: '0acd0000-0000-4000-8000-000000000002',
        nombre: 'Secuencia de números',
        tipo: 'juego',
        produceNivel: true,
      },
    ],
  },
];

function estado(parcial: Partial<EstadoDeSesion>): EstadoDeSesion {
  const vacio = vi.fn();

  return {
    sesion: { user: { email: 'alguien@ucundinamarca.edu.co' } } as Session,
    cargando: false,
    correo: 'alguien@ucundinamarca.edu.co',
    registrarse: vacio,
    entrar: vacio,
    entrarConGoogle: vacio,
    pedirRecuperacion: vacio,
    cambiarContrasena: vacio,
    salir: vacio,
    ...parcial,
  };
}

function pintar() {
  return render(
    <SesionContexto.Provider value={estado({})}>
      <MemoryRouter>
        <Panel />
      </MemoryRouter>
    </SesionContexto.Provider>,
  );
}

beforeEach(() => {
  consultarLaVersionDelAviso.mockResolvedValue('version-de-la-api');
  darDeAltaLaCuenta.mockResolvedValue(CUENTA);
  traerElCatalogo.mockResolvedValue(CATALOGO);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Panel', () => {
  it('da de alta la cuenta al entrar, con la version del aviso vigente', async () => {
    pintar();

    await screen.findByText('Tu cuenta');

    // La version no la conoce el frontend: la dice la API, que es su unica
    // fuente (SCRUM-85). El alta tiene que mandar exactamente esa, y no otra.
    expect(darDeAltaLaCuenta).toHaveBeenCalledWith('version-de-la-api', expect.anything());
  });

  it('muestra el rol y el consentimiento que devuelve la API', async () => {
    pintar();

    expect(await screen.findByText('usuario')).toBeInTheDocument();
    expect(screen.getByText(/Versión 2026-09-1/)).toBeInTheDocument();
  });

  it('lista las actividades del catalogo', async () => {
    pintar();

    expect(await screen.findByText('Parejas de cartas')).toBeInTheDocument();
    expect(screen.getByText('Secuencia de números')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cognición' })).toBeInTheDocument();
  });

  it('mientras carga lo dice, en lugar de dejar la caja vacia', () => {
    // Una promesa que nunca se resuelve deja la pantalla en el estado
    // intermedio, que sin esto solo se ve un instante y nunca se comprueba.
    const nuncaTermina = <T,>(): Promise<T> =>
      new Promise<T>(function sinResolver() {
        // A proposito: la peticion se queda en el aire.
      });

    darDeAltaLaCuenta.mockReturnValue(nuncaTermina());
    traerElCatalogo.mockReturnValue(nuncaTermina());

    pintar();

    expect(screen.getByRole('status')).toHaveTextContent(/Cargando tu cuenta/);
  });

  it('si no se puede conectar, lo explica y deja reintentar', async () => {
    // Lo que lanza `fetch` cuando no hay nadie escuchando no es un ErrorDeLaApi,
    // porque no llego a haber respuesta. Ese es el caso de tener el backend
    // apagado, y es el que define esta tarea.
    darDeAltaLaCuenta.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    pintar();

    const aviso = await screen.findByRole('alert');

    expect(aviso).toHaveTextContent(/No se pudo conectar con el servidor/);

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Tu cuenta')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('el correo ya registrado se explica con su propio mensaje', async () => {
    darDeAltaLaCuenta.mockRejectedValue(
      new ErrorDeLaApi(409, 'da igual lo que diga', undefined, 'CORREO_YA_REGISTRADO'),
    );

    pintar();

    // El texto sale del codigo de la API y no de su mensaje: por eso el mensaje
    // del doble es irrelevante y aun asi la pantalla dice lo correcto.
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /ya pertenece a una cuenta creada con otro método/,
    );
  });

  it('el consentimiento que falta se explica por su codigo, no por ser un 400', async () => {
    darDeAltaLaCuenta.mockRejectedValue(
      new ErrorDeLaApi(400, 'da igual', undefined, 'CONSENTIMIENTO_NO_REGISTRADO'),
    );

    pintar();

    expect(await screen.findByRole('alert')).toHaveTextContent(/falta la aceptación del aviso/);
  });

  it('otro 400 no se explica como si fuera el consentimiento', async () => {
    // Es el motivo de mirar el codigo y no solo el estado. Dar por hecho que
    // todo 400 es el consentimiento mandaria a la persona a revisar algo que
    // estaba bien.
    darDeAltaLaCuenta.mockRejectedValue(
      new ErrorDeLaApi(400, 'otra cosa', undefined, 'IDENTIFICADOR_INVALIDO'),
    );

    pintar();

    const aviso = await screen.findByRole('alert');

    expect(aviso).not.toHaveTextContent(/aviso de tratamiento/);
    expect(aviso).toHaveTextContent(/error 400/);
  });

  it('si el aviso cambio justo antes del alta, lo explica y reintentar lo arregla', async () => {
    darDeAltaLaCuenta.mockRejectedValueOnce(
      new ErrorDeLaApi(409, 'da igual', undefined, 'VERSION_DEL_AVISO_NO_VIGENTE'),
    );

    pintar();

    expect(await screen.findByRole('alert')).toHaveTextContent(/acaba de actualizarse/);

    // Reintentar vuelve a pedir la version, que es justo lo que hace falta.
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Tu cuenta')).toBeInTheDocument();
    expect(consultarLaVersionDelAviso).toHaveBeenCalledTimes(2);
  });

  it('la sesion caducada manda a entrar otra vez', async () => {
    darDeAltaLaCuenta.mockRejectedValue(new ErrorDeLaApi(401, 'Tu sesion caduco.'));

    pintar();

    expect(await screen.findByRole('alert')).toHaveTextContent(/Tu sesión caducó/);
  });

  it('no promete actividades cuando el catalogo llega vacio', async () => {
    traerElCatalogo.mockResolvedValue([]);

    pintar();

    expect(await screen.findByText('Todavía no hay actividades disponibles.')).toBeInTheDocument();
  });
});
