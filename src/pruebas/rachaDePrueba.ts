import type { DiaDeLaSemana, Racha } from '../infraestructura/api/racha.ts';

/** Un miercoles 21 de octubre de 2026 con lunes y martes hechos y hoy hecho. */
export const SEMANA_DE_PRUEBA: readonly DiaDeLaSemana[] = [
  { dia: '2026-10-19', estado: 'hecho' },
  { dia: '2026-10-20', estado: 'hecho' },
  { dia: '2026-10-21', estado: 'hecho' },
  { dia: '2026-10-22', estado: 'futuro' },
  { dia: '2026-10-23', estado: 'futuro' },
  { dia: '2026-10-24', estado: 'futuro' },
  { dia: '2026-10-25', estado: 'futuro' },
];

/**
 * Una racha ya armada para las pruebas de la llama, la celebracion y el panel (SCRUM-243).
 *
 * Por omision: 12 dias, hoy ya sumo, ningun congelamiento usado, y el proximo hito a 14 dias. Cada
 * prueba cambia solo lo que le importa.
 */
export function rachaDePrueba(cambios: Partial<Racha> = {}): Racha {
  return {
    dias: 12,
    nivel: 1,
    hechoHoy: true,
    enDescanso: false,
    congelamientosUsados: 0,
    congelamientosPorMes: 3,
    congelamientosDisponibles: 3,
    diasCubiertos: [],
    proximoHito: 14,
    escalera: [
      { dias: 3, logrado: true },
      { dias: 7, logrado: true },
      { dias: 14, logrado: false },
      { dias: 30, logrado: false },
      { dias: 50, logrado: false },
    ],
    semana: SEMANA_DE_PRUEBA,
    ...cambios,
  };
}
