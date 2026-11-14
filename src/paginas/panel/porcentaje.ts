/** El porcentaje entero de `parte` sobre `total`; 0 si no hay total. */
export function porcentaje(parte: number, total: number): number {
  return total === 0 ? 0 : Math.round((parte / total) * 100);
}
