import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  alCambiarLaSesion,
  generacionDeSesion,
  iniciarUnaOperacionDeLaSesion,
  reiniciarElCicloParaLasPruebas,
} from './ciclo.ts';

/**
 * La operacion de la sesion (SCRUM-315): lo que se anota antes del primer `await` para saber, al
 * terminar, si lo que se empezo sigue siendo de quien tiene la sesion.
 */

beforeEach(() => {
  reiniciarElCicloParaLasPruebas();
});

afterEach(async () => {
  await alCambiarLaSesion(null, { persistente: false });
  reiniciarElCicloParaLasPruebas();
});

describe('iniciarUnaOperacionDeLaSesion', () => {
  it('sin sesion no hay a quien proteger: nulo', () => {
    expect(iniciarUnaOperacionDeLaSesion()).toBeNull();
  });

  it('anota quien la empezo y la generacion de entonces', async () => {
    await alCambiarLaSesion('ana', { persistente: false });

    const operacion = iniciarUnaOperacionDeLaSesion();

    expect(operacion?.persona).toBe('ana');
    expect(operacion?.generacion).toBe(generacionDeSesion());
    expect(operacion?.peticion.persona).toBe('ana');
    expect(operacion?.vigente()).toBe(true);
    expect(() => operacion?.exigir()).not.toThrow();
  });

  it('sigue vigente aunque la sesion se anuncie otra vez a la misma persona (token renovado)', async () => {
    await alCambiarLaSesion('ana', { persistente: false });

    const operacion = iniciarUnaOperacionDeLaSesion();

    await alCambiarLaSesion('ana', { persistente: false });

    expect(operacion?.vigente()).toBe(true);
    expect(operacion?.peticion.vigente()).toBe(true);
  });

  it('deja de ser vigente cuando la persona sale', async () => {
    await alCambiarLaSesion('ana', { persistente: false });

    const operacion = iniciarUnaOperacionDeLaSesion();

    await alCambiarLaSesion(null, { persistente: false });

    expect(operacion?.vigente()).toBe(false);
    expect(operacion?.peticion.vigente()).toBe(false);
  });

  it('deja de ser vigente cuando entra otra persona', async () => {
    await alCambiarLaSesion('ana', { persistente: false });

    const operacion = iniciarUnaOperacionDeLaSesion();

    await alCambiarLaSesion('beto', { persistente: false });

    expect(operacion?.vigente()).toBe(false);
  });

  it('deja de ser vigente aunque la misma persona vuelva a entrar: comparar la persona no basta', async () => {
    await alCambiarLaSesion('ana', { persistente: false });

    const operacion = iniciarUnaOperacionDeLaSesion();

    await alCambiarLaSesion(null, { persistente: false });
    await alCambiarLaSesion('ana', { persistente: false });

    expect(operacion?.vigente()).toBe(false);
    expect(operacion?.generacion).not.toBe(generacionDeSesion());
  });

  it('deja de ser vigente cuando se cancela, con la sesion de siempre', async () => {
    await alCambiarLaSesion('ana', { persistente: false });

    const control = new AbortController();
    const operacion = iniciarUnaOperacionDeLaSesion(control.signal);

    expect(operacion?.vigente()).toBe(true);

    control.abort();

    expect(operacion?.vigente()).toBe(false);
    expect(operacion?.peticion.vigente()).toBe(false);
  });

  it('exigir lanza una cancelacion, no un fallo', async () => {
    await alCambiarLaSesion('ana', { persistente: false });

    const operacion = iniciarUnaOperacionDeLaSesion();

    await alCambiarLaSesion('beto', { persistente: false });

    expect(() => operacion?.exigir()).toThrow(expect.objectContaining({ name: 'AbortError' }));
  });

  it('una operacion nueva con la sesion de ahora es vigente aunque la anterior ya no', async () => {
    await alCambiarLaSesion('ana', { persistente: false });

    const vieja = iniciarUnaOperacionDeLaSesion();

    await alCambiarLaSesion('beto', { persistente: false });

    const nueva = iniciarUnaOperacionDeLaSesion();

    expect(vieja?.vigente()).toBe(false);
    expect(nueva?.vigente()).toBe(true);
    expect(nueva?.persona).toBe('beto');
  });
});
