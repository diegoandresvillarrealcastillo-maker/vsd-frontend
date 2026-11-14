import { useMemo } from 'react';

import { JuegoDeRondas } from './JuegoDeRondas.tsx';
import { leerElCalculo } from './parametrosDeLaCognicion.ts';
import type { PropsDeMecanica } from './registro.tsx';
import { SinSesion } from './SinSesion.tsx';

/**
 * «Cuentas con calma» (SCRUM-225, ficha COG-04): unas cuentas cortas con tres respuestas a elegir.
 *
 * Es el motor `calculo`. **No hay cronometro** (R4) y la ansiedad matematica es real: nunca «te equivocaste»,
 * sino «¡Casi!» y la respuesta, sin dramatismo. Cada cuenta trae su enunciado y sus tres opciones ya hechas por
 * quien sembro la sesion: la pantalla no calcula nada, asi que una cuenta mal escrita no se puede colar aqui.
 *
 * Vive de la sesion de hoy y no tiene respaldo: sin una que entienda, lo dice.
 */
export function CuentasConCalma({ sesion, ...props }: PropsDeMecanica) {
  const reglas = useMemo(() => leerElCalculo(sesion?.parametros), [sesion]);

  if (reglas === null) {
    return <SinSesion />;
  }

  return (
    <JuegoDeRondas
      {...props}
      puntosMaximos={reglas.puntosMaximos}
      introduccion={{
        pasos: ['Lee la cuenta.', 'Elige la respuesta.', 'Sin cronómetro.'],
        texto: `Son ${String(reglas.rondas.length)} cuentas cortas. No hay cronómetro: elige la respuesta con todo el tiempo que quieras.`,
      }}
      etiquetaDeRonda="Cuenta"
      columnas={1}
      rondas={reglas.rondas.map((ronda, indice) => ({
        clave: `c${String(indice + 1)}`,
        pregunta: ronda.enunciado,
        opciones: ronda.opciones.map((texto) => ({ texto })),
        correcta: ronda.correcta,
        despues: `La respuesta era ${ronda.opciones[ronda.correcta] ?? ''}.`,
        alFallar: '¡Casi! Va otra, sin presión.',
      }))}
    />
  );
}
