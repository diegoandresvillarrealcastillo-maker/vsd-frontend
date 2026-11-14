import { useMemo } from 'react';

import { JuegoDeRondas } from './JuegoDeRondas.tsx';
import { leerIntruso } from './parametrosDeLaCognicion.ts';
import type { PropsDeMecanica } from './registro.tsx';
import { SinSesion } from './SinSesion.tsx';

/**
 * «La palabra que sobra» (SCRUM-225, ficha COG-02): cuatro palabras, tres comparten algo y una no.
 *
 * Es el motor `clasificar` en su modo `intruso`. Cada ronda se juega con `JuegoDeRondas`: una ronda acertada,
 * un punto. **La razon se muestra despues**, la respuesta sea la que sea, y sin senalar el fallo: «Las otras son
 * animales» explica la ronda, no corrige a nadie. Sin tiempo.
 *
 * Vive de la sesion de hoy y no tiene respaldo: sin una que entienda, lo dice.
 */
export function PalabraQueSobra({ sesion, ...props }: PropsDeMecanica) {
  const reglas = useMemo(() => leerIntruso(sesion?.parametros), [sesion]);

  if (reglas === null) {
    return <SinSesion />;
  }

  return (
    <JuegoDeRondas
      {...props}
      puntosMaximos={reglas.puntosMaximos}
      introduccion={{
        pasos: ['Mira las cuatro palabras.', 'Tres comparten algo.', 'Toca la que sobra.'],
        texto: `En cada ronda hay cuatro palabras: tres tienen algo en común y una no. Toca la que sobra. Son ${String(reglas.rondas.length)} rondas, sin tiempo.`,
      }}
      rondas={reglas.rondas.map((ronda, indice) => ({
        clave: `r${String(indice + 1)}`,
        pregunta: '¿Cuál de estas palabras sobra?',
        opciones: ronda.palabras.map((texto) => ({ texto })),
        correcta: ronda.intruso,
        despues: `${ronda.palabras[ronda.intruso] ?? ''} sobraba. ${ronda.razon}`,
        alFallar: '¡Casi! Mira lo que une a las demás.',
      }))}
    />
  );
}
