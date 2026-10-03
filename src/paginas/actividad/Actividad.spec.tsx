import type { Session } from '@supabase/supabase-js';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorDeLaApi } from '../../infraestructura/api/clienteHttp.ts';
import { rutaDeActividad, RUTAS } from '../../rutas/rutas.ts';
import { SesionContexto, type EstadoDeSesion } from '../../sesion/SesionContexto.ts';
import { Actividad } from './Actividad.tsx';

/**
 * El motor de actividades, con la API simulada y todo lo demas de verdad.
 *
 * Se simulan los dos modulos de API y **no** el gancho: asi la prueba recorre
 * lo que puede fallar de verdad —cargar, completar, enviar, reintentar— en vez
 * de comprobar que un doble devuelve lo que se le dijo.
 */
const { buscarActividad, registrarResultado } = vi.hoisted(() => ({
  buscarActividad: vi.fn(),
  registrarResultado: vi.fn(),
}));

vi.mock('../../infraestructura/api/catalogo.ts', () => ({ buscarActividad }));
vi.mock('../../infraestructura/api/resultados.ts', () => ({ registrarResultado }));

/** "Como dormiste anoche": una bitacora que si puntua. */
const SUENO = '0acd0000-0000-4000-8000-000000000004';
// "Como te sientes hoy": sin mecanica hasta que llegue Emociones (SCRUM-94).
const SIN_MECANICA = '0acd0000-0000-4000-8000-000000000007';

function fichaDe(id: string, nombre: string, tipo = 'bitacora') {
  return {
    actividad: { id, nombre, tipo, descripcion: 'Cuatro preguntas rápidas.', produceNivel: true },
    categoria: { id: 'cat-1', nombre: 'Bienestar', actividades: [] },
  };
}

function estadoDeSesion(): EstadoDeSesion {
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
    pedirCodigoDeVerificacion: vacio,
    cambiarContrasenaConCodigo: vacio,
    salir: vacio,
  };
}

function pintar(id: string) {
  return render(
    <SesionContexto.Provider value={estadoDeSesion()}>
      <MemoryRouter initialEntries={[rutaDeActividad(id)]}>
        <Routes>
          <Route path={RUTAS.ACTIVIDAD} element={<Actividad />} />
          <Route path={RUTAS.PANEL} element={<p>El panel</p>} />
        </Routes>
      </MemoryRouter>
    </SesionContexto.Provider>,
  );
}

/** Completa el formulario de sueño tal como lo haria una persona. */
async function terminarLaActividad() {
  await userEvent.click(await screen.findByRole('button', { name: 'Terminar' }));
}

