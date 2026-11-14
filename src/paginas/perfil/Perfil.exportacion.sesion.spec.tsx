import { IDBFactory } from 'fake-indexeddb';
import 'fake-indexeddb/auto';
import type { Session } from '@supabase/supabase-js';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { olvidarLaFoto } from '../../foto/fotoDePerfil.ts';
import { olvidarLaMascotaPropia } from '../../foto/mascotaPropia.ts';
import type { Cuenta } from '../../infraestructura/api/cuenta.ts';
import { RUTAS } from '../../rutas/rutas.ts';
import { SesionContexto, type EstadoDeSesion } from '../../sesion/SesionContexto.ts';
import {
  alCambiarLaSesion,
  cicloActual,
  reiniciarElCicloParaLasPruebas,
} from '../../sincronizacion/ciclo.ts';
import { nuevaOperacion } from '../../sincronizacion/cola.ts';
import { Perfil } from './Perfil.tsx';

/**
 * La descarga de los datos cuando la sesion cambia a mitad (SCRUM-316, H-02 de la revision del
 * 29/10/2026).
 *
 * La pantalla, el ciclo y el almacen (IndexedDB simulado) son los de verdad; solo se controla cuando
 * responde la API. A pide su exportacion, sale, y entra B (o vuelve A) con su propia cola. Cuando la
 * respuesta de A llega tarde no se descarga nada: ni lo de A mezclado con lo de B, ni lo de A solo.
 */

const { consultarLaVersionDelAviso, darDeAltaLaCuenta, exportarMisDatos, traerElCatalogo } =
  vi.hoisted(() => ({
    consultarLaVersionDelAviso: vi.fn(),
    darDeAltaLaCuenta: vi.fn(),
    exportarMisDatos: vi.fn(),
    traerElCatalogo: vi.fn(),
  }));

vi.mock('../../infraestructura/api/catalogo.ts', () => ({ traerElCatalogo }));
vi.mock('../../infraestructura/api/foto.ts', () => ({
  guardarLaFoto: vi.fn(),
  quitarLaFoto: vi.fn(),
  pedirLaFoto: vi.fn(),
}));
vi.mock('../../infraestructura/api/mascotaPropia.ts', () => ({
  guardarLaMascotaPropia: vi.fn(),
  quitarLaMascotaPropia: vi.fn(),
  pedirLaMascotaPropia: vi.fn(),
  TIPO_DEL_SVG: 'image/svg+xml',
}));
vi.mock('../../infraestructura/api/notificaciones.ts', () => ({
  consultarLasNotificaciones: () =>
    Promise.resolve({ disponible: false, clavePublica: null, horaSemaforo: null, horaRacha: null }),
}));
vi.mock('../../infraestructura/api/pendientes.ts', () => ({
  consultarElSemaforo: () => Promise.resolve({ pendientes: [], recordatorio: null }),
}));
vi.mock('../../infraestructura/api/aviso.ts', () => ({ consultarLaVersionDelAviso }));
vi.mock('../../infraestructura/api/cuenta.ts', () => ({
  darDeAltaLaCuenta,
  cambiarPreferencias: vi.fn(),
  exportarMisDatos,
  borrarMiCuenta: vi.fn(),
  FRASE_PARA_BORRAR: 'BORRAR MI CUENTA',
}));

const CUENTA: Cuenta = {
  id: '11111111-1111-4111-8111-111111111111',
  correo: 'marina@ejemplo.test',
  rol: 'usuario',
  nombre: 'Marina',
  consentimiento: { versionPolitica: '2026-09-1', aceptadoEn: '2026-09-26T15:00:00.000Z' },
  registradoEn: '2026-09-26T15:00:00.000Z',
  modulosActivos: ['cognicion', 'bienestar'],
  mascota: null,
  diarioConRecomendaciones: false,
  acompanamientoPorDias: false,
  zonaHoraria: 'America/Bogota',
};

const usuario = userEvent.setup({ delay: null });

