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

const HITOS_DE_PRUEBA = [3, 7, 14, 30, 50, 100, 200, 365];

/** La escalera que mandaria el servidor para una racha de tantos dias (solo la tabla, hasta el ano). */
export function escaleraDePrueba(dias: number): Racha['escalera'] {
  const logrados = HITOS_DE_PRUEBA.filter((hito) => hito <= dias);
  const porLograr = HITOS_DE_PRUEBA.filter((hito) => hito > dias).slice(0, 3);

  return [
    ...logrados.map((hito) => ({ dias: hito, logrado: true })),
    ...porLograr.map((hito) => ({ dias: hito, logrado: false })),
  ];
}

/**
 * Una racha ya armada para las pruebas de la llama, la celebracion y el panel (SCRUM-243).
 *
 * Por omision: 12 dias, hoy ya sumo, ningun congelamiento usado. La escalera y el proximo hito salen
 * de los dias, como los mandaria el servidor; cada prueba cambia solo lo que le importa.
 */
export function rachaDePrueba(cambios: Partial<Racha> = {}): Racha {
  const dias = cambios.dias ?? 12;
  const escalera = cambios.escalera ?? escaleraDePrueba(dias);

  return {
    dias,
    nivel: 1,
    hechoHoy: true,
    enDescanso: false,
    congelamientosUsados: 0,
    congelamientosPorMes: 3,
    congelamientosDisponibles: 3,
    diasCubiertos: [],
    proximoHito: escalera.find((hito) => !hito.logrado)?.dias ?? 0,
    escalera,
    semana: SEMANA_DE_PRUEBA,
    ...cambios,
  };
}
