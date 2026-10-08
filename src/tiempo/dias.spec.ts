import { describe, expect, it } from 'vitest';

import { diasAntes } from './dias.ts';

describe('diasAntes', () => {
  it('cuenta dias hacia atras', () => {
    expect(diasAntes('2026-10-03', 1)).toBe('2026-10-02');
    expect(diasAntes('2026-10-03', 0)).toBe('2026-10-03');
  });

  it('cruza meses y anos', () => {
    expect(diasAntes('2026-10-01', 1)).toBe('2026-09-30');
    expect(diasAntes('2026-01-01', 1)).toBe('2025-12-31');
  });

  it('respeta los anos bisiestos', () => {
    expect(diasAntes('2028-03-01', 1)).toBe('2028-02-29');
    expect(diasAntes('2027-03-01', 1)).toBe('2027-02-28');
  });

  it('treinta dias son treinta dias del calendario', () => {
    expect(diasAntes('2026-10-30', 29)).toBe('2026-10-01');
  });
});
