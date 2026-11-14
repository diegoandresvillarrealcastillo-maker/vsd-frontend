import type { Mascota } from '../infraestructura/api/cuenta.ts';

/**
 * Los cinco personajes que pueden acompañar a cada persona (SCRUM-99).
 *
 * Los definió Diego, con su historia y sus cuatro expresiones. Los dibujos son
 * sus hojas de expresiones, recortadas a `sprites/` desde
 * `disenos/mascotas/` con `recortar-hojas.py`.
 *
 * Eran seis: Trama se retiró (SCRUM-121). Quien la tenía guardada se dibuja como
 * Fungito, igual que cualquier forma que este frontend no conozca.
 *
 * Las frases de cada uno van con su personalidad y se suman al banco general
 * (`frasesDeLaMascota.ts`, SCRUM-129), que sirve a cualquier avatar. Acompañan,
 * no evalúan ni aconsejan sobre salud: ninguna menciona síntomas, diagnósticos
 * ni tratamientos.
 */

export type Personaje = 'fungito' | 'sparky' | 'ori' | 'gato' | 'obsidian';

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
];

export const PERSONAJE_POR_DEFECTO: Personaje = 'fungito';

/**
 * La forma que significa «mi mascota propia» (SCRUM-122): un dibujo SVG que subio
 * la persona. No es un personaje de la lista: no tiene sprites ni frases ni
 * cuatro caras, y su dibujo se pide al servidor (`foto/mascotaPropia.ts`).
 */
export const FORMA_DE_LA_MASCOTA_PROPIA = 'propia';

/** El nombre con el que llega la mascota propia; la persona lo puede cambiar. */
export const NOMBRE_DE_LA_MASCOTA_PROPIA = 'Mi mascota';

/** Lo que dice la tarjeta de la mascota propia, donde un personaje dice su rasgo. */
export const RASGO_DE_LA_MASCOTA_PROPIA = 'Tu dibujo';

export const PRESENTACION_DE_LA_MASCOTA_PROPIA =
  'Es el dibujo que subiste. No tiene cuatro caras: se mueve y brilla según el momento del día.';

/** Lo que se puede elegir como mascota: un personaje de la lista o la propia. */
export type Eleccion = Personaje | typeof FORMA_DE_LA_MASCOTA_PROPIA;

/** El nombre con el que llega lo elegido, que la persona puede cambiar. */
export function nombreDeFabrica(eleccion: Eleccion): string {
  return eleccion === FORMA_DE_LA_MASCOTA_PROPIA
    ? NOMBRE_DE_LA_MASCOTA_PROPIA
    : PERSONAJES[eleccion].nombre;
}

/**
 * El nombre que queda al pasar de una mascota a otra.
 *
 * Si la persona no le habia puesto uno suyo —sigue vacio o es el de fabrica de la
 * que tenia— el nombre cambia con la mascota; si ya le puso uno, se respeta.
 */
export function nombreAlElegir(nombre: string, antes: Eleccion, despues: Eleccion): string {
  const limpio = nombre.trim();

  return limpio === '' || limpio === nombreDeFabrica(antes) ? nombreDeFabrica(despues) : nombre;
}

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
 *
 * `propia` dice que la elegida es la mascota propia (SCRUM-122). Su dibujo no
 * sale de aqui sino del servidor, y puede no estar todavia —o no llegar—: por eso
 * `personaje` sigue valiendo Fungito, que es lo que se pinta mientras tanto o si
 * el dibujo no llega.
 */
export function mascotaParaMostrar(mascota: Mascota | null): {
  readonly personaje: Personaje;
  readonly nombre: string;
  readonly propia: boolean;
} {
  if (mascota === null) {
    return {
      personaje: PERSONAJE_POR_DEFECTO,
      nombre: PERSONAJES[PERSONAJE_POR_DEFECTO].nombre,
      propia: false,
    };
  }

  const propia = mascota.forma === FORMA_DE_LA_MASCOTA_PROPIA;
  const personaje = esPersonaje(mascota.forma) ? mascota.forma : PERSONAJE_POR_DEFECTO;

  return { personaje, nombre: mascota.nombre, propia };
}
