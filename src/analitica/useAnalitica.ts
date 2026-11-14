import { useContext } from 'react';

import { AnaliticaContexto, type EstadoDeAnalitica } from './AnaliticaContexto.ts';

/** La analitica vista desde un componente. Sin proveedor, esta apagada. */
export function useAnalitica(): EstadoDeAnalitica {
  return useContext(AnaliticaContexto);
}
