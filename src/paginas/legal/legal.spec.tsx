import type { Session } from '@supabase/supabase-js';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { App } from '../../App.tsx';
import { RUTAS } from '../../rutas/rutas.ts';
import { SesionContexto, type EstadoDeSesion } from '../../sesion/SesionContexto.ts';
import {
  DATOS_DEL_RESPONSABLE,
  FECHA_DE_ACTUALIZACION,
  POR_DEFINIR,
  TEXTOS_REVISADOS,
  VERSIONES_PUBLICADAS,
} from './datosLegales.ts';
import { PorDefinir } from './PaginaLegal.tsx';

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

async function pintar(ruta: string, valor: EstadoDeSesion = estado()) {
  const pintado = render(
    <SesionContexto.Provider value={valor}>
      <MemoryRouter initialEntries={[ruta]}>
        <App />
      </MemoryRouter>
    </SesionContexto.Provider>,
  );

  // Las pantallas se bajan cuando se necesitan (SCRUM-283): se espera a que llegue la del documento.
  await screen.findByRole('heading', { level: 1 });

  return pintado;
}

const DOCUMENTOS = [
  { ruta: RUTAS.PRIVACIDAD, titulo: 'Aviso de privacidad', enlace: 'Privacidad' },
  { ruta: RUTAS.TERMINOS, titulo: 'Términos y condiciones', enlace: 'Términos' },
  { ruta: RUTAS.COOKIES, titulo: 'Cookies y almacenamiento local', enlace: 'Cookies' },
] as const;

describe.each(DOCUMENTOS)('$titulo', ({ ruta, titulo, enlace }) => {
  it('se puede leer sin haber entrado', async () => {
    await pintar(ruta);

    expect(screen.getByRole('heading', { level: 1, name: titulo })).toBeInTheDocument();
  });

  it('tambien con la sesion abierta: no lleva al panel', async () => {
    await pintar(ruta, estado({ sesion: SESION }));

    expect(screen.getByRole('heading', { level: 1, name: titulo })).toBeInTheDocument();
  });

  it('tiene un solo h1 y todas sus secciones con un h2', async () => {
    await pintar(ruta);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);

    const secciones = screen.getAllByRole('region');
    expect(secciones.length).toBeGreaterThan(2);

    for (const seccion of secciones) {
      expect(within(seccion).getAllByRole('heading', { level: 2 })).toHaveLength(1);
    }
  });

  it('el indice lleva a cada seccion', async () => {
    await pintar(ruta);

    const indice = screen.getByRole('navigation', { name: 'En este documento' });
    const enlaces = within(indice).getAllByRole('link');

    expect(enlaces.length).toBe(screen.getAllByRole('region').length);

    for (const vinculo of enlaces) {
      const destino = vinculo.getAttribute('href')?.slice(1) ?? '';

      expect(document.getElementById(destino), `no existe #${destino}`).not.toBeNull();
    }
  });

  it('muestra los tres documentos en el pie y marca en el que esta', async () => {
    await pintar(ruta);

    const pie = screen.getByRole('navigation', { name: 'Documentos legales' });

    expect(
      within(pie)
        .getAllByRole('link')
        .map((vinculo) => vinculo.textContent),
    ).toEqual(['Privacidad', 'Términos', 'Cookies']);
    expect(within(pie).getByRole('link', { name: enlace })).toHaveAttribute('aria-current', 'page');
  });

  it('repite que no diagnostica ni reemplaza a un especialista', async () => {
    await pintar(ruta);

    expect(
      screen.getAllByText(
        /no diagnostica, no formula medicamentos y no reemplaza a un especialista/i,
      ).length,
    ).toBeGreaterThan(0);
  });
});

