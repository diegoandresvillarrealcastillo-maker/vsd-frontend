import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';

import {
  iniciarUnaOperacionDeLaSesion,
  type OperacionDeLaSesion,
} from '../../sincronizacion/ciclo.ts';
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
  const enMarcha = useRef(new Set<AbortController>());

  // Al salir de la pantalla, lo que seguia en marcha se cancela (SCRUM-317).
  useEffect(() => {
    const pendientes = enMarcha.current;

    return () => {
      for (const control of pendientes) {
        control.abort();
      }
    };
  }, []);

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

  /**
   * Empieza una operacion de la persona que tiene la sesion ahora (subir o quitar). Se llama
   * **antes del primer `await`**: la `operacion` recuerda de quien es y deja de ser vigente si la
   * sesion cambia o se sale de la pantalla (SCRUM-317). La `senal` cancela las peticiones al salir.
   */
  function iniciarLaOperacion(): {
    readonly senal: AbortSignal;
    readonly operacion: OperacionDeLaSesion | null;
  } {
    const control = new AbortController();

    enMarcha.current.add(control);

    return { senal: control.signal, operacion: iniciarUnaOperacionDeLaSesion(control.signal) };
  }

  return {
    iniciarLaOperacion,
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
