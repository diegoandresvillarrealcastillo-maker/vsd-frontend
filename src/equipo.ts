/**
 * Las personas que desarrollan VSD Health y su telefono **tecnico** (SCRUM-257).
 *
 * Estos numeros son **solo para problemas tecnicos de la aplicacion**: no son una
 * linea de ayuda ni atienden una crisis. Por eso no estan entre las lineas de
 * atencion, no pasan por el boton «Llamar ahora» (`LlamarAhora`, que es solo para
 * lineas verificadas por pais) y donde se muestran lo dicen con todas las letras.
 *
 * Son celulares de las propias personas. Samuel Villa Perez confirmo el 2026-10-24
 * que se muestran asi; para dejar de mostrar uno basta con quitarlo de esta lista,
 * que es el unico sitio donde estan.
 */
export interface PersonaDelEquipo {
  readonly nombre: string;
  readonly nombreCorto: string;
  readonly rol: string;
  /** Lo que marca el `tel:`: con el prefijo de Colombia, para quien llame desde fuera. */
  readonly telefono: string;
  /** Como se lee en pantalla. */
  readonly telefonoEscrito: string;
}

export const EQUIPO: readonly PersonaDelEquipo[] = [
  {
    nombre: 'Diego Andrés Villarreal Castillo',
    nombreCorto: 'Diego',
    rol: 'Product Owner y desarrollo',
    telefono: '+573112801363',
    telefonoEscrito: '311 280 1363',
  },
  {
    nombre: 'Samuel Villa Pérez',
    nombreCorto: 'Samuel',
    rol: 'Scrum Master y desarrollo',
    telefono: '+573245889281',
    telefonoEscrito: '324 588 9281',
  },
];

/** La aclaracion que acompana a estos telefonos en cualquier pantalla. */
export const SOLO_PROBLEMAS_TECNICOS =
  'Son solo para problemas técnicos de la aplicación. No son una línea de ayuda: si necesitas hablar con alguien, pregunta en VSD IA «¿Dónde busco ayuda?».';
