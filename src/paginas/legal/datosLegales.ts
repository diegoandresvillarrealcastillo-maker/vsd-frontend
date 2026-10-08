/**
 * Lo que las paginas legales necesitan saber y todavia no esta decidido.
 *
 * ---------------------------------------------------------------------------
 * Esto es un borrador, y el codigo lo sabe
 * ---------------------------------------------------------------------------
 *
 * Los textos de privacidad, terminos y cookies los redacta el equipo y los
 * revisa una persona con formacion juridica (decision D3 de la auditoria 360).
 * Hasta entonces lo que hay es un borrador honesto sobre lo que la aplicacion
 * hace de verdad, y dos cosas impiden que pase por definitivo sin que nadie lo
 * decida:
 *
 * 1. Mientras `TEXTOS_REVISADOS` sea `false`, cada pagina lo dice arriba con un
 *    aviso que no se puede pasar por alto.
 * 2. Hay una prueba que falla si alguien pone `TEXTOS_REVISADOS` en `true` y
 *    queda en pantalla algun `POR_DEFINIR`. Cambiar esa bandera es la decision
 *    consciente de que el texto ya esta revisado y completo.
 *
 * Quien revise puede editar los textos en `Privacidad.tsx`, `Terminos.tsx` y
 * `Cookies.tsx`, y los datos del responsable aqui.
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

/** Si el texto ya lo reviso quien corresponde y no queda nada por completar. */
export const TEXTOS_REVISADOS = false;

/**
 * Quien responde por los datos (Ley 1581 de 2012, articulo 17: el responsable
 * tiene que identificarse). Lo decide el equipo antes de promocionar a
 * produccion (D3).
 *
 * ## Solo lo que la ley pide
 *
 * Este archivo es publico (el repositorio y la pagina de privacidad lo son), asi
 * que lleva lo minimo para que una persona pueda ejercer sus derechos: nombre,
 * ciudad, correo y telefono. **No hay campo para un documento de identidad, un
 * NIT ni una direccion de calle**: la ley no los exige en el aviso y, una vez
 * publicados, no se pueden retirar. Si alguna vez hiciera falta uno, que lo
 * decida quien revise los textos, no que se agregue sin mas.
 */
export const DATOS_DEL_RESPONSABLE = {
  nombre: 'Diego Andrés Villarreal Castillo',
  domicilio: 'Fusagasugá (Cundinamarca), Colombia',
  correo: 'diegoandresvillarrealcastillo@gmail.com',
  telefono: POR_DEFINIR,
} as const;

/**
 * La version de cada documento tal como la acepta la persona.
 *
 * Son las mismas cadenas que la API tiene como vigentes (`GET /api/aviso`): lo
 * que se registra al aceptar es **a que version** se dio permiso, asi que
 * cuando el texto cambia hay que cambiarla aqui y en la API a la vez. El
 * registro (T-03) compara las dos antes de dejar aceptar, para que un texto
 * desactualizado no quede registrado como aceptado.
 */
export const VERSIONES_PUBLICADAS = {
  privacidad: '2026-09-1',
  terminos: '2026-10-1',
} as const;

/** Cuando se redacto el borrador que hay ahora. */
export const FECHA_DEL_BORRADOR = '7 de octubre de 2026';
