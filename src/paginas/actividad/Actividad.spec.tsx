import type { Session } from '@supabase/supabase-js';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TEXTO_DEL_AVISO_ORIENTATIVO } from '../../componentes/AvisoOrientativo.tsx';
import { ErrorDeLaApi } from '../../infraestructura/api/clienteHttp.ts';
import { cuantosH1, fallosDeAccesibilidad } from '../../pruebas/axe.ts';
import { rutaDeActividad, RUTAS } from '../../rutas/rutas.ts';
import { SesionContexto, type EstadoDeSesion } from '../../sesion/SesionContexto.ts';
import { fijarLaZonaDeLaCuenta } from '../../tiempo/zonaHoraria.ts';
import { cicloActual } from '../../sincronizacion/ciclo.ts';
import { Actividad } from './Actividad.tsx';
import { abrirUnAlmacenDePrueba, cerrarElAlmacenDePrueba } from '../../pruebas/almacenDePrueba.ts';

/**
 * El motor de actividades, con la API simulada y todo lo demas de verdad.
 *
 * Se simulan los dos modulos de API y **no** el gancho: asi la prueba recorre
 * lo que puede fallar de verdad —cargar, completar, enviar, reintentar— en vez
 * de comprobar que un doble devuelve lo que se le dijo.
 */
const { buscarActividad, registrarResultado, hayConexionConLaApi } = vi.hoisted(() => ({
  buscarActividad: vi.fn(),
  registrarResultado: vi.fn(),
  hayConexionConLaApi: vi.fn(),
}));

// El catalogo sale de la copia local cuando no hay conexion (SCRUM-138); aqui es un doble.
vi.mock('../../sincronizacion/catalogoLocal.ts', () => ({
  buscarActividadConCopia: buscarActividad,
  nombreDeLaActividad: vi.fn(() => Promise.resolve(null)),
}));
// Lo que se termina entra a la cola y la envia el motor de verdad: solo se simula la red.
vi.mock('../../infraestructura/api/conexion.ts', () => ({ hayConexionConLaApi }));
vi.mock('../../infraestructura/api/resultados.ts', () => ({ registrarResultado }));

/** "Como dormiste anoche": una bitacora que si puntua. */
const SUENO = '0acd0000-0000-4000-8000-000000000004';
// Desde SCRUM-94 las nueve del catalogo tienen mecanica. Esta seria una
// sembrada en la base antes de tener pantalla.
const SIN_MECANICA = '0acd0000-0000-4000-8000-0000000000aa';

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

beforeEach(async () => {
  hayConexionConLaApi.mockResolvedValue(true);
  await abrirUnAlmacenDePrueba();
});

afterEach(() => {
  cerrarElAlmacenDePrueba();
  vi.clearAllMocks();
});

