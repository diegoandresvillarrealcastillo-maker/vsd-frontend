import { useId, useMemo, useState, type FormEvent } from 'react';

import '../../../estilos/cuestionarioSinPuntaje.css';
import { RUTAS } from '../../../rutas/rutas.ts';
import { AvisoSiempre } from '../viva/AvisoSiempre.tsx';
import { BarraDeAccion, BotonPrincipal, BotonSecundario } from '../viva/BarraDeAccion.tsx';
import { BarraDeProgreso } from '../viva/BarraDeProgreso.tsx';
import { mensajeAlElegir, mensajeDelPaso } from '../viva/mensajes.ts';
import { OpcionGrande } from '../viva/OpcionGrande.tsx';
import { PasoAnimado } from '../viva/PasoAnimado.tsx';
import { useMascotaDeLaPersona } from '../viva/mascotaDeLaPersona.ts';
import { useCierre } from '../viva/useCierre.tsx';
import { VozDeLaMascota } from '../viva/VozDeLaMascota.tsx';
import {
  leerLasPreguntas,
  type ParametrosDePreguntas,
  type PreguntaSinPuntaje,
} from './parametrosDelCuestionario.ts';
import type { PropsDeMecanica } from './registro.tsx';
import { SinSesion } from './SinSesion.tsx';

/**
 * «El descanso de manana» y «Quien me acompana» (SCRUM-227, fichas BIE-08 y EMO-08): preguntas cerradas, una a
 * la vez, con una opcion, varias o una hora. Es el motor `cuestionario_corto` en su modo `preguntas`.
 *
 * Es una actividad **sin puntaje y sin juicio**: ninguna respuesta suma ni se interpreta (R7), y **cada pregunta
 * se puede saltar**. Lo que dice la mascota no depende de lo que se contesta.
 *
 * - **Una opcion** (`opcion`): se elige una. **Varias** (`varias`): las que se quieran, o ninguna. **Una hora**
 *   (`hora`): con el campo de hora del propio dispositivo, sin opciones.
 * - **El aviso de siempre** (`avisoSiempre`) queda a la vista en todas las preguntas, y con `conLineasDeAyuda`
 *   (EMO-08) trae al lado el acceso a las lineas de atencion.
 * - **El aviso de la noche** (`enlaceAlAviso`): en la ultima pregunta se ofrece ir al perfil a activarlo, en otra
 *   pestana para no perder lo contestado. La persona decide; nada se activa solo.
 * - **Sin respaldo.** Vive de la sesion de hoy: sin una que entienda, lo dice.
 */

type Respuesta = string | readonly string[];

export function PreguntasDelDia({ sesion, ...props }: PropsDeMecanica) {
  const reglas = useMemo(() => leerLasPreguntas(sesion?.parametros), [sesion]);

  if (reglas === null) {
    return <SinSesion />;
  }

  return <Preguntas {...props} reglas={reglas} />;
}

function estaRespondida(pregunta: PreguntaSinPuntaje, respuesta: Respuesta | undefined): boolean {
  if (pregunta.tipo === 'varias') {
    // Ninguna tambien es una respuesta: se puede seguir sin marcar nada.
    return true;
  }

  return typeof respuesta === 'string' && respuesta !== '';
}

