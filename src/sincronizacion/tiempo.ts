/**
 * Lo que tarde `promesa`, o `'tiempo'` si pasan `ms` antes (SCRUM-138).
 *
 * **La promesa no se cancela**: sigue su camino, y a quien llama ya no le importa. Es lo
 * que permite dejar de hacer esperar a una persona por una red lenta sin abandonar lo que
 * la red estaba haciendo.
 *
 * Con un tiempo que no es finito (`Infinity`), no hay limite: es la promesa tal cual. El
 * temporizador se limpia siempre, haya ganado quien haya ganado.
 */
export async function conLimite<T>(promesa: Promise<T>, ms: number): Promise<T | 'tiempo'> {
  if (!Number.isFinite(ms)) {
    return promesa;
  }

  let temporizador: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promesa,
      new Promise<'tiempo'>((resolver) => {
        temporizador = setTimeout(
          () => {
            resolver('tiempo');
          },
          Math.max(0, ms),
        );
      }),
    ]);
  } finally {
    clearTimeout(temporizador);
  }
}
