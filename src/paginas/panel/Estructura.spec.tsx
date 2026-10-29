import type { Session } from '@supabase/supabase-js';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { abrirUnAlmacenDePrueba, cerrarElAlmacenDePrueba } from '../../pruebas/almacenDePrueba.ts';
import { rachaDePrueba } from '../../pruebas/rachaDePrueba.ts';
import { RUTAS } from '../../rutas/rutas.ts';
import { cicloActual, encolar } from '../../sincronizacion/ciclo.ts';
import type { EstadoDeOperacion } from '../../sincronizacion/cola.ts';

import { SesionContexto, type EstadoDeSesion } from '../../sesion/SesionContexto.ts';
import { BarraSuperior, NavegacionInferior } from './Estructura.tsx';

/**
 * El boton redondo de la cuenta, en la barra de arriba de toda la aplicacion.
 * Aqui solo se prueba lo que se agrego con la foto de perfil (SCRUM-120).
 */
const { foto } = vi.hoisted(() => ({ foto: { url: null as string | null } }));

vi.mock('../../foto/fotoDePerfil.ts', () => ({ useFotoDePerfil: () => foto.url }));

// La llama de la racha (SCRUM-186) pide la racha desde la barra: aqui solo importa donde va.
const { consultarLaRacha } = vi.hoisted(() => ({ consultarLaRacha: vi.fn() }));

vi.mock('../../infraestructura/api/racha.ts', () => ({ consultarLaRacha }));

beforeEach(() => {
  consultarLaRacha.mockResolvedValue(rachaDePrueba({ dias: 5, nivel: 0 }));
});

const salir = vi.fn().mockResolvedValue(undefined);

function sesion(): EstadoDeSesion {
  const bien = vi.fn().mockResolvedValue({ ok: true });

  return {
    sesion: { user: { email: 'ana@ejemplo.test' } } as Session,
    cargando: false,
    correo: 'ana@ejemplo.test',
    registrarse: bien,
    entrar: bien,
    entrarConGoogle: bien,
    pedirRecuperacion: bien,
    cambiarContrasena: bien,
    pedirCodigoDeVerificacion: bien,
    cambiarContrasenaConCodigo: bien,
    salir,
  };
}

function pintar() {
  render(
    <SesionContexto.Provider value={sesion()}>
      <MemoryRouter>
        <BarraSuperior conSecciones={false} />
      </MemoryRouter>
    </SesionContexto.Provider>,
  );

  return screen.getByRole('button', { name: 'Abrir el menú de tu cuenta' });
}

describe('el avatar de la barra de arriba (SCRUM-120)', () => {
  it('sin foto, muestra el icono de siempre', () => {
    foto.url = null;

    const avatar = pintar();

    expect(avatar.querySelector('img')).toBeNull();
    expect(avatar.querySelector('svg')).not.toBeNull();
  });

  it('con foto, la muestra en lugar del icono', () => {
    foto.url = 'blob:la-foto';

    const avatar = pintar();

    expect(avatar.querySelector('img')).toHaveAttribute('src', 'blob:la-foto');
    expect(avatar.querySelector('svg')).toBeNull();
  });

  it('la foto es decorativa: el boton ya se llama «Abrir el menú de tu cuenta»', () => {
    foto.url = 'blob:la-foto';

    const avatar = pintar();

    expect(avatar.querySelector('img')).toHaveAttribute('alt', '');
    expect(avatar).toHaveAccessibleName('Abrir el menú de tu cuenta');
  });
});