function sesion(): EstadoDeSesion {
  const bien = vi.fn().mockResolvedValue({ ok: true });

  return {
    sesion: { user: { email: CUENTA.correo } } as Session,
    cargando: false,
    correo: CUENTA.correo,
    registrarse: bien,
    entrar: bien,
    entrarConGoogle: bien,
    pedirRecuperacion: bien,
    cambiarContrasena: bien,
    pedirCodigoDeVerificacion: vi.fn().mockResolvedValue({ ok: true }),
    cambiarContrasenaConCodigo: vi.fn().mockResolvedValue({ ok: true }),
    salir: vi.fn().mockResolvedValue(undefined),
  };
}

function pintar() {
  render(
    <SesionContexto.Provider value={sesion()}>
      <MemoryRouter initialEntries={[RUTAS.PERFIL]}>
        <Routes>
          <Route path={RUTAS.PERFIL} element={<Perfil />} />
          <Route path={RUTAS.INICIO} element={<p>Portada</p>} />
        </Routes>
      </MemoryRouter>
    </SesionContexto.Provider>,
  );
}

/** Una anotacion del diario que sigue sin enviarse, con un texto reconocible. */
async function guardarSinEnviar(operationId: string, contenido: string): Promise<void> {
  await cicloActual()!.almacen.agregarOperacion(
    nuevaOperacion(
      {
        operationId,
        tipo: 'diario.escribir',
        entidad: `diario:${operationId}`,
        payload: { contenido },
      },
      new Date(),
    ),
  );
}

/** Deja pasar lo que una descarga tardia necesitaria para llegar a hacerse. */
async function dejarPasarLoPendiente(): Promise<void> {
  for (let vuelta = 0; vuelta < 5; vuelta += 1) {
    await act(async () => {
      await new Promise<void>((seguir) => setTimeout(seguir, 10));
    });
  }
}

function leerComoTexto(archivo: Blob): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();

    lector.onload = () => {
      resolver(typeof lector.result === 'string' ? lector.result : '');
    };
    lector.onerror = () => {
      rechazar(new Error('No se pudo leer el archivo'));
    };
    lector.readAsText(archivo);
  });
}

type Formato = 'JSON' | 'PDF';

const DELSERVIDOR_DE_A = { cuenta: { correo: 'privado-a@example.test' }, diario: ['PRIVADO_A'] };

/** Lo que el navegador recibiria para guardar. */
let archivos: Blob[];
let clics: number;

/**
 * A, con su cola y la pantalla de datos, pide la descarga y el servidor todavia no responde. Si
 * `conCatalogo`, el servidor responde en seguida y es el catalogo del PDF el que tarda.
 */
async function empezarComoA(formato: Formato, opciones: { catalogoLento?: boolean } = {}) {
  await alCambiarLaSesion('persona-a', { persistente: true });
  await guardarSinEnviar('op-a', 'PRIVADO_A_SIN_ENVIAR');

  let responderElServidor: (datos: unknown) => void = () => undefined;
  let responderElCatalogo: (datos: unknown) => void = () => undefined;

  if (opciones.catalogoLento === true) {
    exportarMisDatos.mockResolvedValue(DELSERVIDOR_DE_A);
    traerElCatalogo.mockReturnValue(
      new Promise((resolver) => {
        responderElCatalogo = resolver;
      }),
    );
  } else {
    exportarMisDatos.mockReturnValue(
      new Promise((resolver) => {
        responderElServidor = resolver;
      }),
    );
    traerElCatalogo.mockResolvedValue([]);
  }

  pintar();
  await usuario.click(await screen.findByRole('button', { name: `Descargar en ${formato}` }));

  if (opciones.catalogoLento === true) {
    // Hasta que no esta esperando el catalogo, no tiene sentido cambiar la sesion.
    await waitFor(() => {
      expect(traerElCatalogo).toHaveBeenCalled();
    });
  }

  return {
    responderElServidor: async () => {
      act(() => {
        responderElServidor(DELSERVIDOR_DE_A);
      });
      await dejarPasarLoPendiente();
    },
    responderElCatalogo: async () => {
      act(() => {
        responderElCatalogo([]);
      });
      await dejarPasarLoPendiente();
    },
  };
}

