import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';

import type { Aviso } from './piezas.tsx';

/**
 * Lo que comparten las dos entradas de archivo del perfil, la foto (`TuFoto`) y la mascota propia
 * (`TuMascotaPropia`): si esta guardando o quitando, el aviso que se le muestra, la entrada misma
 * y a donde va el foco cuando se quita lo que habia.
 */
export function useEntradaDeArchivo() {
  const [ocupado, setOcupado] = useState<'guardando' | 'quitando' | null>(null);
  const [aviso, setAviso] = useState<Aviso>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const enfocarAlTerminar = useRef(false);
  const idDeLaEntrada = useId();

  // El boton de quitar desaparece con lo que se quita, y con el se iria el foco de quien navega
  // con teclado. Se lleva a la entrada, pero solo cuando ya no esta deshabilitada: una entrada
  // deshabilitada no recibe el foco.
  useEffect(() => {
    if (ocupado === null && enfocarAlTerminar.current) {
      enfocarAlTerminar.current = false;
      entrada.current?.focus();
    }
  }, [ocupado]);

  /** Pide que, al terminar de quitar, el foco pase a la entrada. */
  function enfocarLaEntradaAlTerminar(): void {
    enfocarAlTerminar.current = true;
  }

  /**
   * El archivo que eligio la persona, o `undefined` si cerro el selector sin elegir. Al elegir deja
   * todo en «guardando» y sin aviso; lo que sigue (comprobar, subir, avisar) lo hace quien lo llama.
   */
  function tomarElArchivo(evento: ChangeEvent<HTMLInputElement>): File | undefined {
    const elegido = evento.target.files?.[0];

    // Se vacia para que elegir el mismo archivo otra vez cuente como un cambio.
    evento.target.value = '';

    if (elegido === undefined) {
      return undefined;
    }

    setOcupado('guardando');
    setAviso(null);

    return elegido;
  }

  return {
    ocupado,
    setOcupado,
    aviso,
    setAviso,
    entrada,
    enfocarLaEntradaAlTerminar,
    idDeLaEntrada,
    tomarElArchivo,
  };
}
