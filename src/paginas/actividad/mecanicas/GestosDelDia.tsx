import { useMemo, useState, type FormEvent } from 'react';

import { BarraDeAccion, BotonPrincipal } from '../viva/BarraDeAccion.tsx';
import { INICIO, elegir, mensajeAlElegir } from '../viva/mensajes.ts';
import { OpcionGrande } from '../viva/OpcionGrande.tsx';
import { useMascotaDeLaPersona } from '../viva/mascotaDeLaPersona.ts';
import { useCierre } from '../viva/useCierre.tsx';
import { VozDeLaMascota } from '../viva/VozDeLaMascota.tsx';
import { leerLosGestos, type ParametrosDeGestos } from './parametrosDelCuestionario.ts';
import type { PropsDeMecanica } from './registro.tsx';
import { SinSesion } from './SinSesion.tsx';

/**
 * «Antes de dormir» (SCRUM-227, ficha BIE-07): unos gestos que se marcan, los que se hicieron o se haran. Es el
 * motor `cuestionario_corto` en su modo `lista`, y solo sale de noche.
 *
 * Es una actividad **sin puntaje y sin juicio**: marcar todos, algunos o ninguno es una respuesta valida y
 * ninguna suma ni se interpreta (R7). Se termina con **«Listo» aunque no se marque nada**: un dia sin ninguno es
 * un dia, y obligar a marcar uno volveria la lista una exigencia.
 *
 * Sin respaldo: vive de la sesion de hoy, y sin una que entienda, lo dice.
 */

export function GestosDelDia({ sesion, ...props }: PropsDeMecanica) {
  const reglas = useMemo(() => leerLosGestos(sesion?.parametros), [sesion]);

  if (reglas === null) {
    return <SinSesion />;
  }

  return <Gestos {...props} reglas={reglas} />;
}

function Gestos({
  alTerminar,
  enviando,
  reglas,
}: Omit<PropsDeMecanica, 'sesion'> & { readonly reglas: ParametrosDeGestos }) {
  const mascota = useMascotaDeLaPersona();
  const { indicacion, items, nota, cierre } = reglas;
  const [marcados, setMarcados] = useState<readonly string[]>([]);
  const [latido, setLatido] = useState(0);
  const { terminar, pantalla } = useCierre({ cierre, alTerminar, enviando });

  if (pantalla !== null) {
    return pantalla;
  }

  function alternar(clave: string) {
    setLatido((antes) => antes + 1);
    setMarcados((antes) =>
      antes.includes(clave) ? antes.filter((otra) => otra !== clave) : [...antes, clave],
    );
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();

    // En el orden de la lista, no en el que se marcaron.
    terminar({
      marcados: items.map((item) => item.clave).filter((clave) => marcados.includes(clave)),
    });
  }

  return (
    <form className="viva" onSubmit={enviar} noValidate>
      <VozDeLaMascota
        mascota={mascota}
        mensaje={marcados.length === 0 ? elegir(INICIO, 0) : mensajeAlElegir(marcados.length)}
        expresion={marcados.length === 0 ? 'feliz' : 'normal'}
        latido={latido}
      />

      <fieldset className="viva-paso">
        <legend className="viva-paso__titulo viva-leyenda">{indicacion}</legend>

        <div className="viva-opciones">
          {items.map((item) => (
            <OpcionGrande
              key={item.clave}
              tipo="checkbox"
              nombre="gestos"
              valor={item.clave}
              marcada={marcados.includes(item.clave)}
              alCambiar={() => {
                alternar(item.clave);
              }}
              texto={item.texto}
            />
          ))}
        </div>
      </fieldset>

      <p className="actividad__apoyo">Puedes marcar todos, algunos o ninguno.</p>

      {nota !== undefined && <p className="actividad__apoyo">{nota}</p>}

      <BarraDeAccion>
        <BotonPrincipal tipo="submit" deshabilitado={enviando}>
          {enviando ? 'Guardando…' : 'Listo'}
        </BotonPrincipal>
      </BarraDeAccion>
    </form>
  );
}
