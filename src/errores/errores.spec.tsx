import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RUTAS } from '../rutas/rutas.ts';
import { SesionContexto, type EstadoDeSesion } from '../sesion/SesionContexto.ts';
import { fijarLaZonaDeLaCuenta, olvidarLaZonaDeLaCuenta } from '../tiempo/zonaHoraria.ts';
import { LimiteDeErrores } from './LimiteDeErrores.tsx';
import {
  reportarError,
  rutaSinIdentificadores,
  usarReportero,
  type InformeDeError,
} from './reportarError.ts';

/**
 * Cuando la aplicacion falla (SCRUM-156).
 *
 * Lo que importa aqui no es que React atrape un error —eso lo hace React—, sino
 * lo que la persona encuentra despues: un mensaje claro, una salida y las lineas
 * de atencion a la vista. Y que avisar del error no se lleve nada de ella.
 */
const usuario = userEvent.setup({ delay: null });

const SECRETO = 'texto-del-diario-que-no-debe-salir';

// La portada se rompe a proposito, para probar el limite de las rutas. Las demas
// pantallas son las de verdad. `vi.hoisted` porque `vi.mock` se ejecuta antes que
// las constantes de arriba.
const { MENSAJE_DE_LA_PORTADA } = vi.hoisted(() => ({
  MENSAJE_DE_LA_PORTADA: 'Portada rota: texto-del-diario-que-no-debe-salir',
}));

vi.mock('../paginas/portada/Portada.tsx', () => ({
  Portada: () => {
    throw new Error(MENSAJE_DE_LA_PORTADA);
  },
}));

function Rota({ cuando = true }: { cuando?: boolean }) {
  if (cuando) {
    throw new TypeError(`No se pudo pintar: ${SECRETO}`);
  }

  return <p>Todo bien</p>;
}

let informes: InformeDeError[];

beforeEach(() => {
  informes = [];
  usarReportero((informe) => informes.push(informe));
  // React escribe en la consola cada error que atrapa. Es ruido en las pruebas.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  fijarLaZonaDeLaCuenta('America/Bogota');
});

afterEach(() => {
  usarReportero();
  olvidarLaZonaDeLaCuenta();
  vi.restoreAllMocks();
});

