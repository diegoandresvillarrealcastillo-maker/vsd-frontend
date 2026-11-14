/**
 * Lo que dice una pantalla de motor cuando no tiene sesion con que pintarse (SCRUM-209, SCRUM-210).
 *
 * Las pantallas de motor viven de la sesion de hoy, que la entrega el servidor y deja guardada el
 * panel en este equipo. A diferencia de las actividades de siempre, no tienen un respaldo: sin una
 * sesion que entiendan no hay nada que pintar, y lo dicen en lugar de mostrar algo roto.
 */
export function SinSesion() {
  return (
    <div className="actividad__pendiente">
      <p className="actividad__texto">
        Esta actividad necesita la sesión de hoy y no la tenemos en este equipo. Vuelve al panel y
        ábrela desde ahí.
      </p>
    </div>
  );
}
