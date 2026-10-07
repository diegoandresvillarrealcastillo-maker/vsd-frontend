import { describe, expect, it } from 'vitest';

import { FotoRechazada, type MotivoDeFotoRechazada } from '../../foto/prepararLaFoto.ts';
import { ErrorDeLaApi } from '../../infraestructura/api/clienteHttp.ts';
import { explicarLaFoto } from './mensajesDeLaFoto.ts';

const api = (estado: number, codigo?: string): ErrorDeLaApi =>
  new ErrorDeLaApi(estado, 'texto que no debe salir', undefined, codigo);

describe('explicarLaFoto (SCRUM-120)', () => {
  describe('lo que el navegador rechaza antes de mandar nada', () => {
    it.each([
      ['tipo', 'elige un archivo .jpg o .png'],
      ['pesado', 'menos de 10 MB'],
      ['ilegible', 'No se pudo abrir esa imagen'],
      ['no-cabe', 'menos de 50 KB'],
    ] as [MotivoDeFotoRechazada, string][])('%s dice que hacer', (motivo, contiene) => {
      expect(explicarLaFoto(new FotoRechazada(motivo), 'guardar')).toContain(contiene);
    });

    it('cada motivo tiene su propia frase', () => {
      const frases = (['tipo', 'pesado', 'ilegible', 'no-cabe'] as const).map((motivo) =>
        explicarLaFoto(new FotoRechazada(motivo), 'guardar'),
      );

      expect(new Set(frases).size).toBe(4);
    });
  });

  describe('lo que la API rechaza, decidido por su codigo y no por su texto', () => {
    it.each([
      ['FOTO_TIPO_NO_PERMITIDO', 415, 'elige un archivo .jpg o .png'],
      ['FOTO_NO_ES_UNA_IMAGEN', 400, 'no es una imagen .jpg o .png válida'],
      ['FOTO_DEMASIADO_PESADA', 413, 'menos de 50 KB'],
      ['CUERPO_DEMASIADO_GRANDE', 413, 'menos de 50 KB'],
      ['FOTO_DEMASIADO_GRANDE', 400, 'demasiado grande'],
    ])('%s', (codigo, estado, contiene) => {
      expect(explicarLaFoto(api(estado, codigo), 'guardar')).toContain(contiene);
    });

    it('un 413 sin codigo, de un proxy, tambien es que pesa de mas', () => {
      expect(explicarLaFoto(api(413), 'guardar')).toContain('menos de 50 KB');
    });

    it('el codigo manda aunque el estado diga otra cosa', () => {
      expect(explicarLaFoto(api(500, 'FOTO_DEMASIADO_PESADA'), 'guardar')).toContain(
        'menos de 50 KB',
      );
    });

    it('nunca repite el texto que mande la API', () => {
      for (const codigo of ['FOTO_DEMASIADO_PESADA', 'ALMACENAMIENTO_NO_DISPONIBLE', 'OTRO']) {
        expect(explicarLaFoto(api(400, codigo), 'guardar')).not.toContain('no debe salir');
      }
    });
  });

  describe('lo que no es culpa de la persona', () => {
    it('el almacenamiento caido dice que se reintente, segun la accion', () => {
      expect(explicarLaFoto(api(503, 'ALMACENAMIENTO_NO_DISPONIBLE'), 'guardar')).toBe(
        'No se pudo guardar tu foto ahora mismo. Inténtalo de nuevo en unos minutos.',
      );
      expect(explicarLaFoto(api(503, 'ALMACENAMIENTO_NO_DISPONIBLE'), 'quitar')).toBe(
        'No se pudo quitar tu foto ahora mismo. Inténtalo de nuevo en unos minutos.',
      );
    });

    it('sin respuesta del servidor, habla de la conexion, segun la accion', () => {
      expect(explicarLaFoto(new TypeError('Failed to fetch'), 'guardar')).toBe(
        'No se pudo guardar la foto. Revisa tu conexión e inténtalo de nuevo.',
      );
      expect(explicarLaFoto(new TypeError('Failed to fetch'), 'quitar')).toBe(
        'No se pudo quitar la foto. Revisa tu conexión e inténtalo de nuevo.',
      );
    });

    it('una sesion caducada dice que vuelva a entrar', () => {
      expect(explicarLaFoto(api(401), 'guardar')).toBe('Tu sesión caducó. Vuelve a entrar.');
    });

    it('demasiadas peticiones dice que espere', () => {
      expect(explicarLaFoto(api(429), 'quitar')).toContain('Espera un momento');
    });

    it('lo que no se reconoce deja el numero, que es lo que se puede decir por telefono', () => {
      expect(explicarLaFoto(api(500, 'ERROR_INTERNO'), 'guardar')).toBe(
        'No se pudo guardar tu foto (error 500). Inténtalo de nuevo en un momento.',
      );
      expect(explicarLaFoto(api(500), 'quitar')).toContain('(error 500)');
    });
  });
});
