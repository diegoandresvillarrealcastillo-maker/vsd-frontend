import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cuantosDependenDe } from '../sincronizacion/acciones.ts';
import { leerLoEscritoDe } from '../sincronizacion/loGuardadoEnEsteEquipo.ts';
import { nuevaOperacion, type Operacion } from '../sincronizacion/cola.ts';
import {
  descartar,
  reintentar,
  sincronizarAhora,
  type EstadoDeLaSincronizacion,
} from '../sincronizacion/estado.ts';
import {
  cambiosParaMostrar,
  contarCambios,
  indicadorDe,
  type EstadoDeLaConexion,
} from '../sincronizacion/resumen.ts';
import { PanelDeSincronizacion } from './PanelDeSincronizacion.tsx';

const mundo = vi.hoisted(() => ({
  estado: null as unknown as EstadoDeLaSincronizacion,
}));

vi.mock('../sincronizacion/estado.ts', () => ({
  useSincronizacion: () => mundo.estado,
  sincronizarAhora: vi.fn(() => Promise.resolve()),
  reintentar: vi.fn(() => Promise.resolve()),
  descartar: vi.fn(() => Promise.resolve(1)),
}));
vi.mock('../sincronizacion/acciones.ts', () => ({
  cuantosDependenDe: vi.fn(() => Promise.resolve(0)),
}));
vi.mock('../sincronizacion/loGuardadoEnEsteEquipo.ts', () => ({
  leerLoEscritoDe: vi.fn(() => Promise.resolve(null)),
}));

let contador = 0;

function operacion(cambios: Partial<Operacion> = {}): Operacion {
  contador += 1;

  return {
    ...nuevaOperacion(
      {
        operationId: `op-${String(contador)}`,
        tipo: 'diario.escribir',
        entidad: `diario:${String(contador)}`,
        payload: { contenido: 'TEXTO-MUY-PRIVADO' },
      },
      new Date(),
    ),
    orden: contador,
    ...cambios,
  };
}

function armar(
  operaciones: Operacion[] = [],
  cambios: Partial<EstadoDeLaSincronizacion> & { conexion?: EstadoDeLaConexion } = {},
): void {
  const { conexion = 'con_conexion', sincronizando = false, ...resto } = cambios;
  const contadores = contarCambios(operaciones);

  mundo.estado = {
    hayAlmacen: true,
    conexion,
    sincronizando,
    contadores,
    cambios: cambiosParaMostrar(operaciones, new Date()),
    indicador: indicadorDe(conexion, sincronizando, contadores),
    ultimaSincronizacion: null,
    aviso: null,
    peticionDeLista: 0,
    ...resto,
  };
}

function pintar(alCerrar = vi.fn()) {
  render(<PanelDeSincronizacion id="panel" alCerrar={alCerrar} />);

  return alCerrar;
}

const RECHAZADA = {
  estado: 'requiere_atencion' as const,
  error: { codigo: 'SIN_RESPUESTA', momento: new Date().toISOString() },
};

/** Una operacion rechazada que no es del diario: lo que se pregunta al descartar es lo general. */
const RECHAZADA_DE_UN_PENDIENTE = {
  ...RECHAZADA,
  tipo: 'pendiente.crear' as const,
  payload: { texto: 'Llamar a la EPS' },
};

beforeEach(() => {
  vi.mocked(sincronizarAhora).mockClear();
  vi.mocked(reintentar).mockClear();
  vi.mocked(descartar).mockReset();
  vi.mocked(descartar).mockResolvedValue(1);
  vi.mocked(cuantosDependenDe).mockReset();
  vi.mocked(cuantosDependenDe).mockResolvedValue(0);
  vi.mocked(leerLoEscritoDe).mockReset();
  vi.mocked(leerLoEscritoDe).mockResolvedValue(null);
  armar();
});

describe('PanelDeSincronizacion: el estado', () => {
  it('es una region con titulo y su identificador', () => {
    pintar();

    const region = screen.getByRole('region', { name: 'Lo guardado en este equipo' });

    expect(region).toHaveAttribute('id', 'panel');
  });

  it('con conexion, dice que lo que se haga se envia solo', () => {
    pintar();

    expect(screen.getByText(/Con conexión\. Lo que hagas se envía solo\./)).toBeInTheDocument();
  });

  it('sin conexion, dice que se guarda aqui y se envia cuando vuelva', () => {
    armar([], { conexion: 'sin_conexion' });
    pintar();

    expect(
      screen.getByText(
        /Sin conexión\. Lo que hagas se guarda aquí y se envía solo cuando vuelva\./,
      ),
    ).toBeInTheDocument();
  });

  it('dice la ultima vez que se envio, si se sabe', () => {
    armar([], { ultimaSincronizacion: new Date().toISOString() });
    pintar();

    expect(screen.getByText(/Última vez que se envió: /)).toBeInTheDocument();
  });

  it('si nunca se envio, no inventa nada', () => {
    pintar();

    expect(screen.queryByText(/Última vez/)).toBeNull();
  });

  it('el boton "Cerrar" avisa', async () => {
    const alCerrar = pintar();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(alCerrar).toHaveBeenCalledTimes(1);
  });
});

