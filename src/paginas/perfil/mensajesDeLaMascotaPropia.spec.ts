import { describe, expect, it } from 'vitest';

import { SvgRechazado } from '../../foto/comprobarElSvg.ts';
import { ErrorDeLaApi } from '../../infraestructura/api/clienteHttp.ts';
import { explicarLaMascotaPropia } from './mensajesDeLaMascotaPropia.ts';

const api = (estado: number, codigo?: string): ErrorDeLaApi =>
  new ErrorDeLaApi(estado, 'texto que no debe salir', undefined, codigo);

describe('explicarLaMascotaPropia (SCRUM-122)', () => {
  describe('lo que el navegador rechaza antes de mandar nada', () => {
    it('lo que no es un .svg dice que elija uno', () => {
      expect(explicarLaMascotaPropia(new SvgRechazado('tipo'), 'guardar')).toContain('.svg');
    });

    it('lo que pesa de mas dice cuanto y que hacer', () => {
      const frase = explicarLaMascotaPropia(new SvgRechazado('peso'), 'guardar');

      expect(frase).toContain('100 KB');
      expect(frase).toContain('Simplifica');
    });
  });

  describe('lo que la API rechaza, decidido por su codigo y no por su texto', () => {
    it.each([
      ['MASCOTA_SVG_TIPO_NO_PERMITIDO', 415, 'termine en .svg'],
      ['MASCOTA_SVG_DEMASIADO_PESADO', 413, '100 KB'],
      ['CUERPO_DEMASIADO_GRANDE', 413, '100 KB'],
      ['MASCOTA_SVG_NO_ES_UN_SVG', 400, 'no es un SVG válido'],
      ['MASCOTA_SVG_PELIGROSO', 400, 'por seguridad'],
      ['MASCOTA_SVG_NO_ADMITIDO', 400, 'textos, imágenes, filtros o estilos'],
      ['MASCOTA_SVG_DEMASIADO_COMPLEJO', 400, 'demasiado complejo'],
    ])('%s', (codigo, estado, contiene) => {
      expect(explicarLaMascotaPropia(api(estado, codigo), 'guardar')).toContain(contiene);
    });

    it('un SVG que no se admite manda a la guia y dice que convierta los textos a trazos', () => {
      const frase = explicarLaMascotaPropia(api(400, 'MASCOTA_SVG_NO_ADMITIDO'), 'guardar');

      expect(frase).toContain('guía');
      expect(frase).toContain('trazos');
    });

    it('cada motivo tiene su propia frase', () => {
      const frases = [
        'MASCOTA_SVG_TIPO_NO_PERMITIDO',
        'MASCOTA_SVG_DEMASIADO_PESADO',
        'MASCOTA_SVG_NO_ES_UN_SVG',
        'MASCOTA_SVG_PELIGROSO',
        'MASCOTA_SVG_NO_ADMITIDO',
        'MASCOTA_SVG_DEMASIADO_COMPLEJO',
      ].map((codigo) => explicarLaMascotaPropia(api(400, codigo), 'guardar'));

      expect(new Set(frases).size).toBe(6);
    });

    it('el codigo del cuerpo demasiado grande se explica aunque el estado sea otro', () => {
      // Si solo mandara el estado 413, este caso se explicaria por casualidad.
      expect(explicarLaMascotaPropia(api(500, 'CUERPO_DEMASIADO_GRANDE'), 'guardar')).toContain(
        '100 KB',
      );
    });

    it('un 413 sin codigo, de un proxy, tambien es que pesa de mas', () => {
      expect(explicarLaMascotaPropia(api(413), 'guardar')).toContain('100 KB');
    });

    it('el codigo manda aunque el estado diga otra cosa', () => {
      expect(explicarLaMascotaPropia(api(500, 'MASCOTA_SVG_PELIGROSO'), 'guardar')).toContain(
        'por seguridad',
      );
    });

    it('nunca repite el texto que mande la API ni nada del archivo', () => {
      for (const codigo of ['MASCOTA_SVG_PELIGROSO', 'MASCOTA_SVG_NO_ADMITIDO', 'OTRO']) {
        expect(explicarLaMascotaPropia(api(400, codigo), 'guardar')).not.toContain('no debe salir');
      }
    });

    it('si no se pudo dejar como la elegida, manda a elegirla en «Tu mascota»', () => {
      expect(explicarLaMascotaPropia(api(400, 'MASCOTA_INVALIDA'), 'guardar')).toContain(
        '«Tu mascota»',
      );
    });
  });

  describe('lo que no es culpa de la persona', () => {
    it('el almacenamiento caido dice que se reintente, segun la accion', () => {
      expect(explicarLaMascotaPropia(api(503, 'ALMACENAMIENTO_NO_DISPONIBLE'), 'guardar')).toBe(
        'No se pudo guardar tu mascota ahora mismo. Inténtalo de nuevo en unos minutos.',
      );
      expect(explicarLaMascotaPropia(api(503, 'ALMACENAMIENTO_NO_DISPONIBLE'), 'quitar')).toBe(
        'No se pudo quitar tu mascota ahora mismo. Inténtalo de nuevo en unos minutos.',
      );
    });

    it('sin respuesta del servidor, habla de la conexion, segun la accion', () => {
      expect(explicarLaMascotaPropia(new TypeError('Failed to fetch'), 'guardar')).toBe(
        'No se pudo guardar tu mascota. Revisa tu conexión e inténtalo de nuevo.',
      );
      expect(explicarLaMascotaPropia(new TypeError('Failed to fetch'), 'quitar')).toBe(
        'No se pudo quitar tu mascota. Revisa tu conexión e inténtalo de nuevo.',
      );
    });

    it('una sesion caducada dice que vuelva a entrar', () => {
      expect(explicarLaMascotaPropia(api(401), 'guardar')).toBe(
        'Tu sesión caducó. Vuelve a entrar.',
      );
    });

    it('demasiadas peticiones dice que espere', () => {
      expect(explicarLaMascotaPropia(api(429), 'quitar')).toContain('Espera un momento');
    });

    it('lo que no se reconoce deja el numero, que es lo que se puede decir por telefono', () => {
      expect(explicarLaMascotaPropia(api(500, 'ERROR_INTERNO'), 'guardar')).toBe(
        'No se pudo guardar tu mascota (error 500). Inténtalo de nuevo en un momento.',
      );
    });
  });
});
