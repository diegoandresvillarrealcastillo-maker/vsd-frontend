import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EnlacesLegales } from '../paginas/legal/EnlacesLegales.tsx';
import { llamadasAGtag, olvidarLaAnalitica } from '../pruebas/analitica.ts';
import { BannerDeAnalitica } from './BannerDeAnalitica.tsx';
import { CLAVE_DEL_CONSENTIMIENTO, VERSION_DEL_CONSENTIMIENTO } from './consentimiento.ts';
import { ProveedorDeAnalitica } from './ProveedorDeAnalitica.tsx';

/**
 * Las reglas del consentimiento, probadas de punta a punta (SCRUM-161).
 *
 * Aqui se monta el proveedor, el banner y el pie de verdad y se mira lo que
 * importa: que antes de aceptar no exista nada de Google, que rechazar sea tan facil
 * como aceptar, que retirar el permiso detenga el envio, y que a Google nunca le
 * llegue la direccion real de una pantalla.
 */
const ID = 'G-TEST123456';

let usuario: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  usuario = userEvent.setup({ delay: null });
  olvidarLaAnalitica(ID);
});

afterEach(() => {
  olvidarLaAnalitica(ID);
  vi.restoreAllMocks();
});

function Pantalla() {
  return (
    <>
      <main id="contenido" tabIndex={-1}>
        <h1>Una pantalla</h1>
        <Link to="/modulo/ansiedad">Ir a un módulo</Link>
        <Link to="/actividad/9f1c-id-secreto">Ir a una actividad</Link>
        <Link to="/panel?correo=ana@ejemplo.test#privado">Ir al panel</Link>
      </main>
      <EnlacesLegales />
    </>
  );
}

function pintar({ ruta = '/', id = ID }: { ruta?: string; id?: string | null } = {}) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <ProveedorDeAnalitica idDeMedicion={id}>
        <BannerDeAnalitica />
        <Routes>
          <Route path="*" element={<Pantalla />} />
        </Routes>
      </ProveedorDeAnalitica>
    </MemoryRouter>,
  );
}

const banner = () => screen.queryByRole('region', { name: /qué pantallas se usan/i });

/** Las pantallas que Google Analytics recibio como visitas, en orden. */
function visitas(): string[] {
  return llamadasAGtag()
    .filter(([orden, nombre]) => orden === 'event' && nombre === 'page_view')
    .map(([, , datos]) => (datos as { page_path: string }).page_path);
}

function scriptsDeGoogle() {
  return document.head.querySelectorAll('script[src*="googletagmanager.com"]');
}

describe('sin identificador de medicion', () => {
  it('no hay banner, ni script, ni aviso para lectores de pantalla', () => {
    pintar({ id: null });

    expect(banner()).not.toBeInTheDocument();
    expect(scriptsDeGoogle()).toHaveLength(0);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(window.dataLayer).toBeUndefined();
  });

  it('el pie no ofrece preferencias de una analitica que no existe', () => {
    pintar({ id: null });

    expect(screen.queryByRole('button', { name: /preferencias de analítica/i })).toBeNull();
  });

  it('nada se guarda en el navegador', async () => {
    pintar({ id: null });

    await usuario.click(screen.getByRole('link', { name: 'Ir a un módulo' }));

    expect(window.localStorage.getItem(CLAVE_DEL_CONSENTIMIENTO)).toBeNull();
  });
});

