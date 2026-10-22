import { useContext, useEffect, useState } from 'react';

import '../estilos/racha-celebracion.css';
import type { Racha } from '../infraestructura/api/racha.ts';
import { useMascotaDeLaPersona } from '../paginas/actividad/viva/mascotaDeLaPersona.ts';
import { SesionContexto } from '../sesion/SesionContexto.ts';
import { CelebracionDeLaRacha } from './CelebracionDeLaRacha.tsx';
import { DibujoDeLaLlama } from './DibujoDeLaLlama.tsx';
import { EnElCuerpo } from './EnElCuerpo.tsx';
import { momentoDeLaRacha, type MomentoDeLaRacha } from './momentoDeLaRacha.ts';
import { refrescarLaRacha } from './refrescarLaRacha.ts';

/** Cuanto se espera, despues de ver el resultado, para abrir la celebracion. */
const RETRASO_DE_LA_CELEBRACION_MS = 1_200;

/**
 * La racha al terminar una actividad (SCRUM-243).
 *
 * Al montarse —el resultado ya esta guardado— pide la racha otra vez y la compara con la que se
 * sabia: el cliente no cuenta dias. Si hoy acaba de sumar uno, **a los 1,2 s** abre la celebracion
 * (`CelebracionDeLaRacha`), y la persona decide cuando seguir. La segunda actividad del dia no
 * celebra otra vez.
 *
 * ## Cuando el resultado pide acompanar
 *
 * Con `celebrar` en falso —el resultado pide acompanar, o es de los que se leen con cuidado— **no hay
 * celebracion, ni confeti, ni llama que se enciende**: solo una linea tranquila con los dias. Las
 * lineas de atencion nunca quedan tapadas ni retrasadas por una fiesta, y una fiesta junto a «conviene
 * prestarle atencion» estaria fuera de lugar. Es la misma regla de `LogroDeLaActividad`.
 *
 * ## Lo que no se nota
 *
 * Si no hay sesion o cuenta, si no se pudo pedir la racha (sin conexion), o si no se sabia nada de
 * antes (no hay forma de saber si hoy ya habia sumado), no se pinta nada: la pantalla del resultado
 * sigue como siempre. La llama de la barra se actualiza sola con lo que llega (`refrescarLaRacha`).
 */
export function RachaDelDia({
  celebrar,
  silenciosa = false,
}: {
  celebrar: boolean;
  /**
   * El resultado salio de la cola (se guardo sin conexion y se envio despues): ni celebracion ni linea.
   * La persona puede estar leyendo otra cosa —o el aviso de sincronizacion, con una orientacion—, y la
   * llama de la barra se pone al dia sola con lo que llega.
   */
  silenciosa?: boolean;
}) {
  const sesion = useContext(SesionContexto);
  const cuenta = sesion?.sesion?.user.id ?? null;
  const mascota = useMascotaDeLaPersona();
  // Lo que se decide al terminar: cambiar `celebrar` despues no vuelve a pedir ni a celebrar.
  const [celebrarAlMontar] = useState(celebrar);
  const [hoy, setHoy] = useState<{ momento: MomentoDeLaRacha; racha: Racha } | null>(null);
  const [abierta, setAbierta] = useState(false);

  useEffect(() => {
    if (cuenta === null) {
      return undefined;
    }

    let vigente = true;
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const control = new AbortController();

    refrescarLaRacha(cuenta, control.signal)
      .then(({ antes, ahora }) => {
        const momento = momentoDeLaRacha(antes, ahora);

        if (!vigente || momento === null || silenciosa) {
          return;
        }

        setHoy({ momento, racha: ahora });

        if (celebrarAlMontar) {
          temporizador = setTimeout(() => {
            setAbierta(true);
          }, RETRASO_DE_LA_CELEBRACION_MS);
        }
      })
      .catch(() => {
        // Sin conexion o sin cuenta todavia: la pantalla del resultado no cambia.
      });

    return () => {
      vigente = false;
      control.abort();
      clearTimeout(temporizador);
    };
  }, [cuenta, celebrarAlMontar, silenciosa]);

  if (hoy === null) {
    return null;
  }

  if (abierta) {
    // En el cuerpo de la pagina y no dentro del contenido de la actividad, que apila lo suyo y dejaba la
    // celebracion por debajo de los avisos de sincronizacion, de version nueva y de analitica.
    return (
      <EnElCuerpo paleta="actividad">
        <CelebracionDeLaRacha
          momento={hoy.momento}
          racha={hoy.racha}
          mascota={mascota}
          alCerrar={() => {
            setAbierta(false);
          }}
        />
      </EnElCuerpo>
    );
  }

  if (celebrarAlMontar) {
    return null;
  }

  const nivel = Math.max(1, hoy.racha.nivel) as 1 | 2 | 3 | 4;

  return (
    <p className="actividad__racha" role="status">
      <span className={`actividad__racha-llama llama--nivel-${String(nivel)}`}>
        <DibujoDeLaLlama nivel={nivel} enDescanso={false} tamano={18} />
      </span>
      {`Racha: ${String(hoy.racha.dias)} ${hoy.racha.dias === 1 ? 'día' : 'días'}`}
    </p>
  );
}
