import type { Session } from '@supabase/supabase-js';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { App } from '../../App.tsx';
import { RUTAS } from '../../rutas/rutas.ts';
import { SesionContexto, type EstadoDeSesion } from '../../sesion/SesionContexto.ts';
import {
  DATOS_DEL_RESPONSABLE,
  POR_DEFINIR,
  TEXTOS_REVISADOS,
  VERSIONES_PUBLICADAS,
} from './datosLegales.ts';

/**
 * Se construye el estado a mano, igual que en `App.spec.tsx`: estas pruebas
 * hablan de los documentos legales y no de Supabase ni de la red.
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
    pedirCodigoDeVerificacion: vacio,
    cambiarContrasenaConCodigo: vacio,
    salir: vi.fn(),
    ...parcial,
  };
}

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

const DOCUMENTOS = [
  { ruta: RUTAS.PRIVACIDAD, titulo: 'Aviso de privacidad', enlace: 'Privacidad' },
  { ruta: RUTAS.TERMINOS, titulo: 'Términos y condiciones', enlace: 'Términos' },
  { ruta: RUTAS.COOKIES, titulo: 'Cookies y almacenamiento local', enlace: 'Cookies' },
] as const;

describe.each(DOCUMENTOS)('$titulo', ({ ruta, titulo, enlace }) => {
  it('se puede leer sin haber entrado', () => {
    pintar(ruta);

    expect(screen.getByRole('heading', { level: 1, name: titulo })).toBeInTheDocument();
  });

  it('tambien con la sesion abierta: no lleva al panel', () => {
    pintar(ruta, estado({ sesion: SESION }));

    expect(screen.getByRole('heading', { level: 1, name: titulo })).toBeInTheDocument();
  });

  it('tiene un solo h1 y todas sus secciones con un h2', () => {
    pintar(ruta);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);

    const secciones = screen.getAllByRole('region');
    expect(secciones.length).toBeGreaterThan(2);

    for (const seccion of secciones) {
      expect(within(seccion).getAllByRole('heading', { level: 2 })).toHaveLength(1);
    }
  });

  it('el indice lleva a cada seccion', () => {
    pintar(ruta);

    const indice = screen.getByRole('navigation', { name: 'En este documento' });
    const enlaces = within(indice).getAllByRole('link');

    expect(enlaces.length).toBe(screen.getAllByRole('region').length);

    for (const vinculo of enlaces) {
      const destino = vinculo.getAttribute('href')?.slice(1) ?? '';

      expect(document.getElementById(destino), `no existe #${destino}`).not.toBeNull();
    }
  });

  it('muestra los tres documentos en el pie y marca en el que esta', () => {
    pintar(ruta);

    const pie = screen.getByRole('navigation', { name: 'Documentos legales' });

    expect(
      within(pie)
        .getAllByRole('link')
        .map((vinculo) => vinculo.textContent),
    ).toEqual(['Privacidad', 'Términos', 'Cookies']);
    expect(within(pie).getByRole('link', { name: enlace })).toHaveAttribute('aria-current', 'page');
  });

  it('repite que no diagnostica ni reemplaza a un especialista', () => {
    pintar(ruta);

    expect(
      screen.getAllByText(
        /no diagnostica, no formula medicamentos y no reemplaza a un especialista/i,
      ).length,
    ).toBeGreaterThan(0);
  });
});

describe('Mientras el texto sea un borrador', () => {
  it.each(DOCUMENTOS)('$titulo lo dice arriba, donde no se puede pasar por alto', ({ ruta }) => {
    pintar(ruta);

    expect(TEXTOS_REVISADOS).toBe(false);
    expect(screen.getByRole('note')).toHaveTextContent(/borrador pendiente de revisión jurídica/i);
  });

  it.each(DOCUMENTOS)(
    '$titulo no se puede dar por revisado mientras quede algo por definir',
    ({ ruta }) => {
      // Es el candado: poner `TEXTOS_REVISADOS` en `true` con datos sin completar
      // hace fallar esta prueba, que es justo lo que se busca.
      const { container } = pintar(ruta);

      if (container.textContent?.includes(POR_DEFINIR) === true) {
        expect(TEXTOS_REVISADOS).toBe(false);
      }
    },
  );

  it('lo que falta por definir se ve distinto del resto del texto', () => {
    pintar(RUTAS.PRIVACIDAD);

    const pendientes = document.querySelectorAll('mark.legal__pendiente');

    expect(pendientes.length).toBeGreaterThan(0);

    for (const pendiente of pendientes) {
      expect(pendiente.textContent).toContain(POR_DEFINIR);
    }
  });
});

describe('Aviso de privacidad', () => {
  it('muestra su version, la misma que la API tiene como vigente', () => {
    pintar(RUTAS.PRIVACIDAD);

    expect(
      screen.getByText(new RegExp(`Versión ${VERSIONES_PUBLICADAS.privacidad}`)),
    ).toBeInTheDocument();
  });

  it('dice que es solo para mayores de 18 años y que a un menor no se le guarda nada', () => {
    pintar(RUTAS.PRIVACIDAD);

    const seccion = screen.getByRole('region', { name: /solo para mayores de 18 años/i });

    expect(seccion).toHaveTextContent(/no guardamos ninguno de tus datos/i);
  });

  it('identifica al responsable, con sus datos de contacto', () => {
    pintar(RUTAS.PRIVACIDAD);

    const seccion = screen.getByRole('region', { name: /quién es el responsable/i });

    expect(seccion).toHaveTextContent(/nombre o razón social/i);
    expect(seccion).toHaveTextContent(/correo para ejercer tus derechos/i);
  });

  it('muestra el nombre, la ciudad y el correo del responsable, tal como están en datosLegales', () => {
    pintar(RUTAS.PRIVACIDAD);

    const seccion = screen.getByRole('region', { name: /quién es el responsable/i });

    expect(DATOS_DEL_RESPONSABLE.nombre).not.toBe(POR_DEFINIR);
    expect(DATOS_DEL_RESPONSABLE.correo).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    expect(seccion).toHaveTextContent(DATOS_DEL_RESPONSABLE.nombre);
    expect(seccion).toHaveTextContent(DATOS_DEL_RESPONSABLE.domicilio);
    expect(seccion).toHaveTextContent(DATOS_DEL_RESPONSABLE.correo);
  });

  it('no publica un documento de identidad ni una dirección de calle del responsable', () => {
    pintar(RUTAS.PRIVACIDAD);

    const seccion = screen.getByRole('region', { name: /quién es el responsable/i });

    // La ley no los exige en el aviso y, una vez publicados, no se retiran.
    expect(Object.keys(DATOS_DEL_RESPONSABLE)).toEqual([
      'nombre',
      'domicilio',
      'correo',
      'telefono',
    ]);
    expect(seccion).not.toHaveTextContent(
      /c[eé]dula|documento de identidad|NIT|identificaci[oó]n/i,
    );
  });

  it('nombra los datos sensibles y dice que darlos es voluntario', () => {
    pintar(RUTAS.PRIVACIDAD);

    const seccion = screen.getByRole('region', { name: /datos sensibles/i });

    expect(seccion).toHaveTextContent(/voluntario/i);
    expect(seccion).toHaveTextContent(/no los vendemos/i);
  });

  it('explica los derechos y como ejercerlos dentro de la aplicacion', () => {
    pintar(RUTAS.PRIVACIDAD);

    const seccion = screen.getByRole('region', { name: /tus derechos/i });

    expect(seccion).toHaveTextContent(/descargar tus datos/i);
    expect(seccion).toHaveTextContent(/borrar tu cuenta/i);
    expect(within(seccion).getByRole('link', { name: 'sic.gov.co' })).toHaveAttribute(
      'rel',
      expect.stringContaining('noopener'),
    );
  });

  it('el diario solo se lee para recomendar si la persona lo permite', () => {
    pintar(RUTAS.PRIVACIDAD);

    expect(
      screen.getByText(/el diario solo se lee para recomendarte algo si tú lo permites/i),
    ).toBeInTheDocument();
  });
});

describe('Términos y condiciones', () => {
  it('lleva la frase de que no formula, no diagnostica y no reemplaza a un especialista médico', () => {
    pintar(RUTAS.TERMINOS);

    expect(
      screen.getByText(/no formula, no diagnostica y no reemplaza a un especialista médico/i),
    ).toBeInTheDocument();
  });

  it('dice que es solo para mayores de 18 años', () => {
    pintar(RUTAS.TERMINOS);

    expect(
      screen.getByRole('region', { name: /solo para mayores de 18 años/i }),
    ).toBeInTheDocument();
  });

  it('muestra su version', () => {
    pintar(RUTAS.TERMINOS);

    expect(
      screen.getByText(new RegExp(`Versión ${VERSIONES_PUBLICADAS.terminos}`)),
    ).toBeInTheDocument();
  });

  it('enlaza al aviso de privacidad sin recargar la pagina', () => {
    pintar(RUTAS.TERMINOS);

    const enlace = screen.getByRole('link', { name: 'aviso de privacidad' });

    expect(enlace).toHaveAttribute('href', RUTAS.PRIVACIDAD);
  });
});

describe('Cookies y almacenamiento local', () => {
  it('dice sin rodeos que no hay cookies de publicidad ni de seguimiento', () => {
    pintar(RUTAS.COOKIES);

    expect(screen.getByText(/no usa cookies de publicidad ni de seguimiento/i)).toBeInTheDocument();
  });

  it('lista lo que guarda en una tabla con titulo y encabezados', () => {
    pintar(RUTAS.COOKIES);

    const tabla = screen.getByRole('table', {
      name: /elementos que vsd health guarda en tu navegador/i,
    });

    expect(
      within(tabla)
        .getAllByRole('columnheader')
        .map((c) => c.textContent),
    ).toEqual(['Nombre', 'Para qué sirve', 'Cuánto dura', 'Tipo']);
    expect(within(tabla).getByText('vsd.sesion')).toBeInTheDocument();
    expect(within(tabla).getByText('vsd.tema')).toBeInTheDocument();
  });

  it('no inventa elementos: la sesion en una sola pestana no se usa hoy y no sale', () => {
    pintar(RUTAS.COOKIES);

    expect(screen.queryByText('vsd.solo-esta-pestana')).not.toBeInTheDocument();
  });

  it('no lleva version: no hay nada que aceptar', () => {
    pintar(RUTAS.COOKIES);

    expect(screen.queryByText(/Versión \d{4}-/)).not.toBeInTheDocument();
  });
});

describe('Los enlaces desde el resto del sitio', () => {
  it('la portada los tiene en el pie', () => {
    pintar(RUTAS.INICIO);

    const pie = screen.getByRole('navigation', { name: 'Documentos legales' });

    expect(within(pie).getByRole('link', { name: 'Privacidad' })).toHaveAttribute(
      'href',
      RUTAS.PRIVACIDAD,
    );
    expect(within(pie).getByRole('link', { name: 'Términos' })).toHaveAttribute(
      'href',
      RUTAS.TERMINOS,
    );
    expect(within(pie).getByRole('link', { name: 'Cookies' })).toHaveAttribute(
      'href',
      RUTAS.COOKIES,
    );
  });

  it.each([RUTAS.ACCESO, RUTAS.REGISTRO, RUTAS.RECUPERAR])(
    '%s los tiene, para poder leerlos antes de aceptar',
    (ruta) => {
      pintar(ruta);

      const pie = screen.getByRole('navigation', { name: 'Documentos legales' });

      expect(within(pie).getAllByRole('link')).toHaveLength(3);
    },
  );
});