describe('Los textos estan cerrados (SCRUM-235)', () => {
  it('el equipo los da por completos', () => {
    expect(TEXTOS_REVISADOS).toBe(true);
  });

  it.each(DOCUMENTOS)('$titulo ya no se presenta como borrador', async ({ ruta }) => {
    const { container } = await pintar(ruta);

    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent(/borrador/i);
    expect(container.querySelector('.legal__meta')).toHaveTextContent(
      `Vigente · actualizado el ${FECHA_DE_ACTUALIZACION}`,
    );
  });

  it.each(DOCUMENTOS)('$titulo no deja nada por definir', async ({ ruta }) => {
    // Es el candado: un texto dado por cerrado no puede llevar una marca de pendiente.
    const { container } = await pintar(ruta);

    expect(container.textContent).not.toContain(POR_DEFINIR);
    expect(container.querySelectorAll('mark.legal__pendiente')).toHaveLength(0);
  });

  it('los datos del responsable estan todos completos', () => {
    for (const [campo, valor] of Object.entries(DATOS_DEL_RESPONSABLE)) {
      expect(valor.trim(), campo).not.toBe('');
      expect(valor, campo).not.toBe(POR_DEFINIR);
    }
  });

  it('lo que falte por definir en el futuro se ve distinto del resto del texto', () => {
    const { container } = render(<PorDefinir que="el plazo" />);

    const marca = container.querySelector('mark.legal__pendiente');

    expect(marca).toHaveTextContent(`${POR_DEFINIR} el plazo`);
  });

  it.each([RUTAS.PRIVACIDAD, RUTAS.TERMINOS])(
    '%s da un solo correo, el oficial, en todo el documento',
    async (ruta) => {
      const { container } = await pintar(ruta);

      // `textContent` pega un bloque con el siguiente sin espacio; los nodos de texto, no.
      const trozos: string[] = [];
      const recorrido = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      while (recorrido.nextNode()) {
        trozos.push(recorrido.currentNode.textContent ?? '');
      }
      const correos = trozos.join(' ').match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? [];

      expect(DATOS_DEL_RESPONSABLE.correo).toBe('vsdcompany69@gmail.com');
      expect(correos.length).toBeGreaterThan(0);
      expect(new Set(correos)).toEqual(new Set(['vsdcompany69@gmail.com']));
    },
  );

  it('las versiones publicadas son las mismas que tiene la API como vigentes', () => {
    // Ver `AvisoDePrivacidad.spec.ts` del backend: se cambian a la vez.
    expect(VERSIONES_PUBLICADAS).toEqual({ privacidad: '2026-10-3', terminos: '2026-10-3' });
  });
});

