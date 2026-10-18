import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import '../../../estilos/juegos.css';
import '../../../estilos/juegosDeCognicion.css';
import { BarraDeAccion, BotonPrincipal } from '../viva/BarraDeAccion.tsx';
import { BarraDeProgreso } from '../viva/BarraDeProgreso.tsx';
import { ACIERTO, ANIMO_TRAS_CASI, EN_EL_JUEGO, elegir } from '../viva/mensajes.ts';
import { PasosDeInicio } from '../viva/PasosDeInicio.tsx';
import { useMascotaDeLaPersona } from '../viva/mascotaDeLaPersona.ts';
import { VozDeLaMascota } from '../viva/VozDeLaMascota.tsx';
import { marcaDeTiempo, segundosDesde } from './cognicion.ts';
import { esLaPalabra } from './laPalabra.ts';
import {
  leerLasPalabras,
  type PalabraDelJuego,
  type ParametrosDePalabras,
} from './parametrosDeLaCognicion.ts';
import type { PropsDeMecanica } from './registro.tsx';
import { SinSesion } from './SinSesion.tsx';

/**
 * «Completa la palabra» (SCRUM-225, ficha COG-07): una palabra con letras que faltan, o con las letras
 * revueltas, y una pista de categoria.
 *
 * Es el motor `palabras`, en dos modos: `completar` (una o dos letras faltantes, que se escriben en su
 * lugar) y `anagrama` (las letras revueltas, y se escribe la palabra). Una palabra acertada, un punto.
 *
 * ## Las barandas de la ficha
 *
 * - **Se acepta con y sin tilde**, en mayusculas o minusculas: «arbol» y «Árbol» son lo mismo. La enie **no** es
 *   una n: «pano» no es «paño».
 * - **Dislexia:** letras grandes y bien separadas, fondo sin contraste extremo y **sin limite de tiempo**.
 * - Nunca «te equivocaste»: un fallo se acompana con «¡Casi!» y la palabra, sin senalarlo.
 *
 * La pantalla no tiene respaldo: la sesion trae las palabras, y sin una que entienda, lo dice.
 */

export function CompletaLaPalabra({ sesion, ...props }: PropsDeMecanica) {
  const reglas = useMemo(() => leerLasPalabras(sesion?.parametros), [sesion]);

  if (reglas === null) {
    return <SinSesion />;
  }

  return <Palabras {...props} reglas={reglas} />;
}

function Palabras({
  alTerminar,
  enviando,
  reglas,
}: Omit<PropsDeMecanica, 'sesion'> & { readonly reglas: ParametrosDePalabras }) {
  const mascota = useMascotaDeLaPersona();
  const { modo, palabras, puntosMaximos } = reglas;
  const [empezo, setEmpezo] = useState(false);
  const [indice, setIndice] = useState(0);
  const [aciertos, setAciertos] = useState(0);
  const inicio = useRef(marcaDeTiempo());
  const terminada = useRef(false);
  const total = palabras.length;
  const palabra = palabras[indice];

  if (!empezo) {
    return (
      <div className="juego">
        <VozDeLaMascota mascota={mascota} mensaje={elegir(EN_EL_JUEGO, 0)} expresion="feliz" />

        <PasosDeInicio
          pasos={
            modo === 'completar'
              ? ['Lee la pista.', 'Escribe la letra que falta.', 'Sin tiempo.']
              : ['Lee la pista.', 'Ordena las letras.', 'Sin tiempo.']
          }
        />

        <p className="actividad__texto">
          {modo === 'completar'
            ? `Son ${String(total)} palabras con letras que faltan, y una pista de qué son. Puedes escribir con o sin tilde. No hay tiempo.`
            : `Son ${String(total)} palabras con las letras revueltas, y una pista de qué son. Escribe la palabra, con o sin tilde. No hay tiempo.`}
        </p>

        <BarraDeAccion>
          <BotonPrincipal
            alPulsar={() => {
              inicio.current = marcaDeTiempo();
              setEmpezo(true);
            }}
            conFlecha
          >
            Empezar
          </BotonPrincipal>
        </BarraDeAccion>
      </div>
    );
  }

  if (palabra === undefined) {
    return null;
  }

  function alAcabarLaPalabra(acerto: boolean) {
    if (terminada.current) {
      return;
    }

    const buenas = aciertos + (acerto ? 1 : 0);

    setAciertos(buenas);

    if (indice < total - 1) {
      setIndice((antes) => antes + 1);

      return;
    }

    terminada.current = true;

    alTerminar({
      score: Math.min(Math.round((buenas / total) * puntosMaximos * 100) / 100, puntosMaximos),
      metadata: { aciertos: buenas, palabras: total, segundos: segundosDesde(inicio.current) },
    });
  }

  return (
    // Con `key`, cada palabra empieza con sus campos vacios y el foco en el primero.
    <UnaPalabra
      key={indice}
      mascota={mascota}
      modo={modo}
      palabra={palabra}
      indice={indice}
      total={total}
      aciertos={aciertos}
      enviando={enviando}
      alAcabar={alAcabarLaPalabra}
    />
  );
}

