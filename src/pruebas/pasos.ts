import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

/**
 * Ayudas para recorrer las actividades que van de un paso en un paso (SCRUM-173): los
 * cuestionarios y «Movimiento del dia».
 *
 * Cada paso entra y sale con una animacion corta, asi que despues de pulsar «Continuar» hay un
 * instante en que todavia se ve el paso anterior. Estas ayudas esperan a que de verdad haya
 * cambiado el paso antes de seguir; si no, la prueba contestaria otra vez la misma pregunta.
 */

/** Espera a que el paso de las preguntas con opciones cambie del que tenia `antes`. */
export async function esperarAOtroPaso(antes: string | null): Promise<void> {
  await waitFor(() => {
    const ahora = screen.getByRole('radiogroup').getAttribute('aria-labelledby');

    if (ahora === antes) {
      throw new Error('Sigue en el mismo paso');
    }
  });
}

/**
 * Contesta la pregunta de ahora con la opcion `opcion` y pulsa el boton de abajo. Si ese boton
 * es «Continuar», espera a que aparezca la pregunta siguiente.
 */
export async function contestarYSeguir(
  usuario: UserEvent,
  opcion: string,
  boton: 'Continuar' | 'Terminar',
): Promise<void> {
  const grupo = await screen.findByRole('radiogroup');
  const antes = grupo.getAttribute('aria-labelledby');

  await usuario.click(within(grupo).getByRole('radio', { name: opcion }));
  await usuario.click(screen.getByRole('button', { name: boton }));

  if (boton === 'Continuar') {
    await esperarAOtroPaso(antes);
  }
}

/** Contesta con la misma opcion las `preguntas` de un cuestionario, hasta terminarlo. */
export async function responderTodo(
  usuario: UserEvent,
  opcion: string,
  preguntas: number,
): Promise<void> {
  for (let n = 1; n < preguntas; n += 1) {
    await contestarYSeguir(usuario, opcion, 'Continuar');
  }

  await contestarYSeguir(usuario, opcion, 'Terminar');
}
