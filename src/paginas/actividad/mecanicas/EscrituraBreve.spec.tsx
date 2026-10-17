import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SesionDeLaActividad } from '../../../infraestructura/api/progreso.ts';
import { VozDeLaMascota } from '../viva/VozDeLaMascota.tsx';
import { EscrituraBreve } from './EscrituraBreve.tsx';

/**
 * «Tres cosas buenas» (SCRUM-211, ficha EMO-02): el motor `escritura_breve` con varios campos.
 *
 * Es **texto libre y sin puntaje**, y de bienestar: lo que mas importa es lo que no exige. Con una
 * basta, y un dia sin nada bueno tambien se registra. Lo que se escribe no se valora, no se
 * repite en la consola ni se guarda en el navegador; la deteccion de riesgo es del servidor.
 */
vi.setConfig({ testTimeout: 20_000 });

const INVITACION = 'Algo que probaste hoy, aunque sea pequeño.';

const TRES_COSAS = {
  invitacion: INVITACION,
  campos: 3,
  minimo: 1,
  largoMaximo: 200,
  permiteNingunaHoy: true,
};

function sesionDe(parametros: Record<string, unknown>): SesionDeLaActividad {
  return { id: 's-1', titulo: 'Algo que probaste', nivel: 1, parametros };
}

const alTerminar = vi.fn();
const usuario = userEvent.setup({ delay: null });

function pintar(parametros: Record<string, unknown> = TRES_COSAS, enviando = false) {
  return render(
    <EscrituraBreve alTerminar={alTerminar} enviando={enviando} sesion={sesionDe(parametros)} />,
  );
}

/** El dibujo de la mascota con esa expresion, tal como lo pinta el kit: la referencia con que comparar. */
function dibujoCon(expresion: 'feliz' | 'normal'): string | null | undefined {
  const { container, unmount } = render(
    <VozDeLaMascota mascota={null} mensaje="" expresion={expresion} />,
  );
  const dibujo = container.querySelector('img')?.getAttribute('src');

  unmount();

  return dibujo;
}

/** El campo `n` (desde 1), por el nombre que oye un lector de pantalla. */
function campo(n: number, de = 3): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: `Respuesta ${String(n)} de ${String(de)}` });
}

function terminar() {
  return usuario.click(screen.getByRole('button', { name: 'Terminar' }));
}

afterEach(() => {
  cleanup();
  alTerminar.mockClear();
});

