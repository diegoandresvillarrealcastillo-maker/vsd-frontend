import { useContext, useEffect, useState } from 'react';

import type { Racha } from '../infraestructura/api/racha.ts';
import { SesionContexto } from '../sesion/SesionContexto.ts';
import { diaEnLaZona, horaLocal } from '../tiempo/zonaHoraria.ts';
import { fraseDeLaRacha } from './frasesDeLaRacha.ts';
import { alCambiarLaRacha, edadDeLaRachaRecordada, rachaRecordadaDe } from './memoriaDeLaRacha.ts';
import { situacionDeLaRacha } from './situacionDeLaRacha.ts';

/**
 * La voz de la mascota por la tarde (SCRUM-243): lo que dice de la racha **una vez al dia**, en el
 * panel, cuando de verdad hay algo que decir.
 *
 * Solo habla de tarde (desde las 18:00 de la persona), con hoy todavia sin hacer y una racha de 3 dias
 * o mas, y dice la verdad segun los congelamientos (`situacionDeLaRacha`): con ellos, que una actividad
 * evita gastar uno; sin ellos, que la racha esta en juego. En cualquier otro momento se calla.
 *
 * No pide la racha: se entera de la que recibe la llama de la barra en esta visita (`alCambiarLaRacha`, o lo
 * recordado hace menos de cinco minutos), asi que no suma ninguna peticion, y no habla con un dato viejo.
 * Devuelve `null` mientras no hay nada que decir.
 *
 * ## Una vez al dia
 *
 * Lo ultimo que se dijo (la cuenta y el dia) queda en este navegador: es una comodidad, no un dato
 * personal. Si el navegador no guarda nada, queda en memoria y se dice una vez por visita. Dentro de la
 * misma pantalla la frase se mantiene aunque la racha cambie.
 */
const CLAVE_DE_LA_ULTIMA = 'vsd-h:racha-tarde';

/** Cuanto puede tener lo recordado para considerarlo de esta visita: cinco minutos. */
const EDAD_MAXIMA_DE_LO_RECORDADO_MS = 5 * 60_000;

/** Lo ultimo que se dijo, por si el navegador no deja guardarlo. */
let ultimaEnMemoria: string | null = null;

function yaSeDijo(valor: string): boolean {
  try {
    return ultimaEnMemoria === valor || localStorage.getItem(CLAVE_DE_LA_ULTIMA) === valor;
  } catch {
    return ultimaEnMemoria === valor;
  }
}

function marcarComoDicho(valor: string): void {
  ultimaEnMemoria = valor;

  try {
    localStorage.setItem(CLAVE_DE_LA_ULTIMA, valor);
  } catch {
    // Sin almacenamiento se dice una vez por visita, y no pasa nada.
  }
}

/** Para las pruebas: como si nunca se hubiera dicho nada. */
export function olvidarElAvisoDeLaTarde(): void {
  ultimaEnMemoria = null;

  try {
    localStorage.removeItem(CLAVE_DE_LA_ULTIMA);
  } catch {
    // Nada que borrar.
  }
}

export function useAvisoDeLaTarde(): string | null {
  const sesion = useContext(SesionContexto);
  const cuenta = sesion?.sesion?.user.id ?? null;
  // Solo cuenta lo de esta visita: lo que llega (la respuesta que recibe la llama de la barra) y lo que llego
  // hace un momento, porque esa respuesta suele llegar antes de que el panel termine de cargar. Lo que se
  // recordaba de hace rato no: puede ser de ayer o de otro equipo, y decir «en juego» con un dato viejo
  // seria decir algo que quiza no es verdad; ademas queda marcado como dicho ese dia.
  const [racha, setRacha] = useState<Racha | null>(() => {
    const edad = cuenta === null ? null : edadDeLaRachaRecordada(cuenta);

    return cuenta !== null && edad !== null && edad <= EDAD_MAXIMA_DE_LO_RECORDADO_MS
      ? rachaRecordadaDe(cuenta)
      : null;
  });
  const [dicha, setDicha] = useState<string | null>(null);

  useEffect(() => {
    if (cuenta === null) {
      return undefined;
    }

    return alCambiarLaRacha((deQuien, nueva) => {
      if (deQuien === cuenta) {
        setRacha(nueva);
      }
    });
  }, [cuenta]);

  // Lo que habria que decir ahora; se calcula en cada pintura, sin guardar nada.
  const situacion = racha === null ? null : situacionDeLaRacha(racha, horaLocal(new Date()));
  const hayRiesgo =
    situacion === 'riesgoConCongelamientos' || situacion === 'riesgoSinCongelamientos';
  const valor = cuenta === null ? null : `${cuenta}:${diaEnLaZona(new Date())}`;

  // La primera vez que hay algo que decir y hoy no se ha dicho, se queda: la frase no cambia aunque la
  // racha cambie despues. (Ajustar el estado al pintar, y no en un efecto, evita una pintura de mas.)
  if (dicha === null && racha !== null && hayRiesgo && valor !== null && !yaSeDijo(valor)) {
    setDicha(fraseDeLaRacha(situacion, { dias: racha.dias }));
  }

  // Ya salio: queda marcado para no repetirlo hoy al volver a esta pantalla.
  useEffect(() => {
    if (dicha !== null && valor !== null) {
      marcarComoDicho(valor);
    }
  }, [dicha, valor]);

  return dicha;
}
