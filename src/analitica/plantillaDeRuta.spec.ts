import { describe, expect, it } from 'vitest';

import { RUTAS, rutaDeActividad, rutaDeModulo } from '../rutas/rutas.ts';
import { RUTA_DESCONOCIDA, plantillaDeRuta } from './plantillaDeRuta.ts';

/**
 * Lo que Google Analytics recibe de cada visita es la plantilla de la pantalla,
 * nunca la direccion (SCRUM-161). Estas pruebas son la garantia de que un
 * identificador, un modulo o lo que alguien escriba a mano no sale del navegador.
 */
describe('plantillaDeRuta', () => {
  it.each([
    RUTAS.INICIO,
    RUTAS.ACCESO,
    RUTAS.REGISTRO,
    RUTAS.RECUPERAR,
    RUTAS.CONTRASENA_NUEVA,
    RUTAS.PRIVACIDAD,
    RUTAS.TERMINOS,
    RUTAS.COOKIES,
    RUTAS.PANEL,
    RUTAS.PERFIL,
    RUTAS.DIARIO,
  ])('%s se cuenta tal cual: no lleva nada personal', (ruta) => {
    expect(plantillaDeRuta(ruta)).toBe(ruta);
  });

  it('el sendero de un modulo se cuenta como la plantilla, sin decir cual', () => {
    expect(plantillaDeRuta(rutaDeModulo('ansiedad'))).toBe('/modulo/:modulo');
    expect(plantillaDeRuta(rutaDeModulo('estado-de-animo'))).toBe('/modulo/:modulo');
  });

  it('una actividad se cuenta como la plantilla, sin su identificador', () => {
    const id = '9f1c2b34-aaaa-4bbb-8ccc-0123456789ab';

    expect(plantillaDeRuta(rutaDeActividad(id))).toBe('/actividad/:id');
    expect(plantillaDeRuta(rutaDeActividad(id))).not.toContain(id);
  });

  it('nunca devuelve parte de lo que recibio', () => {
    for (const entrada of [
      '/modulo/ansiedad',
      '/actividad/9f1c2b34-aaaa-4bbb-8ccc-0123456789ab',
      '/algo/que-escribio-alguien',
      '/diario/2026-10-08',
      '/modulo/con%20espacios',
    ]) {
      const plantilla = plantillaDeRuta(entrada);

      expect(['/modulo/:modulo', '/actividad/:id', RUTA_DESCONOCIDA]).toContain(plantilla);
    }
  });

  it('una direccion que no es ninguna pantalla se cuenta como «otra», sin su texto', () => {
    expect(plantillaDeRuta('/mi-nombre-es-ana')).toBe(RUTA_DESCONOCIDA);
    expect(plantillaDeRuta('/diario/2026-10-08')).toBe(RUTA_DESCONOCIDA);
    expect(plantillaDeRuta('/modulo/')).toBe(RUTA_DESCONOCIDA);
    expect(plantillaDeRuta('/modulo/ansiedad/extra')).toBe(RUTA_DESCONOCIDA);
    expect(plantillaDeRuta('/actividad')).toBe(RUTA_DESCONOCIDA);
  });

  it('la barra final y las mayusculas no cambian la pantalla', () => {
    expect(plantillaDeRuta('/Panel/')).toBe('/panel');
    expect(plantillaDeRuta('/COOKIES')).toBe('/cookies');
    expect(plantillaDeRuta('/Modulo/Ansiedad/')).toBe('/modulo/:modulo');
  });

  it('la portada sigue siendo la portada', () => {
    expect(plantillaDeRuta('/')).toBe('/');
  });
});