describe('Aviso de privacidad', () => {
  it('muestra su version, la misma que la API tiene como vigente', async () => {
    await pintar(RUTAS.PRIVACIDAD);

    expect(
      screen.getByText(new RegExp(`Versión ${VERSIONES_PUBLICADAS.privacidad}`)),
    ).toBeInTheDocument();
  });

  it('dice que es solo para mayores de 18 años y que a un menor no se le guarda nada', async () => {
    await pintar(RUTAS.PRIVACIDAD);

    const seccion = screen.getByRole('region', { name: /solo para mayores de 18 años/i });

    expect(seccion).toHaveTextContent(/no guardamos ninguno de tus datos/i);
  });

  it('identifica al responsable, con sus datos de contacto', async () => {
    await pintar(RUTAS.PRIVACIDAD);

    const seccion = screen.getByRole('region', { name: /quién es el responsable/i });

    expect(seccion).toHaveTextContent(/nombre o razón social/i);
    expect(seccion).toHaveTextContent(/correo para ejercer tus derechos/i);
  });

  it('muestra el nombre, la ciudad y el correo del responsable, tal como están en datosLegales', async () => {
    await pintar(RUTAS.PRIVACIDAD);

    const seccion = screen.getByRole('region', { name: /quién es el responsable/i });

    expect(DATOS_DEL_RESPONSABLE.nombre).not.toBe(POR_DEFINIR);
    expect(DATOS_DEL_RESPONSABLE.correo).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    expect(seccion).toHaveTextContent(DATOS_DEL_RESPONSABLE.nombre);
    expect(seccion).toHaveTextContent(DATOS_DEL_RESPONSABLE.domicilio);
    expect(seccion).toHaveTextContent(DATOS_DEL_RESPONSABLE.correo);
  });

  it('no publica un teléfono: el repositorio y la página son públicos y no se retira', async () => {
    await pintar(RUTAS.PRIVACIDAD);

    const seccion = screen.getByRole('region', { name: /quién es el responsable/i });

    expect(seccion).not.toHaveTextContent(/tel[eé]fono|\b3\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/i);
  });

  it('la autorización de datos sensibles y de transferencia se da en la casilla del aviso', async () => {
    await pintar(RUTAS.PRIVACIDAD);

    const seccion = screen.getByRole('region', { name: /dónde se guardan/i });

    // El formulario de registro tiene una casilla para el aviso y otra para los términos: el
    // texto no puede hablar de una «casilla única» que no existe (`CamposDelRegistro.tsx`).
    expect(seccion).toHaveTextContent(
      /casilla de aceptación del aviso de privacidad al crear tu cuenta/i,
    );
    expect(seccion).not.toHaveTextContent(/casilla única/i);
    expect(seccion).toHaveTextContent(/autorización expresa e inequívoca/i);
    expect(seccion).toHaveTextContent(/tratamiento de tus datos sensibles/i);
    expect(seccion).toHaveTextContent(/transferir tus datos personales/i);
    expect(seccion).toHaveTextContent(/Estados Unidos de América u otros países/i);
  });

  it('al borrar la cuenta se conserva una constancia mínima, y dice cuál es y por cuánto', async () => {
    await pintar(RUTAS.PRIVACIDAD);

    const seccion = screen.getByRole('region', { name: /cuánto tiempo los conservamos/i });

    // ADR 0026 del backend: «todo o nada» ya no es toda la verdad.
    expect(seccion).toHaveTextContent(/lo único que conservamos .* es una constancia/i);
    expect(seccion).toHaveTextContent(/versiones del aviso y de los términos con su fecha/i);
    expect(seccion).toHaveTextContent(/cuándo creaste y borraste la cuenta/i);
    expect(seccion).toHaveTextContent(
      /identificadores internos sin tu nombre, correo ni datos de bienestar/i,
    );
    expect(seccion).toHaveTextContent(/La ley nos exige poder demostrar tu autorización/i);
    expect(seccion).toHaveTextContent(/plazo de 10 años.*tras lo cual se elimina/i);
  });

  it('las copias de respaldo se conservan como máximo 7 días y no queda un plazo por decidir', async () => {
    await pintar(RUTAS.PRIVACIDAD);

    const seccion = screen.getByRole('region', { name: /cuánto tiempo los conservamos/i });

    expect(seccion).toHaveTextContent(
      'Las copias de respaldo automatizadas de nuestros proveedores pueden conservar datos cifrados por un máximo de 7 días después de que borres tu cuenta, tras lo cual se sobrescriben o eliminan definitivamente.',
    );
    expect(seccion).not.toHaveTextContent(/7 a 30 días/);
  });

  it('borrar la cuenta no promete «todo lo tuyo» sin decir lo de la constancia', async () => {
    await pintar(RUTAS.PRIVACIDAD);

    const seccion = screen.getByRole('region', { name: /tus derechos/i });

    expect(seccion).not.toHaveTextContent(/con todo lo tuyo\./i);
    expect(seccion).toHaveTextContent(/salvo la constancia de lo que aceptaste/i);
  });

  it('no publica un documento de identidad ni una dirección de calle del responsable', async () => {
    await pintar(RUTAS.PRIVACIDAD);

    const seccion = screen.getByRole('region', { name: /quién es el responsable/i });

    // La ley no los exige en el aviso y, una vez publicados, no se retiran.
    expect(Object.keys(DATOS_DEL_RESPONSABLE)).toEqual(['nombre', 'domicilio', 'correo']);
    expect(seccion).not.toHaveTextContent(
      /c[eé]dula|documento de identidad|NIT|identificaci[oó]n/i,
    );
  });

  it('nombra los datos sensibles y dice que darlos es voluntario', async () => {
    await pintar(RUTAS.PRIVACIDAD);

    const seccion = screen.getByRole('region', { name: /datos sensibles/i });

    expect(seccion).toHaveTextContent(/voluntario/i);
    expect(seccion).toHaveTextContent(/no los vendemos/i);
  });

  it('explica los derechos y como ejercerlos dentro de la aplicacion', async () => {
    await pintar(RUTAS.PRIVACIDAD);

    const seccion = screen.getByRole('region', { name: /tus derechos/i });

    expect(seccion).toHaveTextContent(/descargar tus datos/i);
    expect(seccion).toHaveTextContent(/borrar tu cuenta/i);
    expect(within(seccion).getByRole('link', { name: 'sic.gov.co' })).toHaveAttribute(
      'rel',
      expect.stringContaining('noopener'),
    );
  });

  it('el diario solo se lee para recomendar si la persona lo permite', async () => {
    await pintar(RUTAS.PRIVACIDAD);

    expect(
      screen.getByText(/el diario solo se lee para recomendarte algo si tú lo permites/i),
    ).toBeInTheDocument();
  });
});

