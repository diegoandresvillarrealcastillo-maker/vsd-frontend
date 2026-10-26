import { describe, it, expect } from 'vitest';
import c from './contrato/reglas-locales.json';
import { responderSinConexion } from './reglasLocales.ts';
describe('riesgo Unicode sin conexion', () => {
  const reglas = c.paquete;
  const frase = reglas.riesgo.expresiones.find((x) => x.includes(' '))!;
  for (const separador of ['\u200b', '\u200d', '\u2060', '\ufeff', '\u034f', '\u200e']) {
    it('mantiene riesgo con invisible ' + separador.codePointAt(0)?.toString(16), () => {
      for (const texto of [frase, [...frase].join(separador), frase.replaceAll(' ', separador)]) {
        expect(responderSinConexion(reglas, { texto, zona: 'Colombia' }).tipo).toBe('riesgo');
      }
    });
  }
});
