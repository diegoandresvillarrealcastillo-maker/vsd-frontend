import { useId, useMemo, useState, type FormEvent } from 'react';

import '../../../estilos/cuestionarioSinPuntaje.css';
import { BarraDeAccion, BotonPrincipal } from '../viva/BarraDeAccion.tsx';
import { INICIO, elegir, mensajeAlElegir } from '../viva/mensajes.ts';
import { OpcionGrande } from '../viva/OpcionGrande.tsx';
import { useMascotaDeLaPersona } from '../viva/mascotaDeLaPersona.ts';
import { useCierre } from '../viva/useCierre.tsx';
import { VozDeLaMascota } from '../viva/VozDeLaMascota.tsx';
import { leerLaTarjeta, type ParametrosDeTarjeta } from './parametrosDelCuestionario.ts';
import type { PropsDeMecanica } from './registro.tsx';
import { SinSesion } from './SinSesion.tsx';

/**
 * «El habito de sueno de hoy», «Un cuidado pequeno de hoy» y «La caminata del dia» (SCRUM-227, fichas BIE-03,
 * BIE-04 y BIE-05): una practica del dia en una tarjeta y tres respuestas que **cuentan igual**. Es el motor
 * `cuestionario_corto` en su modo `tarjeta`.
 *
 * Es una actividad **sin puntaje y sin juicio**: probarlo, dejarlo para otro dia o no querer, todo es una respuesta
 * valida y ninguna suma ni se interpreta (R7). Lo que la mascota dice no depende de lo que se elige.
 *
 * - **Se propone, no se exige.** La tarjeta dice la practica y, si se quiere, su «por que» (un desplegable).
 * - **Sin respaldo.** Vive de la sesion de hoy: sin una que entienda, lo dice.
 */

export function TarjetaDelDia({ sesion, ...props }: PropsDeMecanica) {
  const reglas = useMemo(() => leerLaTarjeta(sesion?.parametros), [sesion]);

  if (reglas === null) {
    return <SinSesion />;
  }

  return <Tarjeta {...props} reglas={reglas} />;
}

function Tarjeta({
  alTerminar,
  enviando,
  reglas,
}: Omit<PropsDeMecanica, 'sesion'> & { readonly reglas: ParametrosDeTarjeta }) {
  const mascota = useMascotaDeLaPersona();
  const { indicacion, titulo, texto, porQue, opciones, nota, cierre } = reglas;
  const [elegida, setElegida] = useState<string | null>(null);
  const [latido, setLatido] = useState(0);
  const { terminar, pantalla } = useCierre({ cierre, alTerminar, enviando });
  const idDelTitulo = useId();
  const idDeLaPista = useId();

  if (pantalla !== null) {
    return pantalla;
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();

    if (elegida !== null) {
      terminar({ respuesta: elegida });
    }
  }

  return (
    <form className="viva" onSubmit={enviar} noValidate>
      <VozDeLaMascota
        mascota={mascota}
        mensaje={elegida === null ? elegir(INICIO, 0) : mensajeAlElegir(0)}
        expresion={elegida === null ? 'feliz' : 'normal'}
        latido={latido}
      />

      {indicacion !== undefined && <p className="actividad__texto">{indicacion}</p>}

      <article className="tarjeta-del-dia" aria-labelledby={idDelTitulo}>
        <h2 id={idDelTitulo} className="viva-paso__titulo">
          {titulo}
        </h2>
        <p className="tarjeta-del-dia__texto">{texto}</p>

        {porQue !== undefined && (
          <details className="tarjeta-del-dia__porque">
            <summary>¿Por qué?</summary>
            <p>{porQue}</p>
          </details>
        )}
      </article>

      <fieldset className="viva-paso">
        <legend className="viva-paso__titulo viva-leyenda">Tu respuesta</legend>

        <div className="viva-opciones" role="radiogroup" aria-label="Tu respuesta">
          {opciones.map((opcion) => (
            <OpcionGrande
              key={opcion.clave}
              tipo="radio"
              nombre="tarjeta"
              valor={opcion.clave}
              marcada={elegida === opcion.clave}
              alCambiar={() => {
                setElegida(opcion.clave);
                setLatido((antes) => antes + 1);
              }}
              texto={opcion.texto}
            />
          ))}
        </div>
      </fieldset>

      {nota !== undefined && <p className="actividad__apoyo">{nota}</p>}

      {elegida === null && (
        <p className="viva-falta" id={idDeLaPista}>
          Elige una respuesta para continuar.
        </p>
      )}

      <BarraDeAccion>
        <BotonPrincipal
          tipo="submit"
          deshabilitado={elegida === null || enviando}
          {...(elegida === null ? { descritoPor: idDeLaPista } : {})}
        >
          {enviando ? 'Guardando…' : 'Listo'}
        </BotonPrincipal>
      </BarraDeAccion>
    </form>
  );
}