describe('Actividad, accesibilidad (C-03)', () => {
  it('la actividad no tiene fallos de accesibilidad y tiene un solo h1', async () => {
    pintar(SUENO);
    await screen.findByRole('heading', { name: 'Cómo dormiste anoche' });

    expect(await fallosDeAccesibilidad()).toEqual([]);
    expect(cuantosH1()).toBe(1);
  });

  it('el resultado tampoco, ni con las lineas de atencion', async () => {
    registrarResultado.mockResolvedValue({
      id: 'res-1',
      activityId: SUENO,
      nivelOrientativo: 'requiere_atencion',
      sugiereAcompanamiento: true,
      metadata: {},
      completedAt: '2026-09-30T11:00:00.000Z',
    });

    pintar(SUENO);
    await terminarLaActividad();
    await screen.findByRole('heading', { name: 'Listo' });

    expect(await fallosDeAccesibilidad()).toEqual([]);
    expect(cuantosH1()).toBe(1);
  });
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

  it('bajo el nivel va siempre la linea que dice que es orientativo (L-03)', async () => {
    pintar(SUENO);
    await terminarLaActividad();

    await screen.findByRole('heading', { name: 'Listo' });

    expect(screen.getByText(TEXTO_DEL_AVISO_ORIENTATIVO)).toBeInTheDocument();
    expect(screen.getByText(TEXTO_DEL_AVISO_ORIENTATIVO)).toHaveTextContent(
      'Orientativo. No es un diagnóstico ni reemplaza a un profesional.',
    );
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

describe('Actividad, sin conexion (SCRUM-138)', () => {
  /** Lo que hay en la cola de esta persona. */
  async function laCola() {
    return (await cicloActual()?.almacen.operaciones()) ?? [];
  }

  /** Vuelve la conexion y el motor envia lo que haya, como hace el disparador de verdad. */
  async function volverLaConexion() {
    hayConexionConLaApi.mockResolvedValue(true);
    await act(async () => {
      await cicloActual()?.motor.sincronizar('conexion');
    });
  }

  beforeEach(() => {
    hayConexionConLaApi.mockResolvedValue(false);
  });

  it('se abre sin conexion: la actividad sale de la copia local', async () => {
    pintar(SUENO);

    expect(
      await screen.findByRole('heading', { name: 'Cómo dormiste anoche' }),
    ).toBeInTheDocument();
    expect(buscarActividad).toHaveBeenCalledWith(SUENO, expect.any(AbortSignal));
  });

  it('al terminarla queda guardada en este equipo, y lo dice, sin simular que se envio', async () => {
    pintar(SUENO);
    await terminarLaActividad();

    expect(
      await screen.findByText(
        'Guardado en este equipo. Te mostraremos la orientación cuando te conectes.',
      ),
    ).toBeInTheDocument();
    expect(registrarResultado).not.toHaveBeenCalled();
    // Ni un error ni un nivel inventado: no se sabe nada de la orientacion todavia.
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/Vas bien/)).toBeNull();
  });

  it('lo guardado en la cola es lo mismo que se habria enviado', async () => {
    pintar(SUENO);
    await terminarLaActividad();
    await screen.findByText(/Guardado en este equipo/);

    const [operacion, ...otras] = await laCola();

    expect(otras).toEqual([]);
    expect(operacion).toMatchObject({ tipo: 'resultado.registrar', estado: 'pendiente' });
    expect(operacion?.payload).toMatchObject({
      activityId: SUENO,
      score: 9,
      metadata: { horasDormidas: 7, despertares: 0 },
    });
    expect(operacion?.operationId).toBe(
      (operacion?.payload as Record<string, unknown>).clientOperationId,
    );
  });

  it('la hora en que se termino es la del dispositivo, no la de cuando llegue', async () => {
    const antes = Date.now();

    pintar(SUENO);
    await terminarLaActividad();
    await screen.findByText(/Guardado en este equipo/);

    const payload = (await laCola())[0]?.payload as Record<string, string>;

    expect(new Date(payload.completedAt ?? '').getTime()).toBeGreaterThanOrEqual(antes - 1000);
    expect(new Date(payload.completedAt ?? '').getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('si la actividad no se valora, no promete una orientacion que no va a haber', async () => {
    buscarActividad.mockResolvedValue({
      ...fichaDe(SUENO, 'Cómo dormiste anoche'),
      actividad: { ...fichaDe(SUENO, 'x').actividad, produceNivel: false },
    });

    pintar(SUENO);
    await terminarLaActividad();

    expect(
      await screen.findByText('Guardado en este equipo. Se enviará cuando te conectes.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/orientación/)).toBeNull();
  });

  it('el servidor apagado (fetch falla) tampoco es un error: queda guardada', async () => {
    // Es la prueba que definia la tarea de antes: el backend apagado. Lo que lanza `fetch`
    // ahi no es un ErrorDeLaApi, porque no llego a haber respuesta.
    hayConexionConLaApi.mockResolvedValue(true);
    registrarResultado.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    pintar(SUENO);
    await terminarLaActividad();

    expect(await screen.findByText(/Guardado en este equipo/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect((await laCola())[0]).toMatchObject({ estado: 'pendiente', intentos: 0 });
  });

  it('un servidor que falla (503) tambien: queda guardada y se volvera a intentar', async () => {
    hayConexionConLaApi.mockResolvedValue(true);
    registrarResultado.mockRejectedValueOnce(
      new ErrorDeLaApi(503, 'x', undefined, 'ERROR_INTERNO'),
    );

    pintar(SUENO);
    await terminarLaActividad();

    expect(await screen.findByText(/Guardado en este equipo/)).toBeInTheDocument();

    const operacion = (await laCola())[0];

    expect(operacion).toMatchObject({ estado: 'pendiente', intentos: 1 });
    expect(operacion?.proximoIntento).not.toBeNull();
  });

  it('al volver la conexion con la pantalla abierta, se envia UNA vez y la pantalla se pone al dia', async () => {
    pintar(SUENO);
    await terminarLaActividad();
    await screen.findByText(/Guardado en este equipo/);

    await volverLaConexion();

    expect(await screen.findByText('Vas bien. Sigue así.')).toBeInTheDocument();
    expect(screen.queryByText(/Guardado en este equipo/)).toBeNull();
    expect(registrarResultado).toHaveBeenCalledTimes(1);
    expect((await laCola())[0]).toMatchObject({ estado: 'hecha' });
  });

  it('con lo que sugiere el acompanamiento, al volver la conexion tambien salen las lineas', async () => {
    registrarResultado.mockResolvedValue({
      id: 'res-9',
      activityId: SUENO,
      nivelOrientativo: 'requiere_atencion',
      sugiereAcompanamiento: true,
      metadata: {},
      completedAt: '2026-09-30T11:00:00.000Z',
    });

    pintar(SUENO);
    await terminarLaActividad();
    await screen.findByText(/Guardado en este equipo/);
    await volverLaConexion();

    expect(
      await screen.findByRole('region', { name: 'Si te sirve hablarlo con alguien' }),
    ).toBeInTheDocument();
  });

  it('si la respuesta se pierde y se reenvia, va con el MISMO identificador: el servidor no duplica', async () => {
    // El servidor la recibio pero la respuesta no llego. Reenviar con otro identificador
    // la registraria dos veces; con el mismo, el servidor devuelve la que ya tiene.
    hayConexionConLaApi.mockResolvedValue(true);
    registrarResultado.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    pintar(SUENO);
    await terminarLaActividad();
    await screen.findByText(/Guardado en este equipo/);
    await volverLaConexion();

    await screen.findByText('Vas bien. Sigue así.');

    expect(registrarResultado).toHaveBeenCalledTimes(2);

    const primera = registrarResultado.mock.calls[0]?.[0] as Record<string, string>;
    const segunda = registrarResultado.mock.calls[1]?.[0] as Record<string, string>;

    expect(segunda.clientOperationId).toBe(primera.clientOperationId);
    expect(await laCola()).toHaveLength(1);
  });

  it('dos intentos distintos no se mezclan: cada uno es su operacion', async () => {
    pintar(SUENO);
    await terminarLaActividad();
    await screen.findByText(/Guardado en este equipo/);
    await userEvent.click(screen.getByRole('button', { name: 'Hacerla otra vez' }));
    await terminarLaActividad();
    await screen.findByText(/Guardado en este equipo/);

    const cola = await laCola();

    expect(cola).toHaveLength(2);
    expect(new Set(cola.map((o) => o.operationId)).size).toBe(2);
    expect(new Set(cola.map((o) => o.entidad)).size).toBe(2);
  });

  it('recargar con el resultado en la cola no lo pierde, y sale cuando hay conexion', async () => {
    const { unmount } = pintar(SUENO);

    await terminarLaActividad();
    await screen.findByText(/Guardado en este equipo/);
    // Cerrar la pantalla (o recargarla): lo guardado no depende de ella.
    unmount();

    expect(await laCola()).toHaveLength(1);

    await volverLaConexion();

    expect(registrarResultado).toHaveBeenCalledTimes(1);
    expect((await laCola())[0]).toMatchObject({ estado: 'hecha' });
  });

  it('el puntaje no se muestra en ningun momento', async () => {
    pintar(SUENO);
    await terminarLaActividad();
    await screen.findByText(/Guardado en este equipo/);

    const guardada = document.body.textContent ?? '';

    await volverLaConexion();
    await screen.findByText('Vas bien. Sigue así.');

    for (const texto of [guardada, document.body.textContent ?? '']) {
      expect(texto).not.toMatch(/puntaje|puntos|score|9 (de|sobre) 10|\b9\/10/i);
    }
  });

  it('con la pantalla ya cerrada, lo que salga despues no cambia nada ni falla', async () => {
    const { unmount } = pintar(SUENO);

    await terminarLaActividad();
    await screen.findByText(/Guardado en este equipo/);
    unmount();

    await expect(volverLaConexion()).resolves.toBeUndefined();
  });

  it('hacerla otra vez deja de esperar el envio anterior: sale igual, pero ya no le toca a esta pantalla', async () => {
    pintar(SUENO);
    await terminarLaActividad();
    await screen.findByText(/Guardado en este equipo/);
    await userEvent.click(screen.getByRole('button', { name: 'Hacerla otra vez' }));
    await screen.findByRole('button', { name: 'Terminar' });

    await volverLaConexion();

    // El intento anterior salio, pero la pantalla esta en el nuevo.
    expect(registrarResultado).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Terminar' })).toBeInTheDocument();
    expect(screen.queryByText('Vas bien. Sigue así.')).toBeNull();
  });
});

describe('Actividad, cuando algo falla', () => {
  it('si la API rechaza el resultado, lo explica por su codigo y se puede reintentar', async () => {
    registrarResultado.mockRejectedValue(
      new ErrorDeLaApi(400, 'da igual', undefined, 'PUNTAJE_NO_APLICABLE'),
    );

    pintar(SUENO);
    await terminarLaActividad();

    expect(await screen.findByRole('alert')).toHaveTextContent(/registra lo que haces/);
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('reintentar repite el envio con el MISMO identificador de operacion', async () => {
    // Si cambiara, un intento se registraria dos veces. La idempotencia del
    // servidor solo protege si el cliente repite la misma operacion.
    registrarResultado.mockRejectedValue(
      new ErrorDeLaApi(400, 'da igual', undefined, 'PUNTAJE_FUERA_DE_RANGO'),
    );

    pintar(SUENO);
    await terminarLaActividad();

    await screen.findByRole('alert');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => expect(registrarResultado).toHaveBeenCalledTimes(2));

    const primera = registrarResultado.mock.calls[0]?.[0] as Record<string, string>;
    const segunda = registrarResultado.mock.calls[1]?.[0] as Record<string, string>;

    expect(segunda.clientOperationId).toBe(primera.clientOperationId);
    expect(await cicloActual()?.almacen.operaciones()).toHaveLength(1);
  });

  it('si despues de reintentar sale bien, se ve como siempre', async () => {
    registrarResultado.mockRejectedValueOnce(
      new ErrorDeLaApi(400, 'da igual', undefined, 'PUNTAJE_FUERA_DE_RANGO'),
    );

    pintar(SUENO);
    await terminarLaActividad();
    await screen.findByRole('alert');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Vas bien. Sigue así.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('si ya no esta en la cola (la descartaron), reintentar la guarda otra vez, una sola vez', async () => {
    registrarResultado.mockRejectedValueOnce(
      new ErrorDeLaApi(400, 'da igual', undefined, 'PUNTAJE_FUERA_DE_RANGO'),
    );

    pintar(SUENO);
    await terminarLaActividad();
    await screen.findByRole('alert');

    const [operacion] = (await cicloActual()?.almacen.operaciones()) ?? [];

    await cicloActual()?.almacen.quitarOperacion(operacion?.operationId ?? '');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Vas bien. Sigue así.')).toBeInTheDocument();
    expect(await cicloActual()?.almacen.operaciones()).toHaveLength(1);
  });

  it('un rechazo sin codigo explica con el estado', async () => {
    registrarResultado.mockRejectedValue(new ErrorDeLaApi(418, 'x'));

    pintar(SUENO);
    await terminarLaActividad();

    expect(await screen.findByRole('alert')).toHaveTextContent(/error 418/);
  });

  it.each([
    ['ACTIVIDAD_NO_ENCONTRADA', 404, /ya no está disponible/],
    ['PUNTAJE_FUERA_DE_RANGO', 400, /fuera de lo que esta actividad admite/],
    ['CUENTA_NO_REGISTRADA', 403, /Todavía no tienes una cuenta/],
    ['FECHA_EN_EL_FUTURO', 400, /hora de tu dispositivo/],
  ])('el codigo %s se explica', async (codigo, estado, texto) => {
    registrarResultado.mockRejectedValue(new ErrorDeLaApi(estado, 'x', undefined, codigo));

    pintar(SUENO);
    await terminarLaActividad();

    expect(await screen.findByRole('alert')).toHaveTextContent(texto);
  });

  it('sin sesion no hay donde guardar, y lo dice en lugar de perder lo hecho en silencio', async () => {
    pintar(SUENO);
    await screen.findByRole('button', { name: 'Terminar' });
    cerrarElAlmacenDePrueba();
    await terminarLaActividad();

    expect(await screen.findByRole('alert')).toHaveTextContent(/No se pudo guardar tu resultado/);
  });

  it('si el almacen falla al guardar, lo dice sin inventar un motivo', async () => {
    pintar(SUENO);
    await screen.findByRole('button', { name: 'Terminar' });
    vi.spyOn(cicloActual()?.almacen ?? ({} as never), 'agregarOperacion').mockRejectedValue(
      new Error('no hay espacio'),
    );
    await terminarLaActividad();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo guardar este resultado. Vuelve a intentarlo.',
    );
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

  it('sin conexion y sin copia, dice que la primera vez hace falta conexion y no inventa nada', async () => {
    buscarActividad.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    pintar(SUENO);

    expect(await screen.findByRole('alert')).toHaveTextContent(/necesita conexión la primera vez/);
  });

  it('y reintentar la carga la vuelve a pedir', async () => {
    buscarActividad.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    pintar(SUENO);
    await screen.findByRole('alert');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(
      await screen.findByRole('heading', { name: 'Cómo dormiste anoche' }),
    ).toBeInTheDocument();
    expect(buscarActividad).toHaveBeenCalledTimes(2);
  });

  it('una sesion caducada al cargar lo dice', async () => {
    buscarActividad.mockRejectedValueOnce(new ErrorDeLaApi(401, 'x'));

    pintar(SUENO);

    expect(await screen.findByRole('alert')).toHaveTextContent(/Tu sesión caducó/);
  });

  it('cualquier otro fallo al cargar tambien se explica', async () => {
    buscarActividad.mockRejectedValueOnce(new ErrorDeLaApi(500, 'x', undefined, 'ERROR_INTERNO'));

    pintar(SUENO);

    expect(await screen.findByRole('alert')).toHaveTextContent(/No se pudo cargar la actividad/);
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
    buscarActividad.mockResolvedValue(fichaDe(SIN_MECANICA, 'Una que aún no existe', 'preguntas'));

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
    // Sin nivel no hay nada que matizar: la linea acompana al nivel.
    expect(screen.queryByText(TEXTO_DEL_AVISO_ORIENTATIVO)).not.toBeInTheDocument();
  });
});

describe('Actividad, las lineas de atencion (SCRUM-94)', () => {
  const NACIONAL = {
    id: 'l-192',
    titulo: 'Línea 192, opción 4',
    descripcion: 'Funciona en todo el país.',
    tipo: 'contacto',
    cobertura: 'nacional',
    enlace: 'https://www.minsalud.gov.co',
  };
  const BOGOTA = {
    id: 'l-106',
    titulo: 'Línea 106, el poder de ser escuchado',
    tipo: 'contacto',
    cobertura: 'bogota',
  };

  function responder(sugiereAcompanamiento: boolean, lineasDeAtencion?: unknown[]) {
    registrarResultado.mockResolvedValue({
      id: 'res-3',
      activityId: SUENO,
      nivelOrientativo: sugiereAcompanamiento ? 'requiere_atencion' : 'favorable',
      sugiereAcompanamiento,
      ...(lineasDeAtencion === undefined ? {} : { lineasDeAtencion }),
      metadata: {},
      completedAt: '2026-09-30T11:00:00.000Z',
    });
  }

  it('cuando el servidor sugiere acompanamiento, ensena sus lineas en su orden', async () => {
    responder(true, [NACIONAL, BOGOTA]);

    pintar(SUENO);
    await terminarLaActividad();

    const seccion = await screen.findByRole('region', { name: 'Si te sirve hablarlo con alguien' });
    const titulos = within(seccion)
      .getAllByRole('listitem')
      .map((linea) => linea.querySelector('strong')?.textContent);

    // Lo nacional primero: el servidor ya las ordena y aqui no se reordenan.
    expect(titulos).toEqual([NACIONAL.titulo, BOGOTA.titulo]);
    expect(within(seccion).getByText('Todo el país')).toBeInTheDocument();
    expect(within(seccion).getByText('Desde Bogotá')).toBeInTheDocument();
    expect(within(seccion).getByText(/alguien de confianza ayuda/)).toBeInTheDocument();
  });

  it('el enlace abre en otra pestana y lo dice', async () => {
    responder(true, [NACIONAL]);

    pintar(SUENO);
    await terminarLaActividad();

    const enlace = await screen.findByRole('link', { name: /Más información sobre Línea 192/ });

    expect(enlace).toHaveAttribute('href', NACIONAL.enlace);
    expect(enlace).toHaveAttribute('target', '_blank');
    expect(enlace).toHaveAttribute('rel', 'noopener noreferrer');
    expect(enlace).toHaveAccessibleName(/se abre en otra pestaña/);
  });

  it('si el servidor no manda ninguna, ensena las nacionales de respaldo', async () => {
    // Un servidor anterior a SCRUM-94, o la tabla vacia por error. Justo ese
    // momento no puede quedarse sin un telefono.
    responder(true);

    pintar(SUENO);
    await terminarLaActividad();

    const seccion = await screen.findByRole('region', { name: 'Si te sirve hablarlo con alguien' });

    expect(within(seccion).getByText('Línea 192, opción 4')).toBeInTheDocument();
    expect(within(seccion).getByText('Línea 123')).toBeInTheDocument();
  });

  it.each(['Europe/Madrid', 'America/Lima'])(
    'fuera de Colombia (%s), el respaldo es el directorio y no el 192 (SCRUM-124)',
    async (zona) => {
      // Lima comparte hora con Bogota, y aun asi no es Colombia: darle el 192
      // seria darle un numero que no contesta.
      fijarLaZonaDeLaCuenta(zona);
      responder(true);

      pintar(SUENO);
      await terminarLaActividad();

      const seccion = await screen.findByRole('region', {
        name: 'Si te sirve hablarlo con alguien',
      });

      expect(
        within(seccion).getByText('Directorio internacional de líneas de ayuda'),
      ).toBeInTheDocument();
      expect(within(seccion).getByText('Directorio internacional')).toBeInTheDocument();
      expect(seccion).not.toHaveTextContent('192');
      expect(seccion).not.toHaveTextContent('123');
      expect(
        within(seccion).getByRole('link', {
          name: /Más información sobre Directorio internacional/,
        }),
      ).toHaveAttribute('href', 'https://findahelpline.com/');
    },
  );

  it('si el servidor manda lineas de otro pais, esas se ven: el servidor es quien sabe', async () => {
    fijarLaZonaDeLaCuenta('Europe/Madrid');
    responder(true, [
      {
        id: 'l-024',
        titulo: 'Línea 024, llama a la vida',
        tipo: 'contacto',
        cobertura: 'nacional',
      },
    ]);

    pintar(SUENO);
    await terminarLaActividad();

    expect(await screen.findByText('Línea 024, llama a la vida')).toBeInTheDocument();
    expect(
      screen.queryByText('Directorio internacional de líneas de ayuda'),
    ).not.toBeInTheDocument();
  });

  it('una lista vacia tambien cae al respaldo', async () => {
    responder(true, []);

    pintar(SUENO);
    await terminarLaActividad();

    expect(await screen.findByText('Línea 192, opción 4')).toBeInTheDocument();
  });

  it('sin sugerencia no hay lineas', async () => {
    responder(false, []);

    pintar(SUENO);
    await terminarLaActividad();

    await screen.findByRole('heading', { name: 'Listo' });

    expect(screen.queryByRole('region', { name: /hablarlo con alguien/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Línea/)).not.toBeInTheDocument();
  });
});

describe('Actividad: el logro al terminar (SCRUM-170)', () => {
  it('con un resultado favorable celebra, con confeti', async () => {
    registrarResultado.mockResolvedValue({
      id: 'res-2',
      activityId: SUENO,
      nivelOrientativo: 'favorable',
      sugiereAcompanamiento: false,
      metadata: {},
      completedAt: '2026-09-30T11:00:00.000Z',
    });

    const { container } = pintar(SUENO);
    await terminarLaActividad();
    await screen.findByRole('heading', { name: 'Listo' });

    expect(screen.getByText('¡Lo hiciste!')).toBeInTheDocument();
    expect(container.querySelector('.confeti')).not.toBeNull();
  });

  it('si el resultado pide acompanar, la insignia sale serena y sin confeti', async () => {
    registrarResultado.mockResolvedValue({
      id: 'res-3',
      activityId: SUENO,
      nivelOrientativo: 'requiere_atencion',
      sugiereAcompanamiento: true,
      metadata: {},
      completedAt: '2026-09-30T11:00:00.000Z',
    });

    const { container } = pintar(SUENO);
    await terminarLaActividad();
    await screen.findByRole('heading', { name: 'Listo' });

    expect(screen.getByText('Gracias por tomarte este momento.')).toBeInTheDocument();
    expect(screen.queryByText('¡Lo hiciste!')).not.toBeInTheDocument();
    expect(container.querySelector('.confeti')).toBeNull();
  });
});