describe('sin una sesion que entienda', () => {
  it.each([
    ['sin sesion', undefined],
    ['con parametros vacios', sesionDe({})],
    ['con parametros de otro motor', sesionDe({ casillas: [], rondas: 3 })],
    ['con mas campos de los que caben', sesionDe({ ...TRES_COSAS, campos: 6 })],
    ['pidiendo mas respuestas que campos', sesionDe({ ...TRES_COSAS, minimo: 4 })],
    ['sin invitacion', sesionDe({ ...TRES_COSAS, invitacion: '' })],
  ])('%s: lo dice, y no hay nada que escribir', (_caso, sesion) => {
    render(<EscrituraBreve alTerminar={alTerminar} enviando={false} sesion={sesion} />);

    expect(screen.getByText(/necesita la sesión de hoy/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Terminar' })).not.toBeInTheDocument();
    expect(alTerminar).not.toHaveBeenCalled();
  });
});

describe('la presentacion', () => {
  it('la invitacion de la sesion nombra al grupo de campos', () => {
    pintar();

    const grupo = screen.getByRole('group', { name: INVITACION });

    expect(within(grupo).getAllByRole('textbox')).toHaveLength(3);
  });

  it.each([1, 2, 3, 5])('hay tantos campos como dice la sesion: %i', (campos) => {
    pintar({ ...TRES_COSAS, campos });

    expect(screen.getAllByRole('textbox')).toHaveLength(campos);
  });

  it('cada campo tiene su nombre para un lector de pantalla: respuesta n de m', () => {
    pintar();

    expect(campo(1)).toBeInTheDocument();
    expect(campo(2)).toBeInTheDocument();
    expect(campo(3)).toBeInTheDocument();
  });

  it('con un solo campo, no se numera: el grupo ya dice de que se trata', () => {
    pintar({ ...TRES_COSAS, campos: 1 });

    expect(screen.getByRole('textbox', { name: 'Respuesta' })).toBeInTheDocument();
  });

  it('empiezan vacios', () => {
    pintar();

    for (const caja of screen.getAllByRole('textbox')) {
      expect(caja).toHaveValue('');
    }
  });

  it('cada campo respeta el largo de la sesion y lo cuenta', async () => {
    pintar({ ...TRES_COSAS, largoMaximo: 120 });

    expect(campo(1)).toHaveAttribute('maxLength', '120');
    expect(campo(3)).toHaveAttribute('maxLength', '120');
    expect(screen.getAllByText('0 / 120')).toHaveLength(3);

    await usuario.type(campo(2), 'Una sopa');

    expect(screen.getByText('8 / 120')).toBeInTheDocument();
    expect(screen.getAllByText('0 / 120')).toHaveLength(2);
  });

  it('la mascota sonrie al recibir y esta tranquila mientras se escribe', async () => {
    const sonriente = dibujoCon('feliz');
    const tranquila = dibujoCon('normal');

    expect(sonriente).not.toBe(tranquila);

    pintar();

    const dibujo = () => document.querySelector('.viva-voz img')?.getAttribute('src');

    expect(dibujo()).toBe(sonriente);

    await usuario.type(campo(1), 'Una sopa');

    expect(dibujo()).toBe(tranquila);

    await usuario.clear(campo(1));

    expect(dibujo()).toBe(sonriente);
  });

  it('el contador cuenta lo escrito tal cual: los espacios tambien ocupan lugar en el campo', async () => {
    pintar({ ...TRES_COSAS, largoMaximo: 120 });

    await usuario.type(campo(3), '  ab ');

    expect(screen.getByText('5 / 120')).toBeInTheDocument();
  });

  it('la mascota no valora lo que se escribe: invita y agradece', async () => {
    pintar();

    expect(screen.getByText('Puede ser algo muy pequeño. Aquí cuenta todo.')).toBeInTheDocument();

    await usuario.type(campo(1), 'Una sopa');

    expect(screen.getByText('Gracias por compartirlo. Tómate tu tiempo.')).toBeInTheDocument();
    expect(screen.queryByText('Puede ser algo muy pequeño. Aquí cuenta todo.')).toBeNull();
  });

  it('solo espacios no cuenta como haber escrito', async () => {
    pintar();

    await usuario.type(campo(1), '   ');

    expect(screen.getByText('Puede ser algo muy pequeño. Aquí cuenta todo.')).toBeInTheDocument();
  });
});

describe('terminar: con una basta', () => {
  it('con una sola respuesta se termina, y solo se manda esa', async () => {
    pintar();

    await usuario.type(campo(2), 'Una sopa de lentejas');
    await terminar();

    expect(alTerminar).toHaveBeenCalledTimes(1);
    expect(alTerminar.mock.calls[0]?.[0]).toStrictEqual({
      metadata: { encontroUno: true, textos: ['Una sopa de lentejas'] },
    });
  });

  it('con las tres se mandan en el orden de los campos, sin espacios de mas', async () => {
    pintar();

    await usuario.type(campo(1), '  Una sopa ');
    await usuario.type(campo(2), 'Un paseo');
    await usuario.type(campo(3), '   Llamar a mi hermana');
    await terminar();

    expect(alTerminar.mock.calls[0]?.[0]).toStrictEqual({
      metadata: {
        encontroUno: true,
        textos: ['Una sopa', 'Un paseo', 'Llamar a mi hermana'],
      },
    });
  });

  it('un campo salteado no se manda vacio', async () => {
    pintar();

    await usuario.type(campo(1), 'Una sopa');
    await usuario.type(campo(3), 'Un paseo');
    await terminar();

    expect(alTerminar.mock.calls[0]?.[0]).toStrictEqual({
      metadata: { encontroUno: true, textos: ['Una sopa', 'Un paseo'] },
    });
  });

  it('nunca manda un puntaje: la actividad no se valora', async () => {
    pintar();

    await usuario.type(campo(1), 'Una sopa');
    await terminar();

    expect(alTerminar.mock.calls[0]?.[0]).not.toHaveProperty('score');
  });

  it('sin nada escrito lo dice sin regañar, y no manda nada', async () => {
    pintar();

    await terminar();

    expect(screen.getByRole('alert')).toHaveTextContent('Escribe algo, aunque sea pequeño.');
    expect(alTerminar).not.toHaveBeenCalled();
  });

  it('solo espacios es lo mismo que nada', async () => {
    pintar();

    await usuario.type(campo(1), '   ');
    await terminar();

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(alTerminar).not.toHaveBeenCalled();
  });

  it('el aviso se va en cuanto se escribe', async () => {
    pintar();

    await terminar();
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await usuario.type(campo(2), 'u');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('terminar: cuando la sesion pide mas de una', () => {
  const DOS_DE_TRES = { ...TRES_COSAS, minimo: 2 };

  it('con menos de las que pide, dice cuantas y no manda nada', async () => {
    pintar(DOS_DE_TRES);

    await usuario.type(campo(1), 'Una sopa');
    await terminar();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Escribe al menos 2, aunque sean pequeñas.',
    );
    expect(alTerminar).not.toHaveBeenCalled();
  });

  it('con las que pide, se termina', async () => {
    pintar(DOS_DE_TRES);

    await usuario.type(campo(1), 'Una sopa');
    await usuario.type(campo(3), 'Un paseo');
    await terminar();

    expect(alTerminar).toHaveBeenCalledTimes(1);
  });

  it('un campo con solo espacios no cuenta para el minimo', async () => {
    pintar(DOS_DE_TRES);

    await usuario.type(campo(1), 'Una sopa');
    await usuario.type(campo(2), '   ');
    await terminar();

    expect(alTerminar).not.toHaveBeenCalled();
  });

  it('el minimo no dicho es uno: con una basta', async () => {
    pintar({ invitacion: INVITACION, campos: 3, largoMaximo: 200 });

    await usuario.type(campo(3), 'Un paseo');
    await terminar();

    expect(alTerminar).toHaveBeenCalledTimes(1);
  });
});

describe('enviar el formulario', () => {
  it('no sigue su camino de siempre: no recarga la pagina', async () => {
    const { container } = pintar();

    await usuario.type(campo(1), 'Una sopa');

    const formulario = container.querySelector('form');

    if (formulario === null) {
      throw new Error('No hay formulario.');
    }

    // `fireEvent.submit` devuelve false si alguien cancelo el evento.
    expect(fireEvent.submit(formulario)).toBe(false);
    expect(alTerminar).toHaveBeenCalledTimes(1);
  });
});

describe('hoy no me sale ninguna', () => {
  it('se registra el dia sin texto, igual que en «Un momento bueno del dia»', async () => {
    pintar();

    await usuario.click(screen.getByRole('button', { name: 'Hoy no me sale ninguna' }));

    expect(alTerminar).toHaveBeenCalledTimes(1);
    expect(alTerminar.mock.calls[0]?.[0]).toStrictEqual({ metadata: { encontroUno: false } });
  });

  it('aunque haya algo escrito a medias, el dia queda sin texto', async () => {
    pintar();

    await usuario.type(campo(1), 'Una sopa');
    await usuario.click(screen.getByRole('button', { name: 'Hoy no me sale ninguna' }));

    expect(alTerminar.mock.calls[0]?.[0]).toStrictEqual({ metadata: { encontroUno: false } });
  });

  it('si la sesion no lo permite, el boton no sale', () => {
    pintar({ ...TRES_COSAS, permiteNingunaHoy: false });

    expect(screen.queryByRole('button', { name: /Hoy no me sale/ })).not.toBeInTheDocument();
  });

  it('si la sesion no dice nada, tampoco sale', () => {
    pintar({ invitacion: INVITACION, campos: 3, largoMaximo: 200 });

    expect(screen.queryByRole('button', { name: /Hoy no me sale/ })).not.toBeInTheDocument();
  });
});

describe('mientras se guarda', () => {
  it('Terminar espera y lo dice', () => {
    pintar(TRES_COSAS, true);

    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Terminar' })).not.toBeInTheDocument();
  });

  it('«Hoy no me sale ninguna» tambien espera', () => {
    pintar(TRES_COSAS, true);

    expect(screen.getByRole('button', { name: 'Hoy no me sale ninguna' })).toBeDisabled();
  });

  it('fuera del envio, ambos estan disponibles', () => {
    pintar();

    expect(screen.getByRole('button', { name: 'Terminar' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Hoy no me sale ninguna' })).toBeEnabled();
  });
});

describe('las ideas para empezar', () => {
  const CON_IDEAS = { ...TRES_COSAS, ideas: ['Una receta nueva', 'Un paseo corto'] };

  it('sin ideas, no hay atajos ni un espacio vacio donde irian', () => {
    pintar();

    expect(screen.queryByRole('button', { name: 'Una receta nueva' })).not.toBeInTheDocument();
    expect(document.querySelector('.viva-atajos')).toBeNull();
  });

  it('cada idea es un boton', () => {
    pintar(CON_IDEAS);

    expect(screen.getByRole('button', { name: 'Una receta nueva' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Un paseo corto' })).toBeInTheDocument();
  });

  it('una idea llena el primer campo vacio, y la siguiente el que sigue', async () => {
    pintar(CON_IDEAS);

    await usuario.click(screen.getByRole('button', { name: 'Una receta nueva' }));
    await usuario.click(screen.getByRole('button', { name: 'Un paseo corto' }));

    expect(campo(1)).toHaveValue('Una receta nueva');
    expect(campo(2)).toHaveValue('Un paseo corto');
    expect(campo(3)).toHaveValue('');
  });

  it('salta los campos que ya tienen algo', async () => {
    pintar(CON_IDEAS);

    await usuario.type(campo(1), 'Una sopa');
    await usuario.click(screen.getByRole('button', { name: 'Un paseo corto' }));

    expect(campo(1)).toHaveValue('Una sopa');
    expect(campo(2)).toHaveValue('Un paseo corto');
  });

  it('un campo con solo espacios cuenta como vacio', async () => {
    pintar(CON_IDEAS);

    await usuario.type(campo(1), '   ');
    await usuario.click(screen.getByRole('button', { name: 'Un paseo corto' }));

    expect(campo(1)).toHaveValue('Un paseo corto');
  });

  it('con todos los campos llenos, las ideas esperan y no pisan nada', async () => {
    pintar({ ...CON_IDEAS, campos: 2 });

    await usuario.type(campo(1, 2), 'Una sopa');
    await usuario.type(campo(2, 2), 'Un paseo');

    const idea = screen.getByRole('button', { name: 'Una receta nueva' });

    expect(idea).toBeDisabled();

    await usuario.click(idea);

    expect(campo(1, 2)).toHaveValue('Una sopa');
    expect(campo(2, 2)).toHaveValue('Un paseo');
  });

  it('una idea que no cabe en el largo de la sesion se recorta', async () => {
    pintar({
      ...TRES_COSAS,
      largoMaximo: 50,
      ideas: ['Una idea muy larga que no cabe en cincuenta caracteres de ninguna manera'],
    });

    await usuario.click(screen.getByRole('button', { name: /^Una idea muy larga/ }));

    // Exactamente 50 caracteres.
    expect(campo(1)).toHaveValue('Una idea muy larga que no cabe en cincuenta caract');
  });

  it('tocar una idea quita el aviso de que faltaba escribir', async () => {
    pintar(CON_IDEAS);

    await terminar();
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Una receta nueva' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('lo que llena una idea se manda como lo escrito', async () => {
    pintar(CON_IDEAS);

    await usuario.click(screen.getByRole('button', { name: 'Una receta nueva' }));
    await terminar();

    expect(alTerminar.mock.calls[0]?.[0]).toStrictEqual({
      metadata: { encontroUno: true, textos: ['Una receta nueva'] },
    });
  });
});

describe('el tono', () => {
  // Ningun texto nombra una condicion ni diagnostica (el mismo criterio que las demas actividades de
  // Emociones), y ninguno exige: la ficha pide nada de «deberias estar agradecida».
  const CLINICO =
    /ansiedad|ansios|depresi|deprimid|trastorno|diagn[oó]stic|s[ií]ntoma|patolog|enfermedad|suicid|p[aá]nico|estr[eé]s/i;
  const EXIGE = /deber[ií]as|debes |tienes que|tiene que|obligatori|agradecid/i;

  it('lo que dice la pantalla, en cada momento, no nombra una condicion ni exige', async () => {
    pintar({ ...TRES_COSAS, minimo: 2, ideas: ['Una receta nueva'] });

    const momentos: string[] = [document.body.textContent ?? ''];

    await terminar();
    momentos.push(document.body.textContent ?? '');

    await usuario.type(campo(1), 'Una sopa');
    momentos.push(document.body.textContent ?? '');

    expect(momentos).toHaveLength(3);

    for (const texto of momentos) {
      expect(texto).not.toMatch(CLINICO);
      expect(texto).not.toMatch(EXIGE);
    }
  });
});
