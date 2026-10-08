/*
 * Este archivo escribe a proposito el marcado que `jsx-a11y` prohibe (una imagen sin
 * `alt`, un enlace vacio): es justo lo que le ensena al ayudante a encontrar.
 */
/* eslint-disable jsx-a11y/alt-text, jsx-a11y/anchor-has-content */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { cuantosH1, fallosDeAccesibilidad } from './axe.ts';

/**
 * El ayudante de accesibilidad, probado contra lo que tiene que atrapar.
 *
 * Un revisor que nunca falla pasa todas las pantallas, y eso no demuestra que esten
 * bien: demuestra que no mira. Aqui se le ensena cada tipo de fallo para comprobar
 * que lo ve, y un caso bueno para comprobar que no inventa.
 */
describe('fallosDeAccesibilidad', () => {
  it('no encuentra nada en un formulario bien hecho', async () => {
    render(
      <form>
        <h1>Entrar</h1>
        <label htmlFor="correo">Correo</label>
        <input id="correo" type="email" autoComplete="email" />
        <button type="submit">Entrar</button>
        <img src="logo.png" alt="Logo de VSD Health" />
      </form>,
    );

    expect(await fallosDeAccesibilidad()).toEqual([]);
  });

  it.each([
    ['una imagen sin texto alternativo', <img key="a" src="logo.png" />, 'image-alt'],
    ['un boton sin nombre', <button key="b" type="button" />, 'button-name'],
    ['un campo sin etiqueta', <input key="c" type="text" />, 'label'],
    ['un enlace sin texto', <a key="d" href="/panel" />, 'link-name'],
    [
      'un atributo aria con un valor que no existe',
      // `never`: TypeScript no deja escribir un valor que no existe, y justo eso se prueba.
      <div key="e" role="button" tabIndex={0} aria-pressed={'quizas' as never}>
        Activar
      </div>,
      'aria-valid-attr-value',
    ],
    [
      'un encabezado que se salta un nivel',
      <div key="f">
        <h1>Titulo</h1>
        <h3>Subtitulo</h3>
      </div>,
      'heading-order',
    ],
    [
      'una ventana sin nombre porque su aria-labelledby no apunta a nada',
      <div key="g" role="dialog" aria-labelledby="no-existe" />,
      'aria-dialog-name',
    ],
  ])('encuentra %s', async (_caso, marcado, regla) => {
    render(<main>{marcado}</main>);

    const fallos = await fallosDeAccesibilidad();

    expect(
      fallos.some((fallo) => fallo.startsWith(regla)),
      fallos.join('\n'),
    ).toBe(true);
  });

  it('dice la regla, el impacto y donde esta, no un objeto de cuarenta campos', async () => {
    render(
      <main>
        <button type="button" />
      </main>,
    );

    const [fallo] = await fallosDeAccesibilidad();

    expect(fallo).toMatch(/^button-name \(critical\): .+\. En: .*button/);
  });

  it('solo mira lo que se le pide', async () => {
    const { container } = render(
      <div>
        <div id="bueno">
          <button type="button">Guardar</button>
        </div>
        <div id="malo">
          <button type="button" />
        </div>
      </div>,
    );

    const bueno = container.querySelector('#bueno');

    expect(bueno).not.toBeNull();
    expect(await fallosDeAccesibilidad(bueno!)).toEqual([]);
    expect((await fallosDeAccesibilidad(container)).length).toBeGreaterThan(0);
  });
});

describe('cuantosH1', () => {
  it('cuenta los h1 y los role=heading de nivel 1', () => {
    render(
      <div>
        <h1>Uno</h1>
        <div role="heading" aria-level={1}>
          Dos
        </div>
        <h2>No cuenta</h2>
      </div>,
    );

    expect(cuantosH1()).toBe(2);
  });

  it('sin ninguno, cero', () => {
    render(<h2>Solo un h2</h2>);

    expect(cuantosH1()).toBe(0);
  });
});