describe('Términos y condiciones', () => {
  it('lleva la frase de que no formula, no diagnostica y no reemplaza a un especialista médico', async () => {
    await pintar(RUTAS.TERMINOS);

    expect(
      screen.getByText(/no formula, no diagnostica y no reemplaza a un especialista médico/i),
    ).toBeInTheDocument();
  });

  it('dice que es solo para mayores de 18 años', async () => {
    await pintar(RUTAS.TERMINOS);

    expect(
      screen.getByRole('region', { name: /solo para mayores de 18 años/i }),
    ).toBeInTheDocument();
  });

  it('muestra su version', async () => {
    await pintar(RUTAS.TERMINOS);

    expect(
      screen.getByText(new RegExp(`Versión ${VERSIONES_PUBLICADAS.terminos}`)),
    ).toBeInTheDocument();
  });

  it('enlaza al aviso de privacidad sin recargar la pagina', async () => {
    await pintar(RUTAS.TERMINOS);

    const enlace = screen.getByRole('link', { name: 'aviso de privacidad' });

    expect(enlace).toHaveAttribute('href', RUTAS.PRIVACIDAD);
  });

  describe('límites de nuestra responsabilidad', () => {
    function seccion() {
      return screen.getByRole('region', { name: /límites de nuestra responsabilidad/i });
    }

    it('se redacta conforme al Estatuto del Consumidor, no contra él', async () => {
      await pintar(RUTAS.TERMINOS);

      expect(seccion()).toHaveTextContent(/Ley 1480 de 2011 \(Estatuto del Consumidor\)/);
      expect(seccion()).toHaveTextContent(/calidad e idoneidad del software/i);
    });

    it('limita lo que se puede limitar: el funcionamiento técnico y los datos, no tus decisiones', async () => {
      await pintar(RUTAS.TERMINOS);

      expect(seccion()).toHaveTextContent(
        /herramienta de software de apoyo autónomo y no un servicio médico, psicológico ni terapéutico/i,
      );
      expect(seccion()).toHaveTextContent(
        /se limita exclusivamente al correcto funcionamiento técnico de la plataforma y a la protección de tus datos/i,
      );
      expect(seccion()).toHaveTextContent(
        /No asumimos responsabilidad por las decisiones de salud o de vida que tomes/i,
      );
      expect(seccion()).toHaveTextContent(/no sustituye el criterio de un profesional/i);
    });

    it('no quita los derechos que la ley da y que un contrato no puede quitar', async () => {
      await pintar(RUTAS.TERMINOS);

      // Una cláusula que los excluyera sería ineficaz (Ley 1480 de 2011, art. 43) y no protegería
      // de nada: la salvedad va escrita.
      expect(seccion()).toHaveTextContent(
        /Nada de lo anterior limita los derechos que la ley te reconoce como consumidor y como titular de datos personales/i,
      );
    });

    it('no promete lo que la sección de disponibilidad niega', async () => {
      await pintar(RUTAS.TERMINOS);

      const disponibilidad = screen.getByRole('region', { name: /disponibilidad y cambios/i });

      expect(disponibilidad).toHaveTextContent(
        /no garantizamos que esté disponible sin interrupciones/i,
      );
      expect(seccion()).not.toHaveTextContent(/ininterrump|sin interrupciones|siempre disponible/i);
    });
  });
});

describe('Cookies y almacenamiento local', () => {
  it('dice sin rodeos que no hay cookies de publicidad ni de seguimiento', async () => {
    await pintar(RUTAS.COOKIES);

    expect(screen.getByText(/no usa cookies de publicidad ni de seguimiento/i)).toBeInTheDocument();
  });

  it('lista lo que guarda en una tabla con titulo y encabezados', async () => {
    await pintar(RUTAS.COOKIES);

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

  it('no inventa elementos: la sesion en una sola pestana no se usa hoy y no sale', async () => {
    await pintar(RUTAS.COOKIES);

    expect(screen.queryByText('vsd.solo-esta-pestana')).not.toBeInTheDocument();
  });

  it('no lleva version: no hay nada que aceptar', async () => {
    await pintar(RUTAS.COOKIES);

    expect(screen.queryByText(/Versión \d{4}-/)).not.toBeInTheDocument();
  });

  it('la fecha de actualización se ve aunque no tenga versión', async () => {
    const { container } = await pintar(RUTAS.COOKIES);

    expect(container.querySelector('.legal__meta')).toHaveTextContent(
      `Vigente · actualizado el ${FECHA_DE_ACTUALIZACION}`,
    );
  });
});

describe('Los enlaces desde el resto del sitio', () => {
  it('la portada los tiene en el pie', async () => {
    await pintar(RUTAS.INICIO);

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
    async (ruta) => {
      await pintar(ruta);

      const pie = screen.getByRole('navigation', { name: 'Documentos legales' });

      expect(within(pie).getAllByRole('link')).toHaveLength(3);
    },
  );
});
