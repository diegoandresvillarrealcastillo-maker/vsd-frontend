import type { LineaDeAtencion } from '../../infraestructura/api/resultados.ts';
import { zonaActual } from '../../tiempo/zonaHoraria.ts';
import { esZonaDeColombia, lineasDeRespaldo } from '../actividad/lineasParaMostrar.ts';

/**
 * A quien puede acudir quien resulta menor de 18 anos (L-02 de la auditoria 360).
 *
 * La pantalla de rechazo no puede dejar a nadie con las manos vacias: quien llego
 * buscando apoyo y se encuentra con una puerta cerrada necesita saber a donde ir.
 *
 * ## De donde salen
 *
 * Las de Colombia las publican las propias entidades, y se confirmaron en sus
 * paginas oficiales antes de escribirlas:
 *
 * - **Linea 141 del ICBF**: la linea nacional, gratuita y de todo el dia, para la
 *   proteccion de ninas, ninos y adolescentes
 *   (https://www.icbf.gov.co/linea-141).
 * - **Linea 106**: la de la Secretaria Distrital de Salud de Bogota, de todo el
 *   dia, para escucha y orientacion psicologica. Nacio para ninas, ninos y
 *   adolescentes y hoy atiende a todas las edades
 *   (https://bogota.gov.co/mi-ciudad/salud/servicios-de-la-linea-106-en-bogota-atencion-psicologica-y-mas-2023).
 *
 * A estas se suman las que ya ensena la aplicacion despues de una actividad: la 192
 * opcion 4 y la 123. Cada una lleva donde sirve, porque la 106 solo atiende
 * desde Bogota y mostrarla como si fuera de todos seria prometer algo que no es.
 *
 * ## Fuera de Colombia
 *
 * Ningun numero. Se manda al directorio internacional, igual que despues de una
 * actividad: un numero de otro pais, ensenado como si fuera de quien lo lee, es el
 * peor error posible.
 */
const LINEAS_PARA_MENORES_DE_COLOMBIA: readonly LineaDeAtencion[] = [
  {
    id: '0141c0de-0000-4000-8000-000000000141',
    titulo: 'Línea 141 del ICBF',
    descripcion:
      'Protección de niñas, niños y adolescentes, del Instituto Colombiano de Bienestar Familiar. Es gratuita, atiende todo el día y funciona en todo el país. Sirve para pedir orientación o para contar que algo no está bien en casa, en el colegio o en cualquier lugar.',
    tipo: 'contacto',
    cobertura: 'nacional',
    enlace: 'https://www.icbf.gov.co/linea-141',
  },
  {
    id: '0106c0de-0000-4000-8000-000000000106',
    titulo: 'Línea 106',
    descripcion:
      'Escucha y orientación psicológica gratuita de la Secretaría de Salud de Bogotá, todo el día. Nació para niñas, niños y adolescentes, y hoy atiende a personas de cualquier edad.',
    tipo: 'contacto',
    cobertura: 'bogota',
    enlace:
      'https://bogota.gov.co/mi-ciudad/salud/servicios-de-la-linea-106-en-bogota-atencion-psicologica-y-mas-2023',
  },
];

/** Las lineas que se ensenan en la pantalla de rechazo, segun la zona de quien la ve. */
export function lineasParaMenores(zona: string = zonaActual()): readonly LineaDeAtencion[] {
  return esZonaDeColombia(zona)
    ? [...LINEAS_PARA_MENORES_DE_COLOMBIA, ...lineasDeRespaldo(zona)]
    : lineasDeRespaldo(zona);
}
