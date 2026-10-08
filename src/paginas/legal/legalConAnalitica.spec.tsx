import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProveedorDeAnalitica } from '../../analitica/ProveedorDeAnalitica.tsx';
import { olvidarLaAnalitica } from '../../pruebas/analitica.ts';
import { RUTAS } from '../../rutas/rutas.ts';
import { TEXTOS_REVISADOS } from './datosLegales.ts';
import { Cookies } from './Cookies.tsx';
import { Privacidad } from './Privacidad.tsx';

/**
 * Los documentos legales cuentan la analitica solo donde existe (SCRUM-161).
 *
 * Decir que se mide cuando no se mide es tan falso como decir que no se mide
 * cuando si. Aqui se comprueba que los dos casos dicen lo cierto, y que lo que dice
 * el documento coincide con lo que hace `ga4.ts`: las mismas cookies, la misma
 * duracion, y que lo que no se cuenta no se cuenta.
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

function pintar(pagina: React.ReactNode, id: string | null, ruta: string = RUTAS.COOKIES) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <ProveedorDeAnalitica idDeMedicion={id}>{pagina}</ProveedorDeAnalitica>
    </MemoryRouter>,
  );
}

describe('Cookies, con analitica', () => {
  it('dice la verdad: sin publicidad, y con medicion solo si se acepta', () => {
    pintar(<Cookies />, ID);

    const seccion = screen.getByRole('region', { name: /qué usamos/i });

    expect(seccion).toHaveTextContent(/no usa cookies de publicidad/i);
    expect(seccion).toHaveTextContent(/solo si tú lo aceptas, cuenta las visitas/i);
    // La frase de cuando no habia herramientas ya no es cierta.
    expect(document.body).not.toHaveTextContent(/hoy no tiene herramientas de analítica/i);
    expect(document.body).not.toHaveTextContent(/no usa cookies de publicidad ni de seguimiento/i);
  });

  it('tiene su seccion, con lo que se cuenta, lo que no, quien lo recibe y cuanto dura', () => {
    pintar(<Cookies />, ID);

    const seccion = screen.getByRole('region', { name: /analítica \(opcional\)/i });

    expect(seccion).toHaveTextContent(/Google Analytics 4/);
    expect(seccion).toHaveTextContent(/qué cuenta:.*una visita por pantalla/i);
    expect(seccion).toHaveTextContent(/qué no cuenta:.*tu cuenta.*tu diario/i);
    expect(seccion).toHaveTextContent(/google llc/i);
    expect(seccion).toHaveTextContent(/las cookies duran 90 días/i);
    expect(seccion).toHaveTextContent(/2 meses/i);
  });

  it('lo que falta confirmar queda marcado como por definir, no escrito como si ya fuera cierto', () => {
    pintar(<Cookies />, ID);

    const seccion = screen.getByRole('region', { name: /analítica \(opcional\)/i });
    const pendientes = seccion.querySelectorAll('mark.legal__pendiente');

    expect(pendientes.length).toBeGreaterThan(0);
    expect(TEXTOS_REVISADOS).toBe(false);
  });

  it('el indice lleva a la seccion', () => {
    pintar(<Cookies />, ID);

    const indice = screen.getByRole('navigation', { name: 'En este documento' });

    expect(within(indice).getByRole('link', { name: 'Analítica (opcional)' })).toHaveAttribute(
      'href',
      '#analitica',
    );
    expect(document.getElementById('analitica')).not.toBeNull();
  });

  it('la tabla incluye las cookies de Google con el nombre que de verdad ponen', () => {
    pintar(<Cookies />, ID);

    const tabla = screen.getByRole('table', {
      name: /elementos que vsd health guarda en tu navegador/i,
    });

    // `_ga_` lleva el identificador sin el «G-».
    expect(within(tabla).getByText('_ga')).toBeInTheDocument();
    expect(within(tabla).getByText('_ga_TEST123456')).toBeInTheDocument();
    expect(within(tabla).getByText('vsd.analitica')).toBeInTheDocument();
    expect(within(tabla).getAllByText('De analítica, solo si aceptas')).toHaveLength(2);
  });

  it('un enlace con #analitica lleva a la seccion', () => {
    const desplazar = vi.spyOn(Element.prototype, 'scrollIntoView');

    pintar(<Cookies />, ID, `${RUTAS.COOKIES}#analitica`);

    const destino = document.getElementById('analitica');

    expect(desplazar).toHaveBeenCalled();
    expect(desplazar.mock.contexts).toContain(destino);
  });

  it('un fragmento mal escrito no tumba la pagina', () => {
    expect(() => pintar(<Cookies />, ID, `${RUTAS.COOKIES}#%E0%A4%A`)).not.toThrow();
  });

  it('se decide desde aqui con dos botones iguales, y se ve lo que hay elegido', async () => {
    pintar(<Cookies />, ID);

    const seccion = screen.getByRole('region', { name: /analítica \(opcional\)/i });

    expect(seccion).toHaveTextContent(/ahora mismo:\s*todavía no has elegido/i);

    const aceptar = within(seccion).getByRole('button', { name: 'Aceptar' });
    const rechazar = within(seccion).getByRole('button', { name: 'Rechazar' });

    expect(aceptar.className).toBe(rechazar.className);

    await usuario.click(aceptar);

    expect(seccion).toHaveTextContent(/ahora mismo:\s*aceptada/i);
    expect(document.head.querySelectorAll('script[src*="googletagmanager.com"]')).toHaveLength(1);

    await usuario.click(rechazar);

    expect(seccion).toHaveTextContent(/ahora mismo:\s*rechazada/i);
    expect(window['ga-disable-G-TEST123456']).toBe(true);
  });
});

describe('Cookies, sin analitica', () => {
  it('sigue diciendo, y es cierto, que no hay herramientas de analitica', () => {
    pintar(<Cookies />, null);

    expect(screen.getByText(/no usa cookies de publicidad ni de seguimiento/i)).toBeInTheDocument();
    expect(screen.getByText(/hoy no tiene herramientas de analítica/i)).toBeInTheDocument();
  });

  it('no inventa una seccion, ni cookies, ni botones', () => {
    pintar(<Cookies />, null);

    expect(screen.queryByRole('region', { name: /analítica/i })).not.toBeInTheDocument();
    expect(screen.queryByText('_ga')).not.toBeInTheDocument();
    expect(screen.queryByText('vsd.analitica')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aceptar' })).not.toBeInTheDocument();
    expect(document.getElementById('analitica')).toBeNull();
  });
});

describe('Aviso de privacidad', () => {
  it('con analitica, nombra a Google Analytics como proveedor y explica sus datos', () => {
    pintar(<Privacidad />, ID, RUTAS.PRIVACIDAD);

    const proveedores = screen.getByRole('region', { name: /con quién los compartimos/i });

    expect(within(proveedores).getByText('Google Analytics')).toBeInTheDocument();
    expect(within(proveedores).getByRole('link', { name: 'página de cookies' })).toHaveAttribute(
      'href',
      '/cookies#analitica',
    );

    expect(
      screen.getByRole('heading', { level: 3, name: 'Los de la analítica' }),
    ).toBeInTheDocument();
  });

  it('sin analitica no menciona una herramienta que no existe', () => {
    pintar(<Privacidad />, null, RUTAS.PRIVACIDAD);

    expect(screen.queryByText('Google Analytics')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Los de la analítica' })).not.toBeInTheDocument();
  });
});
