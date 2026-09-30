import { llamarALaApi } from './clienteHttp.ts';

/**
 * El catalogo de actividades, por HTTP.
 *
 * Como `cuenta.ts`, es la copia de este lado del contrato del backend.
 */

/**
 * Una actividad tal como se ofrece para elegirla.
 *
 * Fijate en lo que **no** trae: ni puntaje maximo, ni umbrales, ni los textos
 * de cada nivel. No es un olvido del backend. El catalogo sirve para elegir, y
 * para eso basta saber que es la actividad y como se hace; interpretar un
 * resultado ocurre en el servidor. Si el cliente conociera el maximo y los
 * cortes podria calcular el nivel por su cuenta, y entonces habria dos
 * interpretaciones del mismo dato que pueden no coincidir.
 *
 * `produceNivel` es lo unico que hay que saber de antemano, porque cambia la
 * pantalla: una bitacora no muestra resultado al terminar y un juego si.
 */
export interface ActividadDelCatalogo {
  readonly id: string;
  readonly nombre: string;
  readonly tipo?: string;
  readonly descripcion?: string;
  readonly produceNivel: boolean;
}

/** Una categoria con las actividades que ofrece. */
export interface CategoriaDelCatalogo {
  readonly id: string;
  readonly nombre: string;
  readonly descripcion?: string;
  readonly actividades: readonly ActividadDelCatalogo[];
}

/**
 * Trae el catalogo completo.
 *
 * Es la unica lectura del sistema que no depende de quien pregunta: las
 * categorias y las actividades son las mismas para todo el mundo y no
 * contienen nada de nadie. La ruta es publica en el backend, asi que esta
 * llamada funciona incluso sin sesion.
 *
 * El orden lo decide la consulta del servidor y no quien lo pinta. Si
 * dependiera del cliente, dos clientes mostrarian cosas distintas y esa
 * diferencia nadie la nota hasta que alguien pregunta por que.
 */
export function traerElCatalogo(senal?: AbortSignal): Promise<readonly CategoriaDelCatalogo[]> {
  return llamarALaApi<readonly CategoriaDelCatalogo[]>('/api/catalogo', senal ? { senal } : {});
}

/** Una actividad junto a la categoria en la que vive. */
export interface ActividadConSuCategoria {
  readonly actividad: ActividadDelCatalogo;
  readonly categoria: CategoriaDelCatalogo;
}

/**
 * Busca una actividad por su identificador.
 *
 * Trae el catalogo entero y busca dentro, porque **la API no tiene una ruta
 * para una actividad suelta**. Podria tenerla, pero no la necesita: el catalogo
 * completo son nueve actividades en tres categorias, cabe en una respuesta
 * pequena, y es la misma para todo el mundo.
 *
 * Devuelve tambien la categoria porque la pantalla la usa para situar a la
 * persona, y buscarla dos veces seria recorrer lo mismo otra vez.
 *
 * `null` cuando no existe. No lanza: una direccion escrita a mano con un
 * identificador que no existe es un caso normal, no un fallo.
 */
export async function buscarActividad(
  id: string,
  senal?: AbortSignal,
): Promise<ActividadConSuCategoria | null> {
  const catalogo = await traerElCatalogo(senal);

  for (const categoria of catalogo) {
    const actividad = categoria.actividades.find((una) => una.id === id);

    if (actividad !== undefined) {
      return { actividad, categoria };
    }
  }

  return null;
}
