import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { BotonDeEnvio, type EstadoDeEnvio } from '../../componentes/BotonDeEnvio.tsx';
import { consultarLosTextosVigentes } from '../../infraestructura/api/aviso.ts';
import { ErrorDeLaApi } from '../../infraestructura/api/clienteHttp.ts';
import {
  completarElRegistro,
  consultarElEstadoDelRegistro,
  esUnRechazoPorEdad,
} from '../../infraestructura/api/registro.ts';
import { RUTAS } from '../../rutas/rutas.ts';
import { evaluarLaFecha } from '../../sesion/edad.ts';
import {
  leerLaFechaDelRegistro,
  olvidarLaFechaDelRegistro,
} from '../../sesion/fechaDelRegistro.ts';
import { recordarQueElRegistroEstaCompleto } from '../../sesion/useRegistroCompleto.ts';
import { useSesion } from '../../sesion/useSesion.ts';
import { CamposDelRegistro } from './CamposDelRegistro.tsx';
import { Aparece, LienzoDeAcceso } from './LienzoDeAcceso.tsx';

const REGISTRO_CONFIRMADO = 'Correo confirmado. Tu cuenta quedó lista; ya puedes iniciar sesión.';

/**
 * Comprueba que ESTA identidad trae constancia de las mismas versiones que la
 * API mantiene vigentes. Esto no autoriza nada: `user_metadata` es editable y
 * la API vuelve a validar y guardar el consentimiento al crear la cuenta.
 */
function yaAceptoEstosTextos(
  metadatos: Record<string, unknown> | undefined,
  textos: { readonly aviso: string; readonly terminos: string },
): boolean {
  if (metadatos === undefined) {
    return false;
  }

  const aceptoEn = metadatos.acepto_en;

  return (
    metadatos.version_aviso === textos.aviso &&
    metadatos.version_terminos === textos.terminos &&
    typeof aceptoEn === 'string' &&
    Number.isFinite(Date.parse(aceptoEn))
  );
}

/** Lo que se le dice a la persona segun lo que respondio la API. */
function explicar(error: unknown): string {
  if (!(error instanceof ErrorDeLaApi)) {
    return 'No se pudo conectar con el servidor. Revisa tu conexión y vuelve a intentarlo.';
  }

  switch (error.codigo) {
    // Los textos cambiaron entre que se pidieron y que se enviaron. Reintentar
    // vuelve a pedirlos, que es exactamente lo que hay que hacer.
    case 'VERSION_DEL_AVISO_NO_VIGENTE':
    case 'VERSION_DE_LOS_TERMINOS_NO_VIGENTE':
      return 'El aviso de privacidad o los términos acaban de actualizarse. Vuelve a intentarlo para aceptar la versión actual.';

    case 'FECHA_DE_NACIMIENTO_INVALIDA':
      return 'Revisa tu fecha de nacimiento: tiene que ser una fecha real y que ya haya pasado.';

    case 'CORREO_YA_REGISTRADO':
      return 'Ese correo ya pertenece a una cuenta creada con otro método de acceso. Entra con el método que usaste la primera vez.';

    default:
      break;
  }

  if (error.estado === 401) {
    return 'Tu sesión caducó. Vuelve a entrar.';
  }

  if (error.estado === 429) {
    return 'Hiciste muchas peticiones seguidas. Espera un momento y vuelve a intentarlo.';
  }

  return `No se pudo completar tu registro (error ${error.estado}). Vuelve a intentarlo en un momento.`;
}

/**
 * «Completa tu registro»: la fecha de nacimiento y las dos casillas, para quien
 * tiene sesion y todavia no las dio (T-03 de la auditoria 360).
 *
 * Se llega aqui desde la ruta protegida cuando la API dice que falta el registro:
 *
 * - **Entro con Google**, que crea la identidad antes de que nadie pregunte nada.
 * - **Confirmo su correo** despues de registrarse, que es un paso aparte.
 * - **Tiene una cuenta de antes** de que se pidieran estas cosas.
 *
 * Antes el panel daba de alta por su cuenta, y por eso quien entraba con Google
 * quedaba con un consentimiento que nadie habia dado con una casilla. Ahora el
 * alta solo ocurre cuando la persona la pide, aqui.
 *
 * ## Lo que pasa con un menor
 *
 * Si la fecha dice que es menor, el dispositivo lo calcula y se muestra la
 * pantalla de rechazo **sin llamar a la API**: la fecha se descarta y no sale de
 * aqui. Si la API rechaza, es lo mismo, y ademas ella ya borro la identidad: se
 * cierra la sesion. Se navega **antes** de cerrarla, porque cerrarla primero
 * llevaria a esta ruta, protegida, de vuelta al acceso.
 */
