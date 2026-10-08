/**
 * Cuanto hace de algo, en palabras cortas (SCRUM-140): «hace un momento», «hace 5 min»,
 * «hace 3 h», «hace 2 días».
 *
 * Sirve para decir de cuando son los datos que se estan ensenando sin conexion. Se redondea
 * hacia abajo: lo que paso hace 59 minutos es «hace 59 min», no «hace 1 h».
 */
export function haceCuanto(desde: string, ahora: Date): string {
  const minutos = Math.floor((ahora.getTime() - Date.parse(desde)) / 60_000);

  // Una hora del futuro (el reloj del equipo cambio) no es "hace" nada: es ahora.
  if (Number.isNaN(minutos) || minutos < 1) {
    return 'hace un momento';
  }

  if (minutos < 60) {
    return `hace ${String(minutos)} min`;
  }

  const horas = Math.floor(minutos / 60);

  if (horas < 24) {
    return `hace ${String(horas)} h`;
  }

  const dias = Math.floor(horas / 24);

  return dias === 1 ? 'hace 1 día' : `hace ${String(dias)} días`;
}
