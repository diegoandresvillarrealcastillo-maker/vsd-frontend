import { lazy, type ComponentType } from 'react';

/**
 * Las pantallas de la aplicacion, cada una en su propio archivo que se baja cuando se necesita
 * (SCRUM-283).
 *
 * Antes todas viajaban en el paquete principal: quien abria la portada bajaba, interpretaba y
 * ejecutaba tambien el panel, el sendero, las actividades y el perfil, que pesaban mas que el
 * resto junto. En un telefono de gama media eso es lo que hacia que abrir la aplicacion se
 * quedara «pensando». La portada es la unica que va en el paquete: es lo primero que ve quien
 * llega sin cuenta, y esa visita no puede esperar a un segundo archivo.
 *
 * ## Que no se pierde
 *
 * - **No hay espera al navegar.** El service worker guarda todos los archivos desde la primera
 *   visita, y `react-router` cambia de pantalla dentro de una transicion: si el archivo todavia no
 *   esta, se queda la pantalla de antes hasta que llega, sin parpadeo. No se bajan por adelantado
 *   «por si acaso»: competirian con el service worker, que ya los esta guardando.
 * - **Quien ya tiene sesion no espera dos veces.** `precargarLaPrimeraPantalla` pide el panel en
 *   cuanto arranca el JavaScript, en paralelo con la comprobacion de la sesion y no despues.
 */

type Pagina = ComponentType<Record<string, never>>;

function perezosa<Nombre extends string>(
  importar: () => Promise<Record<Nombre, Pagina>>,
  nombre: Nombre,
) {
  return lazy(() => importar().then((modulo) => ({ default: modulo[nombre] })));
}

const importarElPanel = () => import('../paginas/panel/Panel.tsx');
const importarElPerfil = () => import('../paginas/perfil/Perfil.tsx');
const importarElSendero = () => import('../paginas/sendero/Sendero.tsx');
const importarLaActividad = () => import('../paginas/actividad/Actividad.tsx');
const importarElDiario = () => import('../paginas/diario/Diario.tsx');
const importarElAcceso = () => import('../paginas/autenticacion/Acceso.tsx');
const importarElRegistro = () => import('../paginas/autenticacion/Registro.tsx');
const importarRecuperar = () => import('../paginas/autenticacion/Recuperar.tsx');
const importarContrasenaNueva = () => import('../paginas/autenticacion/ContrasenaNueva.tsx');
const importarCompletarRegistro = () => import('../paginas/autenticacion/CompletarRegistro.tsx');
const importarLosTextosNuevos = () =>
  import('../paginas/autenticacion/ActualizamosNuestrosTextos.tsx');
const importarSoloMayores = () => import('../paginas/autenticacion/SoloMayores.tsx');
const importarPrivacidad = () => import('../paginas/legal/Privacidad.tsx');
const importarTerminos = () => import('../paginas/legal/Terminos.tsx');
const importarCookies = () => import('../paginas/legal/Cookies.tsx');

export const Panel = perezosa(importarElPanel, 'Panel');
export const Perfil = perezosa(importarElPerfil, 'Perfil');
export const Sendero = perezosa(importarElSendero, 'Sendero');
export const Actividad = perezosa(importarLaActividad, 'Actividad');
export const Diario = perezosa(importarElDiario, 'Diario');
export const Acceso = perezosa(importarElAcceso, 'Acceso');
export const Registro = perezosa(importarElRegistro, 'Registro');
export const Recuperar = perezosa(importarRecuperar, 'Recuperar');
export const ContrasenaNueva = perezosa(importarContrasenaNueva, 'ContrasenaNueva');
export const CompletarRegistro = perezosa(importarCompletarRegistro, 'CompletarRegistro');
export const ActualizamosNuestrosTextos = perezosa(
  importarLosTextosNuevos,
  'ActualizamosNuestrosTextos',
);
export const SoloMayores = perezosa(importarSoloMayores, 'SoloMayores');
export const Privacidad = perezosa(importarPrivacidad, 'Privacidad');
export const Terminos = perezosa(importarTerminos, 'Terminos');
export const Cookies = perezosa(importarCookies, 'Cookies');

/**
 * Lo que se abre primero segun quien llega, para pedirlo sin esperar a saber nada mas: quien tiene
 * una sesion guardada va al panel; quien no, al acceso o a la portada.
 */
export function precargarLaPrimeraPantalla(hayUnaSesionGuardada: boolean): void {
  void (hayUnaSesionGuardada ? importarElPanel() : importarElAcceso()).catch(() => undefined);
}
