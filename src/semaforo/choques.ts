import type { CambiosDePendiente, Pendiente } from '../infraestructura/api/pendientes.ts';
import { diaEnLaZona } from '../tiempo/zonaHoraria.ts';
import { NIVEL, vencimiento } from './niveles.ts';

/**
 * Las palabras con las que se ensenan, lado a lado, lo del servidor y lo que la persona
 * cambio cuando choco con otro dispositivo (SCRUM-140, ADR 0009).
 *
 * Son lineas cortas que se pueden comparar de un vistazo. Nunca dicen mas de lo necesario.
 */

const FORMATO_DEL_DIA = new Intl.DateTimeFormat('es-CO', {
  // El dia ya es local: se pinta a mediodia UTC para que ninguna zona lo mueva.
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

function diaLegible(dia: string): string {
  return FORMATO_DEL_DIA.format(new Date(`${dia}T12:00:00Z`));
}

/** El dia (en la zona de la persona) hasta el que se pospone algo, que se guarda como instante. */
function posponerHasta(instante: string): string {
  return diaLegible(diaEnLaZona(new Date(instante)));
}

/** Lo que tiene el servidor, tal cual esta. */
export function describirPendiente(pendiente: Pendiente, hoy: string): readonly string[] {
  return [
    `Texto: «${pendiente.texto}»`,
    `Para cuándo: ${NIVEL[pendiente.nivel].nombre}`,
    pendiente.hecho ? 'Hecho' : 'Sin hacer',
    pendiente.fechaLimite === null
      ? 'Sin fecha límite'
      : `Fecha límite: ${vencimiento(pendiente.fechaLimite, hoy).texto.toLowerCase()}`,
    ...(pendiente.posponerHasta === null
      ? []
      : [`Pospuesto hasta el ${posponerHasta(pendiente.posponerHasta)}`]),
  ];
}

/** Lo que la persona queria cambiar: solo lo que cambia, no todo lo demas. */
export function describirCambios(
  cambios: CambiosDePendiente,
  eliminar: boolean,
  hoy: string,
): readonly string[] {
  if (eliminar) {
    return ['Eliminarlo'];
  }

  const lineas: string[] = [];

  if (cambios.texto !== undefined) {
    lineas.push(`Texto: «${cambios.texto}»`);
  }

  if (cambios.nivel !== undefined) {
    lineas.push(`Pasa a ${NIVEL[cambios.nivel].nombre}`);
  }

  if (cambios.hecho !== undefined) {
    lineas.push(cambios.hecho ? 'Marcarlo como hecho' : 'Volver a ponerlo como pendiente');
  }

  if (cambios.fechaLimite !== undefined) {
    lineas.push(
      cambios.fechaLimite === null
        ? 'Quitar la fecha límite'
        : `Fecha límite: ${vencimiento(cambios.fechaLimite, hoy).texto.toLowerCase()}`,
    );
  }

  if (cambios.posponerHasta !== undefined) {
    lineas.push(
      cambios.posponerHasta === null
        ? 'Dejar de posponerlo'
        : `Posponerlo hasta el ${posponerHasta(cambios.posponerHasta)}`,
    );
  }

  return lineas;
}
