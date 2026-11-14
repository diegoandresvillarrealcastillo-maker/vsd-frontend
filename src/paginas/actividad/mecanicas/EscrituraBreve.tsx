import { useId, useMemo, useState, type FormEvent } from 'react';

import '../../../estilos/escrituraBreve.css';
import { guardarLaCartaEnElDiario } from '../cartaEnElDiario.ts';
import { BarraDeAccion, BotonPrincipal, BotonSecundario } from '../viva/BarraDeAccion.tsx';
import { useMascotaDeLaPersona } from '../viva/mascotaDeLaPersona.ts';
import { useCierre } from '../viva/useCierre.tsx';
import { VozDeLaMascota } from '../viva/VozDeLaMascota.tsx';
import { leerEscrituraBreve, type ParametrosDeEscrituraBreve } from './parametrosDeLaSesion.ts';
import type { PropsDeMecanica } from './registro.tsx';
import { SinSesion } from './SinSesion.tsx';

/**
 * «Tres cosas buenas»: de uno a cinco campos de texto, con una invitacion (SCRUM-211, ficha EMO-02).
 * Es el motor `escritura_breve` con varios campos; el de un solo campo sigue siendo
 * `UnMomentoBueno`, con su pantalla y su respaldo de siempre.
 *
 * Es **texto libre y sin puntaje**: nunca manda `score`. Lo que mas importa es lo que no exige.
 *
 * - **Con una basta.** La sesion dice cuantos campos hay que llenar (`minimo`, por omision uno) y
 *   se termina con esos: los demas no se mandan vacios. Un dia sin nada bueno tambien cuenta.
 * - **«Hoy no me sale ninguna»** se registra igual, como en «Un momento bueno del dia», si la
 *   sesion lo permite. Obligar a escribir esos dias volveria la actividad una exigencia.
 * - **No valora lo que se escribe.** Lo que dice la mascota invita y agradece, nada mas: un texto
 *   libre puede ser cualquier cosa, y «que bonito» no le queda bien a todo. Tampoco hay un
 *   «deberias estar agradecida».
 * - **Lo que se escribe es de la persona.** No se guarda en el navegador ni se escribe en la
 *   consola: sale del formulario directo a la peticion. La deteccion de riesgo es del servidor,
 *   que ya mira todo el texto del resultado; la pantalla final ensena las lineas de atencion si
 *   las sugiere, y aqui no se repite esa lista.
 * - **Sin respaldo.** Vive de la sesion de hoy: sin una que entienda, lo dice.
 *
 * ## Lo que suma SCRUM-227 (todo opcional: las sesiones de antes siguen valiendo)
 *
 * - `etiquetas`: lo que pide cada campo («Lo que dejo», «Lo que me llevo»), a la vista sobre cada uno.
 * - `textoNinguna`: lo que dice el boton de «hoy no» cuando no es «Hoy no me sale ninguna» (EMO-09).
 * - `cierre`: lo que dice al terminar, con la mascota, antes de entregar. Sin valorar lo escrito.
 * - `guardarParaManana` (EMO-05, «Carta a mi de manana»): al terminar, lo escrito se guarda tambien como una
 *   entrada del diario (`cartaEnElDiario.ts`), por la cola de siempre. Si no se pudo guardar, la carta se
 *   conserva en la pantalla y se dice, para intentarlo de nuevo.
 */

const INVITACION_A_EMPEZAR = 'Puede ser algo muy pequeño. Aquí cuenta todo.';
const AGRADECIMIENTO = 'Gracias por compartirlo. Tómate tu tiempo.';

function loQueFalta(minimo: number): string {
  return minimo === 1
    ? 'Escribe algo, aunque sea pequeño.'
    : `Escribe al menos ${String(minimo)}, aunque sean pequeñas.`;
}

const estaVacio = (texto: string): boolean => texto.trim() === '';

export function EscrituraBreve({ sesion, ...props }: PropsDeMecanica) {
  const reglas = useMemo(() => leerEscrituraBreve(sesion?.parametros), [sesion]);

  if (reglas === null) {
    return <SinSesion />;
  }

  return <Escritura {...props} reglas={reglas} />;
}