describe('PanelDeSincronizacion: Sincronizar ahora', () => {
  it('con conexion, sincroniza', async () => {
    pintar();

    const boton = screen.getByRole('button', { name: 'Sincronizar ahora' });

    expect(boton).toHaveAttribute('aria-disabled', 'false');

    await userEvent.setup().click(boton);

    expect(sincronizarAhora).toHaveBeenCalledTimes(1);
  });

  it('sin conexion no se puede, pero el boton sigue ahi y dice por que', async () => {
    armar([], { conexion: 'sin_conexion' });
    pintar();

    const boton = screen.getByRole('button', { name: 'Sincronizar ahora' });

    expect(boton).toHaveAttribute('aria-disabled', 'true');
    // No es `disabled`: se puede enfocar y leer.
    expect(boton).not.toBeDisabled();
    expect(boton).toHaveAccessibleDescription(
      'Sin conexión no se puede. Se enviará solo cuando vuelva.',
    );

    await userEvent.setup().click(boton);

    expect(sincronizarAhora).not.toHaveBeenCalled();
  });

  it('con conexion no hay explicacion que dar', () => {
    pintar();

    expect(screen.queryByText(/no se puede/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Sincronizar ahora' })).not.toHaveAttribute(
      'aria-describedby',
    );
  });

  it('mientras envia, lo dice y no se puede pulsar otra vez', async () => {
    armar([], { sincronizando: true });
    pintar();

    const boton = screen.getByRole('button', { name: 'Sincronizando…' });

    expect(boton).toHaveAttribute('aria-disabled', 'true');

    await userEvent.setup().click(boton);

    expect(sincronizarAhora).not.toHaveBeenCalled();
  });

  it('se alcanza con el teclado y se activa con Enter', async () => {
    const usuario = userEvent.setup();

    pintar();
    screen.getByRole('button', { name: 'Sincronizar ahora' }).focus();
    await usuario.keyboard('{Enter}');

    expect(sincronizarAhora).toHaveBeenCalledTimes(1);
  });
});

describe('PanelDeSincronizacion: la lista', () => {
  it('sin cambios, lo dice', () => {
    pintar();

    expect(screen.getByText('No hay cambios guardados en este equipo.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('cada cambio: el tipo, cuando se hizo y que le pasa', () => {
    armar([operacion()]);
    pintar();

    const lista = screen.getByRole('list', { name: 'Cambios guardados en este equipo' });
    const cambio = within(lista).getByRole('listitem');

    expect(within(cambio).getByText('Anotación del diario')).toBeInTheDocument();
    expect(
      within(cambio).getByText('Guardado en este equipo. Se enviará solo.'),
    ).toBeInTheDocument();
    expect(within(cambio).getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument();
  });

  it('NUNCA ensena lo escrito', () => {
    armar([operacion()]);
    pintar();

    expect(screen.queryByText(/TEXTO-MUY-PRIVADO/)).toBeNull();
  });

  it('lo que esta esperando su turno no tiene botones: no es de la persona', () => {
    armar([operacion(), operacion({ estado: 'enviando' })]);
    pintar();

    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Descartar' })).toBeNull();
  });

  it('lo rechazado se puede reintentar o descartar, y dice por que se rechazo', () => {
    armar([operacion(RECHAZADA)]);
    pintar();

    expect(
      screen.getByText('El servidor no respondió después de varios intentos.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeInTheDocument();
  });

  it('cada boton depende de lo suyo: se puede reintentar pero no descartar, y al reves', () => {
    armar([operacion(RECHAZADA), operacion(RECHAZADA)]);

    const [primero, segundo] = mundo.estado.cambios;

    mundo.estado = {
      ...mundo.estado,
      cambios: [
        { ...primero!, puedeReintentarse: true, puedeDescartarse: false },
        { ...segundo!, puedeReintentarse: false, puedeDescartarse: true },
      ],
    };
    pintar();

    const [soloReintentar, soloDescartar] = screen.getAllByRole('listitem');

    expect(within(soloReintentar!).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(within(soloReintentar!).queryByRole('button', { name: 'Descartar' })).toBeNull();
    expect(within(soloDescartar!).queryByRole('button', { name: 'Reintentar' })).toBeNull();
    expect(within(soloDescartar!).getByRole('button', { name: 'Descartar' })).toBeInTheDocument();
  });

  it('un conflicto solo se descarta', () => {
    armar([
      operacion({
        estado: 'conflicto',
        error: { codigo: 'VERSION_DESACTUALIZADA', estado: 409, momento: new Date().toISOString() },
      }),
    ]);
    pintar();

    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeInTheDocument();
  });

  it('lo que necesita a la persona va primero', () => {
    armar([operacion({ orden: 1 }), operacion({ ...RECHAZADA, orden: 2 })]);
    pintar();

    const items = screen.getAllByRole('listitem');

    expect(items[0]).toHaveTextContent('El servidor no respondió');
    expect(items[1]).toHaveTextContent('Se enviará solo');
  });
});

describe('PanelDeSincronizacion: reintentar', () => {
  it('lo devuelve a la cola, lo anuncia, y lleva el foco al titulo', async () => {
    armar([operacion(RECHAZADA)]);
    pintar();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(reintentar).toHaveBeenCalledTimes(1);
    expect(reintentar).toHaveBeenCalledWith(mundo.estado.cambios[0]?.operationId);
    expect(await screen.findByText('El cambio volvió a la cola.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Lo guardado en este equipo' })).toHaveFocus();
  });
});

describe('PanelDeSincronizacion: descartar pregunta primero', () => {
  it('al pulsar, no descarta: pregunta, y avisa que no se puede recuperar', async () => {
    armar([operacion(RECHAZADA_DE_UN_PENDIENTE)]);
    pintar();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Descartar' }));

    expect(
      await screen.findByText(/¿Descartar este cambio\? No se podrá recuperar\./),
    ).toBeInTheDocument();
    expect(descartar).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sí, descartar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No, conservarlo' })).toBeInTheDocument();
  });

  it('mientras pregunta, ya no ofrece reintentar ni descartar de ese cambio', async () => {
    armar([operacion(RECHAZADA_DE_UN_PENDIENTE)]);
    pintar();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Descartar' }));
    await screen.findByText(/¿Descartar este cambio\?/);

    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Descartar' })).toBeNull();
  });

  it('"No, conservarlo" vuelve a como estaba, sin descartar nada', async () => {
    const usuario = userEvent.setup();

    armar([operacion(RECHAZADA_DE_UN_PENDIENTE)]);
    pintar();
    await usuario.click(screen.getByRole('button', { name: 'Descartar' }));
    await usuario.click(await screen.findByRole('button', { name: 'No, conservarlo' }));

    expect(descartar).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeInTheDocument();
    expect(screen.queryByText(/¿Descartar este cambio\?/)).toBeNull();
  });

  it('al preguntar, el foco va a lo seguro («No, conservarlo»): el boton que se pulso ya no esta', async () => {
    armar([operacion(RECHAZADA_DE_UN_PENDIENTE)]);
    pintar();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Descartar' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'No, conservarlo' })).toHaveFocus();
    });
  });

  it('al conservarlo, el foco no se pierde: va al titulo del panel', async () => {
    const usuario = userEvent.setup();

    armar([operacion(RECHAZADA_DE_UN_PENDIENTE)]);
    pintar();
    await usuario.click(screen.getByRole('button', { name: 'Descartar' }));
    await usuario.click(await screen.findByRole('button', { name: 'No, conservarlo' }));

    expect(screen.getByRole('heading', { name: 'Lo guardado en este equipo' })).toHaveFocus();
  });

  it('la pregunta es un grupo con nombre: quien llega a sus botones oye de que se trata', async () => {
    armar([operacion(RECHAZADA_DE_UN_PENDIENTE)]);
    pintar();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Descartar' }));

    expect(
      await screen.findByRole('group', {
        name: /¿Descartar este cambio\? No se podrá recuperar\./,
      }),
    ).toBeInTheDocument();
  });

  it('"Sí, descartar" lo descarta, lo anuncia en singular y lleva el foco al titulo', async () => {
    const usuario = userEvent.setup();

    armar([operacion(RECHAZADA)]);
    pintar();
    await usuario.click(screen.getByRole('button', { name: 'Descartar' }));
    await usuario.click(await screen.findByRole('button', { name: 'Sí, descartar' }));

    expect(descartar).toHaveBeenCalledWith(mundo.estado.cambios[0]?.operationId);
    expect(await screen.findByText('Se descartó 1 cambio.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Lo guardado en este equipo' })).toHaveFocus();
  });

  it('si con el se fueron otros, lo dice antes y lo anuncia en plural despues', async () => {
    const usuario = userEvent.setup();

    vi.mocked(cuantosDependenDe).mockResolvedValue(2);
    vi.mocked(descartar).mockResolvedValue(3);
    armar([operacion(RECHAZADA)]);
    pintar();
    await usuario.click(screen.getByRole('button', { name: 'Descartar' }));

    expect(
      await screen.findByText(/También se descartarán 2 cambios que dependen de este\./),
    ).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Sí, descartar' }));

    expect(await screen.findByText('Se descartaron 3 cambios.')).toBeInTheDocument();
  });

  it('con uno solo que dependa, en singular', async () => {
    vi.mocked(cuantosDependenDe).mockResolvedValue(1);
    armar([operacion(RECHAZADA)]);
    pintar();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Descartar' }));

    expect(
      await screen.findByText(/También se descartará 1 cambio que depende de este\./),
    ).toBeInTheDocument();
  });

  it('si nada depende de el, no dice nada de otros', async () => {
    armar([operacion(RECHAZADA_DE_UN_PENDIENTE)]);
    pintar();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Descartar' }));
    await screen.findByText(/¿Descartar este cambio\?/);

    expect(screen.queryByText(/También se descartar/)).toBeNull();
  });

  it('la pregunta es solo del cambio que se pulso, no de los demas', async () => {
    armar([
      operacion({ ...RECHAZADA_DE_UN_PENDIENTE, orden: 1 }),
      operacion({ ...RECHAZADA_DE_UN_PENDIENTE, orden: 2 }),
    ]);
    pintar();

    const primero = screen.getAllByRole('listitem')[0]!;

    await userEvent.setup().click(within(primero).getByRole('button', { name: 'Descartar' }));
    await screen.findByText(/¿Descartar este cambio\?/);

    expect(screen.getAllByText(/¿Descartar este cambio\?/)).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Descartar' })).toHaveLength(1);
  });

  it('el aviso de despues de descartar es una region que se anuncia sola', () => {
    armar([operacion(RECHAZADA)]);
    pintar();

    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});

describe('PanelDeSincronizacion: descartar una anotacion del diario (SCRUM-142)', () => {
  const ESCRITO = { texto: 'Un dia dificil\n\nNo pude dormir.', conDiagramas: false };

  /**
   * Pinta el panel y pulsa «Descartar». `portapapeles` es lo que el navegador tiene en
   * `navigator.clipboard`; se pone **despues** de crear al usuario porque `user-event`
   * instala el suyo al crearlo.
   */
  async function pedirDescartar(portapapeles?: unknown) {
    const usuario = userEvent.setup();

    if (portapapeles !== undefined) {
      Object.defineProperty(navigator, 'clipboard', { value: portapapeles, configurable: true });
    }

    pintar();
    await usuario.click(screen.getByRole('button', { name: 'Descartar' }));

    return usuario;
  }

  beforeEach(() => {
    vi.mocked(leerLoEscritoDe).mockResolvedValue(ESCRITO);
  });

  it('dice con todas las letras que se borra lo que se escribio', async () => {
    armar([operacion(RECHAZADA)]);
    await pedirDescartar();

    expect(
      await screen.findByText(
        /¿Descartar esta anotación\? Se borra lo que escribiste en tu diario y no se podrá recuperar\./,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/¿Descartar este cambio\?/)).toBeNull();
    expect(descartar).not.toHaveBeenCalled();
  });

  it('ofrece copiar el texto antes, y lo dice', async () => {
    armar([operacion(RECHAZADA)]);
    await pedirDescartar();

    expect(await screen.findByRole('button', { name: 'Copiar el texto' })).toBeInTheDocument();
    expect(screen.getByText('Si quieres conservarlo, copia el texto antes.')).toBeInTheDocument();
  });

  it('copiar no lo ensena: va al portapapeles y se anuncia, y no se descarta', async () => {
    const copiar = vi.fn().mockResolvedValue(undefined);

    armar([operacion(RECHAZADA)]);

    const usuario = await pedirDescartar({ writeText: copiar });

    await usuario.click(await screen.findByRole('button', { name: 'Copiar el texto' }));

    expect(copiar).toHaveBeenCalledWith('Un dia dificil\n\nNo pude dormir.');
    expect(
      await screen.findByText('Texto copiado. Ya puedes pegarlo donde quieras conservarlo.'),
    ).toBeInTheDocument();
    // El panel puede estar a la vista de otra persona: lo escrito no se muestra nunca.
    expect(document.body.textContent).not.toContain('No pude dormir');
    expect(descartar).not.toHaveBeenCalled();
    // Y se puede seguir decidiendo.
    expect(screen.getByRole('button', { name: 'Sí, descartar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No, conservarla' })).toBeInTheDocument();
  });

  it('si no se pudo copiar, lo dice y avisa que no lo descarte todavia', async () => {
    armar([operacion(RECHAZADA)]);

    const usuario = await pedirDescartar({
      writeText: vi.fn().mockRejectedValue(new Error('sin permiso')),
    });

    await usuario.click(await screen.findByRole('button', { name: 'Copiar el texto' }));

    expect(
      await screen.findByText(
        'No se pudo copiar el texto. Si quieres conservarlo, no lo descartes todavía.',
      ),
    ).toBeInTheDocument();
    expect(descartar).not.toHaveBeenCalled();
  });

  it('sin portapapeles en el navegador, tambien lo dice', async () => {
    armar([operacion(RECHAZADA)]);

    // El navegador no tiene portapapeles: `navigator.clipboard` no existe.
    const usuario = await pedirDescartar(null);

    await usuario.click(await screen.findByRole('button', { name: 'Copiar el texto' }));

    expect(await screen.findByText(/No se pudo copiar el texto/)).toBeInTheDocument();
  });

  it('con diagramas, avisa que esos no se copian', async () => {
    vi.mocked(leerLoEscritoDe).mockResolvedValue({ texto: 'Mira', conDiagramas: true });
    armar([operacion(RECHAZADA)]);
    await pedirDescartar();

    expect(await screen.findByText(/Los diagramas no se copian\./)).toBeInTheDocument();
  });

  it('sin diagramas, no dice nada de diagramas', async () => {
    armar([operacion(RECHAZADA)]);
    await pedirDescartar();

    await screen.findByRole('button', { name: 'Copiar el texto' });

    expect(screen.queryByText(/diagramas/)).toBeNull();
  });

  it('si no hay nada escrito que copiar, no ofrece copiar, pero si avisa que se borra', async () => {
    vi.mocked(leerLoEscritoDe).mockResolvedValue(null);
    armar([operacion(RECHAZADA)]);
    await pedirDescartar();

    expect(await screen.findByText(/¿Descartar esta anotación\?/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copiar el texto' })).toBeNull();
    expect(screen.queryByText('Si quieres conservarlo, copia el texto antes.')).toBeNull();
  });

  it('una correccion del diario tambien se trata como el diario', async () => {
    armar([operacion({ ...RECHAZADA, tipo: 'diario.editar' })]);
    await pedirDescartar();

    expect(await screen.findByText(/¿Descartar esta anotación\?/)).toBeInTheDocument();
    expect(leerLoEscritoDe).toHaveBeenCalled();
  });

  it('lo que no es del diario no pregunta por lo escrito ni ofrece copiar', async () => {
    armar([operacion(RECHAZADA_DE_UN_PENDIENTE)]);
    await pedirDescartar();

    await screen.findByText(/¿Descartar este cambio\?/);

    expect(leerLoEscritoDe).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Copiar el texto' })).toBeNull();
  });

  it('«No, conservarla»: vuelve a como estaba, sin descartar', async () => {
    armar([operacion(RECHAZADA)]);

    const usuario = await pedirDescartar();

    await usuario.click(await screen.findByRole('button', { name: 'No, conservarla' }));

    expect(descartar).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeInTheDocument();
  });

  it('«Sí, descartar» lo descarta, como siempre', async () => {
    armar([operacion(RECHAZADA)]);

    const usuario = await pedirDescartar();

    await usuario.click(await screen.findByRole('button', { name: 'Sí, descartar' }));

    expect(descartar).toHaveBeenCalledWith(mundo.estado.cambios[0]?.operationId);
  });

  it('el anuncio de lo copiado no sobrevive a una nueva pregunta', async () => {
    armar([operacion(RECHAZADA)]);

    const usuario = await pedirDescartar({ writeText: vi.fn().mockResolvedValue(undefined) });

    await usuario.click(await screen.findByRole('button', { name: 'Copiar el texto' }));
    await screen.findByText(/Texto copiado/);
    await usuario.click(screen.getByRole('button', { name: 'No, conservarla' }));
    await usuario.click(screen.getByRole('button', { name: 'Descartar' }));
    await screen.findByRole('button', { name: 'Copiar el texto' });

    expect(screen.queryByText(/Texto copiado/)).toBeNull();
  });
});
