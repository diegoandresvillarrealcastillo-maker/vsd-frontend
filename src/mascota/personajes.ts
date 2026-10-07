import type { Mascota } from '../infraestructura/api/cuenta.ts';

/**
 * Los seis personajes que pueden acompañar a cada persona (SCRUM-99).
 *
 * Los definió Diego, con su historia y sus cuatro expresiones. Los dibujos son
 * sus hojas de expresiones, recortadas a `sprites/` desde
 * `disenos/mascotas/` con `recortar-hojas.py`.
 *
 * Las frases de cada uno van con su personalidad y se suman al banco general
 * (`frasesDeLaMascota.ts`, SCRUM-129), que sirve a cualquier avatar. Acompañan,
 * no evalúan ni aconsejan sobre salud: ninguna menciona síntomas, diagnósticos
 * ni tratamientos.
 */

export type Personaje = 'fungito' | 'sparky' | 'ori' | 'gato' | 'obsidian' | 'trama';

export type Expresion = 'normal' | 'feliz' | 'celebrando' | 'dormida';

export interface DatosDePersonaje {
  /** El nombre con el que llega; la persona lo puede cambiar. */
  readonly nombre: string;
  readonly rasgo: string;
  readonly presentacion: string;
  readonly frases: readonly string[];
}

export const PERSONAJES_EN_ORDEN: readonly Personaje[] = [
  'fungito',
  'sparky',
  'ori',
  'gato',
  'obsidian',
  'trama',
];

export const PERSONAJE_POR_DEFECTO: Personaje = 'fungito';

export const PERSONAJES: Readonly<Record<Personaje, DatosDePersonaje>> = {
  fungito: {
    nombre: 'Fungito',
    rasgo: 'Mente serena',
    presentacion:
      'Nació en un antiguo foro de meditación digital. Composta el desorden mental y lo vuelve calma.',
    frases: [
      'Respira despacio. Aquí no hay prisa.',
      'Dame un pensamiento ruidoso y lo vuelvo tierra fértil.',
      'Cerrar una pestaña también es avanzar.',
      'Huele a café y a tierra mojada: buen momento para una pausa.',
      'Lo que no alcances hoy puede esperar a mañana.',
    ],
  },
  sparky: {
    nombre: 'Sparky',
    rasgo: 'Chispa creativa',
    presentacion:
      'Un pequeño faro que surgió en una noche de programación. Cuando algo se atasca, enciende su luz ámbar.',
    frases: [
      '¿Atascado? Empieza por el paso más pequeño.',
      'Una idea a medias ya es una idea. Dale una vuelta más.',
      'Mi luz no se apaga por un mal día. La tuya tampoco.',
      'Hecho es mejor que perfecto. Probemos otra vez.',
      'Cinco minutos bastan para encender algo.',
    ],
  },
  ori: {
    nombre: 'Ori',
    rasgo: 'Crecimiento orgánico',
    presentacion:
      'Una grulla de papel que enseña a desdoblar lo difícil paso a paso. No vuela rápido, pero siempre llega.',
    frases: [
      'Desdoblemos esto: un pliegue a la vez.',
      'No vuelo rápido, pero siempre llego. Tú también.',
      'Lo grande se hace con pasos pequeños y bien doblados.',
      'Si algo se arruga, se vuelve a alisar. Sigue.',
      'Hoy basta con un pliegue.',
    ],
  },
  gato: {
    nombre: 'Ojo de Gato',
    rasgo: 'Sabiduría nocturna',
    presentacion:
      'Un gato robot con gafas que fue bibliotecario. Te acompaña en los ratos largos de enfoque y ronronea cuando terminas algo.',
    frases: [
      'Prrr… Una página más y hacemos una pausa.',
      'Leer despacio también es entender mejor.',
      'Toda biblioteca empezó con un solo libro.',
      'Ajusto mis gafas: veo que vas bien.',
      'Un rato de enfoque vale más que mucho rato distraído.',
    ],
  },
  obsidian: {
    nombre: 'Obsidian',
    rasgo: 'Escudo protector',
    presentacion:
      'Un gólem de cristal que cuida tu calma. Por fuera parece duro; por dentro brilla cuando te tomas un descanso.',
    frases: [
      'Estoy aquí. Puedes bajar la guardia un momento.',
      'Descansar no es rendirse: es recargar el escudo.',
      'Las distracciones se quedan afuera. Tú, aquí.',
      'Me alegra verte tomar un respiro.',
      'Fuerte no es quien no para, sino quien sabe cuándo parar.',
    ],
  },
  trama: {
    nombre: 'Trama',
    rasgo: 'Armonía rítmica',
    presentacion:
      'Un viejo telar que cobró vida. Sabe que lo bueno se teje hilo a hilo, sin pensar en la manta entera.',
    frases: [
      'Hilo a hilo, el tejido crece.',
      'No mires toda la manta: mira el hilo de hoy.',
      'Un punto suelto no arruina el tejido.',
      'Tu ritmo es el ritmo correcto.',
      'Lo que se teje con calma dura más.',
    ],
  },
};

export function esPersonaje(valor: string | undefined): valor is Personaje {
  return valor !== undefined && (PERSONAJES_EN_ORDEN as readonly string[]).includes(valor);
}

/**
 * La mascota que se dibuja: la guardada o, sin ninguna, Fungito.
 *
 * Una forma que este frontend no conoce —una guardada con el modelo anterior,
 * o un personaje que llegue despues— se dibuja como Fungito, pero conserva el
 * nombre que la persona le puso.
 */
export function mascotaParaMostrar(mascota: Mascota | null): {
  readonly personaje: Personaje;
  readonly nombre: string;
} {
  if (mascota === null) {
    return { personaje: PERSONAJE_POR_DEFECTO, nombre: PERSONAJES[PERSONAJE_POR_DEFECTO].nombre };
  }

  const personaje = esPersonaje(mascota.forma) ? mascota.forma : PERSONAJE_POR_DEFECTO;

  return { personaje, nombre: mascota.nombre };
}
