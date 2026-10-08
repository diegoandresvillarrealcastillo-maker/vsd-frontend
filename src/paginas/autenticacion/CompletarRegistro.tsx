import { useEffect, useState, type FormEvent } from 'react';
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
import { recordarQueElRegistroEstaCompleto } from '../../sesion/useRegistroCompleto.ts';
import { useSesion } from '../../sesion/useSesion.ts';
import { CamposDelRegistro } from './CamposDelRegistro.tsx';
import { Aparece, LienzoDeAcceso } from './LienzoDeAcceso.tsx';

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
  const [fecha, setFecha] = useState('');
  const [avisoAceptado, setAvisoAceptado] = useState(false);
  const [terminosAceptados, setTerminosAceptados] = useState(false);
  const [estado, setEstado] = useState<EstadoDeEnvio>('listo');
  const [error, setError] = useState<string | null>(null);
  const [errorDeLaFecha, setErrorDeLaFecha] = useState<string | undefined>(undefined);

  const persona = sesion?.user.id ?? null;

  // Quien ya tiene el registro completo no tiene nada que hacer aqui. Llega
  // pasando por la direccion directamente, o con el boton de atras.
  useEffect(() => {
    const control = new AbortController();

    consultarElEstadoDelRegistro(control.signal)
      .then((resultado) => {
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

        setComprobando(false);
      })
      .catch(() => {
        // Sin conexion no se sabe, y la pantalla sirve igual: la API manda.
        if (!control.signal.aborted) {
          setComprobando(false);
        }
      });

    return () => control.abort();
  }, [destino, navegar, persona]);

  function rechazar() {
    // La fecha se descarta: ya cumplio su funcion y no se guarda en ninguna parte.
    setFecha('');
    void navegar(RUTAS.SOLO_MAYORES, { replace: true });
    void salir();
  }

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

      setEstado('listo');
      setError(explicar(fallo));
      return;
    }

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
          onClick={() => void salir()}
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