describe('antes de decidir', () => {
  it('pregunta, y no existe nada de Google: ni script, ni datos, ni cookies', () => {
    pintar();

    expect(banner()).toBeInTheDocument();
    expect(scriptsDeGoogle()).toHaveLength(0);
    expect(window.dataLayer).toBeUndefined();
    expect(window.gtag).toBeUndefined();
    expect(document.cookie).toBe('');
  });

  it('navegar sin contestar sigue sin mandar nada', async () => {
    pintar();

    await usuario.click(screen.getByRole('link', { name: 'Ir a un módulo' }));
    await usuario.click(screen.getByRole('link', { name: 'Ir al panel' }));

    expect(window.dataLayer).toBeUndefined();
    expect(scriptsDeGoogle()).toHaveLength(0);
  });

  it('aceptar y rechazar son el mismo boton: misma clase, mismo tamano, mismo nivel', () => {
    pintar();

    const aceptar = screen.getByRole('button', { name: 'Aceptar' });
    const rechazar = screen.getByRole('button', { name: 'Rechazar' });

    expect(aceptar.className).toBe(rechazar.className);
    expect(aceptar.tagName).toBe(rechazar.tagName);
    expect(aceptar.parentElement).toBe(rechazar.parentElement);
    // Rechazar no esta detras de un enlace ni de un segundo paso.
    expect(rechazar).toBeVisible();
  });

  it('no hay casillas marcadas de antemano', () => {
    pintar();

    expect(within(banner()!).queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('no roba el foco al aparecer: quien lee o escribe no se interrumpe', () => {
    pintar();

    expect(document.body).toHaveFocus();
  });

  it('dice lo que se cuenta y lo que no, y lleva a la pagina de cookies', () => {
    pintar();

    const region = banner()!;

    expect(region).toHaveTextContent(/no sabe quién eres/i);
    expect(region).toHaveTextContent(/no ve tu cuenta, ni tus respuestas, ni tu diario/i);
    expect(region).toHaveTextContent(/no se usa para anuncios/i);
    expect(within(region).getByRole('link', { name: 'Más información' })).toHaveAttribute(
      'href',
      '/cookies#analitica',
    );
  });

  it('en la primera visita no se puede cerrar sin decidir: Escape no hace nada', async () => {
    pintar();

    await usuario.keyboard('{Escape}');
    await usuario.tab();
    await usuario.keyboard('{Escape}');

    expect(banner()).toBeInTheDocument();
  });

  it('esta entre lo primero que se alcanza con el teclado, no al final de la pagina', async () => {
    pintar();

    await usuario.tab();

    expect(banner()).toContainElement(document.activeElement as HTMLElement);
  });
});

describe('rechazar', () => {
  it('cierra el banner, recuerda la eleccion y no toca a Google', async () => {
    pintar();

    await usuario.click(screen.getByRole('button', { name: 'Rechazar' }));

    expect(banner()).not.toBeInTheDocument();
    expect(scriptsDeGoogle()).toHaveLength(0);
    expect(window.dataLayer).toBeUndefined();
    expect(document.cookie).toBe('');
    expect(screen.getByRole('status')).toHaveTextContent(/no contaremos tus visitas/i);
  });

  it('al volver no se vuelve a preguntar, y sigue sin existir nada de Google', async () => {
    const primera = pintar();

    await usuario.click(screen.getByRole('button', { name: 'Rechazar' }));
    primera.unmount();

    pintar();

    expect(banner()).not.toBeInTheDocument();
    expect(scriptsDeGoogle()).toHaveLength(0);
    expect(window.dataLayer).toBeUndefined();
  });

  it('navegar despues de rechazar no manda ninguna visita', async () => {
    pintar();

    await usuario.click(screen.getByRole('button', { name: 'Rechazar' }));
    await usuario.click(screen.getByRole('link', { name: 'Ir a un módulo' }));

    expect(window.dataLayer).toBeUndefined();
  });
});

describe('aceptar', () => {
  it('descarga el script de Google y manda la visita de la pantalla actual', async () => {
    pintar();

    await usuario.click(screen.getByRole('button', { name: 'Aceptar' }));

    expect(banner()).not.toBeInTheDocument();
    expect(scriptsDeGoogle()).toHaveLength(1);
    expect(visitas()).toEqual(['/']);
    expect(screen.getByRole('status')).toHaveTextContent(/contaremos las visitas/i);
  });

  it('cada pantalla es una visita, y siempre con la plantilla, nunca con la direccion', async () => {
    pintar();

    await usuario.click(screen.getByRole('button', { name: 'Aceptar' }));
    await usuario.click(screen.getByRole('link', { name: 'Ir a un módulo' }));
    await usuario.click(screen.getByRole('link', { name: 'Ir a una actividad' }));
    await usuario.click(screen.getByRole('link', { name: 'Ir al panel' }));

    expect(visitas()).toEqual(['/', '/modulo/:modulo', '/actividad/:id', '/panel']);

    // Ni el modulo, ni el identificador, ni la consulta, ni el fragmento llegaron.
    const todo = JSON.stringify(llamadasAGtag());

    for (const prohibido of ['ansiedad', 'id-secreto', 'ana@ejemplo.test', 'privado', 'correo=']) {
      expect(todo, prohibido).not.toContain(prohibido);
    }
  });

  it('dos modulos distintos son dos visitas a la misma plantilla', async () => {
    pintar({ ruta: '/modulo/ansiedad' });

    await usuario.click(screen.getByRole('button', { name: 'Aceptar' }));

    expect(visitas()).toEqual(['/modulo/:modulo']);
  });

  it('una sola visita por pantalla, aunque el efecto corra dos veces', async () => {
    pintar();

    await usuario.click(screen.getByRole('button', { name: 'Aceptar' }));
    await usuario.click(screen.getByRole('link', { name: 'Ir al panel' }));

    expect(visitas().filter((visita) => visita === '/panel')).toHaveLength(1);
  });

  it('al volver, con la eleccion recordada, mide sin volver a preguntar', () => {
    window.localStorage.setItem(
      CLAVE_DEL_CONSENTIMIENTO,
      JSON.stringify({
        version: VERSION_DEL_CONSENTIMIENTO,
        decision: 'aceptada',
        en: '2026-10-01T00:00:00.000Z',
      }),
    );

    pintar({ ruta: '/panel' });

    expect(banner()).not.toBeInTheDocument();
    expect(scriptsDeGoogle()).toHaveLength(1);
    expect(visitas()).toEqual(['/panel']);
  });
});

describe('cambiar de idea', () => {
  async function aceptada() {
    pintar();
    await usuario.click(screen.getByRole('button', { name: 'Aceptar' }));
  }

  it('el pie ofrece volver a decidir, y el banner dice que hay ahora', async () => {
    await aceptada();

    await usuario.click(screen.getByRole('button', { name: 'Preferencias de analítica' }));

    expect(banner()).toHaveTextContent(/ahora mismo: aceptada/i);
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
  });

  it('retirar el permiso detiene el envio en el acto y borra las cookies', async () => {
    await aceptada();

    document.cookie = '_ga=GA1.1.1.1; Path=/';
    document.cookie = '_ga_TEST123456=GS1.1.1; Path=/';

    await usuario.click(screen.getByRole('button', { name: 'Preferencias de analítica' }));
    await usuario.click(screen.getByRole('button', { name: 'Rechazar' }));

    expect(window['ga-disable-G-TEST123456']).toBe(true);
    expect(document.cookie).not.toContain('_ga');
    expect(llamadasAGtag().at(-1)).toEqual(['consent', 'update', { analytics_storage: 'denied' }]);

    const antes = visitas().length;

    await usuario.click(screen.getByRole('link', { name: 'Ir a un módulo' }));

    expect(visitas()).toHaveLength(antes);
  });

  it('volver a aceptar reanuda la medicion sin descargar el script otra vez', async () => {
    await aceptada();

    await usuario.click(screen.getByRole('button', { name: 'Preferencias de analítica' }));
    await usuario.click(screen.getByRole('button', { name: 'Rechazar' }));
    await usuario.click(screen.getByRole('button', { name: 'Preferencias de analítica' }));
    await usuario.click(screen.getByRole('button', { name: 'Aceptar' }));
    await usuario.click(screen.getByRole('link', { name: 'Ir a un módulo' }));

    expect(scriptsDeGoogle()).toHaveLength(1);
    expect(window['ga-disable-G-TEST123456']).toBe(false);
    expect(visitas().at(-1)).toBe('/modulo/:modulo');
  });

  it('cerrar el banner reabierto no cambia lo elegido', async () => {
    await aceptada();

    await usuario.click(screen.getByRole('button', { name: 'Preferencias de analítica' }));
    await usuario.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(banner()).not.toBeInTheDocument();
    // Sigue aceptada: Google Analytics no se silencio.
    expect(window['ga-disable-G-TEST123456']).not.toBe(true);
    expect(JSON.parse(window.localStorage.getItem(CLAVE_DEL_CONSENTIMIENTO) ?? '{}')).toMatchObject(
      {
        decision: 'aceptada',
      },
    );
  });

  it('Escape cierra el banner reabierto sin cambiar nada', async () => {
    await aceptada();

    await usuario.click(screen.getByRole('button', { name: 'Preferencias de analítica' }));
    await usuario.keyboard('{Escape}');

    expect(banner()).not.toBeInTheDocument();
  });

  it('al cerrar el foco vuelve al boton del pie que lo abrio', async () => {
    await aceptada();

    const preferencias = screen.getByRole('button', { name: 'Preferencias de analítica' });

    await usuario.click(preferencias);
    await usuario.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(preferencias).toHaveFocus();
  });

  it('decidir en la primera visita lleva el foco al contenido, no lo deja perdido', async () => {
    pintar();

    await usuario.click(screen.getByRole('button', { name: 'Rechazar' }));

    expect(screen.getByRole('main')).toHaveFocus();
  });
});

describe('la decision de una version anterior', () => {
  it('ya no vale: se vuelve a preguntar y no se mide', () => {
    window.localStorage.setItem(
      CLAVE_DEL_CONSENTIMIENTO,
      JSON.stringify({
        version: VERSION_DEL_CONSENTIMIENTO - 1,
        decision: 'aceptada',
        en: '2025-01-01T00:00:00.000Z',
      }),
    );

    pintar();

    expect(banner()).toBeInTheDocument();
    expect(scriptsDeGoogle()).toHaveLength(0);
    expect(window.dataLayer).toBeUndefined();
  });
});

describe('si el navegador no deja guardar', () => {
  it('se puede decidir igual para esta visita, y la proxima se pregunta otra vez', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('lleno', 'QuotaExceededError');
    });

    const primera = pintar();

    await usuario.click(screen.getByRole('button', { name: 'Rechazar' }));

    expect(banner()).not.toBeInTheDocument();

    primera.unmount();
    pintar();

    expect(banner()).toBeInTheDocument();
  });

  it('si ni siquiera se puede leer, se pregunta y no se mide', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError');
    });

    pintar();

    expect(banner()).toBeInTheDocument();
    expect(window.dataLayer).toBeUndefined();
  });
});
