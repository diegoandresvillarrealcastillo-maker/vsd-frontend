import { useId, useMemo, useState, type FormEvent } from 'react';

import '../../../estilos/cuestionarioSinPuntaje.css';
import { BarraDeAccion, BotonPrincipal, BotonSecundario } from '../viva/BarraDeAccion.tsx';
import { INICIO, elegir, mensajeAlElegir } from '../viva/mensajes.ts';
import { useMascotaDeLaPersona } from '../viva/mascotaDeLaPersona.ts';
import { useCierre } from '../viva/useCierre.tsx';
import { VozDeLaMascota } from '../viva/VozDeLaMascota.tsx';
import {
  leerLaRueda,
  type NodoDeLaRueda,
  type ParametrosDeRueda,
} from './parametrosDelCuestionario.ts';
import type { PropsDeMecanica } from './registro.tsx';
import { SinSesion } from './SinSesion.tsx';

/**
 * «Rueda de emociones» (SCRUM-227, ficha EMO-01): ponerle nombre a lo que se siente, de lo mas amplio a lo mas
 * fino. Es el motor `cuestionario_corto` en su modo `rueda`.
 *
 * Es una actividad **sin puntaje, sin diagnostico y sin juicio** (R6, R7): no hay emociones buenas ni malas, no se
 * interpreta lo que se elige y nada se dice sobre ello. Lo que la mascota dice no depende de la emocion.
 *
 * - **Una puerta, no una pared.** Empieza con un texto que explica de que va y que no hay respuestas correctas.
 * - **De lo amplio a lo fino**, hasta tres niveles. Se baja tocando; «Atras» sube; la ruta recorrida se ve y se
 *   lee completa. Al llegar a una emocion se lee su definicion de una linea y se confirma con «Esta es».
 * - **Sin color como unica pista y sin arrastrar:** todo son botones grandes de al menos 44 px, que sirven igual
 *   con teclado y con un lector de pantalla.
 * - **Una linea libre opcional** (`linea`) al final: texto de la persona, que pasa por la deteccion de riesgo del
 *   servidor y **no se guarda en el navegador**.
 * - **Sin respaldo.** Vive de la sesion de hoy: sin una que entienda, lo dice.
 */

export function RuedaDeEmociones({ sesion, ...props }: PropsDeMecanica) {
  const reglas = useMemo(() => leerLaRueda(sesion?.parametros), [sesion]);

  if (reglas === null) {
    return <SinSesion />;
  }

  return <Rueda {...props} reglas={reglas} />;
}

type Fase = 'puerta' | 'rueda' | 'linea';

function esUnaEmocion(nodo: NodoDeLaRueda): boolean {
  return nodo.hijos === undefined;
}

