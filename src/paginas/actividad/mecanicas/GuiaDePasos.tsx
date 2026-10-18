import { useEffect, useId, useMemo, useRef, useState } from 'react';

import '../../../estilos/pasos.css';
import { useReglasLocales } from '../../../asistente/useReglasLocales.ts';
import { lineasDeLaZona } from '../../../asistente/reglasLocales.ts';
import { zonaActual } from '../../../tiempo/zonaHoraria.ts';
import { FiguraDeEstiramiento } from '../figuras/FiguraDeEstiramiento.tsx';
import { existeLaFigura } from '../figuras/estiramientos.tsx';
import { LineasDeAtencion } from '../LineasDeAtencion.tsx';
import { Pictograma } from '../pictogramas/Pictograma.tsx';
import { BarraDeAccion, BotonPrincipal, BotonSecundario } from '../viva/BarraDeAccion.tsx';
import { BarraDeProgreso } from '../viva/BarraDeProgreso.tsx';
import { vibrar } from '../viva/haptico.ts';
import { INICIO, elegir, mensajeDelPaso } from '../viva/mensajes.ts';
import { OpcionGrande } from '../viva/OpcionGrande.tsx';
import { PasoAnimado } from '../viva/PasoAnimado.tsx';
import { useMascotaDeLaPersona } from '../viva/mascotaDeLaPersona.ts';
import { VozDeLaMascota } from '../viva/VozDeLaMascota.tsx';
import { marcaDeTiempo, segundosDesde } from './cognicion.ts';
import {
  leerLosPasos,
  type EleccionDeLaGuia,
  type ParametrosDePasos,
  type PasoDeLaGuia,
} from './parametrosDeLaGuia.ts';
import type { PropsDeMecanica } from './registro.tsx';
import { SinSesion } from './SinSesion.tsx';

/**
 * Una guia de pasos (SCRUM-226, ADR 0030): el motor `guia_paso_a_paso` en su modo `pasos`. Sirve a cinco
 * mecanicas de Bienestar y Emociones: la pausa de estiramiento (BIE-02), el escaneo corporal (BIE-06), el
 * respiro del dia (BIE-09), el ancla 5-4-3-2-1 (EMO-03) y el lugar tranquilo (EMO-07).
 *
 * Es una actividad **sin puntaje y de bienestar**: lo que mas importa es lo que no hace.
 *
 * - **La advertencia va a la vista antes de empezar**, en una tarjeta («si algo duele, para»).
 * - **El aviso de siempre** (`avisoSiempre`: «puedes saltarte una zona o parar cuando quieras») queda a la vista
 *   durante **toda** la guia, no solo al principio.
 * - **Nada se impone.** Con `elecciones`, la persona escoge antes de empezar el recorrido que prefiere. Siempre
 *   se puede parar («Parar»), volver atras o seguir; no hay una respuesta buena ni mala.
 * - **Sin tiempo** con `avance: manual`: nada pasa solo. Con `auto`, cada paso dura sus `segundos`, con una barra
 *   suave (no una cuenta atras), y siempre se puede seguir antes.
 * - **Lineas de atencion a mano** (`conLineasDeAyuda`, EMO-03): un boton al lado del aviso abre las lineas del
 *   pais de la persona, tambien sin conexion (SCRUM-141). Se ofrecen, no se imponen.
 * - **El texto es lo que dice que hacer**; la figura o el pictograma de cada paso es adorno para quien ve.
 *
 * La pantalla no tiene respaldo: sin una sesion que entienda, lo dice.
 */

const AGRADECIMIENTO = 'Gracias por darte este rato.';
const AGRADECIMIENTO_AL_PARAR = 'Gracias por intentarlo. Lo que hiciste cuenta.';

export function GuiaDePasos({ sesion, ...props }: PropsDeMecanica) {
  const reglas = useMemo(() => leerLosPasos(sesion?.parametros), [sesion]);

  if (reglas === null) {
    return <SinSesion />;
  }

  return <Guia {...props} reglas={reglas} />;
}

type Fase = 'inicio' | 'guia' | 'fin';

/** Una figura de estiramiento si la clave lo es, un pictograma de la biblioteca si no. */
function Dibujo({ clave, tamano }: { clave: string; tamano: number }) {
  return clave.includes(':') || existeLaFigura(clave) ? (
    <FiguraDeEstiramiento clave={clave} tamano={tamano} />
  ) : (
    <Pictograma clave={clave} tamano={tamano} />
  );
}

