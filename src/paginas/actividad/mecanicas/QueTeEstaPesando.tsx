import { useState, type FormEvent } from 'react';

import { BarraDeAccion, BotonPrincipal } from '../viva/BarraDeAccion.tsx';
import { ACOMPANAN, elegir } from '../viva/mensajes.ts';
import { OpcionGrande } from '../viva/OpcionGrande.tsx';
import { useMascotaDeLaPersona } from '../viva/mascotaDeLaPersona.ts';
import { VozDeLaMascota } from '../viva/VozDeLaMascota.tsx';
import type { PropsDeMecanica } from './registro.tsx';

/**
 * "Que te esta pesando": marcar lo que esta costando estos dias (SCRUM-94).
 *
 * Se puede marcar varias cosas o ninguna. Terminar sin marcar nada es una
 * respuesta valida, y la mejor que puede tener esta actividad.
 *
 * ---------------------------------------------------------------------------
 * Por que cada cosa vale 3 y el maximo es 15
 * ---------------------------------------------------------------------------
 *
 * Los textos de nivel del catalogo hablan de **cuantas** cosas se juntan:
 * "no hay mucho pesandote", "un par de cosas", "varias cosas a la vez". El
 * puntaje tiene que contar lo mismo que dicen.
 *
 * Con 3 puntos por cosa y los umbrales de la actividad (0,30 y 0,60 sobre 15):
 *
 * | Marcadas | Puntaje | Nivel             |
 * | -------- | ------- | ----------------- |
 * | 0 o 1    | 0 o 3   | favorable         |
 * | 2 o 3    | 6 o 9   | en seguimiento    |
 * | 4 o mas  | 12 o 15 | requiere atencion |
 *
 * A partir de cinco el puntaje se queda en 15. Pasar de ahi no diria nada
 * nuevo: ya son varias cosas a la vez. Las marcadas se guardan todas en
 * `metadata`, de modo que no se pierde ninguna.
 *
 * Es una lista de cosas de la vida, no de estados: nada de lo que hay aqui
 * nombra una condicion.
 */

const PUNTOS_POR_COSA = 3;
const MAXIMO = 15;

const COSAS = [
  { clave: 'estudios', texto: 'Los estudios' },
  { clave: 'trabajo', texto: 'El trabajo' },
  { clave: 'dinero', texto: 'El dinero' },
  { clave: 'familia', texto: 'La familia' },
  { clave: 'relaciones', texto: 'La pareja o las amistades' },
  { clave: 'salud', texto: 'La salud, la tuya o la de alguien cercano' },
  { clave: 'descanso', texto: 'El cansancio o el sueño' },
  { clave: 'futuro', texto: 'El futuro o una decisión pendiente' },
  { clave: 'soledad', texto: 'La soledad' },
  { clave: 'algoQuePaso', texto: 'Algo que pasó y sigue dando vueltas' },
  { clave: 'otra', texto: 'Otra cosa' },
] as const;

type Cosa = (typeof COSAS)[number]['clave'];

/** Un dibujo para cada cosa, solo para reconocerla de un vistazo. No dice nada de la persona. */
const ADORNOS: Readonly<Record<Cosa, string>> = {
  estudios: '📚',
  trabajo: '💼',
  dinero: '💰',
  familia: '🏠',
  relaciones: '💞',
  salud: '🩺',
  descanso: '🌙',
  futuro: '🧭',
  soledad: '🫂',
  algoQuePaso: '💭',
  otra: '✨',
};

export function QueTeEstaPesando({ alTerminar, enviando }: PropsDeMecanica) {
  const mascota = useMascotaDeLaPersona();
  const [marcadas, setMarcadas] = useState<readonly Cosa[]>([]);
  // Sube con cada toque: hace saltar a la mascota.
  const [latido, setLatido] = useState(0);

  function alternar(cosa: Cosa) {
    setLatido((antes) => antes + 1);
    setMarcadas((antes) =>
      antes.includes(cosa) ? antes.filter((una) => una !== cosa) : [...antes, cosa],
    );
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();

    alTerminar({
      score: Math.min(marcadas.length * PUNTOS_POR_COSA, MAXIMO),
      // En el orden de la lista y no en el que se marcaron: asi dos registros
      // iguales quedan iguales.
      metadata: {
        marcadas: COSAS.map(({ clave }) => clave).filter((clave) => marcadas.includes(clave)),
      },
    });
  }

  // Ni «que poco» ni «cuanto»: no se opina sobre cuantas cosas se marcan.
  const mensaje =
    marcadas.length === 0
      ? 'Marca lo que quieras. También está bien no marcar nada.'
      : elegir(ACOMPANAN, marcadas.length);

  return (
    <form className="viva" onSubmit={enviar} noValidate>
      {/* Sonrie al recibir a la persona y despues se queda serena: una cara contenta junto a lo
          que alguien dice que le pesa no le queda bien. */}
      <VozDeLaMascota
        mascota={mascota}
        mensaje={mensaje}
        expresion={marcadas.length === 0 ? 'feliz' : 'normal'}
        latido={latido}
      />

      <fieldset className="viva-opciones viva-opciones--en-dos">
        <legend className="viva-paso__titulo viva-leyenda">
          ¿Qué te está costando estos días?
        </legend>

        {COSAS.map(({ clave, texto }) => (
          <OpcionGrande
            key={clave}
            tipo="checkbox"
            nombre="marcadas"
            valor={clave}
            marcada={marcadas.includes(clave)}
            alCambiar={() => alternar(clave)}
            texto={texto}
            adorno={ADORNOS[clave]}
          />
        ))}
      </fieldset>

      {marcadas.length === 0 && (
        <p className="viva-falta">Si ahora mismo no hay nada, puedes terminar sin marcar.</p>
      )}

      <BarraDeAccion>
        <BotonPrincipal tipo="submit" deshabilitado={enviando}>
          {enviando ? 'Guardando…' : 'Terminar'}
        </BotonPrincipal>
      </BarraDeAccion>
    </form>
  );
}
