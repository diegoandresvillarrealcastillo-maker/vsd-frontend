import type { Modulo } from '../../infraestructura/api/cuenta.ts';
import type { NombreDeIcono } from './Icono.tsx';

/**
 * Como se presenta cada modulo: nombre, frase, icono y colores.
 *
 * Los textos y los colores son los del diseño de Figma. Viven aqui y no en el
 * dashboard porque los usan tres pantallas: el dashboard, la bienvenida y la
 * celebracion al desbloquear un modulo.
 */
export interface DatosDeModulo {
  readonly titulo: string;
  readonly descripcion: string;
  readonly icono: NombreDeIcono;
  readonly fondo: string;
  readonly acento: string;
}

/** El orden del diseño. */
export const ORDEN: readonly Modulo[] = ['bienestar', 'cognicion', 'emociones'];

export const MODULOS: Readonly<Record<Modulo, DatosDeModulo>> = {
  bienestar: {
    titulo: 'Bienestar',
    descripcion: 'Hábitos que cuidan tu cuerpo y energía.',
    icono: 'leaf',
    fondo: 'var(--app-bienestar)',
    acento: 'var(--app-bienestar-acento)',
  },
  cognicion: {
    titulo: 'Cognición',
    descripcion: 'Entrena tu memoria, atención y enfoque.',
    icono: 'brain',
    fondo: 'var(--app-cognicion)',
    acento: 'var(--app-cognicion-acento)',
  },
  emociones: {
    titulo: 'Emociones',
    descripcion: 'Conecta, comprende y regula lo que sientes.',
    icono: 'heart',
    fondo: 'var(--app-emociones)',
    acento: 'var(--app-emociones-acento)',
  },
};
