import type { Session } from '@supabase/supabase-js';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { abrirUnAlmacenDePrueba, cerrarElAlmacenDePrueba } from '../../pruebas/almacenDePrueba.ts';
import { rachaDePrueba } from '../../pruebas/rachaDePrueba.ts';
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

describe('la navegacion despues de entrar (SCRUM-182)', () => {
  function nombresDe(navegacion: HTMLElement): (string | undefined)[] {
    return within(navegacion)
      .getAllByRole('link')
      .map((enlace) => enlace.textContent?.trim());
  }

  describe('la barra de arriba', () => {
    function pintarLaBarra() {
      render(
        <SesionContexto.Provider value={sesion()}>
          <MemoryRouter>
            <BarraSuperior conSecciones />
          </MemoryRouter>
        </SesionContexto.Provider>,
      );

      return screen.getByRole('navigation', { name: 'Secciones' });
    }

    it('lleva Inicio, Progreso y Mi diario, en ese orden y sin «Explorar» (SCRUM-249)', () => {
      expect(nombresDe(pintarLaBarra())).toEqual(['Inicio', 'Progreso', 'Mi diario']);
    });

    it('«Mi diario» esta a la vista y lleva a /diario, sin marcarse como la pagina actual', () => {
      const barra = pintarLaBarra();
      const diario = within(barra).getByRole('link', { name: 'Mi diario' });

      expect(diario).toHaveAttribute('href', '/diario');
      expect(diario).not.toHaveAttribute('aria-current');
    });

    it('«Mi diario» lleva la marca para que el tutorial lo senale', () => {
      const barra = pintarLaBarra();

      expect(within(barra).getByRole('link', { name: 'Mi diario' })).toHaveAttribute(
        'data-tutorial',
        'diario',
      );
    });

    it('«Mi diario» sigue a un toque tambien en el menu de la cuenta', async () => {
      pintarLaBarra();

      await userEvent.click(screen.getByRole('button', { name: 'Abrir el menú de tu cuenta' }));

      // Dos enlaces con ese nombre: el de la barra y el del menu.
      const enlaces = screen.getAllByRole('link', { name: 'Mi diario' });

      expect(enlaces).toHaveLength(2);
      expect(enlaces.map((enlace) => enlace.getAttribute('href'))).toEqual(['/diario', '/diario']);
    });

    it('marca la seccion a la vista con la misma pastilla que el dock del movil (SCRUM-284)', async () => {
      const barra = pintarLaBarra();
      const marcada = () =>
        within(barra)
          .getAllByRole('link')
          .filter((enlace) => enlace.querySelector('.app__pastilla') !== null);

      // Al abrir, la que esta a la vista es Inicio: lleva la pastilla y se anuncia como ubicacion.
      expect(marcada().map((enlace) => enlace.textContent.trim())).toEqual(['Inicio']);
      expect(within(barra).getByRole('link', { name: 'Inicio' })).toHaveAttribute(
        'aria-current',
        'location',
      );

      // Al pulsar otra seccion la pastilla viaja alli, igual que en el dock.
      await userEvent.click(within(barra).getByRole('link', { name: 'Progreso' }));

      expect(marcada().map((enlace) => enlace.textContent.trim())).toEqual(['Progreso']);
      expect(within(barra).getByRole('link', { name: 'Inicio' })).not.toHaveAttribute(
        'aria-current',
      );
      expect(within(barra).getByRole('link', { name: 'Progreso' })).toHaveAttribute(
        'aria-current',
        'location',
      );
    });

    it('las pastillas de la barra y del dock son la misma pieza', () => {
      const barra = pintarLaBarra();
      const pastilla = barra.querySelector('.app__pastilla');

      expect(pastilla).not.toBeNull();
      // El mismo elemento y la misma clase que usa el dock: un solo estilo para las dos.
      expect(pastilla?.tagName).toBe('SPAN');
    });

    it('sin secciones y fuera del diario no lleva ninguna navegacion', () => {
      render(
        <SesionContexto.Provider value={sesion()}>
          <MemoryRouter>
            <BarraSuperior conSecciones={false} />
          </MemoryRouter>
        </SesionContexto.Provider>,
      );

      expect(screen.queryByRole('navigation', { name: 'Secciones' })).toBeNull();
    });
  });

  describe('la barra de arriba dentro de Mi diario (SCRUM-249)', () => {
    function pintarLaBarraDelDiario() {
      render(
        <SesionContexto.Provider value={sesion()}>
          <MemoryRouter>
            <BarraSuperior conSecciones={false} enDiario />
          </MemoryRouter>
        </SesionContexto.Provider>,
      );

      return screen.getByRole('navigation', { name: 'Secciones' });
    }

    it('lleva los mismos tres enlaces', () => {
      expect(nombresDe(pintarLaBarraDelDiario())).toEqual(['Inicio', 'Progreso', 'Mi diario']);
    });

    it('«Mi diario» lleva la pastilla y las otras dos no (igual que el dock)', () => {
      const barra = pintarLaBarraDelDiario();
      const conPastilla = within(barra)
        .getAllByRole('link')
        .filter((enlace) => enlace.querySelector('.app__pastilla') !== null);

      expect(conPastilla.map((enlace) => enlace.textContent.trim())).toEqual(['Mi diario']);
    });

    it('marca «Mi diario» como la pagina actual y lleva al panel por las otras dos', () => {
      const barra = pintarLaBarraDelDiario();

      expect(within(barra).getByRole('link', { name: 'Mi diario' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(within(barra).getByRole('link', { name: 'Inicio' })).toHaveAttribute(
        'href',
        '/panel#inicio',
      );
      expect(within(barra).getByRole('link', { name: 'Progreso' })).toHaveAttribute(
        'href',
        '/panel#progreso',
      );
      // Ninguna otra esta marcada: solo se esta en una pagina.
      expect(
        within(barra)
          .getAllByRole('link')
          .filter((enlace) => enlace.getAttribute('aria-current') === 'page'),
      ).toHaveLength(1);
    });
  });

  describe('el dock del movil', () => {
    function pintarElDock(enDiario?: boolean) {
      render(
        <MemoryRouter>
          {enDiario === undefined ? (
            <NavegacionInferior />
          ) : (
            <NavegacionInferior enDiario={enDiario} />
          )}
        </MemoryRouter>,
      );

      return screen.getByRole('navigation', { name: 'Secciones' });
    }

    it('lleva Inicio, Progreso y Mi diario, sin «Explorar»', () => {
      expect(nombresDe(pintarElDock())).toEqual(['Inicio', 'Progreso', 'Mi diario']);
    });

    it('su pastilla es la misma pieza que la de la barra de arriba (SCRUM-284)', () => {
      const dock = pintarElDock();

      expect(dock.querySelector('.app__pastilla')).not.toBeNull();
    });

    it('en el panel, «Mi diario» no esta marcado como la pagina actual', () => {
      const dock = pintarElDock();

      expect(within(dock).getByRole('link', { name: 'Mi diario' })).not.toHaveAttribute(
        'aria-current',
      );
    });

    it('dentro del Diario marca «Mi diario» y lleva al panel por las otras dos', () => {
      const dock = pintarElDock(true);

      expect(within(dock).getByRole('link', { name: 'Mi diario' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(within(dock).getByRole('link', { name: 'Inicio' })).toHaveAttribute(
        'href',
        '/panel#inicio',
      );
      expect(within(dock).getByRole('link', { name: 'Progreso' })).toHaveAttribute(
        'href',
        '/panel#progreso',
      );
      // Ninguna seccion del panel esta «a la vista» desde otra pagina.
      expect(
        within(dock)
          .getAllByRole('link')
          .filter((enlace) => enlace.getAttribute('aria-current') === 'location'),
      ).toEqual([]);
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