function Rueda({
  alTerminar,
  enviando,
  reglas,
}: Omit<PropsDeMecanica, 'sesion'> & { readonly reglas: ParametrosDeRueda }) {
  const mascota = useMascotaDeLaPersona();
  const { indicacion, puerta, rueda, linea, cierre } = reglas;
  const [fase, setFase] = useState<Fase>('puerta');
  /** Los nodos por los que se ha bajado; el ultimo puede ser una emocion (una hoja). */
  const [camino, setCamino] = useState<readonly NodoDeLaRueda[]>([]);
  const [texto, setTexto] = useState('');
  const [latido, setLatido] = useState(0);
  const { terminar, pantalla } = useCierre({ cierre, alTerminar, enviando });
  const idDeLaLinea = useId();

  if (pantalla !== null) {
    return pantalla;
  }

  const actual = camino.at(-1);
  const enUnaEmocion = actual !== undefined && esUnaEmocion(actual);
  const nodos = actual === undefined ? rueda : (actual.hijos ?? []);

  function bajar(nodo: NodoDeLaRueda) {
    setLatido((antes) => antes + 1);
    setCamino((antes) => [...antes, nodo]);
  }

  function subir() {
    setCamino((antes) => antes.slice(0, -1));
  }

  function confirmar() {
    if (actual === undefined) {
      return;
    }

    if (linea === undefined) {
      entregar();
    } else {
      setFase('linea');
    }
  }

  function entregar() {
    if (actual === undefined) {
      return;
    }

    const escrito = texto.trim();

    terminar({
      emocion: actual.clave,
      camino: camino.slice(0, -1).map((nodo) => nodo.clave),
      // Lo escrito es de la persona: va directo a la peticion y no se guarda ni se muestra en ningun otro sitio.
      ...(escrito === '' ? {} : { linea: escrito }),
    });
  }

  if (fase === 'puerta') {
    return (
      <div className="viva">
        <VozDeLaMascota mascota={mascota} mensaje={elegir(INICIO, 0)} expresion="feliz" />

        <section className="tarjeta-del-dia" aria-labelledby="rueda-puerta">
          <h2 id="rueda-puerta" className="viva-paso__titulo">
            {puerta.titulo}
          </h2>
          <p className="tarjeta-del-dia__texto">{puerta.texto}</p>
        </section>

        <BarraDeAccion>
          <BotonPrincipal
            alPulsar={() => {
              setFase('rueda');
            }}
            conFlecha
          >
            Empezar
          </BotonPrincipal>
        </BarraDeAccion>
      </div>
    );
  }

  if (fase === 'linea' && linea !== undefined) {
    return (
      <form
        className="viva"
        onSubmit={(evento: FormEvent) => {
          evento.preventDefault();
          entregar();
        }}
        noValidate
      >
        <VozDeLaMascota
          mascota={mascota}
          mensaje="Gracias por contarlo."
          expresion="feliz"
          latido={1}
        />

        <div className="viva-paso">
          <label className="viva-paso__titulo viva-leyenda" htmlFor={idDeLaLinea}>
            {linea.invitacion}
          </label>
          <textarea
            id={idDeLaLinea}
            className="viva-texto"
            rows={2}
            maxLength={linea.largoMaximo}
            value={texto}
            onChange={(evento) => {
              setTexto(evento.target.value);
            }}
          />
          <p className="viva-texto__cuenta" aria-hidden="true">
            {texto.length} / {linea.largoMaximo}
          </p>
          <p className="actividad__apoyo">Es opcional: puedes terminar sin escribir nada.</p>
        </div>

        <BarraDeAccion>
          <BotonPrincipal tipo="submit" deshabilitado={enviando}>
            {enviando ? 'Guardando…' : 'Terminar'}
          </BotonPrincipal>
        </BarraDeAccion>
      </form>
    );
  }

  return (
    <div className="viva">
      <VozDeLaMascota
        mascota={mascota}
        mensaje={camino.length === 0 ? elegir(INICIO, 0) : mensajeAlElegir(camino.length)}
        expresion={camino.length === 0 ? 'feliz' : 'normal'}
        latido={latido}
      />

      {camino.length > 0 && (
        <nav className="rueda__ruta" aria-label="Por dónde vas">
          <ol>
            {camino.map((nodo, indice) => (
              <li
                key={nodo.clave}
                {...(indice === camino.length - 1 ? { 'aria-current': 'step' } : {})}
              >
                {nodo.nombre}
              </li>
            ))}
          </ol>
        </nav>
      )}

      {enUnaEmocion ? (
        <section className="tarjeta-del-dia rueda__emocion" aria-labelledby="rueda-emocion">
          <h2 id="rueda-emocion" className="viva-paso__titulo">
            {actual.nombre}
          </h2>
          <p className="tarjeta-del-dia__texto">{actual.definicion}</p>
        </section>
      ) : (
        <section className="viva-paso" aria-labelledby="rueda-pregunta">
          <h2 id="rueda-pregunta" className="viva-paso__titulo">
            {actual === undefined ? indicacion : `Más fino, dentro de «${actual.nombre}»`}
          </h2>

          <ul className="rueda__nodos">
            {nodos.map((nodo) => (
              <li key={nodo.clave}>
                <button
                  type="button"
                  className="rueda__nodo"
                  onClick={() => {
                    bajar(nodo);
                  }}
                >
                  <span className="rueda__nodo-nombre">{nodo.nombre}</span>
                  <span className="rueda__nodo-marca" aria-hidden="true">
                    ›
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <BarraDeAccion>
        {camino.length > 0 && (
          <BotonSecundario alPulsar={subir}>
            {enUnaEmocion ? 'Elegir otra' : 'Atrás'}
          </BotonSecundario>
        )}
        {enUnaEmocion && (
          <BotonPrincipal alPulsar={confirmar} deshabilitado={enviando}>
            {enviando ? 'Guardando…' : 'Esta es'}
          </BotonPrincipal>
        )}
      </BarraDeAccion>
    </div>
  );
}
