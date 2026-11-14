import { describe, expect, it } from 'vitest';

import type { LineaDeAtencion } from '../../infraestructura/api/resultados.ts';
import { fijarLaZonaDeLaCuenta } from '../../tiempo/zonaHoraria.ts';
import {
  DIRECTORIO_DE_RESPALDO,
  DIRECTORIO_INTERNACIONAL,
  esZonaDeColombia,
  LINEAS_DE_RESPALDO_DE_COLOMBIA,
  lineasDeRespaldo,
  lineasParaMostrar,
  textoDeCobertura,
} from './lineasParaMostrar.ts';

const DEL_SERVIDOR: LineaDeAtencion = {
  id: 'l-024',
  titulo: 'Línea 024, llama a la vida',
  tipo: 'contacto',
  cobertura: 'nacional',
};

describe('esZonaDeColombia', () => {
  it('Bogota es de Colombia', () => {
    expect(esZonaDeColombia('America/Bogota')).toBe(true);
  });

  // Misma hora que Bogota no es el mismo pais: darle el 192 a alguien en Lima
  // es el error que SCRUM-124 existe para evitar.
  it.each([
    'America/Lima',
    'America/Guayaquil',
    'America/Panama',
    'Europe/Madrid',
    'America/Mexico_City',
    'America/New_York',
    'UTC',
    '',
    'Marte/Olimpo',
  ])('%s no lo es', (zona) => {
    expect(esZonaDeColombia(zona)).toBe(false);
  });
});

describe('lineasDeRespaldo', () => {
  it('en Colombia, las dos nacionales', () => {
    expect(lineasDeRespaldo('America/Bogota')).toBe(LINEAS_DE_RESPALDO_DE_COLOMBIA);
    expect(lineasDeRespaldo('America/Bogota').map((linea) => linea.titulo)).toEqual([
      'Línea 192, opción 4',
      'Línea 123',
    ]);
  });

  it.each(['Europe/Madrid', 'America/Mexico_City', 'America/Lima', 'Asia/Tokyo', 'UTC'])(
    'en %s, el directorio y ningun numero de telefono',
    (zona) => {
      expect(lineasDeRespaldo(zona)).toEqual([DIRECTORIO_DE_RESPALDO]);
      expect(DIRECTORIO_DE_RESPALDO.descripcion).not.toMatch(/\d/u);
      expect(DIRECTORIO_DE_RESPALDO.enlace).toBe(DIRECTORIO_INTERNACIONAL);
    },
  );

  it('sin zona, usa la de la cuenta', () => {
    fijarLaZonaDeLaCuenta('Europe/Madrid');

    expect(lineasDeRespaldo()).toEqual([DIRECTORIO_DE_RESPALDO]);

    fijarLaZonaDeLaCuenta('America/Bogota');

    expect(lineasDeRespaldo()).toBe(LINEAS_DE_RESPALDO_DE_COLOMBIA);
  });

  it('el respaldo de fuera dice la verdad: todavia no tenemos sus lineas', () => {
    expect(DIRECTORIO_DE_RESPALDO.descripcion).toContain('Todavía no tenemos verificadas');
    expect(DIRECTORIO_DE_RESPALDO.descripcion).toContain(
      'número de emergencias del lugar donde estás',
    );
  });
});

describe('lineasParaMostrar', () => {
  it('lo que manda el servidor manda, sea cual sea la zona', () => {
    expect(lineasParaMostrar([DEL_SERVIDOR], 'America/Bogota')).toEqual([DEL_SERVIDOR]);
    expect(lineasParaMostrar([DEL_SERVIDOR], 'Europe/Madrid')).toEqual([DEL_SERVIDOR]);
  });

  it.each([undefined, []])(
    'si el servidor no manda ninguna (%j), el respaldo de la zona',
    (nada) => {
      expect(lineasParaMostrar(nada, 'America/Bogota')).toBe(LINEAS_DE_RESPALDO_DE_COLOMBIA);
      expect(lineasParaMostrar(nada, 'Europe/Madrid')).toEqual([DIRECTORIO_DE_RESPALDO]);
    },
  );
});

describe('textoDeCobertura', () => {
  it.each([
    ['nacional', 'Todo el país'],
    ['bogota', 'Desde Bogotá'],
    ['universidad', 'Universidad'],
    ['internacional', 'Directorio internacional'],
  ])('%s se dice «%s»', (cobertura, texto) => {
    expect(textoDeCobertura(cobertura)).toBe(texto);
  });

  it('una cobertura que no se conoce no se inventa', () => {
    expect(textoDeCobertura('planetaria')).toBeUndefined();
    expect(textoDeCobertura(undefined)).toBeUndefined();
  });
});
