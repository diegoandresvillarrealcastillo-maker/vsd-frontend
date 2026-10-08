import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TEXTO_DEL_AVISO_ORIENTATIVO } from '../componentes/AvisoOrientativo.tsx';
import type { RespuestaDelAsistente } from '../infraestructura/api/asistente.ts';
import { ErrorDeLaApi } from '../infraestructura/api/clienteHttp.ts';
import { fijarLaZonaDeLaCuenta } from '../tiempo/zonaHoraria.ts';
import { Asistente } from './Asistente.tsx';
import { ESPERA_MAXIMA_MS } from './useConversacion.ts';

/**
 * VSD IA, con la API simulada y la pantalla de verdad (SCRUM-100).
 */
const { preguntarAlAsistente } = vi.hoisted(() => ({ preguntarAlAsistente: vi.fn() }));

vi.mock('../infraestructura/api/asistente.ts', async (importar) => ({
  ...(await importar<typeof import('../infraestructura/api/asistente.ts')>()),
  preguntarAlAsistente,
}));

const MARCO = { left: 12, top: 200, width: 351, height: 600 };

const SOBRE_EL_SUENO: RespuestaDelAsistente = {
  intencion: 'como_duermo_mejor',
  mensaje: 'Descansar mejor casi siempre empieza por la rutina.',
  recursos: [
    {
      id: 'r-1',
      titulo: 'Higiene del sueño',
      descripcion: 'Pequeños cambios antes de dormir.',
      tipo: 'lectura',
      enlace: 'https://ejemplo.test/sueno',
    },
  ],
  senalDeRiesgo: false,
  incluyeLineasDeAtencion: false,
};

const CON_RIESGO: RespuestaDelAsistente = {
  intencion: 'me_siento_mal',
  mensaje: 'Gracias por escribirlo.',
  recursos: [
    {
      id: 'l-bogota',
      titulo: 'Línea 106',
      descripcion: 'Escucha para niños, niñas y adolescentes.',
      tipo: 'contacto',
      cobertura: 'bogota',
    },
  ],
  senalDeRiesgo: true,
  incluyeLineasDeAtencion: true,
};

const usuario = userEvent.setup({ delay: null });

function pintar() {
  const alCerrar = vi.fn();

  render(
    <Asistente
      marco={MARCO}
      ladoDeLaMascota={72}
      nombreDeLaMascota="Chispita"
      alCerrar={alCerrar}
    />,
  );

  return { alCerrar, dialogo: screen.getByRole('dialog', { name: 'VSD IA' }) };
}

function campo() {
  return screen.getByRole('textbox', { name: 'Escribe tu pregunta' });
}