beforeEach(() => {
  buscarActividad.mockResolvedValue(fichaDe(SUENO, 'Cómo dormiste anoche'));
  registrarResultado.mockResolvedValue({
    id: 'res-1',
    activityId: SUENO,
    nivelOrientativo: 'favorable',
    sugiereAcompanamiento: false,
    metadata: {},
    completedAt: '2026-09-30T11:00:00.000Z',
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Actividad, el recorrido completo', () => {
  it('carga la actividad y la presenta con su categoria', async () => {
    pintar(SUENO);

    expect(
      await screen.findByRole('heading', { name: 'Cómo dormiste anoche' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Bienestar')).toBeInTheDocument();
  });

  it('al terminar registra el resultado y muestra el nivel', async () => {
    pintar(SUENO);
    await terminarLaActividad();

    expect(await screen.findByRole('heading', { name: 'Listo' })).toBeInTheDocument();
    expect(screen.getByText('Vas bien. Sigue así.')).toBeInTheDocument();
  });

  it('manda el puntaje crudo y la metadata de lo que respondio la persona', async () => {
    pintar(SUENO);
    await terminarLaActividad();

    await waitFor(() => expect(registrarResultado).toHaveBeenCalledTimes(1));

    const enviado = registrarResultado.mock.calls[0]?.[0] as Record<string, unknown>;

    // Con los valores por defecto del formulario: 7 horas, 0 despertares y
    // "normal" son 4 + 3 + 2 = 9 sobre 10.
    expect(enviado.score).toBe(9);
    expect(enviado.activityId).toBe(SUENO);
    expect(enviado.metadata).toMatchObject({ horasDormidas: 7, despertares: 0 });
  });

  it('el identificador de operacion es un UUID que genera el dispositivo', async () => {
    pintar(SUENO);
    await terminarLaActividad();

    await waitFor(() => expect(registrarResultado).toHaveBeenCalledTimes(1));

    const enviado = registrarResultado.mock.calls[0]?.[0] as Record<string, string>;

    expect(enviado.clientOperationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});

describe('Actividad, cuando algo falla', () => {
  it('si no se puede guardar lo dice, y avisa de que no se ha perdido', async () => {
    // Es la prueba que define la tarea: el backend apagado. Lo que lanza
    // `fetch` ahi no es un ErrorDeLaApi, porque no llego a haber respuesta.
    registrarResultado.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    pintar(SUENO);
    await terminarLaActividad();

    const aviso = await screen.findByRole('alert');

    expect(aviso).toHaveTextContent(/No se pudo guardar/);
    expect(aviso).toHaveTextContent(/no se ha perdido/);
  });

  it('reintentar repite el envio con el MISMO identificador de operacion', async () => {
    // Si cambiara, un intento se registraria dos veces. La idempotencia del
    // servidor solo protege si el cliente repite la misma operacion.
    registrarResultado.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    pintar(SUENO);
    await terminarLaActividad();

    await screen.findByRole('alert');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => expect(registrarResultado).toHaveBeenCalledTimes(2));

    const primera = registrarResultado.mock.calls[0]?.[0] as Record<string, string>;
    const segunda = registrarResultado.mock.calls[1]?.[0] as Record<string, string>;

    expect(segunda.clientOperationId).toBe(primera.clientOperationId);
  });

  it('hacerla otra vez usa una operacion NUEVA', async () => {
    pintar(SUENO);
    await terminarLaActividad();

    await screen.findByRole('heading', { name: 'Listo' });
    await userEvent.click(screen.getByRole('button', { name: 'Hacerla otra vez' }));
    await terminarLaActividad();

    await waitFor(() => expect(registrarResultado).toHaveBeenCalledTimes(2));

    const primera = registrarResultado.mock.calls[0]?.[0] as Record<string, string>;
    const segunda = registrarResultado.mock.calls[1]?.[0] as Record<string, string>;

    // Si se repitiera, el servidor devolveria el resultado anterior y
    // pareceria que el segundo intento no se guardo.
    expect(segunda.clientOperationId).not.toBe(primera.clientOperationId);
  });

  it('explica el error por su codigo, no por el estado', async () => {
    registrarResultado.mockRejectedValue(
      new ErrorDeLaApi(400, 'da igual', undefined, 'PUNTAJE_NO_APLICABLE'),
    );

    pintar(SUENO);
    await terminarLaActividad();

    expect(await screen.findByRole('alert')).toHaveTextContent(/registra lo que haces/);
  });

  it('una actividad que no existe no deja la pantalla en blanco', async () => {
    buscarActividad.mockResolvedValue(null);

    pintar('99999999-9999-4999-8999-999999999999');

    expect(
      await screen.findByRole('heading', { name: 'Esta actividad no existe' }),
    ).toBeInTheDocument();
  });
});

describe('Actividad, las que todavia no tienen mecanica', () => {
  it('lo dice en lugar de fingir que se puede hacer', async () => {
    buscarActividad.mockResolvedValue(fichaDe(SIN_MECANICA, 'Cómo te sientes hoy', 'preguntas'));

    pintar(SIN_MECANICA);

    expect(await screen.findByText(/todavía no se puede hacer/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Terminar' })).not.toBeInTheDocument();
  });
});

describe('Actividad, el nivel', () => {
  it('no se muestra cuando la actividad solo registra', async () => {
    // Lo decide la respuesta del servidor, no el tipo de la actividad. Hay
    // bitacoras que puntuan y bitacoras que no.
    registrarResultado.mockResolvedValue({
      id: 'res-2',
      activityId: SUENO,
      sugiereAcompanamiento: false,
      metadata: {},
      completedAt: '2026-09-30T11:00:00.000Z',
    });

    pintar(SUENO);
    await terminarLaActividad();

    expect(await screen.findByText(/Quedó registrado/)).toBeInTheDocument();
  });

  it('ofrece acompanamiento cuando el servidor lo sugiere', async () => {
    registrarResultado.mockResolvedValue({
      id: 'res-3',
      activityId: SUENO,
      nivelOrientativo: 'requiere_atencion',
      sugiereAcompanamiento: true,
      metadata: {},
      completedAt: '2026-09-30T11:00:00.000Z',
    });

    pintar(SUENO);
    await terminarLaActividad();

    expect(await screen.findByText(/hablar con alguien ayuda/)).toBeInTheDocument();
  });
});
