import type { Cuenta } from '../infraestructura/api/cuenta.ts';
import {
  olvidarLaMascotaDeLaCarga,
  recordarLaMascotaDeLaCarga,
} from '../mascota/mascotaDeLaCarga.ts';
import { olvidarLaFoto, sincronizarLaFoto } from './fotoDePerfil.ts';
import { olvidarLaMascotaPropia, sincronizarLaMascotaPropia } from './mascotaPropia.ts';

/**
 * Todo lo de una persona que viaja como archivo: su foto de perfil (SCRUM-120) y
 * su mascota propia (SCRUM-122), y la mascota que corre en la pantalla de carga
 * (SCRUM-283), que no es un archivo pero se recuerda y se olvida en los mismos dos momentos.
 *
 * Hay un solo punto de entrada para las dos cosas que no pueden olvidarse de
 * ninguno: cuando llega una cuenta, y cuando termina la sesion. Quien llama no
 * tiene que acordarse de cuantos archivos hay, y el dia que haya un tercero, se
 * suma aqui y llega a todos los sitios.
 */

/** Llega una cuenta: se mira la marca de cada archivo y se piden los que cambiaron. */
export function sincronizarLosArchivosDeLaPersona(
  cuenta: Pick<Cuenta, 'id' | 'foto' | 'mascotaPropia'> & Partial<Pick<Cuenta, 'mascota'>>,
): void {
  sincronizarLaFoto(cuenta);
  sincronizarLaMascotaPropia(cuenta);
  recordarLaMascotaDeLaCarga(cuenta.mascota?.forma);
}

/** Termina la sesion: nada de lo que era de esa persona se queda para la siguiente. */
export function olvidarLosArchivosDeLaPersona(): void {
  olvidarLaFoto();
  olvidarLaMascotaPropia();
  olvidarLaMascotaDeLaCarga();
}
