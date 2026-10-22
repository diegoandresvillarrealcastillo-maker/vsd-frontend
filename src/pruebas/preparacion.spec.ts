import { getConfig } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('la preparacion de las pruebas (SCRUM-241)', () => {
  it('las busquedas asincronas esperan lo bastante para una maquina cargada', () => {
    // Con toda la suite en paralelo, el segundo por omision se queda corto y pruebas como la del Panel
    // fallan a veces sin que nada este mal. Se fija una sola vez, aqui, y no prueba por prueba.
    expect(getConfig().asyncUtilTimeout).toBeGreaterThanOrEqual(5000);
  });
});
