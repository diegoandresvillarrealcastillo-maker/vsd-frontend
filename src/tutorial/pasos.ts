import type { Expresion } from '../mascota/personajes.ts';

/**
 * Los elementos de la pantalla que un paso puede senalar (SCRUM-201).
 *
 * Cada nombre es un `data-tutorial="..."` puesto en el elemento real. Si el elemento no esta o no
 * se ve (sin conexion, otra pantalla, un tamano en el que no existe), el paso se ve centrado,
 * como antes: el recorrido nunca depende de que el elemento este.
 */
export type AnclaDelTutorial = 'ruta' | 'llama' | 'semaforo' | 'diario' | 'asistente';

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
  /** El elemento que ilumina este paso (SCRUM-201). Sin el, el paso va centrado. */
  readonly ancla?: AnclaDelTutorial;
  /**
   * Lo que dice el globo cuando la persona toca el elemento senalado (SCRUM-252). Un paso sin esto
   * senala algo que no se toca: la ruta, por ejemplo.
   */
  readonly alProbar?: string;
  /**
   * Tocar el elemento llevaria a otra pantalla (el diario): en el recorrido el toque no navega, solo
   * se reconoce, para que nadie se salga del tutorial sin querer.
   */
  readonly noNavega?: true;
}

export const PASOS_DEL_TUTORIAL: readonly PasoDelTutorial[] = [
  {
    id: 'hola',
    titulo: '¡Hola! Soy Fungito',
    texto:
      'Soy tu guía en VSD Health. En menos de un minuto te muestro dónde está cada cosa y para qué sirve. Puedes saltarte este recorrido cuando quieras.',
    expresion: 'feliz',
  },
  {
    id: 'ruta',
    titulo: 'Tu ruta de hoy',
    texto:
      'Cada día te preparo actividades cortas de memoria, bienestar y emociones. Elige la que quieras y en el orden que quieras: sin metas ni presión. Así vas viendo cómo te sientes.',
    expresion: 'normal',
    ancla: 'ruta',
  },
  {
    id: 'llama',
    titulo: 'Tu llama',
    texto:
      'Cuenta los días en que haces algo en la aplicación. Tócala para ver tu avance. Si un día no puedes, descansa y vuelve a encenderse cuando regreses.',
    expresion: 'feliz',
    ancla: 'llama',
    alProbar: '¡Eso es! Ahí ves tu avance con calma. Cuando quieras, sigue.',
  },
  {
    id: 'semaforo',
    titulo: 'Tu semáforo',
    texto:
      'Anota lo que tienes pendiente y márcalo como urgente, prioridad o aplazable. Así ordenas la cabeza y eliges por dónde empezar, sin exigirte.',
    expresion: 'feliz',
    ancla: 'semaforo',
    alProbar: '¡Eso es! Ahí anotas lo que tienes pendiente. Cuando quieras, sigue.',
  },
  {
    id: 'diario',
    titulo: 'Tu diario',
    texto:
      'Escribe lo que quieras, a tu ritmo. Es solo tuyo: solo se usa para recomendarte algo si tú lo permites. Lo abres en «Mi diario»: abajo en el celular, o arriba, junto a Inicio y Mi actividad, en el computador.',
    expresion: 'normal',
    ancla: 'diario',
    alProbar: 'Ahí está. Lo abres cuando termine el recorrido: por ahora, sigamos.',
    noNavega: true,
  },
  {
    id: 'asistente',
    titulo: 'VSD IA, para conversar',
    texto:
      'Si quieres hablar o no sabes por dónde empezar, el asistente te escucha y te orienta con calma. No sustituye a un profesional: no diagnostica ni receta nada.',
    expresion: 'feliz',
    ancla: 'asistente',
    // La mascota que se toca es la de la persona, no necesariamente Fungito: no se dice «mi».
    alProbar:
      '¡Eso es! Desde la frase de tu mascota puedes hablar con el asistente. Cuando quieras, sigue.',
  },
  {
    id: 'aqui-estoy',
    titulo: 'Aquí estoy',
    texto:
      'Tócame para leer una frase y muéveme por la pantalla si te estorbo. Cuando quieras repetir este recorrido, lo encuentras en tu perfil.',
    expresion: 'celebrando',
  },
];
