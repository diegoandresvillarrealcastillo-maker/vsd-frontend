/**
 * Lo unico que va en un `tel:`: cifras, con un `+` delante si lleva el prefijo del
 * pais. Es la misma forma que imponen el servidor y la base (SCRUM-257); se vuelve
 * a comprobar aqui porque lo que acaba en el marcador de alguien que esta mal no
 * puede ser nada mas, venga de donde venga (una copia vieja, una respuesta rara).
 */
const TELEFONO = /^\+?\d{3,15}$/u;

/** Lo que se puede marcar, o `undefined` si la linea no trae nada que sirva. */
export function telefonoParaMarcar(telefono: string | undefined): string | undefined {
  return telefono !== undefined && TELEFONO.test(telefono) ? telefono : undefined;
}
