import { useMemo, useRef, useState } from 'react';

import '../../../estilos/juegos.css';
import '../../../estilos/juegosDeCognicion.css';
import '../../../estilos/cognicion365.css';
import type { LoQueProduceLaActividad } from '../useCompletarActividad.ts';
import type { PropsDeMecanica } from './registro.tsx';
import { AtencionEnFlujo } from './AtencionEnFlujo.tsx';
import { CompletaLaPalabra } from './CompletaLaPalabra.tsx';
import { CuentasConCalma } from './CuentasConCalma.tsx';
import { DeduccionEspacial } from './DeduccionEspacial.tsx';
import { LoQueVi } from './LoQueVi.tsx';
import { OrdenaPorCategoria } from './OrdenaPorCategoria.tsx';
import { PalabraQueSobra } from './PalabraQueSobra.tsx';
import { RecuerdaLaLista } from './RecuerdaLaLista.tsx';
import { RazonamientoLogico } from './RazonamientoLogico.tsx';
import { SecuenciaDeCasillas } from './SecuenciaDeCasillas.tsx';
import { UnirLosPuntos } from './UnirLosPuntos.tsx';
import { leerRetoCompuesto } from './parametrosDeRetoCompuesto.ts';
import type { FaseDeRetoCompuesto } from './parametrosDeRetoCompuesto.ts';
import { SinSesion } from './SinSesion.tsx';

/** Recorre tres juegos diferentes conservando las instrucciones y la interacción propia de cada uno. */
export function RetoCompuestoCognitivo({ sesion, alTerminar, enviando }: PropsDeMecanica) {
  const reto = useMemo(() => leerRetoCompuesto(sesion?.parametros), [sesion]);
  const [indice, setIndice] = useState(0);
  const resultado = useRef({ score: 0, aciertos: 0, rondas: 0, segundos: 0 });
  const enviado = useRef(false);

  if (reto === null) {
    return <SinSesion />;
  }

  const terminarFase = (producido: LoQueProduceLaActividad) => {
    if (enviado.current) {
      return;
    }

    resultado.current = {
      score: resultado.current.score + (producido.score ?? 0),
      aciertos: resultado.current.aciertos + Number(producido.metadata?.aciertos ?? 0),
      rondas: resultado.current.rondas + Number(producido.metadata?.rondas ?? 0),
      segundos: resultado.current.segundos + Number(producido.metadata?.segundos ?? 0),
    };

    if (indice < reto.fases.length - 1) {
      setIndice(indice + 1);
      return;
    }

    enviado.current = true;
    alTerminar({
      score: Math.min(resultado.current.score, reto.puntosMaximos),
      metadata: {
        aciertos: resultado.current.aciertos,
        rondas: resultado.current.rondas,
        segundos: resultado.current.segundos,
        mecanica: 'reto_compuesto_cognitivo',
      },
    });
  };

  const fase = reto.fases[indice]!;

  return (
    <div className="juego cognicion365-compuesto">
      <p className="juego__marcador" aria-live="polite">
        Reto {indice + 1} de {reto.fases.length}
      </p>
      <JuegoDeFase fase={fase} alTerminar={terminarFase} enviando={enviando} />
    </div>
  );
}

function JuegoDeFase({
  fase,
  alTerminar,
  enviando,
}: {
  readonly fase: FaseDeRetoCompuesto;
  readonly alTerminar: (resultado: LoQueProduceLaActividad) => void;
  readonly enviando: boolean;
}) {
  const props = { alTerminar, enviando, sesion: fase.sesion };

  switch (fase.codigo) {
    case 'COG-01':
      return <SecuenciaDeCasillas {...props} />;
    case 'COG-02':
      return <PalabraQueSobra {...props} />;
    case 'COG-03':
      return <OrdenaPorCategoria {...props} />;
    case 'COG-04':
      return <CuentasConCalma {...props} />;
    case 'COG-05':
      return <AtencionEnFlujo {...props} />;
    case 'COG-06':
      return <RecuerdaLaLista {...props} />;
    case 'COG-07':
      return <CompletaLaPalabra {...props} />;
    case 'COG-08':
      return <UnirLosPuntos {...props} />;
    case 'COG-09':
      return <LoQueVi {...props} />;
    case 'COG-10':
      return <DeduccionEspacial {...props} />;
    case 'COG-11':
      return <RazonamientoLogico {...props} />;
  }
}