function Preguntas({
  alTerminar,
  enviando,
  reglas,
}: Omit<PropsDeMecanica, 'sesion'> & { readonly reglas: ParametrosDePreguntas }) {
  const mascota = useMascotaDeLaPersona();
  const { indicacion, preguntas, enlaceAlAviso, nota, cierre, avisoSiempre, conLineasDeAyuda } =
    reglas;
  const [paso, setPaso] = useState(0);
  const [direccion, setDireccion] = useState<1 | -1>(1);
  const [respuestas, setRespuestas] = useState<Readonly<Record<string, Respuesta>>>({});
  const [latido, setLatido] = useState(0);
  const { terminar, pantalla } = useCierre({ cierre, alTerminar, enviando });
  const idDelCampo = useId();
  const pregunta = preguntas[paso];

  if (pantalla !== null) {
    return pantalla;
  }

  if (pregunta === undefined) {
    return null;
  }

  const esLaUltima = paso === preguntas.length - 1;
  const respuesta = respuestas[pregunta.clave];
  const lista = Array.isArray(respuesta) ? (respuesta as string[]) : [];
  const contestadas = preguntas.filter(({ clave }) => respuestas[clave] !== undefined).length;

  function guardar(clave: string, valor: Respuesta | undefined) {
    setLatido((antes) => antes + 1);
    setRespuestas((antes) => {
      const { [clave]: _quitada, ...resto } = antes;

      return valor === undefined ? resto : { ...resto, [clave]: valor };
    });
  }

  function seguir(conLoContestado: Readonly<Record<string, Respuesta>>) {
    if (!esLaUltima) {
      setDireccion(1);
      setPaso((antes) => antes + 1);

      return;
    }

    terminar({ respuestas: conLoContestado });
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();

    if (pregunta !== undefined && estaRespondida(pregunta, respuesta)) {
      seguir(respuestas);
    }
  }

  function sinEsa(clave: string): Readonly<Record<string, Respuesta>> {
    const { [clave]: _quitada, ...resto } = respuestas;

    return resto;
  }

  function saltar() {
    if (pregunta !== undefined) {
      // Saltarla borra lo que se hubiera contestado antes, si se volvio atras.
      const resto = sinEsa(pregunta.clave);

      setRespuestas(resto);
      seguir(resto);
    }
  }

  function volver() {
    setLatido((antes) => antes + 1);
    setDireccion(-1);
    setPaso((antes) => Math.max(0, antes - 1));
  }

  return (
    <form className="viva" onSubmit={enviar} noValidate>
      <BarraDeProgreso
        paso={paso + 1}
        total={preguntas.length}
        hechos={contestadas}
        etiqueta="Pregunta"
      />

      <VozDeLaMascota
        mascota={mascota}
        mensaje={
          respuesta === undefined ? mensajeDelPaso(paso, preguntas.length) : mensajeAlElegir(paso)
        }
        expresion={paso === 0 && respuesta === undefined ? 'feliz' : 'normal'}
        latido={latido}
      />

      {avisoSiempre !== undefined && (
        <AvisoSiempre texto={avisoSiempre} conLineasDeAyuda={conLineasDeAyuda} />
      )}

      <PasoAnimado
        clave={pregunta.clave}
        direccion={direccion}
        titulo={pregunta.texto}
        {...(paso === 0 ? { ayuda: indicacion } : {})}
      >
        {pregunta.pista !== undefined && <p className="actividad__apoyo">{pregunta.pista}</p>}

        {pregunta.tipo === 'opcion' && (
          <div
            className="viva-opciones"
            role="radiogroup"
            aria-labelledby={`viva-titulo-${pregunta.clave}`}
          >
            {pregunta.opciones?.map((opcion) => (
              <OpcionGrande
                key={opcion.clave}
                tipo="radio"
                nombre={pregunta.clave}
                valor={opcion.clave}
                marcada={respuesta === opcion.clave}
                alCambiar={() => {
                  guardar(pregunta.clave, opcion.clave);
                }}
                texto={opcion.texto}
              />
            ))}
          </div>
        )}

        {pregunta.tipo === 'varias' && (
          <div
            className="viva-opciones"
            role="group"
            aria-labelledby={`viva-titulo-${pregunta.clave}`}
          >
            <p className="actividad__apoyo">Elige las que quieras, o ninguna.</p>
            {pregunta.opciones?.map((opcion) => (
              <OpcionGrande
                key={opcion.clave}
                tipo="checkbox"
                nombre={pregunta.clave}
                valor={opcion.clave}
                marcada={lista.includes(opcion.clave)}
                alCambiar={() => {
                  const nueva = lista.includes(opcion.clave)
                    ? lista.filter((otra) => otra !== opcion.clave)
                    : [...lista, opcion.clave];
                  const enOrden = (pregunta.opciones ?? [])
                    .map((una) => una.clave)
                    .filter((clave) => nueva.includes(clave));

                  // Sin marcar ninguna es una pregunta sin responder: no se manda como una lista vacia.
                  guardar(pregunta.clave, enOrden.length === 0 ? undefined : enOrden);
                }}
                texto={opcion.texto}
              />
            ))}
          </div>
        )}

        {pregunta.tipo === 'hora' && (
          <div className="hora-del-dia">
            <label className="hora-del-dia__etiqueta" htmlFor={idDelCampo}>
              Hora
            </label>
            <input
              id={idDelCampo}
              className="hora-del-dia__campo"
              type="time"
              value={typeof respuesta === 'string' ? respuesta : ''}
              onChange={(evento) => {
                guardar(
                  pregunta.clave,
                  evento.target.value === '' ? undefined : evento.target.value,
                );
              }}
            />
          </div>
        )}
      </PasoAnimado>

      {esLaUltima && enlaceAlAviso && (
        <p className="actividad__apoyo tarjeta-del-dia__enlace">
          Si quieres un aviso a esa hora, puedes activarlo en tu perfil cuando quieras.{' '}
          <a
            href={RUTAS.PERFIL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ir a mi perfil, donde se activa el aviso (se abre en otra pestaña)"
          >
            Ir a mi perfil
          </a>
        </p>
      )}

      {esLaUltima && nota !== undefined && <p className="actividad__apoyo">{nota}</p>}

      <BarraDeAccion>
        {paso > 0 && <BotonSecundario alPulsar={volver}>Atrás</BotonSecundario>}
        <BotonSecundario alPulsar={saltar}>Saltar</BotonSecundario>
        <BotonPrincipal
          tipo="submit"
          conFlecha={!esLaUltima}
          deshabilitado={!estaRespondida(pregunta, respuesta) || enviando}
        >
          {enviando ? 'Guardando…' : esLaUltima ? 'Terminar' : 'Continuar'}
        </BotonPrincipal>
      </BarraDeAccion>
    </form>
  );
}
