/**
 * Version del aviso de tratamiento de datos que se acepta al registrarse.
 *
 * Queda guardada con la cuenta porque la Ley 1581 no se conforma con un si o
 * un no: ante una reclamacion hay que poder demostrar **a que** dio permiso
 * cada persona y **cuando**. Si el aviso cambia, esta cadena cambia con el.
 *
 * Vive en su propio archivo y no dentro del proveedor de sesion porque la usan
 * dos sitios: el registro, que la guarda en Supabase, y el alta de cuenta, que
 * la manda a nuestra API. Tenerla duplicada seria el peor error posible aqui,
 * porque las dos copias podrian decir que se acepto algo distinto.
 */
export const VERSION_DEL_AVISO = '2026-09-1';