/**
 * El acceso a las lineas de atencion, siempre a mano durante la guia. Las reglas locales se leen al montarse
 * (con conexion o de la copia), de modo que al abrirlas ya estan: quien las busca en un mal momento no espera.
 */
function AccesoALasLineas() {
  const reglas = useReglasLocales();
  const [abiertas, setAbiertas] = useState(false);
  const idDelPanel = useId();

  return (
    <div className="guia-pasos__lineas">
      <button
        type="button"
        className="guia-pasos__boton-lineas"
        aria-expanded={abiertas}
        aria-controls={idDelPanel}
        onClick={() => {
          setAbiertas((antes) => !antes);
        }}
      >
        {abiertas ? 'Ocultar las líneas de atención' : 'Líneas de atención'}
      </button>

      <div id={idDelPanel} hidden={!abiertas}>
        {abiertas && (
          // Sin reglas todavia, `LineasDeAtencion` usa su respaldo: nunca se queda sin un telefono.
          <LineasDeAtencion
            lineas={reglas === null ? undefined : lineasDeLaZona(reglas, zonaActual())}
          />
        )}
      </div>
    </div>
  );
}

function Guia({
  alTerminar,
  enviando,
  reglas,
}: Omit<PropsDeMecanica, 'sesion'> & { readonly reglas: ParametrosDePasos }) {
  const mascota = useMascotaDeLaPersona();
  const { avance, advertenciaInicial, intro, cierre, avisoSiempre, conLineasDeAyuda, haptico } =
    reglas;
  const { elecciones } = reglas;
  const [fase, setFase] = useState<Fase>('inicio');
  const [eleccion, setEleccion] = useState<string | null>(null);
  const [indice, setIndice] = useState(0);
  const [direccion, setDireccion] = useState<1 | -1>(1);
  const [completa, setCompleta] = useState(false);
  const inicio = useRef(0);
  const terminada = useRef(false);

  const recorrido: EleccionDeLaGuia | undefined = elecciones?.find((una) => una.clave === eleccion);
  const pasos: readonly PasoDeLaGuia[] =
    elecciones === undefined ? (reglas.pasos ?? []) : (recorrido?.pasos ?? []);
  const total = pasos.length;
  const paso = pasos[indice];
  const puedeEmpezar = elecciones === undefined || eleccion !== null;
  const esElUltimo = indice === total - 1;
  const idDeLaEleccion = useId();

  // Con avance automatico, el paso pasa solo a los `segundos` que dice la sesion.
  useEffect(() => {
    if (fase !== 'guia' || avance !== 'auto' || paso?.segundos === undefined) {
      return undefined;
    }

    const temporizador = setTimeout(() => {
      if (esElUltimo) {
        setCompleta(true);
        setFase('fin');
      } else {
        setDireccion(1);
        setIndice((antes) => antes + 1);
      }
    }, paso.segundos * 1000);

    return () => {
      clearTimeout(temporizador);
    };
  }, [fase, avance, paso?.segundos, indice, esElUltimo]);

  // Una vibracion suave al cambiar de paso, solo si la sesion la pide.
  useEffect(() => {
    if (haptico && fase === 'guia') {
      vibrar(20);
    }
  }, [haptico, fase, indice]);

  function empezar() {
    if (!puedeEmpezar) {
      return;
    }

    inicio.current = marcaDeTiempo();
    setIndice(0);
    setFase('guia');
  }

  function siguiente() {
    if (esElUltimo) {
      setCompleta(true);
      setFase('fin');

      return;
    }

    setDireccion(1);
    setIndice((antes) => antes + 1);
  }

  function atras() {
    setDireccion(-1);
    setIndice((antes) => Math.max(0, antes - 1));
  }

  function parar() {
    setCompleta(false);
    setFase('fin');
  }

  function terminar() {
    if (terminada.current) {
      return;
    }

    terminada.current = true;

    alTerminar({
      metadata: {
        completa,
        pasos: completa ? total : Math.min(indice + 1, total),
        total,
        segundos: segundosDesde(inicio.current),
        ...(eleccion === null ? {} : { eleccion }),
      },
    });
  }

  const aviso =
    avisoSiempre === undefined ? null : (
      <div className="guia-pasos__siempre" role="note">
        <p className="guia-pasos__siempre-texto">{avisoSiempre}</p>
        {conLineasDeAyuda && <AccesoALasLineas />}
      </div>
    );

  if (fase === 'inicio') {
    return (
      <div className="guia-pasos">
        <VozDeLaMascota mascota={mascota} mensaje={elegir(INICIO, 0)} expresion="feliz" />

        {advertenciaInicial !== undefined && (
          <section className="guia-pasos__aviso" role="note" aria-labelledby="guia-pasos-aviso">
            <h2 id="guia-pasos-aviso" className="guia-pasos__aviso-titulo">
              Antes de empezar
            </h2>
            <p className="guia-pasos__aviso-texto">{advertenciaInicial}</p>
          </section>
        )}

        {intro !== undefined && <p className="actividad__texto">{intro}</p>}

        {aviso}

        {elecciones !== undefined && (
          <fieldset className="guia-pasos__elecciones">
            <legend className="viva-paso__titulo guia-pasos__leyenda">Elige uno</legend>

            {elecciones.map((una) => (
              <OpcionGrande
                key={una.clave}
                tipo="radio"
                nombre={idDeLaEleccion}
                valor={una.clave}
                marcada={eleccion === una.clave}
                alCambiar={() => {
                  setEleccion(una.clave);
                }}
                texto={
                  una.descripcion === undefined ? una.nombre : `${una.nombre}. ${una.descripcion}`
                }
                {...(una.pictograma === undefined
                  ? {}
                  : { adorno: <Dibujo clave={una.pictograma} tamano={32} /> })}
              />
            ))}
          </fieldset>
        )}

        <BarraDeAccion>
          <BotonPrincipal
            alPulsar={empezar}
            deshabilitado={!puedeEmpezar}
            {...(puedeEmpezar ? {} : { descritoPor: `${idDeLaEleccion}-pista` })}
            conFlecha
          >
            Empezar
          </BotonPrincipal>
        </BarraDeAccion>

        {!puedeEmpezar && (
          <p id={`${idDeLaEleccion}-pista`} className="guia-pasos__pista">
            Elige una opción para empezar.
          </p>
        )}
      </div>
    );
  }

  if (fase === 'fin') {
    return (
      <div className="guia-pasos">
        <VozDeLaMascota
          mascota={mascota}
          mensaje={completa ? (cierre ?? AGRADECIMIENTO) : AGRADECIMIENTO_AL_PARAR}
          expresion="feliz"
          latido={1}
        />

        {completa && cierre !== undefined && (
          <p className="actividad__texto guia-pasos__cierre" role="status">
            {AGRADECIMIENTO}
          </p>
        )}

        {aviso}

        <BarraDeAccion>
          <BotonPrincipal alPulsar={terminar} deshabilitado={enviando}>
            {enviando ? 'Guardando…' : 'Terminar'}
          </BotonPrincipal>
        </BarraDeAccion>
      </div>
    );
  }

  if (paso === undefined) {
    return null;
  }

  return (
    <div className="guia-pasos">
      <BarraDeProgreso paso={indice + 1} total={total} hechos={indice} etiqueta="Paso" />

      <VozDeLaMascota mascota={mascota} mensaje={mensajeDelPaso(indice, total)} anunciar={false} />

      {aviso}

      <PasoAnimado
        clave={`${eleccion ?? 'guia'}-${String(indice)}`}
        direccion={direccion}
        titulo={paso.titulo ?? `Paso ${String(indice + 1)}`}
      >
        {paso.pictograma !== undefined && (
          <div className="guia-pasos__figura">
            <Dibujo clave={paso.pictograma} tamano={168} />
          </div>
        )}

        <p className="actividad__texto guia-pasos__texto">{paso.texto}</p>

        {avance === 'auto' && paso.segundos !== undefined && (
          <>
            <p className="guia-pasos__tiempo-texto">
              Pasa solo en unos {paso.segundos} segundos. Si ya terminaste, puedes seguir.
            </p>
            <div className="guia-pasos__tiempo" aria-hidden="true">
              <span
                key={indice}
                className="guia-pasos__tiempo-barra"
                style={{ animationDuration: `${String(paso.segundos)}s` }}
              />
            </div>
          </>
        )}
      </PasoAnimado>

      <BarraDeAccion>
        {indice > 0 && <BotonSecundario alPulsar={atras}>Atrás</BotonSecundario>}
        <BotonSecundario alPulsar={parar}>Parar</BotonSecundario>
        <BotonPrincipal alPulsar={siguiente} conFlecha={!esElUltimo}>
          {esElUltimo ? 'Listo' : 'Siguiente'}
        </BotonPrincipal>
      </BarraDeAccion>
    </div>
  );
}
