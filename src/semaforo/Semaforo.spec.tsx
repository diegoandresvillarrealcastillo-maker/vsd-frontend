import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  Pendiente,
  Recordatorio,
  Semaforo as Datos,
} from '../infraestructura/api/pendientes.ts';
import { fallosDeAccesibilidad } from '../pruebas/axe.ts';
import { Semaforo } from './Semaforo.tsx';
import { olvidarLosRecordatoriosDejados } from './useSemaforo.ts';

/**
 * El semaforo flotante, con la API simulada y la pantalla de verdad.
 */
const { consultarElSemaforo, crearPendiente, editarPendiente, borrarPendiente } = vi.hoisted(
  () => ({
    consultarElSemaforo: vi.fn(),
    crearPendiente: vi.fn(),
    editarPendiente: vi.fn(),
    borrarPendiente: vi.fn(),
  }),
);

vi.mock('../infraestructura/api/pendientes.ts', () => ({
  consultarElSemaforo,
  crearPendiente,
  editarPendiente,
  borrarPendiente,
}));

const HACE_10_DIAS = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

function pendiente(parcial: Partial<Pendiente> & Pick<Pendiente, 'id' | 'texto'>): Pendiente {
  return {
    nivel: 'aplazable',
    hecho: false,
    posponerHasta: null,
    fechaLimite: null,
    creadoEn: HACE_10_DIAS,
    editadoEn: HACE_10_DIAS,
    ...parcial,
  };
}

const ENTREGA = pendiente({ id: 'p-entrega', texto: 'Entregar el trabajo', nivel: 'urgente' });
const EPS = pendiente({ id: 'p-eps', texto: 'Pedir cita en la EPS', nivel: 'prioridad' });
const CUARTO = pendiente({ id: 'p-cuarto', texto: 'Organizar el cuarto', nivel: 'aplazable' });

function semaforo(parcial: Partial<Datos> = {}): Datos {
  return { pendientes: [ENTREGA, EPS, CUARTO], recordatorio: null, ...parcial };
}

const usuario = userEvent.setup({ delay: null });

function boton() {
  return screen.getByRole('button', { name: /Abrir tu semáforo/ });
}

async function abrirLaVentana() {
  await usuario.click(await screen.findByRole('button', { name: /Abrir tu semáforo/ }));

  return screen.findByRole('dialog', { name: 'Tu semáforo' });
}

