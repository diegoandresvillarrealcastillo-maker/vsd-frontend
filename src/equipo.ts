/** Las personas que desarrollan VSD Health. */
export interface PersonaDelEquipo {
  readonly nombre: string;
  readonly nombreCorto: string;
  readonly rol: string;
}

export const EQUIPO: readonly PersonaDelEquipo[] = [
  {
    nombre: 'Diego Andrés Villarreal Castillo',
    nombreCorto: 'Diego',
    rol: 'Product Owner y desarrollo',
  },
  {
    nombre: 'Samuel Villa Pérez',
    nombreCorto: 'Samuel',
    rol: 'Scrum Master y desarrollo',
  },
];

/** Canal formal para reportar problemas tecnicos de la aplicacion. */
export const CORREO_DE_SOPORTE = 'vsdcompany69@gmail.com';

/** La aclaracion que acompana al contacto tecnico en cualquier pantalla. */
export const ACLARACION_DEL_SOPORTE =
  'Este correo es solo para problemas técnicos de la aplicación; no es una línea de ayuda. Si necesitas hablar con alguien, pregunta en VSD IA «¿Dónde busco ayuda?».';
