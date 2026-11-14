import type { ProgresoDelModulo } from '../../infraestructura/api/progreso.ts';
import type { Operacion } from '../../sincronizacion/cola.ts';
import { diaEnLaZona } from '../../tiempo/zonaHoraria.ts';
import { etapaPara } from '../sendero/etapas.ts';

/**
 * Lo que la persona hizo hoy y todavia no esta en lo que dijo el servidor (SCRUM-140).
 *
 * Sin conexion se ensena la copia del progreso, y encima solo se pone lo que el servidor no
 * puede contradecir: que lo que la persona hizo **hoy**, y esta en la cola o ya se envio, esta
 * hecho. Nada de eso se inventa: es lo que ella hizo.
 *
 * ## Las sesiones
 *
 * Una sesion es un dia en el que se hizo algo del modulo, y la API **ya cuenta hoy** cuando hay
 * algo hecho hoy. Por eso, si lo primero que se hizo hoy en un modulo esta en la cola, ese dia
 * pasa a contar: una sesion mas, y la etapa que le toca con esa cuenta (que el cliente ya
 * calcula igual que el servidor para dibujar el sendero). Si ya habia algo hecho hoy, el dia
 * ya contaba y no se suma otra.
 */

function esObjeto(valor: unknown): valor is Readonly<Record<string, unknown>> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function actividadDe(operacion: Operacion): { id: string; dia: string } | null {
  const { payload } = operacion;

  if (
    !esObjeto(payload) ||
    typeof payload.activityId !== 'string' ||
    typeof payload.completedAt !== 'string' ||
    Number.isNaN(Date.parse(payload.completedAt))
  ) {
    return null;
  }

  return { id: payload.activityId, dia: diaEnLaZona(new Date(payload.completedAt)) };
}

/**
 * El progreso con lo hecho hoy que esta en la cola. Si la copia es de otro dia, tal cual: lo
 * que toca hoy en ella es lo de ese dia.
 *
 * @param guardadoEn Cuando se guardo la copia, o `null` si es lo que acaba de decir el servidor.
 */
export function conLoQueEstaEnLaCola(
  progreso: readonly ProgresoDelModulo[],
  resultados: readonly Operacion[],
  hoy: string,
  guardadoEn: string | null,
): readonly ProgresoDelModulo[] {
  if (guardadoEn !== null && diaEnLaZona(new Date(guardadoEn)) !== hoy) {
    return progreso;
  }

  const hechasHoy = new Set<string>();

  for (const operacion of resultados) {
    const actividad = actividadDe(operacion);

    if (actividad !== null && actividad.dia === hoy) {
      hechasHoy.add(actividad.id);
    }
  }

  if (hechasHoy.size === 0) {
    return progreso;
  }

  return progreso.map((modulo) => {
    const yaHabiaAlgo = modulo.hoy.some((actividad) => actividad.hecha);
    const lista = modulo.hoy.map((actividad) =>
      hechasHoy.has(actividad.id) && !actividad.hecha ? { ...actividad, hecha: true } : actividad,
    );

    // Lo primero que se hizo hoy en este modulo: el dia pasa a contar como una sesion.
    return !yaHabiaAlgo && lista.some((actividad) => actividad.hecha)
      ? {
          ...modulo,
          hoy: lista,
          sesiones: modulo.sesiones + 1,
          etapa: etapaPara(modulo.sesiones + 1),
        }
      : { ...modulo, hoy: lista };
  });
}
