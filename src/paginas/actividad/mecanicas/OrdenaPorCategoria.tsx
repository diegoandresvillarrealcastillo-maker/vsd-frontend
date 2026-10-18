import { useEffect, useMemo, useRef, useState } from 'react';

import '../../../estilos/juegos.css';
import '../../../estilos/juegosDeCognicion.css';
import { BarraDeAccion, BotonPrincipal } from '../viva/BarraDeAccion.tsx';
import { BarraDeProgreso } from '../viva/BarraDeProgreso.tsx';
import {
  ACIERTO,
  ANIMO_TRAS_CASI,
  EN_EL_JUEGO,
  elegir,
  mensajeAlElegir,
} from '../viva/mensajes.ts';
import { PasosDeInicio } from '../viva/PasosDeInicio.tsx';
import { useMascotaDeLaPersona } from '../viva/mascotaDeLaPersona.ts';
import { VozDeLaMascota } from '../viva/VozDeLaMascota.tsx';
import { marcaDeTiempo, segundosDesde } from './cognicion.ts';
import { leerLasCestas, type ParametrosDeCestas } from './parametrosDeLaCognicion.ts';
import type { PropsDeMecanica } from './registro.tsx';
import { SinSesion } from './SinSesion.tsx';

/**
 * «Ordena por categoria» (SCRUM-225, ficha COG-03) y «Lo que si controlo» (ficha EMO-04): unas tarjetas que
 * aparecen de una en una y se llevan a una cesta. Es el motor `clasificar` en su modo `cestas`, y tiene dos
 * caras segun la sesion:
 *
 * - **Con cesta correcta** (COG-03): es un juego. Un acierto, un punto, y el tono **celebra**: un fallo se
 *   acompana con «¡Casi!» y dice donde iba, sin senalarlo. Una tarjeta ambigua (el tomate es fruta o verdura)
 *   vale en cualquiera de sus cestas.
 * - **Sin cesta correcta** (EMO-04): es un ejercicio de reflexion. No se puntua, nada celebra ni corrige, y lo que
 *   dice la mascota no depende de donde se puso cada tarjeta. Al final se ve como quedo todo y, si la sesion lo
 *   pide, se puede escribir una linea sobre que haria. Esa linea es texto libre: pasa por la deteccion de
 *   riesgo del servidor y no se guarda en el navegador.
 *
 * ## Se juega tocando
 *
 * La tarjeta se lleva **tocando la cesta**, no arrastrando (R10: la alternativa por toque es la primera
 * opcion, no un respaldo). Asi funciona igual con el dedo, el raton, el teclado y un lector de pantalla, y no
 * compite con el desplazamiento de la pagina en un telefono. Cada cesta es un boton de al menos 44 px.
 */

export function OrdenaPorCategoria({ sesion, ...props }: PropsDeMecanica) {
  const reglas = useMemo(() => leerLasCestas(sesion?.parametros), [sesion]);

  if (reglas === null) {
    return <SinSesion />;
  }

  return <Mesa {...props} reglas={reglas} />;
}

interface Colocacion {
  readonly elemento: string;
  readonly cesta: string;
  readonly acerto: boolean;
}

