import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TEXTO_DEL_AVISO_ORIENTATIVO } from '../componentes/AvisoOrientativo.tsx';
import type { RespuestaDelAsistente } from '../infraestructura/api/asistente.ts';
import { ErrorDeLaApi } from '../infraestructura/api/clienteHttp.ts';
import { fallosDeAccesibilidad } from '../pruebas/axe.ts';
import type { ReglasLocales } from '../infraestructura/api/reglasLocales.ts';
import { fijarLaZonaDeLaCuenta } from '../tiempo/zonaHoraria.ts';
import { Asistente } from './Asistente.tsx';
import contratoJson from './contrato/reglas-locales.json';
import { ESPERA_MAXIMA_MS } from './useConversacion.ts';

/**
 * VSD IA, con la API simulada y la pantalla de verdad (SCRUM-100).
 */
const { preguntarAlAsistente, leerLasReglasLocalesConCopia } = vi.hoisted(() => ({
  preguntarAlAsistente: vi.fn(),
  leerLasReglasLocalesConCopia: vi.fn(),
}));

vi.mock('../infraestructura/api/asistente.ts', async (importar) => ({
  ...(await importar<typeof import('../infraestructura/api/asistente.ts')>()),
  preguntarAlAsistente,
}));
// Las reglas para responder sin conexion (SCRUM-141): por omision no hay ninguna guardada.
vi.mock('../sincronizacion/reglasLocalesLocal.ts', () => ({ leerLasReglasLocalesConCopia }));

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

/** Lo que publica el servidor: el paquete de verdad. */
const REGLAS = (contratoJson as unknown as { paquete: ReglasLocales }).paquete;

beforeEach(() => {
  preguntarAlAsistente.mockResolvedValue(SOBRE_EL_SUENO);
  // Nunca se abrio con conexion: no hay reglas guardadas.
  leerLasReglasLocalesConCopia.mockRejectedValue(new TypeError('Failed to fetch'));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  fijarLaZonaDeLaCuenta('America/Bogota');
});

