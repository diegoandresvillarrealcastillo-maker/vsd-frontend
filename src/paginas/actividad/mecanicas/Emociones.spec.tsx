import type { Session } from '@supabase/supabase-js';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TEXTO_DEL_AVISO_ORIENTATIVO } from '../../../componentes/AvisoOrientativo.tsx';
import { rutaDeActividad, RUTAS } from '../../../rutas/rutas.ts';
import { SesionContexto, type EstadoDeSesion } from '../../../sesion/SesionContexto.ts';
import { Actividad } from '../Actividad.tsx';

/**
 * Las tres actividades de Emociones (SCRUM-94), dentro del motor de verdad y
 * con la API simulada.
 */
const { buscarActividad, registrarResultado } = vi.hoisted(() => ({
  buscarActividad: vi.fn(),
  registrarResultado: vi.fn(),
}));

vi.mock('../../../infraestructura/api/catalogo.ts', () => ({ buscarActividad }));
vi.mock('../../../infraestructura/api/resultados.ts', () => ({ registrarResultado }));

const SIENTES = '0acd0000-0000-4000-8000-000000000007';
const PESANDO = '0acd0000-0000-4000-8000-000000000008';
const MOMENTO = '0acd0000-0000-4000-8000-000000000009';

const usuario = userEvent.setup({ delay: null });

function ficha(id: string, nombre: string, produceNivel: boolean) {
  return {
    actividad: { id, nombre, tipo: produceNivel ? 'preguntas' : 'bitacora', produceNivel },
    categoria: { id: 'cat-3', nombre: 'Emociones', actividades: [] },
  };
}

