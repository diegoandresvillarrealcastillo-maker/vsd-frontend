import type { Session } from '@supabase/supabase-js';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ID_DEL_CONTENIDO } from '../componentes/SaltoAlContenido.tsx';
import { LINEAS_DE_RESPALDO_DE_COLOMBIA } from '../paginas/actividad/lineasParaMostrar.ts';
import { abrirUnAlmacenDePrueba, cerrarElAlmacenDePrueba } from '../pruebas/almacenDePrueba.ts';
import { fallosDeAccesibilidad } from '../pruebas/axe.ts';
import { SesionContexto, type EstadoDeSesion } from '../sesion/SesionContexto.ts';
import { fijarLaZonaDeLaCuenta } from '../tiempo/zonaHoraria.ts';
import { AvisoDeAcompanamiento } from './AvisoDeAcompanamiento.tsx';
import { olvidarLosAvisosCerrados } from './useAcompanamiento.ts';

/**
 * El aviso de acompanamiento (SCRUM-177), con el almacen de verdad y la API simulada.
 */
const { consultarElAcompanamiento } = vi.hoisted(() => ({ consultarElAcompanamiento: vi.fn() }));

vi.mock('../infraestructura/api/acompanamiento.ts', () => ({ consultarElAcompanamiento }));

const usuario = userEvent.setup({ delay: null });

const LINEA = {
  id: 'l-192',
  titulo: 'Línea 192, opción 4',
  descripcion: 'Orientación en salud mental del Ministerio de Salud.',
  tipo: 'contacto',
  cobertura: 'nacional',
  enlace: 'https://www.minsalud.gov.co/',
};
const MODERADO = { nivel: 'moderado', lineasDeAtencion: [] };
const CRITICO = { nivel: 'critico', lineasDeAtencion: [LINEA] };

