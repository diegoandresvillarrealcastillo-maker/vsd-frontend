/**
 * Lo que las paginas legales necesitan saber: quien responde por los datos, que
 * version de cada texto esta publicada y si el texto esta cerrado.
 *
 * ---------------------------------------------------------------------------
 * Los textos estan cerrados (SCRUM-235, 20 de octubre de 2026)
 * ---------------------------------------------------------------------------
 *
 * Los textos de privacidad, terminos y cookies dejaron de ser un borrador: ya no
 * hay nada por definir y `TEXTOS_REVISADOS` es `true`. Esa bandera es la
 * decision del equipo (SCRUM-235) de que el texto esta completo; no dice que lo
 * haya revisado una persona con formacion juridica (decision D3 de la auditoria
 * 360), y no se debe leer asi.
 *
 * Los dos candados siguen puestos para la proxima version:
 *
 * 1. Si `TEXTOS_REVISADOS` vuelve a `false`, cada pagina lo dice arriba con un
 *    aviso que no se puede pasar por alto (`legalComoBorrador.spec.tsx`).
 * 2. Hay una prueba que falla si la bandera esta en `true` y queda en pantalla
 *    algun `POR_DEFINIR`. Para redactar algo a medias se pone la bandera en
 *    `false`, no se esconde la marca.
 *
 * Los textos viven en `Privacidad.tsx`, `Terminos.tsx` y `Cookies.tsx`; los datos
 * del responsable, aqui. Cuando un texto cambie, cambia su version (abajo) y la
 * del backend a la vez.
 */

import { RUTAS, type Ruta } from '../../rutas/rutas.ts';

/** Los tres documentos legales, en el orden en que se suelen buscar. */
export const DOCUMENTOS_LEGALES: readonly { readonly ruta: Ruta; readonly nombre: string }[] = [
  { ruta: RUTAS.PRIVACIDAD, nombre: 'Privacidad' },
  { ruta: RUTAS.TERMINOS, nombre: 'Términos' },
  { ruta: RUTAS.COOKIES, nombre: 'Cookies' },
];

/** Lo que falta por decidir se escribe siempre asi, para poder buscarlo. */
export const POR_DEFINIR = '[POR DEFINIR]';

/** Si el equipo da el texto por completo: no queda nada por completar ni por decidir. */
export const TEXTOS_REVISADOS = true;

/**
 * Quien responde por los datos (Ley 1581 de 2012, articulo 17: el responsable
 * tiene que identificarse). Lo decide el equipo antes de promocionar a
 * produccion (D3).
 *
 * El correo es el oficial para ejercer los derechos: uno solo, que aparece igual
 * en el aviso y en los terminos porque ambos lo leen de aqui.
 *
 * ## Solo lo que la ley pide
 *
 * Este archivo es publico (el repositorio y la pagina de privacidad lo son), asi
 * que lleva lo minimo para que una persona pueda ejercer sus derechos: nombre,
 * ciudad y correo. **No hay campo para un telefono, un documento de identidad,
 * un NIT ni una direccion de calle**: la ley no los exige en el aviso y, una vez
 * publicados, no se pueden retirar del historial del repositorio. Si alguna vez
 * hiciera falta uno, que lo decida quien revise los textos, no que se agregue
 * sin mas.
 */
export const DATOS_DEL_RESPONSABLE: Readonly<Record<'nombre' | 'domicilio' | 'correo', string>> = {
  nombre: 'Diego Andrés Villarreal Castillo',
  domicilio: 'Fusagasugá (Cundinamarca), Colombia',
  correo: 'vsdcompany69@gmail.com',
};

/**
 * La version de cada documento tal como la acepta la persona.
 *
 * Son las mismas cadenas que la API tiene como vigentes (`GET /api/aviso`): lo
 * que se registra al aceptar es **a que version** se dio permiso, asi que
 * cuando el texto cambia hay que cambiarla aqui y en la API a la vez. La API es
 * la que dice cual se acepta (el alta toma la version de `GET /api/aviso`); esta
 * es la que se ve en la pagina. Si no coinciden, la persona acepta una version
 * que no es la que leyo: por eso viajan juntas, frontend y backend, en el mismo
 * envio.
 *
 * 2026-10-3 (SCRUM-235): el aviso describe la constancia de la baja y su plazo,
 * la transferencia internacional y los respaldos; los terminos traen la
 * limitacion de responsabilidad. Las dos llevan el mismo numero porque se
 * publicaron juntas, pero cada una cambia por su lado.
 */
export const VERSIONES_PUBLICADAS = {
  privacidad: '2026-10-3',
  terminos: '2026-10-3',
} as const;

/** El dia en que se cerraron los textos que hay ahora. */
export const FECHA_DE_ACTUALIZACION = '20 de octubre de 2026';