function Mesa({
  alTerminar,
  enviando,
  reglas,
}: Omit<PropsDeMecanica, 'sesion'> & { readonly reglas: ParametrosDeCestas }) {
  const mascota = useMascotaDeLaPersona();
  const { indicacion, cestas, elementos, puntosMaximos, linea, cierre } = reglas;
  const puntua = puntosMaximos !== undefined;
  const [empezo, setEmpezo] = useState(false);
  const [colocaciones, setColocaciones] = useState<readonly Colocacion[]>([]);
  /** La cesta donde se acaba de poner la tarjeta que se esta viendo; `null` si todavia no se puso. */
  const [puesta, setPuesta] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const inicio = useRef(marcaDeTiempo());
  const siguiente = useRef<HTMLButtonElement>(null);
  const terminada = useRef(false);

  const total = elementos.length;
  const hechas = colocaciones.length;
  const enElResumen = hechas === total && puesta === null;
  const elemento = elementos[hechas];
  const aciertos = colocaciones.filter((colocacion) => colocacion.acerto).length;
  const nombreDeLaCesta = (clave: string) =>
    cestas.find((cesta) => cesta.clave === clave)?.nombre ?? clave;

  useEffect(() => {
    if (puesta !== null) {
      siguiente.current?.focus();
    }
  }, [puesta]);

  function llevarA(cesta: string) {
    if (elemento === undefined || puesta !== null) {
      return;
    }

    setPuesta(cesta);
  }

  function seguir() {
    if (elemento === undefined || puesta === null) {
      return;
    }

    setColocaciones((antes) => [
      ...antes,
      {
        elemento: elemento.clave,
        cesta: puesta,
        // En el ejercicio de reflexion no hay acierto: cuenta lo que se hizo, no si estaba bien.
        acerto: puntua && elemento.sitios.includes(puesta),
      },
    ]);
    setPuesta(null);
  }

  function terminar() {
    if (terminada.current) {
      return;
    }

    terminada.current = true;

    const colocacionesPorElemento = Object.fromEntries(
      colocaciones.map((colocacion) => [colocacion.elemento, colocacion.cesta]),
    );
    const escrito = texto.trim();

    alTerminar({
      ...(puntua ? { score: Math.min(aciertos, puntosMaximos) } : {}),
      metadata: {
        colocaciones: colocacionesPorElemento,
        segundos: segundosDesde(inicio.current),
        ...(puntua ? { aciertos, tarjetas: total } : {}),
        // Lo escrito es de la persona: va directo a la peticion y no se guarda ni se muestra en ningun otro sitio.
        ...(escrito === '' ? {} : { linea: escrito }),
      },
    });
  }

  if (!empezo) {
    return (
      <div className="juego">
        <VozDeLaMascota mascota={mascota} mensaje={elegir(EN_EL_JUEGO, 0)} expresion="feliz" />

        <PasosDeInicio
          pasos={[
            'Mira la tarjeta.',
            'Toca la cesta donde va.',
            puntua ? 'Sigue con la siguiente.' : 'No hay respuestas buenas ni malas.',
          ]}
        />

        <p className="actividad__texto">{indicacion}</p>

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

  if (enElResumen) {
    return (
      <div className="juego">
        <VozDeLaMascota
          mascota={mascota}
          mensaje={
            puntua
              ? aciertos >= Math.ceil(total * 0.75)
                ? elegir(ACIERTO, aciertos)
                : '¡Casi! Vas por buen camino.'
              : (cierre ?? 'Separarlo ya ordena un poco. Gracias.')
          }
          {...(puntua
            ? {
                resultado:
                  aciertos >= Math.ceil(total * 0.75) ? ('acierto' as const) : ('casi' as const),
              }
            : {})}
          expresion={puntua && aciertos >= Math.ceil(total * 0.75) ? 'celebrando' : 'feliz'}
          latido={1}
        />

        <h2 className="juego__pregunta">
          {puntua ? `Acertaste ${String(aciertos)} de ${String(total)}` : 'Así quedó'}
        </h2>

        <div className="juego__resumen">
          {cestas.map((cesta) => (
            <section key={cesta.clave} className="juego__resumen-cesta">
              <h3>{cesta.nombre}</h3>
              <ul>
                {colocaciones
                  .filter((colocacion) => colocacion.cesta === cesta.clave)
                  .map((colocacion) => (
                    <li key={colocacion.elemento}>
                      {elementos.find((una) => una.clave === colocacion.elemento)?.nombre}
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>

        {linea !== undefined && (
          <div className="viva-paso">
            <label className="viva-paso__titulo viva-leyenda" htmlFor="linea-de-las-cestas">
              {linea.invitacion}
            </label>
            <textarea
              id="linea-de-las-cestas"
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
          </div>
        )}

        <BarraDeAccion>
          <BotonPrincipal alPulsar={terminar} deshabilitado={enviando}>
            {enviando ? 'Guardando…' : 'Terminar'}
          </BotonPrincipal>
        </BarraDeAccion>
      </div>
    );
  }

  if (elemento === undefined) {
    return null;
  }

  const acerto = puesta !== null && puntua && elemento.sitios.includes(puesta);
  const sitios = elemento.sitios.map(nombreDeLaCesta).join(' o ');
  const mensaje =
    puesta === null
      ? 'Tómate el tiempo que necesites.'
      : !puntua
        ? mensajeAlElegir(hechas)
        : acerto
          ? elegir(ACIERTO, hechas)
          : `¡Casi! Iba en ${sitios}.`;

  return (
    <div className="juego">
      <BarraDeProgreso
        paso={hechas + 1}
        total={total}
        hechos={hechas + (puesta === null ? 0 : 1)}
        estrellas={puntua ? aciertos + (acerto ? 1 : 0) : hechas + (puesta === null ? 0 : 1)}
        etiqueta="Tarjeta"
      />

      <VozDeLaMascota
        mascota={mascota}
        mensaje={mensaje}
        {...(puesta !== null && puntua && !acerto
          ? { ademas: elegir(ANIMO_TRAS_CASI, hechas) }
          : {})}
        {...(puesta !== null && puntua
          ? { resultado: acerto ? ('acierto' as const) : ('casi' as const) }
          : {})}
        expresion={puesta !== null && puntua && acerto ? 'celebrando' : 'normal'}
        latido={puesta === null ? 0 : hechas + 1}
      />

      <div className="juego__tarjeta" aria-live="polite">
        <span className="juego__tarjeta-cuenta">
          Tarjeta {hechas + 1} de {total}
        </span>
        <strong className="juego__tarjeta-nombre">{elemento.nombre}</strong>
      </div>

      <div className="juego__cestas" role="group" aria-label="Cestas" data-cestas={cestas.length}>
        {cestas.map((cesta) => {
          const estado =
            puesta === null || !puntua
              ? undefined
              : elemento.sitios.includes(cesta.clave)
                ? 'correcta'
                : cesta.clave === puesta
                  ? 'elegida'
                  : 'otra';

          return (
            <button
              key={cesta.clave}
              type="button"
              className="juego__cesta"
              disabled={puesta !== null}
              aria-label={`Llevar «${elemento.nombre}» a ${cesta.nombre}`}
              {...(estado === undefined ? {} : { 'data-estado': estado })}
              {...(puesta === cesta.clave ? { 'data-puesta': '' } : {})}
              onClick={() => {
                llevarA(cesta.clave);
              }}
            >
              <span className="juego__cesta-nombre">{cesta.nombre}</span>
              {estado === 'correcta' && (
                <span className="juego__opcion-marca">
                  <span aria-hidden="true">✓</span>
                  <span className="solo-lectores"> (iba aquí)</span>
                </span>
              )}
              {estado === 'elegida' && <span className="juego__opcion-marca">tu elección</span>}
              {!puntua && puesta === cesta.clave && (
                <span className="juego__opcion-marca" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>

      {puesta !== null && (
        <BarraDeAccion>
          <BotonPrincipal referencia={siguiente} alPulsar={seguir} conFlecha>
            {hechas + 1 === total ? 'Ver cómo quedó' : 'Siguiente'}
          </BotonPrincipal>
        </BarraDeAccion>
      )}
    </div>
  );
}
