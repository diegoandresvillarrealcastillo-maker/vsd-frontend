import { describe, expect, it } from 'vitest';

import { ErrorDeLaApi } from '../infraestructura/api/clienteHttp.ts';
import { CODIGOS_DE_CONFLICTO, clasificarFallo } from './clasificarFallo.ts';

function api(estado: number, codigo?: string, reintentarEnSegundos?: number): ErrorDeLaApi {
  return new ErrorDeLaApi(estado, 'mensaje', undefined, codigo, reintentarEnSegundos);
}

describe('clasificarFallo: la API respondio', () => {
  it('un 401 es la sesion: se detiene todo, sin descartar nada', () => {
    expect(clasificarFallo(api(401, 'TOKEN_INVALIDO'))).toEqual({ clase: 'sesion' });
    expect(clasificarFallo(api(401))).toEqual({ clase: 'sesion' });
  });

  it.each([
    ['VERSION_DESACTUALIZADA', 409],
    ['EDICION_FUERA_DE_PLAZO', 409],
    ['VERSION_DESACTUALIZADA', 400],
  ])('el codigo %s (estado %i) es un conflicto, no un error', (codigo, estado) => {
    expect(clasificarFallo(api(estado, codigo))).toEqual({ clase: 'conflicto', codigo, estado });
  });

  it('los codigos de conflicto son los dos de ADR 0009', () => {
    expect([...CODIGOS_DE_CONFLICTO].sort()).toEqual([
      'EDICION_FUERA_DE_PLAZO',
      'VERSION_DESACTUALIZADA',
    ]);
  });

  it('un 409 con otro codigo NO es un conflicto: es un rechazo', () => {
    expect(clasificarFallo(api(409, 'VERSION_DEL_AVISO_NO_VIGENTE'))).toEqual({
      clase: 'permanente',
      codigo: 'VERSION_DEL_AVISO_NO_VIGENTE',
      estado: 409,
    });
  });

  it.each([408, 425, 429, 500, 502, 503, 504, 599])('un %i es pasajero: se reintenta', (estado) => {
    expect(clasificarFallo(api(estado, 'ERROR_INTERNO'))).toEqual({
      clase: 'temporal',
      codigo: 'ERROR_INTERNO',
      estado,
    });
  });

  it('conserva lo que pide el servidor (Retry-After)', () => {
    expect(clasificarFallo(api(429, 'DEMASIADAS_PETICIONES', 45))).toEqual({
      clase: 'temporal',
      codigo: 'DEMASIADAS_PETICIONES',
      estado: 429,
      reintentarEnSegundos: 45,
    });
  });

  it('sin Retry-After no inventa uno', () => {
    expect(clasificarFallo(api(503))).not.toHaveProperty('reintentarEnSegundos');
  });

  it.each([400, 403, 404, 413, 415, 422])(
    'un %i es permanente: reintentar no cambia la respuesta',
    (estado) => {
      expect(clasificarFallo(api(estado, 'PENDIENTE_INVALIDO'))).toEqual({
        clase: 'permanente',
        codigo: 'PENDIENTE_INVALIDO',
        estado,
      });
    },
  );

  it('un error sin codigo (un proxy) usa el estado como codigo', () => {
    expect(clasificarFallo(api(404))).toEqual({
      clase: 'permanente',
      codigo: 'HTTP_404',
      estado: 404,
    });
    expect(clasificarFallo(api(502))).toMatchObject({ clase: 'temporal', codigo: 'HTTP_502' });
  });

  it('un 404 de "no existe" es permanente: no va a aparecer solo', () => {
    expect(clasificarFallo(api(404, 'PENDIENTE_NO_ENCONTRADO')).clase).toBe('permanente');
  });
});

describe('clasificarFallo: ni siquiera llego', () => {
  it('un TypeError (asi falla fetch sin red) es la red', () => {
    expect(clasificarFallo(new TypeError('Failed to fetch'))).toEqual({ clase: 'red' });
    expect(clasificarFallo(new TypeError('Load failed'))).toEqual({ clase: 'red' });
    expect(
      clasificarFallo(new TypeError('NetworkError when attempting to fetch resource.')),
    ).toEqual({
      clase: 'red',
    });
  });

  it('una peticion cancelada o con el tiempo agotado tambien', () => {
    expect(clasificarFallo(new DOMException('cancelada', 'AbortError'))).toEqual({ clase: 'red' });
    expect(clasificarFallo(new DOMException('tarde', 'TimeoutError'))).toEqual({ clase: 'red' });
  });

  it('una respuesta que no es JSON (el portal de una red wifi) es la red, no un error de la operacion', () => {
    expect(clasificarFallo(new SyntaxError('Unexpected token < in JSON'))).toEqual({
      clase: 'red',
    });
  });

  it('un fallo de la red no es un error de la API aunque tenga mensaje', () => {
    expect(clasificarFallo(new TypeError('x')).clase).not.toBe('permanente');
  });
});

describe('clasificarFallo: lo inesperado', () => {
  it.each([
    ['un Error cualquiera', new Error('algo raro')],
    ['un texto', 'fallo'],
    ['nulo', null],
    ['indefinido', undefined],
    ['un objeto', { cosa: 1 }],
    ['un numero', 7],
  ])('%s se trata como pasajero, no como un rechazo', (_nombre, error) => {
    // Descartar o marcar como rechazada una operacion por algo que no es suyo seria
    // perderla. El limite de intentos evita que insista para siempre.
    expect(clasificarFallo(error)).toEqual({ clase: 'temporal', codigo: 'ERROR_INESPERADO' });
  });
});