/** Sale A y entra B con su propia cola, que no debe aparecer en nada de lo de A. */
async function entraB(): Promise<void> {
  await alCambiarLaSesion(null, { persistente: true });
  await alCambiarLaSesion('persona-b', { persistente: true });
  await guardarSinEnviar('op-b', 'PRIVADO_B_SIN_ENVIAR');
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  reiniciarElCicloParaLasPruebas();
  archivos = [];
  clics = 0;
  consultarLaVersionDelAviso.mockResolvedValue('version-de-la-api');
  darDeAltaLaCuenta.mockResolvedValue(CUENTA);
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: (blob: Blob) => {
      archivos.push(blob);

      return 'blob:prueba';
    },
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
    clics += 1;
  });
});

afterEach(() => {
  cleanup();
  olvidarLaFoto();
  olvidarLaMascotaPropia();
  reiniciarElCicloParaLasPruebas();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  exportarMisDatos.mockReset();
  traerElCatalogo.mockReset();
});

describe.each<Formato>(['JSON', 'PDF'])('descargar en %s con la sesion que cambia', (formato) => {
  it('de la misma persona y sin cambios, se descarga y se pide al servidor con su contexto', async () => {
    const A = await empezarComoA(formato);

    await A.responderElServidor();

    expect(archivos).toHaveLength(1);
    expect(archivos[0]!.type).toBe(formato === 'JSON' ? 'application/json' : 'application/pdf');
    expect(await screen.findByText('Tus datos se descargaron.')).toBeInTheDocument();
    expect(exportarMisDatos).toHaveBeenCalledWith(
      expect.any(AbortSignal),
      expect.objectContaining({ persona: 'persona-a' }),
    );
  });

  it('si A sale de la pantalla y entra B, lo de A no se descarga ni se mezcla con la cola de B', async () => {
    const A = await empezarComoA(formato);

    cleanup();
    await entraB();
    const operacionesDeB = vi.spyOn(cicloActual()!.almacen, 'operaciones');

    await A.responderElServidor();

    expect(archivos).toHaveLength(0);
    expect(clics).toBe(0);
    // La cola de B ni siquiera se lee para armar la exportacion de A.
    expect(operacionesDeB).not.toHaveBeenCalled();
  });

  it('al salir de la pantalla se cancela la peticion que seguia en vuelo', async () => {
    await empezarComoA(formato);

    const [senal] = exportarMisDatos.mock.calls[0] as [AbortSignal];

    expect(senal.aborted).toBe(false);

    cleanup();

    expect(senal.aborted).toBe(true);
  });

  it('si solo se sale de la pantalla, con la misma sesion, la respuesta tardia tampoco se descarga', async () => {
    const A = await empezarComoA(formato);

    cleanup();
    await A.responderElServidor();

    expect(archivos).toHaveLength(0);
    expect(clics).toBe(0);
  });

  it('con la sesion de siempre, un fallo del servidor se dice y se puede reintentar', async () => {
    await alCambiarLaSesion('persona-a', { persistente: true });
    exportarMisDatos.mockRejectedValue(new TypeError('Failed to fetch'));
    pintar();

    await usuario.click(await screen.findByRole('button', { name: `Descargar en ${formato}` }));

    expect(
      await screen.findByText('No se pudieron descargar. Inténtalo de nuevo.'),
    ).toBeInTheDocument();
    expect(archivos).toHaveLength(0);
    expect(screen.getByRole('button', { name: `Descargar en ${formato}` })).toBeEnabled();
  });

  it('si la pantalla sigue pero la sesion es la de B, no descarga nada ni dice que fallo', async () => {
    const A = await empezarComoA(formato);

    await entraB();
    await A.responderElServidor();

    expect(archivos).toHaveLength(0);
    expect(clics).toBe(0);
    expect(screen.queryByText('Tus datos se descargaron.')).not.toBeInTheDocument();
    expect(screen.queryByText(/No se pudieron descargar/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Descargar en ${formato}` })).toBeEnabled();
  });

  it('si A sale y vuelve a entrar, la respuesta de antes tampoco se descarga', async () => {
    const A = await empezarComoA(formato);

    await alCambiarLaSesion(null, { persistente: true });
    await alCambiarLaSesion('persona-a', { persistente: true });
    await A.responderElServidor();

    expect(archivos).toHaveLength(0);
    expect(clics).toBe(0);
  });

  it('si la sesion cambia mientras se lee la cola de A, no se descarga lo leido', async () => {
    const A = await empezarComoA(formato);
    let soltarLaCola: (operaciones: []) => void = () => undefined;

    vi.spyOn(cicloActual()!.almacen, 'operaciones').mockReturnValue(
      new Promise((resolver) => {
        soltarLaCola = resolver;
      }),
    );

    await A.responderElServidor();
    await entraB();
    act(() => {
      soltarLaCola([]);
    });
    await dejarPasarLoPendiente();

    expect(archivos).toHaveLength(0);
    expect(clics).toBe(0);
  });
});

describe('descargar sin sesion anotada (la pantalla probada sola)', () => {
  it('sigue como siempre: descarga y, si el servidor falla, lo dice', async () => {
    exportarMisDatos.mockResolvedValueOnce(DELSERVIDOR_DE_A);
    pintar();

    await usuario.click(await screen.findByRole('button', { name: 'Descargar en JSON' }));
    expect(await screen.findByText('Tus datos se descargaron.')).toBeInTheDocument();
    expect(archivos).toHaveLength(1);

    exportarMisDatos.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await usuario.click(screen.getByRole('button', { name: 'Descargar en JSON' }));

    expect(
      await screen.findByText('No se pudieron descargar. Inténtalo de nuevo.'),
    ).toBeInTheDocument();
    expect(archivos).toHaveLength(1);
  });
});

describe('descargar en JSON: lo que lleva', () => {
  it('con la misma sesion, lleva lo del servidor y la cola de la misma persona, no la de otra', async () => {
    const A = await empezarComoA('JSON');

    await A.responderElServidor();

    const texto = await leerComoTexto(archivos[0]!);

    expect(texto).toContain('PRIVADO_A');
    expect(texto).toContain('PRIVADO_A_SIN_ENVIAR');
    expect(texto).not.toContain('PRIVADO_B');
  });
});

describe('descargar en PDF: la espera del catalogo', () => {
  it('si la sesion cambia mientras llega el catalogo, no se descarga el PDF', async () => {
    const A = await empezarComoA('PDF', { catalogoLento: true });

    cleanup();
    await entraB();
    await A.responderElCatalogo();

    expect(archivos).toHaveLength(0);
    expect(clics).toBe(0);
  });

  it('con la misma sesion, el PDF sale cuando llega el catalogo', async () => {
    const A = await empezarComoA('PDF', { catalogoLento: true });

    expect(archivos).toHaveLength(0);

    await A.responderElCatalogo();

    expect(archivos).toHaveLength(1);
    expect(archivos[0]!.type).toBe('application/pdf');
  });
});

describe('la reproduccion de la auditoria (H-02)', () => {
  it('la exportacion de A no mezcla la cola de B ni se descarga tras salir', async () => {
    const A = await empezarComoA('JSON');

    cleanup();
    await entraB();
    await A.responderElServidor();

    // Antes del arreglo el archivo salia con PRIVADO_A y PRIVADO_B juntos.
    const todo = await Promise.all(archivos.map(leerComoTexto));

    expect(todo.join('')).not.toContain('PRIVADO_B');
    expect(archivos).toHaveLength(0);
  });
});