describe('la pantalla de error', () => {
  it('en vez de una pantalla en blanco, explica y ofrece una salida', () => {
    render(
      <LimiteDeErrores origen="raiz">
        <Rota />
      </LimiteDeErrores>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Algo no salió como esperábamos',
    );
    expect(screen.getByRole('button', { name: 'Intentarlo de nuevo' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/');
  });

  it('deja las lineas de atencion a la vista: 192 opcion 4 y 123', () => {
    render(
      <LimiteDeErrores origen="raiz">
        <Rota />
      </LimiteDeErrores>,
    );

    const seccion = screen.getByRole('region', {
      name: 'Si ahora mismo te sirve hablar con alguien',
    });

    expect(seccion).toHaveTextContent('Línea 192, opción 4');
    expect(seccion).toHaveTextContent('Línea 123');
  });

  it('fuera de Colombia no ensena un telefono que podria no ser el suyo', () => {
    // Un numero de otro pais, ensenado como propio, es peor que ninguno.
    fijarLaZonaDeLaCuenta('Europe/Madrid');

    render(
      <LimiteDeErrores origen="raiz">
        <Rota />
      </LimiteDeErrores>,
    );

    const seccion = screen.getByRole('region', {
      name: 'Si ahora mismo te sirve hablar con alguien',
    });

    expect(seccion).not.toHaveTextContent('192');
    expect(seccion).toHaveTextContent('Directorio internacional de líneas de ayuda');
    expect(screen.getByRole('link', { name: /Más información sobre/ })).toHaveAttribute(
      'href',
      'https://findahelpline.com/',
    );
  });

  it('lleva el foco al mensaje, para teclado y lector de pantalla', () => {
    render(
      <LimiteDeErrores origen="raiz">
        <Rota />
      </LimiteDeErrores>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
  });

  it('no depende de la sesion ni del enrutador: se pinta con todo roto', () => {
    // Ningun proveedor alrededor. Si usara `useSesion` o `Link`, aqui fallaria.
    expect(() =>
      render(
        <LimiteDeErrores origen="raiz">
          <Rota />
        </LimiteDeErrores>,
      ),
    ).not.toThrow();
  });

  it('no culpa a la persona ni promete lo que no sabe', () => {
    render(
      <LimiteDeErrores origen="raiz">
        <Rota />
      </LimiteDeErrores>,
    );

    const tarjeta = screen.getByRole('main');

    expect(tarjeta).toHaveTextContent('No es culpa tuya');
    expect(tarjeta).toHaveTextContent('Lo que ya habías guardado no se pierde por esto');
    expect(tarjeta).not.toHaveTextContent(/tu informaci[oó]n est[aá] a salvo|nada se perdi[oó]/i);
  });
});

describe('reintentar', () => {
  function Alternable() {
    const [rota, setRota] = useState(true);

    return (
      <>
        <button type="button" onClick={() => setRota(false)}>
          Arreglar
        </button>
        <LimiteDeErrores origen="ruta">
          <Rota cuando={rota} />
        </LimiteDeErrores>
      </>
    );
  }

  it('si el error ya no ocurre, vuelve a mostrar lo que habia', async () => {
    render(<Alternable />);
    await usuario.click(screen.getByRole('button', { name: 'Arreglar' }));
    await usuario.click(screen.getByRole('button', { name: 'Intentarlo de nuevo' }));

    expect(screen.getByText('Todo bien')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });

  it('si el error vuelve, cambia el mensaje: repetir el mismo boton no es una respuesta', async () => {
    render(
      <LimiteDeErrores origen="ruta">
        <Rota />
      </LimiteDeErrores>,
    );

    await usuario.click(screen.getByRole('button', { name: 'Intentarlo de nuevo' }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sigue sin funcionar');
    expect(screen.queryByRole('button', { name: 'Intentarlo de nuevo' })).not.toBeInTheDocument();
    // La salida y las lineas siguen ahi.
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toBeInTheDocument();
    expect(screen.getByText('Línea 123')).toBeInTheDocument();
  });

  it('cada intento se reporta', async () => {
    render(
      <LimiteDeErrores origen="ruta">
        <Rota />
      </LimiteDeErrores>,
    );
    await usuario.click(screen.getByRole('button', { name: 'Intentarlo de nuevo' }));

    expect(informes.map((informe) => informe.origen)).toEqual(['ruta', 'ruta']);
  });
});

describe('al cambiar de pantalla', () => {
  it('el error de la anterior se quita solo', () => {
    const { rerender } = render(
      <LimiteDeErrores origen="ruta" restablecerCon="/panel">
        <Rota />
      </LimiteDeErrores>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();

    rerender(
      <LimiteDeErrores origen="ruta" restablecerCon="/perfil">
        <Rota cuando={false} />
      </LimiteDeErrores>,
    );

    expect(screen.getByText('Todo bien')).toBeInTheDocument();
  });

  it('con la misma pantalla, el error se queda', () => {
    const { rerender } = render(
      <LimiteDeErrores origen="ruta" restablecerCon="/panel">
        <Rota />
      </LimiteDeErrores>,
    );

    rerender(
      <LimiteDeErrores origen="ruta" restablecerCon="/panel">
        <Rota />
      </LimiteDeErrores>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});

describe('el aviso del error no se lleva nada de la persona', () => {
  it('manda el tipo y la pila, nunca el mensaje', () => {
    render(
      <LimiteDeErrores origen="raiz">
        <Rota />
      </LimiteDeErrores>,
    );

    expect(informes).toHaveLength(1);
    expect(informes[0]).toMatchObject({ origen: 'raiz', nombre: 'TypeError' });
    expect(JSON.stringify(informes[0])).not.toContain(SECRETO);
    expect(informes[0]?.componentes).toContain('Rota');
  });

  it('un error que no es un Error (un texto lanzado) solo deja su tipo', () => {
    reportarError(`algo con ${SECRETO}`, 'ventana');

    expect(informes[0]).toMatchObject({ nombre: 'string', pila: '' });
    expect(JSON.stringify(informes[0])).not.toContain(SECRETO);
  });

  it('una linea del mensaje que parece un correo no se cuela en la pila', () => {
    const error = new Error('x');

    error.stack = [
      'Error: x',
      'ana@ejemplo.com',
      `Error: ${SECRETO}`,
      '    at pintar (http://localhost:5173/src/Algo.tsx:10:5)',
      'otraFuncion@http://localhost:5173/src/Otra.tsx:3:9',
    ].join('\n');

    reportarError(error, 'ventana');

    expect(informes[0]?.pila).toBe(
      [
        '    at pintar (http://localhost:5173/src/Algo.tsx:10:5)',
        'otraFuncion@http://localhost:5173/src/Otra.tsx:3:9',
      ].join('\n'),
    );
  });

  it('la ruta va sin consulta, sin almohadilla y sin identificadores', () => {
    expect(
      rutaSinIdentificadores('/actividad/0192c0de-0000-4000-8000-000000000192/resultado'),
    ).toBe('/actividad/:id/resultado');
    expect(rutaSinIdentificadores('/diario/12345')).toBe('/diario/:id');
    expect(rutaSinIdentificadores('/panel')).toBe('/panel');

    window.history.pushState({}, '', '/perfil?correo=ana@ejemplo.com#privado');
    reportarError(new Error('x'), 'ventana');

    expect(informes[0]?.ruta).toBe('/perfil');
    expect(JSON.stringify(informes[0])).not.toContain('ana@ejemplo.com');
  });

  it('un reportero que falla no causa otro error', () => {
    usarReportero(() => {
      throw new Error('el servicio no responde');
    });

    expect(() => reportarError(new Error('x'), 'ventana')).not.toThrow();
  });
});

describe('dentro de la aplicacion', () => {
  function IrAlAcceso() {
    const navegar = useNavigate();

    return (
      <button type="button" onClick={() => void navegar(RUTAS.ACCESO)}>
        Ir al acceso
      </button>
    );
  }

  const sesion: EstadoDeSesion = {
    sesion: null,
    cargando: false,
    correo: null,
    registrarse: vi.fn(),
    entrar: vi.fn(),
    entrarConGoogle: vi.fn(),
    pedirRecuperacion: vi.fn(),
    cambiarContrasena: vi.fn(),
    pedirCodigoDeVerificacion: vi.fn(),
    cambiarContrasenaConCodigo: vi.fn(),
    salir: vi.fn(),
  };

  it('un error en una ruta muestra la pantalla de error, y navegar a otra la quita', async () => {
    const { App } = await import('../App.tsx');

    render(
      <SesionContexto.Provider value={sesion}>
        <MemoryRouter initialEntries={[RUTAS.INICIO]}>
          <IrAlAcceso />
          <App />
        </MemoryRouter>
      </SesionContexto.Provider>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Algo no salió como esperábamos',
    );
    expect(informes[0]).toMatchObject({ origen: 'ruta', nombre: 'Error' });
    expect(JSON.stringify(informes[0])).not.toContain(SECRETO);
    // La navegacion sigue viva: el limite de la ruta no se llevo el resto.
    expect(screen.getByRole('button', { name: 'Ir al acceso' })).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Ir al acceso' }));

    expect(await screen.findByLabelText('Correo')).toBeInTheDocument();
    expect(screen.queryByText('Algo no salió como esperábamos')).not.toBeInTheDocument();
  });
});