describe('VSD IA, accesibilidad (C-03)', () => {
  it('abierta, no tiene fallos de accesibilidad', async () => {
    pintar();

    expect(await fallosDeAccesibilidad()).toEqual([]);
  });

  it('con una respuesta y sus recursos, tampoco', async () => {
    pintar();

    await usuario.type(campo(), 'no duermo bien');
    await usuario.click(screen.getByRole('button', { name: 'Enviar' }));
    await screen.findByText(/Descansar mejor casi siempre/);

    expect(await fallosDeAccesibilidad()).toEqual([]);
  });

  it('se cierra al pulsar el fondo, y no al pulsar dentro', async () => {
    const { alCerrar, dialogo } = pintar();

    // El marco rodea al dialogo y no es el fondo: pulsarlo no cierra.
    await usuario.click(dialogo.parentElement!);
    await usuario.click(dialogo);
    expect(alCerrar).not.toHaveBeenCalled();

    const fondo = dialogo.parentElement?.parentElement;

    expect(fondo).toHaveClass('asistente-velo');
    expect(fondo).toHaveAttribute('role', 'presentation');
    await usuario.click(fondo!);
    expect(alCerrar).toHaveBeenCalledTimes(1);
  });
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

describe('sin conexion: un asistente mixto (SCRUM-141)', () => {
  const AVISO = /Sin conexión\. Puedo saludarte y decirte dónde buscar ayuda/;
  const EXIGE = 'Esto lo puedo responder cuando tengas conexión.';

  function sinConexion() {
    return vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  }

  /** Con las reglas guardadas: lo que ocurre cuando ya se abrio con conexion una vez. */
  function conLasReglas() {
    leerLasReglasLocalesConCopia.mockResolvedValue({
      valor: REGLAS,
      deLaCopia: true,
      guardadoEn: '2026-10-08T10:00:00.000Z',
    });
  }

  async function pintarSinConexion(zona = 'America/Bogota') {
    fijarLaZonaDeLaCuenta(zona);
    conLasReglas();
    sinConexion();

    const pintado = pintar();

    // Las reglas llegan un instante despues de abrir: cuando se dice, ya se pueden aplicar.
    await screen.findByText(AVISO);

    return pintado;
  }

  /** Con red, pero con las reglas ya leidas: espera a que el aviso de las reglas se haya resuelto. */
  async function pintarConReglasYConRed() {
    conLasReglas();
    pintar();
    await vi.waitFor(() => {
      expect(leerLasReglasLocalesConCopia).toHaveBeenCalled();
    });
    // Un instante para que las reglas lleguen al estado de la pantalla.
    await act(async () => {
      await new Promise((resolver) => setTimeout(resolver, 30));
    });
  }

  const conversacion = () => screen.getByRole('log', { name: 'Conversación' });

  it('avisa arriba, sin depender del color, que sin conexion solo responde lo basico', async () => {
    const { dialogo } = await pintarSinConexion();

    expect(within(dialogo).getByText(AVISO)).toHaveAttribute('role', 'status');
  });

  it('con conexion no dice nada de eso', async () => {
    await pintarConReglasYConRed();

    await usuario.type(campo(), 'hola{Enter}');
    await screen.findByText(SOBRE_EL_SUENO.mensaje);

    expect(screen.queryByText(AVISO)).not.toBeInTheDocument();
    expect(screen.queryByText('Respondido sin conexión')).not.toBeInTheDocument();
  });

  it('sin reglas guardadas no promete lo que no puede: no hay aviso', async () => {
    sinConexion();

    pintar();
    await usuario.type(campo(), 'hola{Enter}');

    expect(screen.queryByText(AVISO)).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('No tienes conexión');
  });

  it('el aviso se va cuando vuelve la conexion, y se vuelven a pedir las reglas', async () => {
    await pintarSinConexion();
    leerLasReglasLocalesConCopia.mockClear();

    act(() => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
      window.dispatchEvent(new Event('online'));
    });

    await vi.waitFor(() => {
      expect(screen.queryByText(AVISO)).not.toBeInTheDocument();
    });
    expect(leerLasReglasLocalesConCopia).toHaveBeenCalled();
  });

  it('y vuelve a aparecer si se va otra vez', async () => {
    await pintarConReglasYConRed();

    expect(screen.queryByText(AVISO)).not.toBeInTheDocument();

    act(() => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      window.dispatchEvent(new Event('offline'));
    });

    expect(await screen.findByText(AVISO)).toBeInTheDocument();
  });

  describe('lo que se responde', () => {
    it('un saludo, sin preguntar al servidor, y dice que no vino de el', async () => {
      await pintarSinConexion();

      await usuario.type(campo(), 'hola{Enter}');

      expect(
        await within(conversacion()).findByText(/Sin conexión puedo saludarte/),
      ).toBeInTheDocument();
      expect(preguntarAlAsistente).not.toHaveBeenCalled();
      expect(conversacion()).toHaveTextContent('Respondido sin conexión');
      // Y no invita a preguntar lo que sin conexion no se puede responder.
      expect(conversacion()).not.toHaveTextContent('descanso');
    });

    it('un agradecimiento y una despedida', async () => {
      await pintarSinConexion();

      await usuario.type(campo(), 'muchas gracias{Enter}');
      expect(await within(conversacion()).findByText(/¡Con gusto!/)).toBeInTheDocument();

      await usuario.type(campo(), 'chao{Enter}');
      expect(await within(conversacion()).findByText(/Hasta pronto/)).toBeInTheDocument();
      expect(preguntarAlAsistente).not.toHaveBeenCalled();
    });

    it('"buenas noches" tiene su propia respuesta', async () => {
      await pintarSinConexion();

      await usuario.type(campo(), 'buenas noches{Enter}');

      expect(await within(conversacion()).findByText(/¡Buenas noches!/)).toBeInTheDocument();
    });

    it('el nombre de la mascota cuenta como relleno: "hola Chispita" es un saludo', async () => {
      await pintarSinConexion();

      await usuario.type(campo(), 'hola Chispita{Enter}');

      expect(
        await within(conversacion()).findByText(/Sin conexión puedo saludarte/),
      ).toBeInTheDocument();
    });

    it('una senal de riesgo ensena las lineas del pais de la persona, sin esperar la red', async () => {
      await pintarSinConexion('America/Bogota');

      await usuario.type(campo(), 'me siento muy mal, quiero hacerme daño{Enter}');

      const lineas = await screen.findByRole('region', {
        name: 'Si te sirve hablarlo con alguien',
      });

      expect(lineas).toHaveTextContent('Línea 192, opción 4');
      expect(lineas).toHaveTextContent('Línea 123');
      expect(conversacion()).toHaveTextContent(REGLAS.riesgo.mensaje);
      expect(conversacion()).toHaveTextContent('Respondido sin conexión');
      expect(preguntarAlAsistente).not.toHaveBeenCalled();
      expect(screen.queryByText('Pensando…')).not.toBeInTheDocument();
    });

    it('solo una senal de riesgo se pinta como tal: un saludo o la ayuda, no', async () => {
      await pintarSinConexion();

      await usuario.type(campo(), 'quiero morirme{Enter}');
      await screen.findByRole('region', { name: 'Si te sirve hablarlo con alguien' });
      expect(conversacion().querySelectorAll('.asistente__respuesta--acompana')).toHaveLength(1);

      await usuario.type(campo(), 'hola{Enter}');
      await usuario.type(campo(), 'donde busco ayuda{Enter}');

      expect(await within(conversacion()).findAllByText('Respondido sin conexión')).toHaveLength(3);
      expect(conversacion().querySelectorAll('.asistente__respuesta--acompana')).toHaveLength(1);
    });

    it('las lineas son las de su pais y de ningun otro: desde Madrid, las de España', async () => {
      await pintarSinConexion('Europe/Madrid');

      await usuario.type(campo(), 'quiero morirme{Enter}');

      const lineas = await screen.findByRole('region', {
        name: 'Si te sirve hablarlo con alguien',
      });

      expect(lineas).toHaveTextContent('Línea 024');
      expect(lineas).not.toHaveTextContent('Línea 192');
      expect(lineas).not.toHaveTextContent('Línea 988');
    });

    it('desde un lugar sin pais verificado, el directorio internacional y ningun telefono', async () => {
      await pintarSinConexion('Asia/Tokyo');

      await usuario.type(campo(), 'quiero morirme{Enter}');

      const lineas = await screen.findByRole('region', {
        name: 'Si te sirve hablarlo con alguien',
      });

      expect(lineas).toHaveTextContent('Directorio internacional de líneas de ayuda');
      expect(lineas).not.toHaveTextContent('Línea 192');
      expect(lineas).not.toHaveTextContent('Línea 024');
    });

    it('un saludo delante de algo serio no esconde las lineas', async () => {
      await pintarSinConexion();

      await usuario.type(campo(), 'hola, quiero matarme{Enter}');

      expect(
        await screen.findByRole('region', { name: 'Si te sirve hablarlo con alguien' }),
      ).toHaveTextContent('Línea 192, opción 4');
    });

    it('"¿qué líneas de ayuda hay?" se responde con las lineas', async () => {
      await pintarSinConexion();

      await usuario.type(campo(), '¿Qué líneas de ayuda hay?{Enter}');

      const lineas = await screen.findByRole('region', {
        name: 'Si te sirve hablarlo con alguien',
      });

      expect(lineas).toHaveTextContent('Línea 192, opción 4');
      expect(conversacion()).toHaveTextContent('Pedir ayuda es una buena decisión.');
      expect(preguntarAlAsistente).not.toHaveBeenCalled();
    });

    it('una sugerencia que se puede responder sin conexion, se responde', async () => {
      await pintarSinConexion();

      await usuario.click(screen.getByRole('button', { name: '¿Dónde busco ayuda?' }));

      expect(
        await screen.findByRole('region', { name: 'Si te sirve hablarlo con alguien' }),
      ).toBeInTheDocument();
    });
  });

  describe('lo que exige conexion', () => {
    it.each([
      'como duermo mejor',
      'que significa mi resultado',
      'me siento triste',
      '¿Cómo estás?',
    ])('"%s" no se inventa: dice que lo respondera cuando haya conexion', async (pregunta) => {
      await pintarSinConexion();

      await usuario.type(campo(), `${pregunta}{Enter}`);

      const alerta = await screen.findByRole('alert');

      expect(alerta).toHaveTextContent(EXIGE);
      expect(alerta).not.toHaveTextContent('No tienes conexión');
      expect(preguntarAlAsistente).not.toHaveBeenCalled();
      expect(conversacion()).not.toHaveTextContent('Respondido sin conexión');
    });

    it('lo escrito se queda en pantalla y deja las lineas del pais a mano', async () => {
      await pintarSinConexion('Europe/Madrid');

      await usuario.type(campo(), 'como duermo mejor{Enter}');

      expect(conversacion()).toHaveTextContent('como duermo mejor');
      // Las que el servidor publico para su pais, no las de Colombia.
      expect(screen.getByRole('alert')).toHaveTextContent('Línea 024, llama a la vida');
      expect(screen.getByRole('alert')).not.toHaveTextContent('Línea 192');
    });

    it('el respaldo solo ensena las lineas que atienden en todo el pais', async () => {
      await pintarSinConexion('America/Bogota');

      await usuario.type(campo(), 'como duermo mejor{Enter}');

      // La 106 solo atiende desde Bogota: a quien no sabe de donde es cada una no se la ensena aqui.
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Línea 192, opción 4 · Línea 123.',
      );
      expect(screen.getByRole('alert')).not.toHaveTextContent('Línea 106');
    });

    it('y solo lo que es un telefono: una lectura que sirva en todo el pais no entra', async () => {
      const conUnaLectura: ReglasLocales = {
        ...REGLAS,
        paises: {
          ...REGLAS.paises,
          CO: {
            zonas: REGLAS.paises.CO?.zonas ?? [],
            lineas: [
              ...(REGLAS.paises.CO?.lineas ?? []),
              { id: 'una-lectura', titulo: 'Una lectura', tipo: 'lectura', cobertura: 'nacional' },
            ],
          },
        },
      };

      leerLasReglasLocalesConCopia.mockResolvedValue({
        valor: conUnaLectura,
        deLaCopia: true,
        guardadoEn: '2026-10-08T10:00:00.000Z',
      });
      sinConexion();
      pintar();
      await screen.findByText(AVISO);

      await usuario.type(campo(), 'como duermo mejor{Enter}');

      expect(await screen.findByRole('alert')).toHaveTextContent('Línea 192, opción 4');
      expect(screen.getByRole('alert')).not.toHaveTextContent('Una lectura');
    });

    it('lo escrito sin conexion no se envia despues: solo la persona lo reenvia', async () => {
      await pintarSinConexion();

      await usuario.type(campo(), 'como duermo mejor{Enter}');
      await screen.findByRole('alert');

      // Vuelve la red: no se envia nada solo.
      act(() => {
        vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
        window.dispatchEvent(new Event('online'));
      });
      await act(async () => {
        await new Promise((resolver) => setTimeout(resolver, 60));
      });

      expect(preguntarAlAsistente).not.toHaveBeenCalled();

      // La persona decide: "Reintentar" lo manda, una sola vez y sin repetirlo en la conversacion.
      await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(preguntarAlAsistente).toHaveBeenCalledTimes(1);
      expect(preguntarAlAsistente).toHaveBeenCalledWith(
        'como duermo mejor',
        expect.any(AbortSignal),
      );
      expect(await screen.findByText(SOBRE_EL_SUENO.mensaje)).toBeInTheDocument();
      expect(screen.getAllByText('como duermo mejor')).toHaveLength(1);
    });

    it('reintentar sin que vuelva la conexion vuelve a decir lo mismo', async () => {
      await pintarSinConexion();

      await usuario.type(campo(), 'como duermo mejor{Enter}');
      await usuario.click(await screen.findByRole('button', { name: 'Reintentar' }));

      expect(screen.getAllByRole('alert')).toHaveLength(2);
      expect(preguntarAlAsistente).not.toHaveBeenCalled();
    });
  });

  describe('cuando el navegador dice que hay red y la peticion no llega', () => {
    beforeEach(() => {
      preguntarAlAsistente.mockRejectedValue(new TypeError('Failed to fetch'));
    });

    it('un saludo se responde con lo guardado', async () => {
      await pintarConReglasYConRed();

      await usuario.type(campo(), 'hola{Enter}');

      expect(
        await within(conversacion()).findByText(/Sin conexión puedo saludarte/),
      ).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('una senal de riesgo ensena las lineas aunque no haya llegado nada', async () => {
      await pintarConReglasYConRed();

      await usuario.type(campo(), 'ya no puedo más{Enter}');

      expect(
        await screen.findByRole('region', { name: 'Si te sirve hablarlo con alguien' }),
      ).toHaveTextContent('Línea 192, opción 4');
    });

    it('lo que exige conexion lo dice, sin decir que no hay conexion en general', async () => {
      await pintarConReglasYConRed();

      await usuario.type(campo(), 'como duermo mejor{Enter}');

      expect(await screen.findByRole('alert')).toHaveTextContent(EXIGE);
    });

    it('un error del servidor se respeta tal cual: no se responde por el', async () => {
      preguntarAlAsistente.mockRejectedValue(new ErrorDeLaApi(500, 'Fallo'));
      await pintarConReglasYConRed();

      await usuario.type(campo(), 'hola{Enter}');

      expect(await screen.findByRole('alert')).toHaveTextContent('Algo falló');
      expect(screen.queryByText('Respondido sin conexión')).not.toBeInTheDocument();
    });

    it('"vas muy rapido" tambien se respeta: es del servidor', async () => {
      preguntarAlAsistente.mockRejectedValue(new ErrorDeLaApi(429, 'Demasiadas peticiones'));
      await pintarConReglasYConRed();

      await usuario.type(campo(), 'hola{Enter}');

      expect(await screen.findByRole('alert')).toHaveTextContent('Espera un momento');
    });
  });

  it('si tarda demasiado, un saludo se responde con lo guardado y lo que exige conexion sigue diciendo que tarda', async () => {
    conLasReglas();
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
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });

      fireEvent.change(campo(), { target: { value: 'hola' } });
      fireEvent.submit(campo().closest('form')!);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_MS);
      });

      expect(conversacion()).toHaveTextContent('Sin conexión puedo saludarte');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      fireEvent.change(campo(), { target: { value: 'como duermo mejor' } });
      fireEvent.submit(campo().closest('form')!);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_MS);
      });

      expect(screen.getByRole('alert')).toHaveTextContent('tardando más de la cuenta');
    } finally {
      vi.useRealTimers();
    }
  });
});