beforeEach(() => {
  preguntarAlAsistente.mockResolvedValue(SOBRE_EL_SUENO);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('VSD IA', () => {
  it('se abre con el foco en el campo y avisa de que nada se guarda', () => {
    const { dialogo } = pintar();

    expect(campo()).toHaveFocus();
    expect(dialogo).toHaveTextContent('Lo que escribas aquí no se guarda');
  });

  it('desde que se abre, y antes de preguntar nada, dice que es orientativo (L-03)', () => {
    const { dialogo } = pintar();

    const cabecera = within(dialogo).getByRole('banner');

    expect(cabecera).toHaveTextContent(TEXTO_DEL_AVISO_ORIENTATIVO);
  });

  it('responde con su mensaje y sus recursos', async () => {
    pintar();

    await usuario.type(campo(), 'no duermo bien');
    await usuario.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(preguntarAlAsistente).toHaveBeenCalledWith('no duermo bien', expect.any(AbortSignal));

    const conversacion = screen.getByRole('log', { name: 'Conversación' });

    expect(await within(conversacion).findByText(SOBRE_EL_SUENO.mensaje)).toBeInTheDocument();
    expect(conversacion).toHaveTextContent('no duermo bien');
    expect(
      within(conversacion).getByRole('link', { name: /Leer más sobre Higiene del sueño/ }),
    ).toHaveAttribute('href', 'https://ejemplo.test/sueno');
    expect(campo()).toHaveValue('');
  });

  it('las sugerencias preguntan por lo que sabe responder', async () => {
    pintar();

    await usuario.click(screen.getByRole('button', { name: '¿Cómo puedo dormir mejor?' }));

    expect(preguntarAlAsistente).toHaveBeenCalledWith(
      '¿Cómo puedo dormir mejor?',
      expect.any(AbortSignal),
    );
    // Ya empezo la conversacion: las sugerencias se van.
    expect(screen.queryByRole('button', { name: '¿Dónde busco ayuda?' })).not.toBeInTheDocument();
  });

  it('Enter envia y Mayus+Enter salta de linea', async () => {
    pintar();

    await usuario.type(campo(), 'hola{Shift>}{Enter}{/Shift}otra linea');

    expect(preguntarAlAsistente).not.toHaveBeenCalled();
    expect(campo()).toHaveValue('hola\notra linea');

    await usuario.type(campo(), '{Enter}');

    expect(preguntarAlAsistente).toHaveBeenCalledWith('hola\notra linea', expect.any(AbortSignal));
  });

  describe('la señal de riesgo', () => {
    it('siempre muestra las lineas de atencion que manda el servidor', async () => {
      preguntarAlAsistente.mockResolvedValue(CON_RIESGO);

      pintar();

      await usuario.type(campo(), 'ya no puedo más{Enter}');

      const lineas = await screen.findByRole('region', {
        name: 'Si te sirve hablarlo con alguien',
      });

      expect(lineas).toHaveTextContent('Línea 106');
    });

    it('y si no manda ninguna fuera de Colombia, el directorio y ningun telefono de Colombia', async () => {
      fijarLaZonaDeLaCuenta('America/Mexico_City');
      preguntarAlAsistente.mockResolvedValue({ ...CON_RIESGO, recursos: [] });

      pintar();

      await usuario.type(campo(), 'ya no puedo más{Enter}');

      const lineas = await screen.findByRole('region', {
        name: 'Si te sirve hablarlo con alguien',
      });

      expect(lineas).toHaveTextContent('Directorio internacional de líneas de ayuda');
      expect(lineas).not.toHaveTextContent('Línea 192');
      expect(lineas).not.toHaveTextContent('Línea 123');
    });

    it('y si no manda ninguna, las nacionales de respaldo', async () => {
      preguntarAlAsistente.mockResolvedValue({ ...CON_RIESGO, recursos: [] });

      pintar();

      await usuario.type(campo(), 'ya no puedo más{Enter}');

      const lineas = await screen.findByRole('region', {
        name: 'Si te sirve hablarlo con alguien',
      });

      expect(lineas).toHaveTextContent('Línea 192, opción 4');
      expect(lineas).toHaveTextContent('Línea 123');
    });
  });

  describe('nunca se queda cargando', () => {
    it('sin conexion lo dice al momento, sin intentarlo', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

      pintar();

      await usuario.type(campo(), 'hola{Enter}');

      expect(preguntarAlAsistente).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent('No tienes conexión');
      // No se sabe que habria respondido: los telefonos quedan a mano.
      expect(screen.getByRole('alert')).toHaveTextContent('Línea 192, opción 4');
      expect(screen.queryByText('Pensando…')).not.toBeInTheDocument();
    });

    it.each(['America/Lima', 'Europe/Madrid'])(
      'fuera de Colombia (%s), manda al directorio y no ensena telefonos de Colombia (SCRUM-124)',
      async (zona) => {
        fijarLaZonaDeLaCuenta(zona);
        vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

        pintar();

        await usuario.type(campo(), 'hola{Enter}');

        const alerta = screen.getByRole('alert');

        expect(alerta).toHaveTextContent('No tienes conexión');
        expect(alerta).not.toHaveTextContent('192');
        expect(alerta).not.toHaveTextContent('123');
        expect(alerta).toHaveTextContent('número de emergencias del lugar donde estás');
        expect(
          within(alerta).getByRole('link', { name: /directorio internacional/ }),
        ).toHaveAttribute('href', 'https://findahelpline.com/');
      },
    );

    it('si la peticion no llega, tambien es falta de conexion', async () => {
      preguntarAlAsistente.mockRejectedValue(new TypeError('Failed to fetch'));

      pintar();

      await usuario.type(campo(), 'hola{Enter}');

      expect(await screen.findByRole('alert')).toHaveTextContent('No tienes conexión');
    });

    it('si tarda demasiado deja de esperar y lo dice', async () => {
      vi.useFakeTimers();

      try {
        // Como `fetch`: solo termina si lo abortan.
        preguntarAlAsistente.mockImplementation(
          (_texto: string, senal: AbortSignal) =>
            new Promise((_resolver, rechazar) => {
              senal.addEventListener('abort', () => {
                rechazar(new DOMException('Abortado', 'AbortError'));
              });
            }),
        );

        pintar();

        fireEvent.change(campo(), { target: { value: 'hola' } });
        fireEvent.submit(campo().closest('form')!);

        expect(screen.getByRole('status')).toHaveTextContent('Pensando…');

        await act(async () => {
          await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_MS);
        });

        expect(screen.getByRole('alert')).toHaveTextContent('tardando más de la cuenta');
        expect(screen.queryByText('Pensando…')).not.toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it('si van muy rapido, pide un momento', async () => {
      preguntarAlAsistente.mockRejectedValue(new ErrorDeLaApi(429, 'Demasiadas peticiones'));

      pintar();

      await usuario.type(campo(), 'hola{Enter}');

      expect(await screen.findByRole('alert')).toHaveTextContent('Espera un momento');
    });

    it('reintentar vuelve a preguntar lo mismo, sin repetirlo en la conversacion', async () => {
      preguntarAlAsistente
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(SOBRE_EL_SUENO);

      pintar();

      await usuario.type(campo(), 'no duermo bien{Enter}');
      await usuario.click(await screen.findByRole('button', { name: 'Reintentar' }));

      expect(preguntarAlAsistente).toHaveBeenLastCalledWith(
        'no duermo bien',
        expect.any(AbortSignal),
      );
      expect(await screen.findByText(SOBRE_EL_SUENO.mensaje)).toBeInTheDocument();
      expect(screen.getAllByText('no duermo bien')).toHaveLength(1);
    });
  });

  it('lo escrito no se guarda en el navegador', async () => {
    localStorage.clear();
    sessionStorage.clear();

    pintar();

    await usuario.type(campo(), 'algo muy mío{Enter}');
    await screen.findByText(SOBRE_EL_SUENO.mensaje);

    expect(JSON.stringify({ ...localStorage })).not.toContain('algo muy mío');
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('algo muy mío');
  });

  it('se cierra con Escape, con la X o pulsando fuera', async () => {
    const { alCerrar } = pintar();

    await usuario.keyboard('{Escape}');
    await usuario.click(screen.getByRole('button', { name: 'Cerrar VSD IA' }));
    await usuario.click(document.querySelector('.asistente-velo')!);

    expect(alCerrar).toHaveBeenCalledTimes(3);
  });
});