describe('cerrar sesion con cambios sin enviar (SCRUM-142)', () => {
  const usuario = userEvent.setup({ delay: null });
  let contador = 0;

  /** Un cambio guardado en este equipo, en el estado que se diga. */
  async function guardar(estado: EstadoDeOperacion) {
    contador += 1;

    const guardada = await encolar({
      operationId: `op-${String(contador)}`,
      tipo: 'pendiente.crear',
      entidad: `pendiente:${String(contador)}`,
      payload: { texto: 'Algo' },
    });

    await cicloActual()?.almacen.guardarOperacion({ ...guardada, estado });
  }

  async function pulsarCerrarSesion() {
    pintar();
    await usuario.click(screen.getByRole('button', { name: 'Abrir el menú de tu cuenta' }));
    await usuario.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
  }

  /** Lo que hace el motor al enviar: deja la primera operacion `hecha`. */
  function elMotorEnviaUna() {
    return vi.spyOn(cicloActual()!.motor, 'sincronizar').mockImplementation(async () => {
      const [una] = await cicloActual()!.almacen.operaciones();

      await cicloActual()!.almacen.guardarOperacion({ ...una!, estado: 'hecha' });

      return { estado: 'terminada' } as never;
    });
  }

  beforeEach(async () => {
    contador = 0;
    salir.mockClear();
    foto.url = null;
    // Con conexion, pero sin que el motor envie nada: se mira lo que queda.
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    await abrirUnAlmacenDePrueba();
  });

  afterEach(() => {
    cerrarElAlmacenDePrueba();
    vi.restoreAllMocks();
  });

  it('sin nada que enviar, sale de una vez, como siempre', async () => {
    await pulsarCerrarSesion();

    await waitFor(() => {
      expect(salir).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('lo que ya se envio no cuenta: sale de una vez', async () => {
    await guardar('hecha');

    await pulsarCerrarSesion();

    await waitFor(() => {
      expect(salir).toHaveBeenCalledTimes(1);
    });
  });

  it('con algo sin enviar, pregunta y NO sale todavia', async () => {
    await guardar('pendiente');
    await guardar('requiere_atencion');

    await pulsarCerrarSesion();

    expect(await screen.findByRole('alertdialog', { name: '¿Salir ahora?' })).toHaveTextContent(
      'Tienes 2 cambios guardados en este equipo que no se han enviado. Si sales ahora, se perderán.',
    );
    expect(salir).not.toHaveBeenCalled();
  });

  it('esperar no sale, cierra la pregunta y devuelve el foco al boton de la cuenta', async () => {
    await guardar('pendiente');
    await pulsarCerrarSesion();
    await screen.findByRole('alertdialog');

    await usuario.click(screen.getByRole('button', { name: 'Esperar' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(salir).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Abrir el menú de tu cuenta' })).toHaveFocus();
  });

  it('«Salir y perderlos» si sale', async () => {
    await guardar('pendiente');
    await pulsarCerrarSesion();
    await screen.findByRole('alertdialog');

    await usuario.click(screen.getByRole('button', { name: 'Salir y perderlos' }));

    expect(salir).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('sin conexion no se ofrece enviar, y se puede esperar o salir', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await guardar('pendiente');

    await pulsarCerrarSesion();
    await screen.findByRole('alertdialog');

    expect(screen.queryByRole('button', { name: 'Enviarlos ahora' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Esperar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salir y perderlos' })).toBeInTheDocument();
  });

  it('«Enviarlos ahora» envia, y si no queda nada, sale', async () => {
    await guardar('pendiente');
    await pulsarCerrarSesion();
    await screen.findByRole('alertdialog');

    const enviar = elMotorEnviaUna();

    await usuario.click(screen.getByRole('button', { name: 'Enviarlos ahora' }));

    await waitFor(() => {
      expect(salir).toHaveBeenCalledTimes(1);
    });
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('«Enviarlos ahora» con algo que no salio: no sale, y dice cuantos quedan', async () => {
    await guardar('pendiente');
    await guardar('pendiente');
    await pulsarCerrarSesion();
    await screen.findByRole('alertdialog');

    elMotorEnviaUna();

    await usuario.click(screen.getByRole('button', { name: 'Enviarlos ahora' }));

    expect(await screen.findByText(/Tienes 1 cambio guardado/)).toBeInTheDocument();
    expect(salir).not.toHaveBeenCalled();
    // Y se puede volver a intentar.
    expect(screen.getByRole('button', { name: 'Enviarlos ahora' })).toBeInTheDocument();
  });

  it('el menu se cierra al preguntar: no queda detras del dialogo', async () => {
    await guardar('pendiente');
    await pulsarCerrarSesion();
    await screen.findByRole('alertdialog');

    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument();
  });

  it('sin almacen abierto, sale de una vez: no hay nada que perder', async () => {
    cerrarElAlmacenDePrueba();

    await pulsarCerrarSesion();

    await waitFor(() => {
      expect(salir).toHaveBeenCalledTimes(1);
    });
  });
});

describe('la navegacion despues de entrar (SCRUM-182, SCRUM-296)', () => {
  function nombresDe(navegacion: HTMLElement): (string | undefined)[] {
    return within(navegacion)
      .getAllByRole('link')
      .map((enlace) => enlace.textContent?.trim());
  }

  /** Los enlaces que llevan la pastilla que se desliza: la ubicacion de ahora. */
  function conPastilla(navegacion: HTMLElement): (string | undefined)[] {
    return within(navegacion)
      .getAllByRole('link')
      .filter((enlace) => enlace.querySelector('.app__pastilla') !== null)
      .map((enlace) => enlace.textContent.trim());
  }

  describe('la barra de arriba', () => {
    function pintarLaBarra(pagina?: 'actividad' | 'diario') {
      render(
        <SesionContexto.Provider value={sesion()}>
          <MemoryRouter>
            {pagina === undefined ? (
              <BarraSuperior conSecciones />
            ) : (
              <BarraSuperior conSecciones={false} pagina={pagina} />
            )}
          </MemoryRouter>
        </SesionContexto.Provider>,
      );

      return screen.getByRole('navigation', { name: 'Secciones' });
    }

    it('lleva Inicio, Mi actividad y Mi diario, en ese orden y sin «Progreso» (SCRUM-296)', () => {
      expect(nombresDe(pintarLaBarra())).toEqual(['Inicio', 'Mi actividad', 'Mi diario']);
    });

    it('en el panel, Inicio es la ubicacion: lleva la pastilla y se anuncia como tal', () => {
      const barra = pintarLaBarra();

      expect(conPastilla(barra)).toEqual(['Inicio']);
      expect(within(barra).getByRole('link', { name: 'Inicio' })).toHaveAttribute(
        'aria-current',
        'location',
      );
      expect(within(barra).getByRole('link', { name: 'Inicio' })).toHaveAttribute(
        'href',
        '#inicio',
      );
    });

    it('«Mi actividad» lleva a /mi-actividad, sin marcarse como la pagina actual', () => {
      const actividad = within(pintarLaBarra()).getByRole('link', { name: 'Mi actividad' });

      expect(actividad).toHaveAttribute('href', '/mi-actividad');
      expect(actividad).not.toHaveAttribute('aria-current');
    });

    it('«Mi diario» esta a la vista y lleva a /diario, sin marcarse como la pagina actual', () => {
      const diario = within(pintarLaBarra()).getByRole('link', { name: 'Mi diario' });

      expect(diario).toHaveAttribute('href', '/diario');
      expect(diario).not.toHaveAttribute('aria-current');
    });

    it('«Mi diario» lleva la marca para que el tutorial lo senale', () => {
      expect(within(pintarLaBarra()).getByRole('link', { name: 'Mi diario' })).toHaveAttribute(
        'data-tutorial',
        'diario',
      );
    });

    it('el menu de la cuenta ya no lleva «Mi diario»: quedan perfil, pagina principal y salir (SCRUM-296)', async () => {
      pintarLaBarra();

      await userEvent.click(screen.getByRole('button', { name: 'Abrir el menú de tu cuenta' }));

      const menu = document.querySelector<HTMLElement>('.app__menu')!;

      expect(
        within(menu)
          .getAllByRole('link')
          .map((enlace) => enlace.textContent.trim()),
      ).toEqual(['Tu perfil', 'Ir al inicio']);
      expect(within(menu).getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
      // El unico «Mi diario» que queda es el de la barra.
      expect(screen.getAllByRole('link', { name: 'Mi diario' })).toHaveLength(1);
    });

    it('las pastillas de la barra y del dock son la misma pieza (SCRUM-284)', () => {
      const pastilla = pintarLaBarra().querySelector('.app__pastilla');

      expect(pastilla).not.toBeNull();
      // El mismo elemento y la misma clase que usa el dock: un solo estilo para las dos.
      expect(pastilla?.tagName).toBe('SPAN');
    });

    it('sin secciones y fuera de las paginas de la navegacion no lleva ninguna', () => {
      render(
        <SesionContexto.Provider value={sesion()}>
          <MemoryRouter>
            <BarraSuperior conSecciones={false} />
          </MemoryRouter>
        </SesionContexto.Provider>,
      );

      expect(screen.queryByRole('navigation', { name: 'Secciones' })).toBeNull();
    });

    describe.each([
      { pagina: 'actividad', nombre: 'Mi actividad' },
      { pagina: 'diario', nombre: 'Mi diario' },
    ] as const)('dentro de $nombre', ({ pagina, nombre }) => {
      it('lleva los mismos tres enlaces', () => {
        expect(nombresDe(pintarLaBarra(pagina))).toEqual(['Inicio', 'Mi actividad', 'Mi diario']);
      });

      it(`solo «${nombre}» lleva la pastilla (igual que el dock)`, () => {
        expect(conPastilla(pintarLaBarra(pagina))).toEqual([nombre]);
      });

      it(`marca «${nombre}» como la pagina actual y lleva a las otras por su direccion`, () => {
        const barra = pintarLaBarra(pagina);

        expect(within(barra).getByRole('link', { name: nombre })).toHaveAttribute(
          'aria-current',
          'page',
        );
        expect(within(barra).getByRole('link', { name: 'Inicio' })).toHaveAttribute(
          'href',
          '/panel#inicio',
        );
        // Ninguna otra esta marcada: solo se esta en una pagina.
        expect(
          within(barra)
            .getAllByRole('link')
            .filter((enlace) => enlace.hasAttribute('aria-current')),
        ).toHaveLength(1);
      });
    });
  });

  describe('el dock del movil', () => {
    function pintarElDock(pagina?: 'actividad' | 'diario') {
      render(
        <MemoryRouter>
          {pagina === undefined ? <NavegacionInferior /> : <NavegacionInferior pagina={pagina} />}
        </MemoryRouter>,
      );

      return screen.getByRole('navigation', { name: 'Secciones' });
    }

    it('lleva Inicio, Mi actividad y Mi diario, sin «Progreso» ni «Explorar»', () => {
      expect(nombresDe(pintarElDock())).toEqual(['Inicio', 'Mi actividad', 'Mi diario']);
    });

    it('su pastilla es la misma pieza que la de la barra de arriba (SCRUM-284)', () => {
      expect(pintarElDock().querySelector('.app__pastilla')).not.toBeNull();
    });

    it('en el panel, Inicio es la ubicacion y las otras dos no estan marcadas', () => {
      const dock = pintarElDock();

      expect(conPastilla(dock)).toEqual(['Inicio']);
      expect(within(dock).getByRole('link', { name: 'Inicio' })).toHaveAttribute(
        'aria-current',
        'location',
      );
      expect(within(dock).getByRole('link', { name: 'Mi actividad' })).not.toHaveAttribute(
        'aria-current',
      );
      expect(within(dock).getByRole('link', { name: 'Mi diario' })).not.toHaveAttribute(
        'aria-current',
      );
    });

    it('«Mi diario» lleva la marca para que el tutorial lo senale en el movil (SCRUM-201)', () => {
      expect(within(pintarElDock()).getByRole('link', { name: 'Mi diario' })).toHaveAttribute(
        'data-tutorial',
        'diario',
      );
    });

    describe.each([
      { pagina: 'actividad', nombre: 'Mi actividad', ruta: '/mi-actividad' },
      { pagina: 'diario', nombre: 'Mi diario', ruta: '/diario' },
    ] as const)('dentro de $nombre', ({ pagina, nombre, ruta }) => {
      it(`marca «${nombre}» y lleva al panel por Inicio`, () => {
        const dock = pintarElDock(pagina);

        expect(within(dock).getByRole('link', { name: nombre })).toHaveAttribute(
          'aria-current',
          'page',
        );
        expect(within(dock).getByRole('link', { name: nombre })).toHaveAttribute('href', ruta);
        expect(within(dock).getByRole('link', { name: 'Inicio' })).toHaveAttribute(
          'href',
          '/panel#inicio',
        );
        expect(conPastilla(dock)).toEqual([nombre]);
        // Ninguna seccion del panel esta «a la vista» desde otra pagina.
        expect(
          within(dock)
            .getAllByRole('link')
            .filter((enlace) => enlace.getAttribute('aria-current') === 'location'),
        ).toEqual([]);
      });
    });
  });
});

describe('la llama de la racha en la barra (SCRUM-186)', () => {
  function pintarConCuenta() {
    const valor = { ...sesion(), sesion: { user: { id: 'cuenta-1', email: 'ana@ejemplo.test' } } };

    render(
      <SesionContexto.Provider value={valor as unknown as EstadoDeSesion}>
        <MemoryRouter>
          <BarraSuperior conSecciones={false} />
        </MemoryRouter>
      </SesionContexto.Provider>,
    );
  }

  it('va a la izquierda del indicador de conexion', async () => {
    pintarConCuenta();

    const llama = await screen.findByRole('button', { name: /Tu racha: 5 días/ });
    const conexion = document.querySelector('.conexion');

    expect(conexion).not.toBeNull();
    // `conexion` viene despues de la llama en el documento: esta a su derecha.
    expect(
      llama.compareDocumentPosition(conexion!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('va antes que el selector de tema y que la cuenta', async () => {
    pintarConCuenta();

    const llama = await screen.findByRole('button', { name: /Tu racha/ });
    const cuenta = screen.getByRole('button', { name: 'Abrir el menú de tu cuenta' });

    expect(llama.compareDocumentPosition(cuenta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

/**
 * Dentro del perfil, el menu de la cuenta no repite «Tu perfil» (SCRUM-314): esa opcion se
 * reemplaza por la de volver al panel. La barra es fija, asi que quien baja mucho en el perfil la
 * alcanza sin subir a mano.
 */
describe('el menu de la cuenta dentro del perfil (SCRUM-314)', () => {
  const usuario = userEvent.setup({ delay: null });

  beforeEach(() => {
    foto.url = null;
  });

  async function abrirElMenuEn(ruta: string): Promise<HTMLElement> {
    render(
      <SesionContexto.Provider value={sesion()}>
        <MemoryRouter initialEntries={[ruta]}>
          <BarraSuperior conSecciones={false} />
        </MemoryRouter>
      </SesionContexto.Provider>,
    );

    await usuario.click(screen.getByRole('button', { name: 'Abrir el menú de tu cuenta' }));

    return document.querySelector<HTMLElement>('.app__menu')!;
  }

  function textosDeLosEnlaces(menu: HTMLElement): string[] {
    return within(menu)
      .getAllByRole('link')
      .map((enlace) => enlace.textContent.trim());
  }

  it('en el perfil, «Tu perfil» se reemplaza por «Ir a mi panel»', async () => {
    const menu = await abrirElMenuEn(RUTAS.PERFIL);

    expect(textosDeLosEnlaces(menu)).toEqual(['Ir a mi panel', 'Ir al inicio']);
    expect(within(menu).queryByRole('link', { name: 'Tu perfil' })).toBeNull();
  });

  it('«Ir a mi panel» lleva al panel', async () => {
    const menu = await abrirElMenuEn(RUTAS.PERFIL);

    expect(within(menu).getByRole('link', { name: 'Ir a mi panel' })).toHaveAttribute(
      'href',
      RUTAS.PANEL,
    );
  });

  it('en el perfil el menu conserva el correo, la pagina principal y «Cerrar sesión»', async () => {
    const menu = await abrirElMenuEn(RUTAS.PERFIL);

    expect(within(menu).getByText('ana@ejemplo.test')).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute(
      'href',
      RUTAS.INICIO,
    );
    expect(within(menu).getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
  });

  it.each([
    ['con una barra al final', `${RUTAS.PERFIL}/`],
    ['con mayusculas', '/Perfil'],
  ])('se reconoce el perfil %s', async (_caso, ruta) => {
    const menu = await abrirElMenuEn(ruta);

    expect(within(menu).getByRole('link', { name: 'Ir a mi panel' })).toBeInTheDocument();
    expect(within(menu).queryByRole('link', { name: 'Tu perfil' })).toBeNull();
  });

  it.each([
    ['el panel', RUTAS.PANEL],
    ['Mi actividad', RUTAS.MI_ACTIVIDAD],
    ['Mi diario', RUTAS.DIARIO],
    ['la portada', RUTAS.INICIO],
  ])('en %s sigue ofreciendo «Tu perfil» y no «Ir a mi panel»', async (_pantalla, ruta) => {
    const menu = await abrirElMenuEn(ruta);

    expect(textosDeLosEnlaces(menu)).toEqual(['Tu perfil', 'Ir al inicio']);
    expect(within(menu).getByRole('link', { name: 'Tu perfil' })).toHaveAttribute(
      'href',
      RUTAS.PERFIL,
    );
    expect(within(menu).queryByRole('link', { name: 'Ir a mi panel' })).toBeNull();
  });

  it('una ruta que solo empieza como el perfil no cuenta como el perfil', async () => {
    const menu = await abrirElMenuEn('/perfiles');

    expect(within(menu).getByRole('link', { name: 'Tu perfil' })).toBeInTheDocument();
  });
});
