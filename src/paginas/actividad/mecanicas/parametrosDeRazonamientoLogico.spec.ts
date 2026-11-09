import { describe, expect, it } from 'vitest';
import { leerRazonamientoLogico } from './parametrosDeRazonamientoLogico.ts';

const VALIDO = {
  modo: 'deduccion_logica',
  premisas: ['Todas las aves del parque tienen plumas.', 'Lina es un ave del parque.'],
  opciones: [
    { clave: 'plumas', texto: 'Lina tiene plumas.', correcta: true },
    { clave: 'vuela', texto: 'Lina puede volar.', correcta: false },
    { clave: 'duena', texto: 'Todas las aves son de Lina.', correcta: false },
  ],
  explicacion: 'La primera premisa incluye a las aves del parque; Lina pertenece a ese grupo.',
  puntosMaximos: 1,
};

describe('leerRazonamientoLogico', () => {
  it('acepta premisas y una conclusion validas', () => {
    expect(
      leerRazonamientoLogico(VALIDO)?.opciones.filter((opcion) => opcion.correcta),
    ).toHaveLength(1);
  });

  it('rechaza premisas repetidas y mas de una respuesta correcta', () => {
    expect(
      leerRazonamientoLogico({ ...VALIDO, premisas: ['La misma premisa.', 'La misma premisa.'] }),
    ).toBeNull();
    expect(
      leerRazonamientoLogico({
        ...VALIDO,
        opciones: VALIDO.opciones.map((opcion) => ({ ...opcion, correcta: true })),
      }),
    ).toBeNull();
  });
});
