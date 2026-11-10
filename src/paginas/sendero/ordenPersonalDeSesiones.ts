import type { SesionPublicada } from '../../infraestructura/api/sesionesPublicadas.ts';
import type { Modulo } from '../../infraestructura/api/cuenta.ts';

export interface GrupoDeActividad {
  readonly idActividad: string;
  readonly sesiones: readonly SesionPublicada[];
  readonly sesion: SesionPublicada;
}

function hashEstable(texto: string): number {
  let hash = 2166136261;
  for (let indice = 0; indice < texto.length; indice += 1) {
    hash ^= texto.charCodeAt(indice);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Ordena cada sesión individualmente para el árbol de pruebas sin perder ninguna variante. */
export function ordenarSesionesParaPersona(
  sesiones: readonly SesionPublicada[],
  personaId: string,
  modulo: Modulo,
): readonly SesionPublicada[] {
  const fijas = new Set<number>();
  sesiones.forEach((sesion, indice) => {
    if (sesion.frecuencia?.tipo === 'diaria') fijas.add(indice);
  });

  const rotativas = sesiones
    .filter((_, indice) => !fijas.has(indice))
    .slice()
    .sort((a, b) => {
      const ha = hashEstable(`${personaId}|${modulo}|sesion|${a.id}`);
      const hb = hashEstable(`${personaId}|${modulo}|sesion|${b.id}`);
      return ha - hb || a.id.localeCompare(b.id);
    });

  let siguiente = 0;
  return sesiones.map((sesion, indice) => (fijas.has(indice) ? sesion : rotativas[siguiente++]!));
}

/** Una actividad por nodo; su posición y sesión elegida permanecen estables por persona. */
export function ordenarActividadesParaPersona(
  sesiones: readonly SesionPublicada[],
  personaId: string,
  modulo: Modulo,
): readonly GrupoDeActividad[] {
  const agrupadas = new Map<string, SesionPublicada[]>();
  for (const sesion of sesiones) {
    const grupo = agrupadas.get(sesion.idActividad) ?? [];
    grupo.push(sesion);
    agrupadas.set(sesion.idActividad, grupo);
  }

  const grupos = [...agrupadas.entries()].map(([idActividad, variantes]) => {
    const sesionesOrdenadas = [...variantes].sort((a, b) => a.id.localeCompare(b.id));
    const indice =
      hashEstable(`${personaId}|${modulo}|sesion|${idActividad}`) % sesionesOrdenadas.length;
    return { idActividad, sesiones: sesionesOrdenadas, sesion: sesionesOrdenadas[indice]! };
  });

  const posicionesDiarias = new Set<number>();
  grupos.forEach((grupo, indice) => {
    if (grupo.sesiones.some((sesion) => sesion.frecuencia?.tipo === 'diaria')) {
      posicionesDiarias.add(indice);
    }
  });

  const rotativas = grupos
    .filter((_, indice) => !posicionesDiarias.has(indice))
    .sort((a, b) => {
      const primero = hashEstable(`${personaId}|${modulo}|orden|${a.idActividad}`);
      const segundo = hashEstable(`${personaId}|${modulo}|orden|${b.idActividad}`);
      return primero - segundo || a.idActividad.localeCompare(b.idActividad);
    });

  let siguienteRotativa = 0;
  return grupos.map((grupo, indice) => {
    if (posicionesDiarias.has(indice)) return grupo;
    const siguiente = rotativas[siguienteRotativa];
    siguienteRotativa += 1;
    return siguiente!;
  });
}