function UnaPalabra({
  mascota,
  modo,
  palabra,
  indice,
  total,
  aciertos,
  enviando,
  alAcabar,
}: {
  readonly mascota: ReturnType<typeof useMascotaDeLaPersona>;
  readonly modo: 'completar' | 'anagrama';
  readonly palabra: PalabraDelJuego;
  readonly indice: number;
  readonly total: number;
  readonly aciertos: number;
  readonly enviando: boolean;
  readonly alAcabar: (acerto: boolean) => void;
}) {
  const faltantes = palabra.faltan ?? [];
  const letras = [...palabra.palabra];
  const [escrito, setEscrito] = useState<readonly string[]>(() =>
    Array.from({ length: modo === 'completar' ? faltantes.length : 1 }, () => ''),
  );
  const [revisada, setRevisada] = useState<boolean | null>(null);
  const siguiente = useRef<HTMLButtonElement>(null);
  const entradas = useRef<(HTMLInputElement | null)[]>([]);
  const esLaUltima = indice === total - 1;

  useEffect(() => {
    entradas.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (revisada !== null) {
      siguiente.current?.focus();
    }
  }, [revisada]);

  function comprobar(evento: FormEvent) {
    evento.preventDefault();

    if (revisada !== null) {
      return;
    }

    setRevisada(esLaPalabra(palabra, modo, escrito));
  }

  const todoEscrito = escrito.length > 0 && escrito.every((valor) => valor.trim() !== '');

  const veredicto =
    revisada === null
      ? { mensaje: 'Tómate el tiempo que necesites.' }
      : revisada
        ? { mensaje: elegir(ACIERTO, indice), resultado: 'acierto' as const }
        : {
            mensaje: `¡Casi! Era «${palabra.palabra}».`,
            ademas: elegir(ANIMO_TRAS_CASI, indice),
            resultado: 'casi' as const,
          };

  return (
    <form className="juego" onSubmit={comprobar} noValidate>
      <BarraDeProgreso
        paso={indice + 1}
        total={total}
        hechos={indice + (revisada === null ? 0 : 1)}
        estrellas={aciertos + (revisada === true ? 1 : 0)}
        etiqueta="Palabra"
      />

      <VozDeLaMascota
        mascota={mascota}
        mensaje={veredicto.mensaje}
        {...('ademas' in veredicto ? { ademas: veredicto.ademas } : {})}
        {...('resultado' in veredicto ? { resultado: veredicto.resultado } : {})}
        expresion={revisada === true ? 'celebrando' : 'normal'}
        latido={revisada === null ? 0 : indice + 1}
      />

      <p className="juego__pista">
        Pista: <strong>{palabra.pista}</strong>
      </p>

      {modo === 'completar' ? (
        <div
          className="juego__palabra"
          role="group"
          aria-label={`Palabra de ${String(letras.length)} letras`}
        >
          {letras.map((letra, posicion) => {
            const lugar = faltantes.indexOf(posicion);

            return lugar === -1 ? (
              <span key={posicion} className="juego__letra">
                {letra}
              </span>
            ) : (
              <input
                key={posicion}
                ref={(elemento) => {
                  entradas.current[lugar] = elemento;
                }}
                className="juego__letra juego__letra--falta"
                value={escrito[lugar] ?? ''}
                maxLength={1}
                inputMode="text"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                disabled={revisada !== null}
                aria-label={`Letra ${String(posicion + 1)} de ${String(letras.length)}`}
                onChange={(evento) => {
                  const valor = evento.target.value;

                  setEscrito((antes) => antes.map((actual, i) => (i === lugar ? valor : actual)));

                  // Al escribir una letra, el foco pasa a la que sigue.
                  if (valor !== '') {
                    entradas.current[lugar + 1]?.focus();
                  }
                }}
              />
            );
          })}
        </div>
      ) : (
        <>
          <p className="juego__revuelta">
            <span className="solo-lectores">
              Letras revueltas: {[...(palabra.revuelta ?? '')].join(', ')}
            </span>
            {[...(palabra.revuelta ?? '')].map((letra, posicion) => (
              <span key={posicion} className="juego__letra" aria-hidden="true">
                {letra}
              </span>
            ))}
          </p>

          <label className="juego__campo">
            <span className="juego__campo-etiqueta">Escribe la palabra</span>
            <input
              ref={(elemento) => {
                entradas.current[0] = elemento;
              }}
              className="juego__entrada"
              value={escrito[0] ?? ''}
              maxLength={letras.length + 2}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              disabled={revisada !== null}
              onChange={(evento) => {
                setEscrito([evento.target.value]);
              }}
            />
          </label>
        </>
      )}

      {revisada !== null && (
        <p className="juego__despues" role="status">
          La palabra era <strong>{palabra.palabra}</strong>.
        </p>
      )}

      <BarraDeAccion>
        {revisada === null ? (
          <BotonPrincipal tipo="submit" deshabilitado={!todoEscrito}>
            Comprobar
          </BotonPrincipal>
        ) : (
          <BotonPrincipal
            referencia={siguiente}
            alPulsar={() => {
              alAcabar(revisada);
            }}
            deshabilitado={enviando}
            conFlecha={!esLaUltima}
          >
            {esLaUltima ? (enviando ? 'Guardando…' : 'Terminar') : 'Siguiente'}
          </BotonPrincipal>
        )}
      </BarraDeAccion>
    </form>
  );
}
