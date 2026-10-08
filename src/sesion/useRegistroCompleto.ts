import { useEffect, useState } from 'react';

import { consultarElEstadoDelRegistro } from '../infraestructura/api/registro.ts';

/**
 * Lo que se sabe del registro de quien tiene sesion, desde el punto de vista de
 * la ruta que quiere mostrarle algo.
 *
 * - `comprobando`: todavia no se sabe. No se muestra nada de la cuenta.
 * - `completo`: tiene su fecha de nacimiento y lo que acepto.
 * - `pendiente`: hay que llevarla a completar el registro. Es una persona que
 *   entro con Google, que confirmo su correo, o una cuenta anterior a que se
 *   pidiera.
 * - `sin-comprobar`: no se pudo preguntar (sin conexion, el servidor dormido).
 *   **No bloquea**: la aplicacion se puede usar sin conexion, y la API es la que
 *   de verdad manda: a una cuenta incompleta le responde 403 en todo lo demas.
 */
export type ComprobacionDelRegistro = 'comprobando' | 'completo' | 'pendiente' | 'sin-comprobar';

/**
 * La persona de la que ya se sabe que esta completa.
 *
 * Sin esto, cada cambio de pantalla preguntaria otra vez a la API algo que no
 * cambia: el registro solo avanza, nunca retrocede. Se guarda el identificador y
 * no un `true`, de modo que otra persona que entre en el mismo equipo se
 * comprueba por su cuenta.
 */
let completaPara: string | null = null;

/** Lo llama la pantalla que completa el registro, para no volver a preguntar. */
export function recordarQueElRegistroEstaCompleto(persona: string): void {
  completaPara = persona;
}

/** Para las pruebas: cada una parte sin saber nada. */
export function olvidarElRegistro(): void {
  completaPara = null;
}

interface Respuesta {
  readonly persona: string;
  readonly resultado: Exclude<ComprobacionDelRegistro, 'comprobando'>;
}

/**
 * Pregunta una vez por persona si su registro esta completo.
 *
 * @param activo Si de verdad hay que preguntar. Las rutas que no exigen el
 *   registro (la propia pantalla de completarlo) no lo piden.
 */
export function useRegistroCompleto(
  persona: string | null,
  activo: boolean,
): ComprobacionDelRegistro {
  const [respuesta, setRespuesta] = useState<Respuesta | null>(null);

  useEffect(() => {
    if (!activo || persona === null || completaPara === persona) {
      return undefined;
    }

    const control = new AbortController();

    consultarElEstadoDelRegistro(control.signal)
      .then((estado) => {
        if (control.signal.aborted) {
          return;
        }

        if (estado.estado === 'completo') {
          completaPara = persona;
        }

        setRespuesta({
          persona,
          resultado: estado.estado === 'completo' ? 'completo' : 'pendiente',
        });
      })
      .catch(() => {
        if (!control.signal.aborted) {
          setRespuesta({ persona, resultado: 'sin-comprobar' });
        }
      });

    return () => control.abort();
  }, [persona, activo]);

  if (persona !== null && completaPara === persona) {
    return 'completo';
  }

  // Una respuesta de otra persona no vale para esta.
  return respuesta !== null && respuesta.persona === persona ? respuesta.resultado : 'comprobando';
}