export function CompletarRegistro() {
  const { sesion, salir } = useSesion();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const destino = (ubicacion.state as { volverA?: string } | null)?.volverA ?? RUTAS.PANEL;

  const [comprobando, setComprobando] = useState(true);
  // La fecha que se escribio al registrarse en este equipo, si es de esta cuenta (SCRUM-189):
  // no se pide otra vez. `null` en `fechaEscrita` quiere decir que la persona no ha tocado nada.
  const correo = sesion?.user.email;
  const delRegistro = useMemo(() => leerLaFechaDelRegistro(correo), [correo]);
  const [fechaEscrita, setFechaEscrita] = useState<string | null>(null);
  const fecha = fechaEscrita ?? delRegistro ?? '';
  const fechaYaDada = delRegistro !== null && fechaEscrita === null;
  const setFecha = setFechaEscrita;
  const [avisoAceptado, setAvisoAceptado] = useState(false);
  const [terminosAceptados, setTerminosAceptados] = useState(false);
  const [estado, setEstado] = useState<EstadoDeEnvio>('listo');
  const [error, setError] = useState<string | null>(null);
  const [errorDeLaFecha, setErrorDeLaFecha] = useState<string | undefined>(undefined);

  const persona = sesion?.user.id ?? null;

  const rechazar = useCallback(() => {
    // La fecha se descarta: ya cumplio su funcion y no se guarda en ninguna parte.
    olvidarLaFechaDelRegistro();
    setFechaEscrita('');
    void navegar(RUTAS.SOLO_MAYORES, { replace: true });
    void salir();
  }, [navegar, salir]);

  // Quien confirma el correo en el mismo navegador ya dio la fecha y acepto
  // las versiones vigentes al crear la identidad. En ese caso se completa la
  // cuenta sin pedirle lo mismo otra vez y se cierra la sesion nacida del
  // enlace: la siguiente pantalla es el acceso, como promete el registro.
  //
  // En otro navegador, para Google, cuentas antiguas o textos que cambiaron se
  // conserva el formulario. La API sigue siendo quien valida edad y versiones.
  useEffect(() => {
    const control = new AbortController();

    async function prepararElRegistro() {
      try {
        const resultado = await consultarElEstadoDelRegistro(control.signal);

        if (control.signal.aborted) {
          return;
        }

        if (resultado.estado === 'completo') {
          if (persona !== null) {
            recordarQueElRegistroEstaCompleto(persona);
          }

          void navegar(destino, { replace: true });
          return;
        }

        if (resultado.estado === 'sin-cuenta' && delRegistro !== null) {
          const textos = await consultarLosTextosVigentes(control.signal);

          if (control.signal.aborted) {
            return;
          }

          if (yaAceptoEstosTextos(sesion?.user.user_metadata, textos)) {
            await completarElRegistro({ fechaNacimiento: delRegistro, textos }, control.signal);

            if (control.signal.aborted) {
              return;
            }

            olvidarLaFechaDelRegistro();

            if (persona !== null) {
              recordarQueElRegistroEstaCompleto(persona);
            }

            await salir();
            void navegar(RUTAS.ACCESO, {
              replace: true,
              state: { confirmacion: REGISTRO_CONFIRMADO },
            });
            return;
          }
        }
      } catch (fallo) {
        if (control.signal.aborted) {
          return;
        }

        if (esUnRechazoPorEdad(fallo)) {
          rechazar();
          return;
        }

        // Sin conexion o con datos antiguos no se acepta nada por deduccion:
        // el formulario queda disponible y la API sigue mandando.
      }

      if (!control.signal.aborted) {
        setComprobando(false);
      }
    }

    void prepararElRegistro();

    return () => control.abort();
  }, [delRegistro, destino, navegar, persona, rechazar, salir, sesion?.user.user_metadata]);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    setErrorDeLaFecha(undefined);

    const evaluacion = evaluarLaFecha(fecha);

    if (evaluacion === 'vacia') {
      setErrorDeLaFecha('Escribe tu fecha de nacimiento.');
      return;
    }

    if (evaluacion === 'invalida') {
      setErrorDeLaFecha(
        'Revisa tu fecha de nacimiento: tiene que ser una fecha real y que ya haya pasado.',
      );
      return;
    }

    if (evaluacion === 'menor') {
      rechazar();
      return;
    }

    if (!avisoAceptado || !terminosAceptados) {
      return;
    }

    setEstado('enviando');

    try {
      // Las versiones las dice la API, que es su unica fuente. Si no se pueden
      // saber, no se registra a nadie: aceptar un texto sin version es aceptar
      // algo que nadie puede demostrar.
      const textos = await consultarLosTextosVigentes();

      await completarElRegistro({ fechaNacimiento: fecha, textos });
    } catch (fallo) {
      if (esUnRechazoPorEdad(fallo)) {
        rechazar();
        return;
      }

      // La API dice que la fecha no sirve: la recordada tampoco, y se deja escribir otra.
      if (fallo instanceof ErrorDeLaApi && fallo.codigo === 'FECHA_DE_NACIMIENTO_INVALIDA') {
        olvidarLaFechaDelRegistro();
        setFecha('');
      }

      setEstado('listo');
      setError(explicar(fallo));
      return;
    }

    // Cumplio su funcion: ya la tiene la API y no hay por que dejarla en el dispositivo.
    olvidarLaFechaDelRegistro();

    if (persona !== null) {
      recordarQueElRegistroEstaCompleto(persona);
    }

    setEstado('hecho');
    void navegar(destino, { replace: true });
  }

  if (comprobando) {
    return (
      <p role="status" aria-live="polite" className="solo-lectores">
        Comprobando tu registro
      </p>
    );
  }

  const ocupado = estado !== 'listo';
  const puedeEnviar = avisoAceptado && terminosAceptados;

  return (
    <LienzoDeAcceso
      titulo="Completa tu registro"
      entradilla="Un último paso. Para cuidar tus datos necesitamos tu fecha de nacimiento y que aceptes cómo los tratamos."
      pie={
        <button
          type="button"
          className="acceso__enlace acceso__enlace--boton"
          disabled={ocupado}
          onClick={() => {
            olvidarLaFechaDelRegistro();
            void salir();
          }}
        >
          Prefiero no continuar y cerrar la sesión
        </button>
      }
    >
      <form className="acceso__formulario" onSubmit={(e) => void enviar(e)} noValidate>
        {error !== null && (
          <Aparece>
            <p className="aviso aviso--error" role="alert">
              {error}
            </p>
          </Aparece>
        )}

        <CamposDelRegistro
          fecha={fecha}
          alCambiarLaFecha={setFecha}
          errorDeLaFecha={errorDeLaFecha}
          avisoAceptado={avisoAceptado}
          alCambiarElAviso={setAvisoAceptado}
          terminosAceptados={terminosAceptados}
          alCambiarLosTerminos={setTerminosAceptados}
          disabled={ocupado}
          alPedirOtraFecha={
            fechaYaDada
              ? () => {
                  setFechaEscrita('');
                }
              : undefined
          }
        />

        <Aparece>
          {/* Sin las dos casillas no hay base legal para guardar un solo dato de
              salud, asi que el boton no deja continuar. La API lo vuelve a
              comprobar: esto es comodidad, no el control. */}
          <BotonDeEnvio estado={puedeEnviar ? estado : 'listo'} textoAlTerminar="Registro completo">
            Continuar
          </BotonDeEnvio>
        </Aparece>

        {!puedeEnviar && (
          <Aparece>
            <p className="campo__ayuda">
              Para continuar hace falta aceptar el aviso de privacidad y los términos.
            </p>
          </Aparece>
        )}
      </form>
    </LienzoDeAcceso>
  );
}
