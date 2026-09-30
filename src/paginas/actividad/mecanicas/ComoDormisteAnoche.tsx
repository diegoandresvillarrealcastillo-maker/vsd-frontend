import { useState, type FormEvent } from 'react';

import type { LoQueProduceLaActividad } from '../useCompletarActividad.ts';

/**
 * "Como dormiste anoche": cuatro preguntas sobre la noche.
 *
 * Es una **bitacora que si puntua**, y por eso es la primera mecanica que se
 * construye: ejercita las dos mitades del motor a la vez. Registra lo que paso
 * —las horas, los despertares— y ademas produce un nivel.
 *
 * Que una actividad de registro se valore no es una contradiccion. Anotar
 * cuanto dormiste es registrar; decirte que anoche descansaste bien o poco es
 * orientar. Son dos cosas distintas y esta actividad hace las dos.
 */

/**
 * El maximo lo sabe la mecanica, no el catalogo.
 *
 * La API no publica el puntaje maximo a proposito: si el cliente lo conociera
 * junto con los cortes de nivel, podria calcular el nivel por su cuenta y
 * habria dos interpretaciones del mismo dato que pueden no coincidir.
 *
 * Aqui esta porque **esta pantalla es la mecanica**: es quien decide cuanto
 * vale cada respuesta, asi que necesariamente conoce su propia escala. El
 * servidor tiene el mismo numero por su lado y rechaza con 400 lo que se pase.
 */
const MAXIMO = 10;

type ComoAmaneciste = 'descansado' | 'normal' | 'cansado';

/**
 * Cuanto suma cada respuesta.
 *
 * Los tramos de sueno siguen la recomendacion habitual para personas adultas,
 * de siete a nueve horas. No es un criterio clinico ni pretende serlo: es una
 * orientacion, y el texto que ve la persona lo redacta el servidor.
 */
function puntuarHoras(horas: number): number {
  if (horas >= 7 && horas <= 9) {
    return 4;
  }

  if (horas >= 6 && horas < 7) {
    return 3;
  }

  if (horas > 9 && horas <= 10) {
    return 3;
  }

  if (horas >= 5 && horas < 6) {
    return 2;
  }

  return 1;
}

function puntuarDespertares(veces: number): number {
  if (veces === 0) {
    return 3;
  }

  if (veces === 1) {
    return 2;
  }

  if (veces === 2) {
    return 1;
  }

  return 0;
}

function puntuarComoAmaneciste(como: ComoAmaneciste): number {
  if (como === 'descansado') {
    return 3;
  }

  return como === 'normal' ? 2 : 0;
}

export function ComoDormisteAnoche({
  alTerminar,
  enviando,
}: {
  alTerminar: (produjo: LoQueProduceLaActividad) => void;
  enviando: boolean;
}) {
  const [horaDeAcostarse, setHoraDeAcostarse] = useState('23:00');
  const [horasDormidas, setHorasDormidas] = useState(7);
  const [despertares, setDespertares] = useState(0);
  const [comoAmaneciste, setComoAmaneciste] = useState<ComoAmaneciste>('normal');

  function enviar(evento: FormEvent) {
    evento.preventDefault();

    const score =
      puntuarHoras(horasDormidas) +
      puntuarDespertares(despertares) +
      puntuarComoAmaneciste(comoAmaneciste);

    alTerminar({
      // Nunca puede pasarse del maximo, pero se acota igual: si alguien cambia
      // un tramo y se le va la suma, es mejor un resultado topado que un 400.
      score: Math.min(score, MAXIMO),
      // Lo que la persona respondio se guarda tal cual. El puntaje es una
      // lectura de esto; esto es el dato.
      metadata: { horaDeAcostarse, horasDormidas, despertares, comoAmaneciste },
    });
  }

  return (
    <form className="actividad__formulario" onSubmit={enviar}>
      <p className="actividad__campo">
        <label htmlFor="hora">¿A qué hora te acostaste?</label>
        <input
          id="hora"
          type="time"
          value={horaDeAcostarse}
          onChange={(evento) => setHoraDeAcostarse(evento.target.value)}
        />
      </p>

      <p className="actividad__campo">
        <label htmlFor="horas">¿Cuántas horas dormiste?</label>
        <input
          id="horas"
          type="number"
          min={0}
          max={24}
          step={0.5}
          value={horasDormidas}
          onChange={(evento) => setHorasDormidas(Number(evento.target.value))}
        />
      </p>

      <p className="actividad__campo">
        <label htmlFor="despertares">¿Cuántas veces te despertaste?</label>
        <input
          id="despertares"
          type="number"
          min={0}
          max={20}
          value={despertares}
          onChange={(evento) => setDespertares(Number(evento.target.value))}
        />
      </p>

      <p className="actividad__campo">
        <label htmlFor="amaneciste">¿Cómo amaneciste?</label>
        <select
          id="amaneciste"
          value={comoAmaneciste}
          onChange={(evento) => setComoAmaneciste(evento.target.value as ComoAmaneciste)}
        >
          <option value="descansado">Descansado</option>
          <option value="normal">Normal</option>
          <option value="cansado">Cansado</option>
        </select>
      </p>

      <button type="submit" className="pildora" disabled={enviando}>
        {enviando ? 'Guardando…' : 'Terminar'}
      </button>
    </form>
  );
}
