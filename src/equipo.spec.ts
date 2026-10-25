import { describe, expect, it } from 'vitest';

import contratoJson from './asistente/contrato/reglas-locales.json';
import type { LineaDeAtencion } from './infraestructura/api/resultados.ts';
import { LINEAS_DE_RESPALDO_DE_COLOMBIA } from './paginas/actividad/lineasParaMostrar.ts';
import { lineasParaMenores } from './paginas/autenticacion/lineasParaMenores.ts';
import { EQUIPO, SOLO_PROBLEMAS_TECNICOS } from './equipo.ts';
import { telefonoParaMarcar } from './componentes/telefonoParaMarcar.ts';

/**
 * El contacto tecnico del equipo (SCRUM-257): dos celulares que sirven para problemas
 * tecnicos y nunca son una linea de ayuda.
 */
describe('el equipo de VSD Health', () => {
  it('cada telefono se puede marcar y es el que se lee en pantalla', () => {
    for (const persona of EQUIPO) {
      expect(telefonoParaMarcar(persona.telefono), persona.nombre).toBe(persona.telefono);
      expect(persona.telefono, persona.nombre).toMatch(/^\+57\d{10}$/u);
      expect(persona.telefono.slice(3), persona.nombre).toBe(
        persona.telefonoEscrito.replace(/\s/gu, ''),
      );
    }
  });

  it('son dos personas, con su nombre y su rol', () => {
    expect(EQUIPO.map((persona) => persona.nombreCorto)).toEqual(['Diego', 'Samuel']);
    expect(EQUIPO.every((persona) => persona.rol !== '')).toBe(true);
  });

  it('ningun telefono del equipo es el de una linea de atencion, ni al reves', () => {
    // Los del equipo son para problemas tecnicos: si alguno apareciera en una linea, el boton
    // «Llamar ahora» mandaria a alguien en crisis con un desarrollador.
    const delEquipo = new Set(
      EQUIPO.flatMap((persona) => [persona.telefono, persona.telefono.slice(3)]),
    );
    const delPaquete = Object.values(contratoJson.paquete.paises).flatMap(
      (pais) => pais.lineas as readonly LineaDeAtencion[],
    );
    const lineas = [
      ...LINEAS_DE_RESPALDO_DE_COLOMBIA,
      ...lineasParaMenores('America/Bogota'),
      ...delPaquete,
    ];

    for (const linea of lineas) {
      expect(delEquipo.has(linea.telefono ?? ''), linea.titulo).toBe(false);
    }
  });

  it('la aclaracion dice que es solo para problemas tecnicos y que no es una linea de ayuda', () => {
    expect(SOLO_PROBLEMAS_TECNICOS).toMatch(/solo para problemas técnicos/u);
    expect(SOLO_PROBLEMAS_TECNICOS).toMatch(/No son una línea de ayuda/u);
  });
});
