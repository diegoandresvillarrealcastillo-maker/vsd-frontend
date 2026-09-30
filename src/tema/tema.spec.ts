import { afterEach, describe, expect, it } from 'vitest';

import { ponerTema, temaActual, temaElegido } from './tema.ts';

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.tema;
});

describe('Tema', () => {
  it('marca el documento, que es de donde lo lee el CSS', () => {
    ponerTema('oscuro');

    expect(document.documentElement.dataset.tema).toBe('oscuro');
  });

  it('lo recuerda entre visitas', () => {
    ponerTema('oscuro');

    expect(temaElegido()).toBe('oscuro');
  });

  it('no dice que alguien eligio cuando nadie eligio', () => {
    // La diferencia importa: sin eleccion, la aplicacion sigue al sistema. Si
    // esto devolviera un tema, dejaria de seguirlo desde la primera carga.
    expect(temaElegido()).toBeNull();
  });

  it('lee el tema puesto en el documento y no lo vuelve a calcular', () => {
    // Lo pone el script del index.html antes del primer pintado. Recalcularlo
    // aqui abriria la puerta a que el selector ensene una cosa y la pantalla
    // otra.
    document.documentElement.dataset.tema = 'oscuro';

    expect(temaActual()).toBe('oscuro');
  });

  it('apaga las transiciones mientras cambia', () => {
    // Sin esto, una propiedad transicionada cuyo valor sale de una variable se
    // queda con el valor viejo al cambiar solo la variable. El sintoma fue el
    // boton principal con el fondo de un tema y el texto del otro.
    ponerTema('oscuro');

    expect(document.documentElement.dataset.cambiandoTema).toBe('');
  });
});