function sesion(): EstadoDeSesion {
  const vacio = vi.fn();

  return {
    sesion: { user: { email: 'alguien@ejemplo.test' } } as Session,
    cargando: false,
    correo: 'alguien@ejemplo.test',
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
  render(
    <SesionContexto.Provider value={sesion()}>
      <MemoryRouter initialEntries={[rutaDeActividad(id)]}>
        <Routes>
          <Route path={RUTAS.ACTIVIDAD} element={<Actividad />} />
        </Routes>
      </MemoryRouter>
    </SesionContexto.Provider>,
  );
}

/** Lo que la mecanica le entrego al motor en el envio numero `n`. */
function enviado(n = 0): Record<string, unknown> {
  return registrarResultado.mock.calls[n]?.[0] as Record<string, unknown>;
}

function terminar() {
  return usuario.click(screen.getByRole('button', { name: 'Terminar' }));
}

/** Lo que responde el servidor, con o sin sugerencia de acompanamiento. */
function responderDelServidor(activityId: string, extra: Record<string, unknown> = {}) {
  registrarResultado.mockResolvedValue({
    id: 'r-1',
    activityId,
    sugiereAcompanamiento: false,
    lineasDeAtencion: [],
    metadata: {},
    completedAt: '2026-10-03T15:00:00.000Z',
    ...extra,
  });
}

/** Las preguntas del formulario, sin contar el selector de tema de la barra. */
async function preguntas(): Promise<HTMLElement[]> {
  const formulario = (await screen.findByRole('button', { name: 'Terminar' })).closest('form');

  if (formulario === null) {
    throw new Error('La actividad no tiene formulario');
  }

  return within(formulario).getAllByRole('group');
}

beforeEach(() => {
  buscarActividad.mockImplementation((id: string) => {
    const nombres: Record<string, [string, boolean]> = {
      [SIENTES]: ['Cómo te sientes hoy', true],
      [PESANDO]: ['Qué te está pesando', true],
      [MOMENTO]: ['Un momento bueno del día', false],
    };
    const [nombre, produceNivel] = nombres[id] ?? ['?', false];

    return Promise.resolve(ficha(id, nombre, produceNivel));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('Cómo te sientes hoy', () => {
  async function responderTodo(opcion: string) {
    for (const pregunta of await preguntas()) {
      await usuario.click(within(pregunta).getByRole('radio', { name: opcion }));
    }
  }

  it('son cinco preguntas de tres opciones: Nada, Algo, Mucho', async () => {
    pintar(SIENTES);

    const grupos = await preguntas();

    expect(grupos).toHaveLength(5);

    for (const pregunta of grupos) {
      expect(
        within(pregunta)
          .getAllByRole('radio')
          .map((radio) => radio.closest('label')?.textContent),
      ).toEqual(['Nada', 'Algo', 'Mucho']);
    }
  });

  it('un dia muy dificil manda el maximo, 10, con cada respuesta', async () => {
    responderDelServidor(SIENTES, { nivelOrientativo: 'requiere_atencion' });

    pintar(SIENTES);
    await responderTodo('Mucho');
    await terminar();

    await waitFor(() => expect(registrarResultado).toHaveBeenCalledTimes(1));

    expect(enviado()).toMatchObject({
      activityId: SIENTES,
      score: 10,
      metadata: {
        respuestas: { arrancar: 2, tension: 2, disfrutar: 2, vueltas: 2, compania: 2 },
      },
    });
  });

  it('un dia tranquilo manda 0', async () => {
    responderDelServidor(SIENTES, { nivelOrientativo: 'favorable' });

    pintar(SIENTES);
    await responderTodo('Nada');
    await terminar();

    await waitFor(() => expect(registrarResultado).toHaveBeenCalledTimes(1));

    expect(enviado().score).toBe(0);
  });

  it('si falta una pregunta lo dice y no envia nada', async () => {
    pintar(SIENTES);

    const [primera] = await preguntas();

    if (primera === undefined) {
      throw new Error('Sin preguntas');
    }

    await usuario.click(within(primera).getByRole('radio', { name: 'Algo' }));
    await terminar();

    expect(screen.getByRole('alert')).toHaveTextContent('Te faltan 4 preguntas por responder.');
    expect(registrarResultado).not.toHaveBeenCalled();
  });
});

describe('Qué te está pesando', () => {
  async function marcar(...cosas: string[]) {
    await screen.findByRole('button', { name: 'Terminar' });

    for (const cosa of cosas) {
      await usuario.click(screen.getByRole('checkbox', { name: cosa }));
    }
  }

  it('se puede terminar sin marcar nada: manda 0 y la lista vacia', async () => {
    responderDelServidor(PESANDO, { nivelOrientativo: 'favorable' });

    pintar(PESANDO);
    await marcar();
    await terminar();

    await waitFor(() => expect(registrarResultado).toHaveBeenCalledTimes(1));

    expect(enviado()).toMatchObject({ score: 0, metadata: { marcadas: [] } });
  });

  it('cada cosa vale 3, y se guardan en el orden de la lista', async () => {
    responderDelServidor(PESANDO, { nivelOrientativo: 'en_seguimiento' });

    pintar(PESANDO);
    await marcar('El dinero', 'Los estudios');
    await terminar();

    await waitFor(() => expect(registrarResultado).toHaveBeenCalledTimes(1));

    expect(enviado()).toMatchObject({ score: 6, metadata: { marcadas: ['estudios', 'dinero'] } });
  });

  it('desmarcar resta', async () => {
    responderDelServidor(PESANDO);

    pintar(PESANDO);
    await marcar('El dinero', 'La familia', 'El dinero');
    await terminar();

    await waitFor(() => expect(registrarResultado).toHaveBeenCalledTimes(1));

    expect(enviado()).toMatchObject({ score: 3, metadata: { marcadas: ['familia'] } });
  });

  it('a partir de cinco el puntaje se queda en 15, pero se guardan todas', async () => {
    // La API responde 400 si el puntaje pasa del maximo de la actividad.
    responderDelServidor(PESANDO, { nivelOrientativo: 'requiere_atencion' });

    pintar(PESANDO);
    await marcar(
      'Los estudios',
      'El trabajo',
      'El dinero',
      'La familia',
      'La soledad',
      'Otra cosa',
    );
    await terminar();

    await waitFor(() => expect(registrarResultado).toHaveBeenCalledTimes(1));

    expect(enviado().score).toBe(15);
    expect((enviado().metadata as { marcadas: string[] }).marcadas).toHaveLength(6);
  });
});

describe('Un momento bueno del día', () => {
  async function escribir(texto: string) {
    await usuario.type(
      await screen.findByRole('textbox', { name: '¿Qué estuvo bien hoy?' }),
      texto,
    );
  }

  it('manda el texto sin espacios de mas y nunca un puntaje', async () => {
    responderDelServidor(MOMENTO);

    pintar(MOMENTO);
    await escribir('   Comí con mi hermana  ');
    await terminar();

    await waitFor(() => expect(registrarResultado).toHaveBeenCalledTimes(1));

    expect(enviado()).not.toHaveProperty('score');
    expect(enviado().metadata).toEqual({ encontroUno: true, texto: 'Comí con mi hermana' });
    expect(await screen.findByText(/Quedó registrado/)).toBeInTheDocument();
  });

  it('vacio o solo espacios lo dice y no envia nada', async () => {
    pintar(MOMENTO);
    await escribir('   ');
    await terminar();

    expect(screen.getByRole('alert')).toHaveTextContent('Escribe algo, aunque sea pequeño.');
    expect(registrarResultado).not.toHaveBeenCalled();
  });

  it('"Hoy no me sale ninguno" tambien se registra', async () => {
    responderDelServidor(MOMENTO);

    pintar(MOMENTO);
    await usuario.click(await screen.findByRole('button', { name: 'Hoy no me sale ninguno' }));

    await waitFor(() => expect(registrarResultado).toHaveBeenCalledTimes(1));

    expect(enviado()).not.toHaveProperty('score');
    expect(enviado().metadata).toEqual({ encontroUno: false });
  });

  it('no deja escribir mas de 500 caracteres', async () => {
    pintar(MOMENTO);

    expect(await screen.findByRole('textbox', { name: '¿Qué estuvo bien hoy?' })).toHaveAttribute(
      'maxLength',
      '500',
    );
  });

  it('una senal de riesgo en el texto siempre ensena las lineas de atencion', async () => {
    // La deteccion es del servidor: la pantalla ensena lo que el dice, sin
    // una segunda lista propia.
    responderDelServidor(MOMENTO, {
      sugiereAcompanamiento: true,
      lineasDeAtencion: [
        { id: 'l-192', titulo: 'Línea 192, opción 4', tipo: 'contacto', cobertura: 'nacional' },
      ],
    });

    pintar(MOMENTO);
    await escribir('nada, ya no quiero estar aquí');
    await terminar();

    const seccion = await screen.findByRole('region', { name: 'Si te sirve hablarlo con alguien' });

    expect(within(seccion).getByText('Línea 192, opción 4')).toBeInTheDocument();
    // Sin nivel: la actividad no puntua, y la sugerencia no se convierte en uno.
    expect(screen.queryByText(/Conviene prestarle atención/)).not.toBeInTheDocument();
  });

  it('el texto no sale por la consola, ni cuando falla el envio', async () => {
    const TEXTO = 'algo muy personal que nadie mas deberia leer';
    const espias = (['log', 'info', 'warn', 'error', 'debug'] as const).map((metodo) =>
      vi.spyOn(console, metodo).mockImplementation(() => undefined),
    );

    registrarResultado.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    responderDelServidor(MOMENTO, { sugiereAcompanamiento: true });

    pintar(MOMENTO);
    await escribir(TEXTO);
    await terminar();
    await usuario.click(await screen.findByRole('button', { name: 'Reintentar' }));
    await screen.findByRole('heading', { name: 'Listo' });

    // Sanity: el texto si llego a la peticion. Lo que no puede es salir por
    // ningun otro lado.
    expect(enviado(1).metadata).toMatchObject({ texto: TEXTO });

    for (const espia of espias) {
      for (const argumentos of espia.mock.calls) {
        expect(argumentos.map((uno) => String(uno)).join(' ')).not.toContain('muy personal');
      }
    }
  });
});

describe('Emociones, lo que se lee en pantalla', () => {
  // Criterio de la tarea: ningun texto nombra una condicion ni diagnostica.
  const CLINICO =
    /ansiedad|ansios|depresi|deprimid|trastorno|diagn[oó]stic|s[ií]ntoma|patolog|enfermedad|suicid|p[aá]nico|estr[eé]s/i;

  it.each([
    ['Cómo te sientes hoy', SIENTES],
    ['Qué te está pesando', PESANDO],
    ['Un momento bueno del día', MOMENTO],
  ])('%s no nombra ninguna condicion', async (_nombre, id) => {
    pintar(id);
    await screen.findByRole('button', { name: 'Terminar' });

    expect(document.body.textContent).not.toMatch(CLINICO);
  });

  it('la pantalla final con las lineas de atencion tampoco', async () => {
    responderDelServidor(PESANDO, {
      nivelOrientativo: 'requiere_atencion',
      sugiereAcompanamiento: true,
      lineasDeAtencion: [],
    });

    pintar(PESANDO);
    await screen.findByRole('button', { name: 'Terminar' });
    await terminar();
    await screen.findByRole('region', { name: 'Si te sirve hablarlo con alguien' });

    // La linea fija «Orientativo. No es un diagnostico...» (L-03 de la auditoria
    // 360) es la unica que puede nombrar el diagnostico, y solo para negarlo. Se
    // comprueba que esta, y se quita para mirar todo lo demas.
    expect(screen.getByText(TEXTO_DEL_AVISO_ORIENTATIVO)).toBeInTheDocument();
    expect(document.body.textContent.replace(TEXTO_DEL_AVISO_ORIENTATIVO, '')).not.toMatch(CLINICO);
  });
});
