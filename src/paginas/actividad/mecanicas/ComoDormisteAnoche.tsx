import { useId, useState, type FormEvent } from 'react';

import { BarraDeAccion, BotonPrincipal } from '../viva/BarraDeAccion.tsx';
import { Contador } from '../viva/Contador.tsx';
import { OpcionGrande } from '../viva/OpcionGrande.tsx';
import { useMascotaDeLaPersona } from '../viva/mascotaDeLaPersona.ts';
import { VozDeLaMascota } from '../viva/VozDeLaMascota.tsx';
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

const COMO_AMANECISTE: readonly {
  readonly valor: ComoAmaneciste;
  readonly texto: string;
  readonly adorno: string;
}[] = [
  { valor: 'descansado', texto: 'Descansado', adorno: '😊' },
  { valor: 'normal', texto: 'Normal', adorno: '🙂' },
  { valor: 'cansado', texto: 'Cansado', adorno: '😴' },
];

/** Horas de acostarse que se piden a diario, para no tener que escribirlas. */
const ATAJOS_DE_HORA = ['21:00', '22:00', '23:00', '00:00', '01:00'] as const;

export function ComoDormisteAnoche({
  alTerminar,
  enviando,
}: {
  alTerminar: (produjo: LoQueProduceLaActividad) => void;
  enviando: boolean;
}) {
  const mascota = useMascotaDeLaPersona();
  const [horaDeAcostarse, setHoraDeAcostarse] = useState('23:00');
  const [horasDormidas, setHorasDormidas] = useState(7);
  const [despertares, setDespertares] = useState(0);
  const [comoAmaneciste, setComoAmaneciste] = useState<ComoAmaneciste>('normal');
  const idDeLaHora = useId();

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

  // Dice lo que la persona anoto, sin opinar: ni «que bien» ni «que poco».
  const mensaje = `Anotado: ${String(horasDormidas)} horas de sueño. Cambia lo que no sea así.`;

  return (
    <form className="viva" onSubmit={enviar}>
      <VozDeLaMascota mascota={mascota} mensaje={mensaje} />

      <section className="viva-tarjeta">
        <label className="viva-tarjeta__titulo" htmlFor={idDeLaHora}>
          ¿A qué hora te acostaste?
        </label>
        <input
          id={idDeLaHora}
          className="viva-hora"
          type="time"
          value={horaDeAcostarse}
          onChange={(evento) => setHoraDeAcostarse(evento.target.value)}
        />
        <div className="viva-atajos">
          {ATAJOS_DE_HORA.map((hora) => (
            <button
              key={hora}
              type="button"
              className="viva-atajo"
              aria-pressed={horaDeAcostarse === hora}
              onClick={() => setHoraDeAcostarse(hora)}
            >
              {hora}
            </button>
          ))}
        </div>
      </section>

      <section className="viva-tarjeta">
        <Contador
          etiqueta="¿Cuántas horas dormiste?"
          valor={horasDormidas}
          alCambiar={setHorasDormidas}
          minimo={0}
          maximo={24}
          paso={0.5}
          unidad="h"
        />
      </section>

      <section className="viva-tarjeta">
        <Contador
          etiqueta="¿Cuántas veces te despertaste?"
          valor={despertares}
          alCambiar={setDespertares}
          minimo={0}
          maximo={20}
        />
      </section>

      <section className="viva-tarjeta">
        <h2 className="viva-tarjeta__titulo" id="viva-amaneciste">
          ¿Cómo amaneciste?
        </h2>
        <div className="viva-opciones" role="radiogroup" aria-labelledby="viva-amaneciste">
          {COMO_AMANECISTE.map(({ valor, texto, adorno }) => (
            <OpcionGrande
              key={valor}
              tipo="radio"
              nombre="amaneciste"
              valor={valor}
              marcada={comoAmaneciste === valor}
              alCambiar={() => setComoAmaneciste(valor)}
              texto={texto}
              adorno={adorno}
            />
          ))}
        </div>
      </section>

      <BarraDeAccion>
        <BotonPrincipal tipo="submit" deshabilitado={enviando}>
          {enviando ? 'Guardando…' : 'Terminar'}
        </BotonPrincipal>
      </BarraDeAccion>
    </form>
  );
}
