import type { Expresion } from '../mascota/personajes.ts';

/**
 * Los pasos del tutorial de bienvenida (SCRUM-187).
 *
 * Los textos acompanan: ninguno apura, exige ni reprocha, y ninguno promete lo que la
 * aplicacion no hace (el asistente orienta, no diagnostica). Son una propuesta para que
 * Diego los revise (D10 del ciclo 7).
 */
export interface PasoDelTutorial {
  readonly id: string;
  readonly titulo: string;
  readonly texto: string;
  /** La cara con la que Fungito dice este paso. */
  readonly expresion: Expresion;
}

export const PASOS_DEL_TUTORIAL: readonly PasoDelTutorial[] = [
  {
    id: 'hola',
    titulo: '¡Hola! Soy Fungito',
    texto:
      'Voy a acompañarte por VSD Health. Te cuento en un momento cómo funciona todo, y puedes saltarte esto cuando quieras.',
    expresion: 'feliz',
  },
  {
    id: 'ruta',
    titulo: 'Tu ruta de hoy',
    texto:
      'Cada día te preparo una ruta con actividades cortas de memoria, bienestar y emociones. Haz las que quieras, en el orden que quieras: no hay una cantidad que cumplir.',
    expresion: 'normal',
  },
  {
    id: 'semaforo',
    titulo: 'Tu semáforo',
    texto:
      'Anota lo que tienes pendiente y ponle un color: urgente, prioridad o aplazable. Es para ordenar la cabeza, no para exigirte.',
    expresion: 'feliz',
  },
  {
    id: 'diario',
    titulo: 'Tu diario',
    texto:
      'Un espacio para escribir lo que quieras. Es tuyo: solo se usa para recomendarte algo si tú lo permites en tu perfil.',
    expresion: 'normal',
  },
  {
    id: 'asistente',
    titulo: 'VSD IA, para conversar',
    texto:
      'Si quieres hablar, el asistente te escucha y te orienta. No sustituye a un profesional: no diagnostica ni receta nada.',
    expresion: 'feliz',
  },
  {
    id: 'aqui-estoy',
    titulo: 'Aquí estoy',
    texto:
      'Tócame para leer una frase y muéveme por la pantalla. Cuando quieras repetir este recorrido, lo encuentras en tu perfil.',
    expresion: 'celebrando',
  },
];