beforeEach(() => {
  localStorage.clear();
  // Salvo en las pruebas de la induccion, ya se vio.
  localStorage.setItem('vsd-h:semaforo-induccion-vista', 'si');
  olvidarLosRecordatoriosDejados();
  consultarElSemaforo.mockResolvedValue(semaforo());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('el boton flotante', () => {
  it('cuenta los urgentes sin hacer', async () => {
    consultarElSemaforo.mockResolvedValue(
      semaforo({
        pendientes: [
          ENTREGA,
          pendiente({ id: 'p-2', texto: 'Pagar la matrícula', nivel: 'urgente' }),
          pendiente({ id: 'p-3', texto: 'Ya hecho', nivel: 'urgente', hecho: true }),
          EPS,
        ],
      }),
    );

    render(<Semaforo />);

    expect(
      await screen.findByRole('button', { name: 'Abrir tu semáforo de pendientes: 2 urgentes' }),
    ).toHaveTextContent('2');
  });

  it('sin urgentes no lleva numero', async () => {
    consultarElSemaforo.mockResolvedValue(semaforo({ pendientes: [CUARTO] }));

    render(<Semaforo />);

    await waitFor(() => expect(consultarElSemaforo).toHaveBeenCalled());
    expect(boton()).toHaveAccessibleName('Abrir tu semáforo de pendientes');
    expect(boton()).toHaveTextContent('');
  });

  it('se aparta mientras se escribe en la pagina', async () => {
    render(
      <>
        <label>
          Algo
          <input />
        </label>
        <Semaforo />
      </>,
    );

    await waitFor(() => expect(consultarElSemaforo).toHaveBeenCalled());
    await usuario.click(screen.getByRole('textbox', { name: 'Algo' }));

    // Apartado, ni se ve ni se alcanza con el teclado o un lector de pantalla.
    expect(document.querySelector('.semaforo')).toHaveClass('semaforo--apartado');
    expect(screen.queryByRole('button', { name: /Abrir tu semáforo/ })).not.toBeInTheDocument();

    await usuario.click(document.body);

    expect(document.querySelector('.semaforo')).not.toHaveClass('semaforo--apartado');
    expect(boton()).toBeVisible();
  });
});

describe('la induccion', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('la primera vez son cuatro pasos y despues la ventana', async () => {
    render(<Semaforo />);

    await usuario.click(await screen.findByRole('button', { name: /Abrir tu semáforo/ }));

    const induccion = screen.getByRole('dialog', { name: 'Rojo: urgente' });

    expect(induccion).toHaveTextContent('Paso 1 de 4');

    for (const titulo of ['Ámbar: prioridad', 'Verde: aplazable', 'Te avisamos con calma']) {
      await usuario.click(within(induccion).getByRole('button', { name: 'Siguiente' }));
      expect(screen.getByRole('dialog', { name: titulo })).toBeInTheDocument();
    }

    await usuario.click(screen.getByRole('button', { name: 'Empezar' }));

    expect(screen.getByRole('dialog', { name: 'Tu semáforo' })).toBeInTheDocument();
  });

  it('saltarla tambien cuenta como vista, y la proxima vez abre directo', async () => {
    render(<Semaforo />);

    await usuario.click(await screen.findByRole('button', { name: /Abrir tu semáforo/ }));
    await usuario.click(screen.getByRole('button', { name: 'Saltar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(boton()).toHaveFocus();

    await usuario.click(boton());

    expect(screen.getByRole('dialog', { name: 'Tu semáforo' })).toBeInTheDocument();
  });

  it('se cierra con Escape', async () => {
    render(<Semaforo />);

    await usuario.click(await screen.findByRole('button', { name: /Abrir tu semáforo/ }));
    await usuario.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('la ventana, accesibilidad (C-03)', () => {
  it('el boton flotante y la ventana abierta no tienen fallos de accesibilidad', async () => {
    render(<Semaforo />);

    await screen.findByRole('button', { name: /Abrir tu semáforo/ });
    expect(await fallosDeAccesibilidad()).toEqual([]);

    await abrirLaVentana();
    expect(await fallosDeAccesibilidad()).toEqual([]);
  });

  it('se cierra al pulsar el fondo, y no al pulsar dentro', async () => {
    render(<Semaforo />);

    const ventana = await abrirLaVentana();

    await usuario.click(within(ventana).getByRole('heading', { name: 'Tu semáforo' }));
    expect(screen.getByRole('dialog', { name: 'Tu semáforo' })).toBeInTheDocument();

    const fondo = ventana.parentElement;

    expect(fondo).toHaveAttribute('role', 'presentation');
    await usuario.click(fondo!);
    expect(screen.queryByRole('dialog', { name: 'Tu semáforo' })).not.toBeInTheDocument();
  });
});

describe('la ventana', () => {
  it('ordena por color, cada uno con su plazo', async () => {
    render(<Semaforo />);

    const ventana = await abrirLaVentana();
    const urgente = within(ventana).getByRole('region', { name: /Urgente/ });

    expect(urgente).toHaveTextContent('Esta semana');
    expect(urgente).toHaveTextContent('Entregar el trabajo');
    expect(urgente).toHaveTextContent('Hace 10 días');
    expect(within(ventana).getByRole('region', { name: /Prioridad/ })).toHaveTextContent(
      'Pedir cita en la EPS',
    );
    expect(within(ventana).getByRole('region', { name: /Aplazable/ })).toHaveTextContent(
      'Organizar el cuarto',
    );
  });

  it('se maneja con teclado: el foco no se escapa y Escape la cierra', async () => {
    render(<Semaforo />);

    const ventana = await abrirLaVentana();

    expect(within(ventana).getByRole('heading', { name: 'Tu semáforo' })).toHaveFocus();

    // Mayus+Tab desde el principio da la vuelta al ultimo: el boton de anadir.
    await usuario.tab({ shift: true });
    expect(within(ventana).getByRole('button', { name: 'Añadir' })).toHaveFocus();

    await usuario.tab();
    expect(within(ventana).getByRole('button', { name: 'Cerrar el semáforo' })).toHaveFocus();

    await usuario.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(boton()).toHaveFocus();
  });

  it('si no se pudo cargar, deja reintentar', async () => {
    consultarElSemaforo.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    render(<Semaforo />);

    const ventana = await abrirLaVentana();

    await usuario.click(await within(ventana).findByRole('button', { name: 'Reintentar' }));

    expect(await within(ventana).findByText('Entregar el trabajo')).toBeInTheDocument();
  });
});

describe('anadir', () => {
  it('con el color elegido; queda en su lista', async () => {
    const nuevo = pendiente({ id: 'p-nuevo', texto: 'Llamar a mamá', nivel: 'urgente' });

    crearPendiente.mockResolvedValue(nuevo);

    render(<Semaforo />);

    const ventana = await abrirLaVentana();

    await usuario.type(
      within(ventana).getByRole('textbox', { name: 'Añadir algo' }),
      'Llamar a mamá',
    );
    await usuario.click(within(ventana).getByRole('radio', { name: 'Urgente' }));
    await usuario.click(within(ventana).getByRole('button', { name: 'Añadir' }));

    expect(crearPendiente).toHaveBeenCalledWith({
      clientOperationId: expect.stringMatching(/^[0-9a-f-]{36}$/) as unknown,
      texto: 'Llamar a mamá',
      nivel: 'urgente',
    });
    expect(within(ventana).getByRole('region', { name: /Urgente/ })).toHaveTextContent(
      'Llamar a mamá',
    );
    expect(within(ventana).getByRole('textbox', { name: 'Añadir algo' })).toHaveValue('');
    expect(within(ventana).getByRole('status')).toHaveTextContent('Anotado en Urgente');
  });

  it('vacio no se envia', async () => {
    render(<Semaforo />);

    const ventana = await abrirLaVentana();

    await usuario.click(within(ventana).getByRole('button', { name: 'Añadir' }));

    expect(crearPendiente).not.toHaveBeenCalled();
    expect(within(ventana).getByRole('alert')).toHaveTextContent('Escribe qué tienes pendiente');
  });

  it('un reintento tras un fallo no duplica: reutiliza la operacion', async () => {
    crearPendiente
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(pendiente({ id: 'p-nuevo', texto: 'Llamar a mamá' }));

    render(<Semaforo />);

    const ventana = await abrirLaVentana();

    await usuario.type(
      within(ventana).getByRole('textbox', { name: 'Añadir algo' }),
      'Llamar a mamá',
    );
    await usuario.click(within(ventana).getByRole('button', { name: 'Añadir' }));

    expect(within(ventana).getByRole('alert')).toHaveTextContent('No se pudo guardar');

    await usuario.click(within(ventana).getByRole('button', { name: 'Añadir' }));

    const [primera, segunda] = crearPendiente.mock.calls as [
      [{ clientOperationId: string }],
      [{ clientOperationId: string }],
    ];

    expect(segunda[0].clientOperationId).toBe(primera[0].clientOperationId);
  });
});

describe('la fecha limite, opcional (SCRUM-119)', () => {
  /** Lo que se escribe en un `<input type="date">` en un navegador: el valor AAAA-MM-DD. */
  function ponerFecha(campo: HTMLElement, valor: string) {
    fireEvent.change(campo, { target: { value: valor } });
  }

  it('al anotar sin fecha, no se manda ninguna', async () => {
    crearPendiente.mockResolvedValue(pendiente({ id: 'p-n', texto: 'General' }));
    render(<Semaforo />);
    const ventana = await abrirLaVentana();

    await usuario.type(within(ventana).getByRole('textbox', { name: 'Añadir algo' }), 'General');
    await usuario.click(within(ventana).getByRole('button', { name: 'Añadir' }));

    expect(crearPendiente.mock.calls[0]?.[0]).not.toHaveProperty('fechaLimite');
  });

  it('al anotar con fecha, se manda, y el campo queda limpio para el siguiente', async () => {
    crearPendiente.mockResolvedValue(
      pendiente({ id: 'p-n', texto: 'Entregar', nivel: 'urgente', fechaLimite: '2026-10-12' }),
    );
    render(<Semaforo />);
    const ventana = await abrirLaVentana();

    await usuario.type(within(ventana).getByRole('textbox', { name: 'Añadir algo' }), 'Entregar');
    const campo = within(ventana).getByLabelText(/Fecha límite/);
    ponerFecha(campo, '2026-10-12');
    await usuario.click(within(ventana).getByRole('button', { name: 'Añadir' }));

    expect(crearPendiente).toHaveBeenCalledWith(
      expect.objectContaining({ texto: 'Entregar', fechaLimite: '2026-10-12' }),
    );
    expect(within(ventana).getByLabelText(/Fecha límite/)).toHaveValue('');
  });

  it('un pendiente con fecha la muestra en palabras; uno sin fecha, nada', async () => {
    const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());

    consultarElSemaforo.mockResolvedValue(
      semaforo({
        pendientes: [
          pendiente({ id: 'p-hoy', texto: 'Vence ya', nivel: 'urgente', fechaLimite: hoy }),
          pendiente({
            id: 'p-viejo',
            texto: 'Ya paso',
            nivel: 'prioridad',
            fechaLimite: '2020-01-01',
          }),
          CUARTO,
        ],
      }),
    );
    render(<Semaforo />);
    const ventana = await abrirLaVentana();

    expect(await within(ventana).findByText('Vence hoy')).toBeInTheDocument();
    expect(within(ventana).getByText(/^Venció hace \d+ días$/)).toHaveClass(
      'semaforo-tarea__limite--vencida',
    );
    // Organizar el cuarto no tiene fecha: solo hay dos lineas de limite.
    expect(ventana.querySelectorAll('.semaforo-tarea__limite')).toHaveLength(2);
  });

  it('se pone una fecha a uno que no la tenia, y lo dice', async () => {
    editarPendiente.mockResolvedValue({ ...ENTREGA, fechaLimite: '2030-03-04' });
    render(<Semaforo />);
    const ventana = await abrirLaVentana();

    const tarea = (await within(ventana).findByText('Entregar el trabajo')).closest('li');
    await usuario.click(within(tarea as HTMLElement).getByRole('button', { name: 'Poner fecha' }));

    expect(
      within(ventana).getByText(/Sin fecha, te lo recordamos según su color/),
    ).toBeInTheDocument();

    ponerFecha(within(ventana).getByLabelText('Fecha límite'), '2030-03-04');

    await waitFor(() =>
      expect(editarPendiente).toHaveBeenCalledWith('p-entrega', { fechaLimite: '2030-03-04' }),
    );
    // Sale dos veces: en el aviso de lo hecho y en la propia tarea.
    await waitFor(() =>
      expect(ventana.querySelector('.semaforo-tarea__limite')).toHaveTextContent(
        'Vence el lunes, 4 de marzo',
      ),
    );
  });

  it('se quita la fecha, y el boton vuelve a decir Poner fecha', async () => {
    const conFecha = { ...ENTREGA, fechaLimite: '2030-03-04' };

    consultarElSemaforo.mockResolvedValue(semaforo({ pendientes: [conFecha, EPS, CUARTO] }));
    editarPendiente.mockResolvedValue({ ...ENTREGA, fechaLimite: null });
    render(<Semaforo />);
    const ventana = await abrirLaVentana();

    const tarea = (await within(ventana).findByText('Entregar el trabajo')).closest('li');
    await usuario.click(
      within(tarea as HTMLElement).getByRole('button', { name: 'Cambiar fecha' }),
    );
    await usuario.click(within(ventana).getByRole('button', { name: 'Quitar fecha' }));

    await waitFor(() =>
      expect(editarPendiente).toHaveBeenCalledWith('p-entrega', { fechaLimite: null }),
    );
    expect(await within(ventana).findByText(/ya no tiene fecha límite/)).toBeInTheDocument();
    expect(
      within(
        (await within(ventana).findByText('Entregar el trabajo')).closest('li') as HTMLElement,
      ).getByRole('button', { name: 'Poner fecha' }),
    ).toBeInTheDocument();
  });

  it('si no se pudo guardar la fecha, lo dice y no cambia nada', async () => {
    editarPendiente.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<Semaforo />);
    const ventana = await abrirLaVentana();

    const tarea = (await within(ventana).findByText('Entregar el trabajo')).closest('li');
    await usuario.click(within(tarea as HTMLElement).getByRole('button', { name: 'Poner fecha' }));
    ponerFecha(within(ventana).getByLabelText('Fecha límite'), '2030-03-04');

    expect(await within(ventana).findByRole('alert')).toHaveTextContent('No se pudo guardar');
    expect(ventana.querySelectorAll('.semaforo-tarea__limite')).toHaveLength(0);
  });
});

describe('completar, subir y eliminar', () => {
  it('hecho se puede deshacer, y el foco va al deshacer', async () => {
    editarPendiente
      .mockResolvedValueOnce({ ...ENTREGA, hecho: true })
      .mockResolvedValueOnce({ ...ENTREGA, hecho: false });

    render(<Semaforo />);

    const ventana = await abrirLaVentana();
    const urgente = within(ventana).getByRole('region', { name: /Urgente/ });

    await usuario.click(within(urgente).getByRole('button', { name: 'Hecho' }));

    expect(editarPendiente).toHaveBeenCalledWith('p-entrega', { hecho: true });
    expect(urgente).not.toHaveTextContent('Entregar el trabajo');
    expect(within(ventana).getByRole('status')).toHaveTextContent('Hecho: «Entregar el trabajo»');

    const deshacer = within(ventana).getByRole('button', { name: 'Deshacer' });

    expect(deshacer).toHaveFocus();

    await usuario.click(deshacer);

    expect(editarPendiente).toHaveBeenLastCalledWith('p-entrega', { hecho: false });
    expect(urgente).toHaveTextContent('Entregar el trabajo');
  });

  it('lo hecho esta semana se puede devolver a pendientes', async () => {
    consultarElSemaforo.mockResolvedValue(semaforo({ pendientes: [{ ...CUARTO, hecho: true }] }));
    editarPendiente.mockResolvedValue(CUARTO);

    render(<Semaforo />);

    const ventana = await abrirLaVentana();

    await usuario.click(within(ventana).getByText('Hechos esta semana (1)'));
    await usuario.click(within(ventana).getByRole('button', { name: 'Volver a pendientes' }));

    expect(editarPendiente).toHaveBeenCalledWith('p-cuarto', { hecho: false });
    expect(within(ventana).getByRole('region', { name: /Aplazable/ })).toHaveTextContent(
      'Organizar el cuarto',
    );
  });

  it('subir de nivel lo mueve de lista; urgente ya no sube', async () => {
    editarPendiente.mockResolvedValue({ ...EPS, nivel: 'urgente' });

    render(<Semaforo />);

    const ventana = await abrirLaVentana();
    const urgente = within(ventana).getByRole('region', { name: /Urgente/ });

    expect(within(urgente).queryByRole('button', { name: /Subir/ })).not.toBeInTheDocument();

    await usuario.click(
      within(within(ventana).getByRole('region', { name: /Prioridad/ })).getByRole('button', {
        name: 'Subir a Urgente',
      }),
    );

    expect(editarPendiente).toHaveBeenCalledWith('p-eps', { nivel: 'urgente' });
    expect(urgente).toHaveTextContent('Pedir cita en la EPS');
    // Y el boton flotante lo cuenta.
    expect(boton()).toHaveAccessibleName('Abrir tu semáforo de pendientes: 2 urgentes');
  });

  it('eliminar pide confirmacion; cancelar no borra nada', async () => {
    borrarPendiente.mockResolvedValue(undefined);

    render(<Semaforo />);

    const ventana = await abrirLaVentana();
    const aplazable = within(ventana).getByRole('region', { name: /Aplazable/ });

    await usuario.click(within(aplazable).getByRole('button', { name: 'Eliminar' }));

    const confirmar = within(aplazable).getByRole('group', {
      name: /¿Eliminar «Organizar el cuarto»\?/,
    });

    expect(within(confirmar).getByRole('button', { name: 'Cancelar' })).toHaveFocus();

    await usuario.click(within(confirmar).getByRole('button', { name: 'Cancelar' }));

    expect(borrarPendiente).not.toHaveBeenCalled();

    await usuario.click(within(aplazable).getByRole('button', { name: 'Eliminar' }));
    await usuario.click(
      within(within(aplazable).getByRole('group')).getByRole('button', { name: 'Eliminar' }),
    );

    expect(borrarPendiente).toHaveBeenCalledWith('p-cuarto');
    expect(aplazable).toHaveTextContent('Nada aquí.');
  });

  it('si falla, no cambia nada y lo dice', async () => {
    editarPendiente.mockRejectedValue(new TypeError('Failed to fetch'));

    render(<Semaforo />);

    const ventana = await abrirLaVentana();
    const urgente = within(ventana).getByRole('region', { name: /Urgente/ });

    await usuario.click(within(urgente).getByRole('button', { name: 'Hecho' }));

    expect(within(ventana).getByRole('alert')).toHaveTextContent('No se pudo guardar');
    expect(urgente).toHaveTextContent('Entregar el trabajo');
  });
});

describe('el recordatorio', () => {
  const DE_PLAZO: Recordatorio = {
    pendienteId: 'p-entrega',
    nivel: 'urgente',
    dias: 10,
    nivelSugerido: null,
    tono: 'plazo',
    fechaLimite: null,
  };

  const POR_FECHA: Recordatorio = {
    pendienteId: 'p-cuarto',
    nivel: 'aplazable',
    dias: 3,
    nivelSugerido: 'prioridad',
    tono: 'plazo',
    fechaLimite: '2020-01-01',
  };

  const SUAVE: Recordatorio = {
    pendienteId: 'p-cuarto',
    nivel: 'aplazable',
    dias: 31,
    nivelSugerido: 'prioridad',
    tono: 'suave',
    fechaLimite: null,
  };

  it('el de plazo pregunta si se quiere revisar', async () => {
    consultarElSemaforo.mockResolvedValue(semaforo({ recordatorio: DE_PLAZO }));

    render(<Semaforo />);

    const aviso = await screen.findByRole('region', { name: /Ey, tienes esto pendiente/ });

    expect(aviso).toHaveTextContent('«Entregar el trabajo»');
    expect(aviso).toHaveTextContent('Hace 10 días');
  });

  it('el del aplazable es suave: que no se acumule', async () => {
    consultarElSemaforo.mockResolvedValue(semaforo({ recordatorio: SUAVE }));

    render(<Semaforo />);

    expect(
      await screen.findByRole('region', { name: /no es urgente, pero no dejes que se acumule/ }),
    ).toHaveTextContent('«Organizar el cuarto»');
  });

  it('si es por la fecha que puso la persona, dice que llego el dia (SCRUM-119)', async () => {
    consultarElSemaforo.mockResolvedValue(semaforo({ recordatorio: POR_FECHA }));

    render(<Semaforo />);

    const aviso = await screen.findByRole('region', { name: /Llegó la fecha que le pusiste/ });

    expect(aviso).toHaveTextContent('«Organizar el cuarto»');
    expect(aviso).toHaveTextContent(/Venció hace \d+ días/);
    expect(aviso).not.toHaveTextContent('Hace 3 días');
  });

  it('revisarlo abre la ventana con ese pendiente resaltado', async () => {
    consultarElSemaforo.mockResolvedValue(semaforo({ recordatorio: DE_PLAZO }));

    render(<Semaforo />);

    await usuario.click(await screen.findByRole('button', { name: 'Revisarlo' }));

    const ventana = screen.getByRole('dialog', { name: 'Tu semáforo' });

    expect(within(ventana).getByText('Entregar el trabajo').closest('li')).toHaveClass(
      'semaforo-tarea--resaltada',
    );
  });

  it('"ahora no" lo calla en esta visita, tambien al cambiar de pantalla', async () => {
    consultarElSemaforo.mockResolvedValue(semaforo({ recordatorio: DE_PLAZO }));

    const { unmount } = render(<Semaforo />);

    await usuario.click(await screen.findByRole('button', { name: 'Ahora no' }));

    expect(screen.queryByRole('region', { name: /Ey, tienes/ })).not.toBeInTheDocument();
    expect(boton()).toHaveFocus();
    expect(editarPendiente).not.toHaveBeenCalled();

    unmount();
    render(<Semaforo />);

    await waitFor(() => expect(consultarElSemaforo).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('region', { name: /Ey, tienes/ })).not.toBeInTheDocument();
  });

  it('"en una semana" lo pospone siete dias', async () => {
    consultarElSemaforo.mockResolvedValue(semaforo({ recordatorio: DE_PLAZO }));
    editarPendiente.mockImplementation((_id: string, cambios: { posponerHasta: string }) =>
      Promise.resolve({ ...ENTREGA, posponerHasta: cambios.posponerHasta }),
    );

    render(<Semaforo />);

    await usuario.click(await screen.findByRole('button', { name: 'En una semana' }));

    const [id, cambios] = editarPendiente.mock.calls[0] as [string, { posponerHasta: string }];
    const dias = (new Date(cambios.posponerHasta).getTime() - Date.now()) / (24 * 60 * 60 * 1000);

    expect(id).toBe('p-entrega');
    expect(dias).toBeGreaterThan(6.9);
    expect(dias).toBeLessThanOrEqual(7);
    expect(screen.queryByRole('region', { name: /Ey, tienes/ })).not.toBeInTheDocument();
  });

  it('atender el pendiente desde la ventana tambien lo calla', async () => {
    consultarElSemaforo.mockResolvedValue(semaforo({ recordatorio: DE_PLAZO }));
    editarPendiente.mockResolvedValue({ ...ENTREGA, hecho: true });

    render(<Semaforo />);

    await usuario.click(await screen.findByRole('button', { name: 'Revisarlo' }));
    const urgente = within(screen.getByRole('dialog', { name: 'Tu semáforo' })).getByRole(
      'region',
      { name: /Urgente/ },
    );

    await usuario.click(within(urgente).getByRole('button', { name: 'Hecho' }));
    await usuario.click(screen.getByRole('button', { name: 'Cerrar el semáforo' }));

    expect(screen.queryByRole('region', { name: /Ey, tienes/ })).not.toBeInTheDocument();
  });
});