function Escritura({
  alTerminar,
  enviando,
  reglas,
}: Omit<PropsDeMecanica, 'sesion'> & { readonly reglas: ParametrosDeEscrituraBreve }) {
  const mascota = useMascotaDeLaPersona();
  const {
    invitacion,
    campos,
    minimo,
    ideas,
    largoMaximo,
    permiteNingunaHoy,
    etiquetas,
    textoNinguna,
    guardarParaManana,
    cierre,
  } = reglas;
  const [textos, setTextos] = useState<readonly string[]>(() =>
    Array.from({ length: campos }, () => ''),
  );
  const [falta, setFalta] = useState<string | null>(null);
  // Sube cada vez que se toca una idea: hace saltar a la mascota.
  const [latido, setLatido] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const { terminar, pantalla } = useCierre({ cierre, alTerminar, enviando });
  const idDeLosCampos = useId();

  const escritos = textos.map((texto) => texto.trim()).filter((texto) => texto !== '');
  const hayLugar = textos.some(estaVacio);

  function escribir(cual: number, texto: string) {
    setFalta(null);
    setTextos((antes) => antes.map((actual, i) => (i === cual ? texto : actual)));
  }

  /** Una idea llena el primer campo vacio: se suma a lo escrito, no lo pisa. */
  function sumar(idea: string) {
    setFalta(null);
    setLatido((antes) => antes + 1);
    setTextos((antes) => {
      const primeroVacio = antes.findIndex(estaVacio);

      return antes.map((actual, i) => (i === primeroVacio ? idea.slice(0, largoMaximo) : actual));
    });
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();

    if (escritos.length < minimo) {
      setFalta(loQueFalta(minimo));
      return;
    }

    if (guardarParaManana === true) {
      setGuardando(true);

      try {
        // Un solo campo: la carta entera, tal como se escribio.
        await guardarLaCartaEnElDiario(escritos.join('\n'));
      } catch {
        // No se pudo dejar en este equipo: lo escrito sigue en la pantalla y se puede intentar de nuevo.
        setFalta('No pudimos guardarla en tu diario en este equipo. Prueba de nuevo.');
        setGuardando(false);

        return;
      }

      setGuardando(false);
    }

    terminar({ encontroUno: true, textos: escritos });
  }

  if (pantalla !== null) {
    return pantalla;
  }

  return (
    <form
      className="viva"
      onSubmit={(evento) => {
        void enviar(evento);
      }}
      noValidate
    >
      <VozDeLaMascota
        mascota={mascota}
        mensaje={escritos.length === 0 ? INVITACION_A_EMPEZAR : AGRADECIMIENTO}
        expresion={escritos.length === 0 ? 'feliz' : 'normal'}
        latido={latido}
      />

      <fieldset className="viva-paso escritura">
        <legend className="viva-paso__titulo viva-leyenda">{invitacion}</legend>

        {ideas.length > 0 && (
          <div className="viva-atajos">
            {ideas.map((idea) => (
              <button
                key={idea}
                type="button"
                className="viva-atajo"
                disabled={!hayLugar}
                onClick={() => sumar(idea)}
              >
                {idea}
              </button>
            ))}
          </div>
        )}

        {textos.map((texto, i) => (
          // El orden de los campos no cambia nunca: el indice es su identidad.
          <div key={i} className="escritura__campo">
            {etiquetas?.[i] !== undefined && (
              <label className="escritura__etiqueta" htmlFor={`${idDeLosCampos}-${String(i)}`}>
                {etiquetas[i]}
              </label>
            )}
            <textarea
              id={`${idDeLosCampos}-${String(i)}`}
              className="viva-texto escritura__texto"
              rows={2}
              maxLength={largoMaximo}
              value={texto}
              {...(etiquetas?.[i] === undefined
                ? {
                    'aria-label':
                      campos === 1
                        ? 'Respuesta'
                        : `Respuesta ${String(i + 1)} de ${String(campos)}`,
                  }
                : {})}
              onChange={(evento) => {
                escribir(i, evento.target.value);
              }}
            />
            <p className="viva-texto__cuenta" aria-hidden="true">
              {texto.length} / {largoMaximo}
            </p>
          </div>
        ))}
      </fieldset>

      {falta !== null && (
        <p className="viva-falta" role="alert">
          {falta}
        </p>
      )}

      {/* Fuera de la franja de abajo: esa es para el gesto principal, y asi no tapa el texto. */}
      {permiteNingunaHoy && (
        <div className="viva-salida">
          <BotonSecundario
            deshabilitado={enviando || guardando}
            alPulsar={() => {
              terminar({ encontroUno: false });
            }}
          >
            {textoNinguna ?? 'Hoy no me sale ninguna'}
          </BotonSecundario>
        </div>
      )}

      <BarraDeAccion>
        <BotonPrincipal tipo="submit" deshabilitado={enviando || guardando}>
          {enviando || guardando ? 'Guardando…' : 'Terminar'}
        </BotonPrincipal>
      </BarraDeAccion>
    </form>
  );
}