function sesion(id: string | null): EstadoDeSesion {
  const vacio = vi.fn();

  return {
    sesion: id === null ? null : ({ user: { id, email: `${id}@ejemplo.test` } } as Session),
    cargando: false,
    correo: id === null ? null : `${id}@ejemplo.test`,
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

/** El aviso dentro de una pagina con su contenido, como en las pantallas con barra. */
function pintar(cuenta: string | null = 'ana') {
  return render(
    <SesionContexto.Provider value={sesion(cuenta)}>
      <AvisoDeAcompanamiento />
      <main id={ID_DEL_CONTENIDO} tabIndex={-1}>
        <h1>La pantalla</h1>
      </main>
    </SesionContexto.Provider>,
  );
}

function elAviso() {
  return document.querySelector('.acompanamiento');
}

beforeEach(async () => {
  fijarLaZonaDeLaCuenta('America/Bogota');
  consultarElAcompanamiento.mockResolvedValue({ nivel: 'ninguno', lineasDeAtencion: [] });
  await abrirUnAlmacenDePrueba();
});

afterEach(() => {
  olvidarLosAvisosCerrados();
  cerrarElAlmacenDePrueba();
  consultarElAcompanamiento.mockReset();
  vi.clearAllMocks();
});

describe('Sin nada que ofrecer', () => {
  it('con nivel «ninguno» no pinta nada: ni un hueco', async () => {
    pintar();

    await waitFor(() => {
      expect(consultarElAcompanamiento).toHaveBeenCalled();
    });
    expect(elAviso()).toBeNull();
  });

  it('sin sesion ni siquiera pregunta', async () => {
    consultarElAcompanamiento.mockResolvedValue(CRITICO);

    pintar(null);
    await act(async () => {
      await Promise.resolve();
    });

    expect(consultarElAcompanamiento).not.toHaveBeenCalled();
    expect(elAviso()).toBeNull();
  });

  it('un nivel que esta version no entiende se lee como «ninguno»: nunca se inventa un aviso', async () => {
    consultarElAcompanamiento.mockResolvedValue({ nivel: 'urgente', lineasDeAtencion: [LINEA] });

    pintar();
    await waitFor(() => {
      expect(consultarElAcompanamiento).toHaveBeenCalled();
    });

    expect(elAviso()).toBeNull();
  });

  it('sin conexion y sin copia no muestra nada, y no lo dice como un error', async () => {
    consultarElAcompanamiento.mockRejectedValue(new TypeError('Failed to fetch'));

    pintar();
    await waitFor(() => {
      expect(consultarElAcompanamiento).toHaveBeenCalled();
    });

    expect(elAviso()).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Moderado', () => {
  beforeEach(() => {
    consultarElAcompanamiento.mockResolvedValue(MODERADO);
  });

  it('pregunta si quiere hablarlo, sin diagnosticar y sin lineas', async () => {
    pintar();

    expect(await screen.findByText('¿Quieres hablarlo con un profesional?')).toBeVisible();
    expect(screen.getByText(/No es un diagnóstico: es una invitación/)).toBeVisible();
    expect(screen.queryByRole('link')).toBeNull();
    expect(
      screen.getByRole('region', { name: '¿Quieres hablarlo con un profesional?' }),
    ).toBeVisible();
  });

  it('«Ahora no» lo cierra, lleva el foco al contenido y no vuelve mientras se navega', async () => {
    const { unmount } = pintar();

    await usuario.click(await screen.findByRole('button', { name: 'Ahora no' }));

    expect(elAviso()).toBeNull();
    expect(screen.getByRole('main')).toHaveFocus();

    // Otra pantalla de la misma visita: el aviso ya se cerro.
    unmount();
    pintar();
    await waitFor(() => {
      expect(consultarElAcompanamiento).toHaveBeenCalledTimes(2);
    });

    expect(elAviso()).toBeNull();
  });

  it('lo que una cuenta cerro no se le oculta a otra', async () => {
    const { unmount } = pintar('ana');

    await usuario.click(await screen.findByRole('button', { name: 'Ahora no' }));
    unmount();
    pintar('luis');

    expect(await screen.findByText('¿Quieres hablarlo con un profesional?')).toBeVisible();
  });

  it('no tiene fallos de accesibilidad', async () => {
    pintar();
    await screen.findByText('¿Quieres hablarlo con un profesional?');

    expect(await fallosDeAccesibilidad()).toEqual([]);
  });
});

describe('Critico', () => {
  beforeEach(() => {
    consultarElAcompanamiento.mockResolvedValue(CRITICO);
  });

  it('se queda a la vista con las lineas del pais, su cobertura y su enlace', async () => {
    pintar();

    expect(await screen.findByText('Hablar con alguien puede ayudarte')).toBeVisible();
    expect(screen.getByText(/Esto no es un diagnóstico/)).toBeVisible();
    expect(screen.getByText('Línea 192, opción 4')).toBeVisible();
    expect(screen.getByText('Todo el país')).toBeVisible();
    expect(
      screen.getByRole('link', {
        name: 'Más información sobre Línea 192, opción 4 (se abre en otra pestaña)',
      }),
    ).toHaveAttribute('href', 'https://www.minsalud.gov.co/');
  });

  it('no es un modal ni se puede cerrar: no atrapa a nadie y se va solo cuando el servidor deja de decirlo', async () => {
    pintar();
    await screen.findByText('Hablar con alguien puede ayudarte');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector('[aria-modal]')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('si el servidor no manda lineas, usa las de respaldo del pais: nunca queda sin un telefono', async () => {
    consultarElAcompanamiento.mockResolvedValue({ nivel: 'critico', lineasDeAtencion: [] });

    pintar();
    await screen.findByText('Hablar con alguien puede ayudarte');

    for (const linea of LINEAS_DE_RESPALDO_DE_COLOMBIA) {
      expect(screen.getByText(linea.titulo)).toBeVisible();
    }
  });

  it('no lleva encabezados: llega antes del h1 de la pagina y no le cambia el orden', async () => {
    pintar();
    await screen.findByText('Hablar con alguien puede ayudarte');

    expect(screen.getAllByRole('heading')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
  });

  it('sin conexion se ve lo ultimo que se supo, de la copia de este equipo', async () => {
    const primera = pintar();

    await primera.findByText('Hablar con alguien puede ayudarte');
    primera.unmount();
    consultarElAcompanamiento.mockRejectedValue(new TypeError('Failed to fetch'));

    pintar();

    expect(await screen.findByText('Hablar con alguien puede ayudarte')).toBeVisible();
    expect(screen.getByText('Línea 192, opción 4')).toBeVisible();
  });

  it('al volver la conexion pregunta de nuevo y, si ya no hace falta, se va', async () => {
    pintar();
    await screen.findByText('Hablar con alguien puede ayudarte');

    consultarElAcompanamiento.mockResolvedValue({ nivel: 'ninguno', lineasDeAtencion: [] });
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(elAviso()).toBeNull();
    });
  });

  describe('«Llamar ahora» (SCRUM-257)', () => {
    it('una linea con telefono verificado se puede marcar con un toque', async () => {
      consultarElAcompanamiento.mockResolvedValue({
        nivel: 'critico',
        lineasDeAtencion: [{ ...LINEA, telefono: '192' }],
      });
      pintar();

      const boton = await screen.findByRole('link', {
        name: 'Llamar ahora: Línea 192, opción 4',
      });

      expect(boton).toHaveAttribute('href', 'tel:192');
    });

    it('una linea sin telefono no tiene boton, y conserva su enlace', async () => {
      consultarElAcompanamiento.mockResolvedValue(CRITICO);
      pintar();

      expect(await screen.findByText('Línea 192, opción 4')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Llamar ahora/ })).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Más información sobre/ })).toBeInTheDocument();
    });

    it('con las lineas de respaldo de Colombia, la 192 y la 123 se pueden marcar', async () => {
      consultarElAcompanamiento.mockResolvedValue({ nivel: 'critico', lineasDeAtencion: [] });
      pintar();

      expect(await screen.findByRole('link', { name: /Llamar ahora: Línea 192/ })).toHaveAttribute(
        'href',
        'tel:192',
      );
      expect(screen.getByRole('link', { name: /Llamar ahora: Línea 123/ })).toHaveAttribute(
        'href',
        'tel:123',
      );
    });
  });

  it('no tiene fallos de accesibilidad', async () => {
    pintar();
    await screen.findByText('Hablar con alguien puede ayudarte');

    expect(await fallosDeAccesibilidad()).toEqual([]);
  });
});
