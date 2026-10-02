import type { Session } from '@supabase/supabase-js';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { App } from './App.tsx';
import { RUTAS } from './rutas/rutas.ts';
import { SesionContexto, type EstadoDeSesion } from './sesion/SesionContexto.ts';

/**
 * Se construye el estado a mano en vez de levantar el proveedor, igual que en
 * las pruebas de las pantallas: asi esto habla del mapa de rutas y no de
 * Supabase ni de la red.
 */
function estado(parcial: Partial<EstadoDeSesion> = {}): EstadoDeSesion {
  const vacio = vi.fn().mockResolvedValue({ ok: true });

  return {
    sesion: null,
    cargando: false,
    correo: null,
    registrarse: vacio,
    entrar: vacio,
    entrarConGoogle: vacio,
    pedirRecuperacion: vacio,
    cambiarContrasena: vacio,
    salir: vi.fn(),
    ...parcial,
  };
}

/**
 * Una sesion de mentira.
 *
 * Solo hace falta que no sea `null`: ninguna guarda mira dentro. Se fuerza el
 * tipo porque construir un `Session` entero —con su token, su usuario y sus
 * fechas— para comprobar un `if` seria ruido.
 */
const SESION = { access_token: 'de-mentira' } as unknown as Session;

function pintar(ruta: string, valor: EstadoDeSesion = estado()) {
  return render(
    <SesionContexto.Provider value={valor}>
      <MemoryRouter initialEntries={[ruta]}>
        <App />
      </MemoryRouter>
    </SesionContexto.Provider>,
  );
}

describe('Portada', () => {
  it('se ve en la raiz', () => {
    pintar(RUTAS.INICIO);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/lo que sientes/i);
  });

  it('ofrece entrar y registrarse desde la propia portada', () => {
    // Una portada que solo informa deja sin salida a quien llego decidido.
    pintar(RUTAS.INICIO);

    expect(screen.getAllByRole('link', { name: 'Crear cuenta' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Ya tengo cuenta' })).toBeInTheDocument();
  });

  it('deja el aviso clinico a la vista', () => {
    // No es decoracion: el proyecto se compromete a que la aplicacion no
    // parezca una herramienta de diagnostico en ningun momento.
    pintar(RUTAS.INICIO);

    expect(screen.getAllByText(/no diagnostica/i).length).toBeGreaterThan(0);
  });

  it('devuelve a la portada cualquier direccion que no existe', () => {
    pintar('/esta-ruta-no-existe');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/lo que sientes/i);
  });
});

describe('Salto al contenido', () => {
  it('es lo primero que se tabula, en cualquier pantalla', () => {
    // Quien navega con teclado tendria que pasar por las siete paradas de la
    // navegacion antes de llegar a lo que vino a leer. En cada pantalla.
    pintar(RUTAS.INICIO);

    const enfocables = document.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );

    expect(enfocables[0]).toHaveClass('salto');
    expect(enfocables[0]).toHaveTextContent('Saltar al contenido');
  });

  it('lleva el foco al contenido, no solo el desplazamiento', () => {
    // Un enlace que desplaza pero deja el foco atras es peor que no tenerlo:
    // dice que salto y la siguiente parada vuelve a ser el principio del menu.
    pintar(RUTAS.INICIO);

    screen.getByRole('link', { name: 'Saltar al contenido' }).click();

    expect(document.activeElement).toBe(document.querySelector('main'));
  });
});

describe('Volver a la portada', () => {
  it.each([
    ['el acceso', RUTAS.ACCESO],
    ['el registro', RUTAS.REGISTRO],
    ['la recuperación', RUTAS.RECUPERAR],
  ])('se puede salir de %s', (_nombre, ruta) => {
    // Sin esto, quien abre una de estas pantallas desde un enlace se queda
    // encerrado: no hay menú, no hay atrás, y el único camino de vuelta sería
    // un logo que nadie sabe que es un enlace.
    pintar(ruta);

    // Nombre exacto: la pantalla de recuperación tiene además un "Volver al
    // inicio de sesión", y una expresión suelta encontraría los dos.
    const volver = screen.getByRole('link', { name: 'Volver al inicio' });

    expect(volver).toHaveAttribute('href', RUTAS.INICIO);
  });

  it('se puede salir del panel estando dentro', () => {
    pintar(RUTAS.PANEL, estado({ sesion: SESION }));

    expect(screen.getByRole('link', { name: /página principal/ })).toHaveAttribute(
      'href',
      RUTAS.INICIO,
    );
  });

  it('a quien ya entró no se le ofrece crear cuenta, se le dice que sigue dentro', () => {
    pintar(RUTAS.INICIO, estado({ sesion: SESION }));

    expect(screen.getByRole('link', { name: /Sesión activa/ })).toHaveAttribute(
      'href',
      RUTAS.PANEL,
    );
    expect(screen.queryByRole('link', { name: 'Ya tengo cuenta' })).toBeNull();
  });
});

describe('Guardas de ruta', () => {
  it('manda al acceso a quien pide el panel sin sesion', () => {
    pintar(RUTAS.PANEL);

    expect(screen.getByRole('heading', { name: 'Hola de nuevo' })).toBeInTheDocument();
  });

  it.each([
    ['el acceso', RUTAS.ACCESO],
    ['el registro', RUTAS.REGISTRO],
    ['la recuperacion', RUTAS.RECUPERAR],
  ])('manda al panel a quien ya tiene sesion y pide %s', (_nombre, ruta) => {
    // Rellenar un formulario que no va a cambiar nada es peor que no verlo:
    // quien lo envia no entiende por que no paso nada.
    pintar(ruta, estado({ sesion: SESION, correo: 'alguien@ejemplo.com' }));

    expect(screen.getByRole('heading', { name: 'Ya estás dentro' })).toBeInTheDocument();
  });

  it('no deja escribir una contrasena nueva a quien no vino del correo', () => {
    // Sin sesion y sin motivo de error en la direccion, nadie llego aqui desde
    // un enlace: se escribio la ruta a mano. No hay contrasena que cambiar,
    // porque no se sabe de quien.
    pintar(RUTAS.CONTRASENA_NUEVA);

    expect(screen.getByRole('heading', { name: 'Recuperar el acceso' })).toBeInTheDocument();
  });

  it('deja escribir la contrasena nueva a quien si vino del correo', () => {
    pintar(RUTAS.CONTRASENA_NUEVA, estado({ sesion: SESION }));

    expect(screen.getByRole('heading', { name: 'Contraseña nueva' })).toBeInTheDocument();
  });
});
