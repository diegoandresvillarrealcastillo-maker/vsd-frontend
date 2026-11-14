import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { BotonDeEnvio, type EstadoDeEnvio } from '../../componentes/BotonDeEnvio.tsx';
import { Campo } from '../../componentes/Campo.tsx';
import { Casilla } from '../../componentes/Casilla.tsx';
import { consultarLosTextosVigentes } from '../../infraestructura/api/aviso.ts';
import { ErrorDeLaApi } from '../../infraestructura/api/clienteHttp.ts';
import {
  borrarMiCuenta,
  FRASE_PARA_BORRAR,
  type TextoPendiente,
} from '../../infraestructura/api/cuenta.ts';
import {
  aceptarLosTextos,
  consultarElEstadoDelRegistro,
} from '../../infraestructura/api/registro.ts';
import { RUTAS } from '../../rutas/rutas.ts';
import { olvidarLosDatosDeLaSesionActual } from '../../sincronizacion/ciclo.ts';
import { recordarQueElRegistroEstaCompleto } from '../../sesion/useRegistroCompleto.ts';
import { useSesion } from '../../sesion/useSesion.ts';
import { EnlaceAlDocumento } from './CamposDelRegistro.tsx';
import { Aparece, LienzoDeAcceso } from './LienzoDeAcceso.tsx';

const LOS_DOS: readonly TextoPendiente[] = ['aviso_de_privacidad', 'terminos'];

/** Lo que se le dice a la persona segun lo que respondio la API. */
function explicar(error: unknown): string {
  if (!(error instanceof ErrorDeLaApi)) {
    return 'No se pudo conectar con el servidor. Revisa tu conexión y vuelve a intentarlo.';
  }

  switch (error.codigo) {
    // Los textos cambiaron otra vez entre que se pidieron y que se enviaron. Reintentar vuelve a
    // pedir las versiones, que es exactamente lo que hay que hacer.
    case 'VERSION_DEL_AVISO_NO_VIGENTE':
    case 'VERSION_DE_LOS_TERMINOS_NO_VIGENTE':
      return 'El aviso de privacidad o los términos acaban de actualizarse. Vuelve a intentarlo para aceptar la versión actual.';

    default:
      break;
  }

  if (error.estado === 401) {
    return 'Tu sesión caducó. Vuelve a entrar.';
  }

  if (error.estado === 429) {
    return 'Hiciste muchas peticiones seguidas. Espera un momento y vuelve a intentarlo.';
  }

  return `No se pudo guardar tu aceptación (error ${error.estado}). Vuelve a intentarlo en un momento.`;
}

/** «el aviso de privacidad», «los términos» o «el aviso de privacidad y los términos». */
function queCambio(pendientes: readonly TextoPendiente[]): string {
  const aviso = pendientes.includes('aviso_de_privacidad');
  const terminos = pendientes.includes('terminos');

  if (aviso && terminos) {
    return 'el aviso de privacidad y los términos';
  }

  return aviso ? 'el aviso de privacidad' : 'los términos';
}

/**
 * «Actualizamos nuestros textos»: volver a aceptar el aviso de privacidad o los terminos cuando
 * cambiaron (SCRUM-237).
 *
 * El aviso y los terminos prometen «si cambian, te pediremos que la aceptes de nuevo». Se llega aqui
 * desde la ruta protegida cuando la API dice que la version que la persona acepto ya no es la
 * vigente, o cuando cualquier llamada recibe un 403 `TEXTOS_PENDIENTES_DE_ACEPTAR`.
 *
 * - **Pide solo lo que cambio**, con las mismas casillas y los mismos enlaces que el registro: lo que
 *   se acepta no puede depender de por donde se entro. Sin marcar todo lo que se muestra, no se manda
 *   nada.
 * - **Las versiones las dice la API**, como en el registro: aceptar un texto sin version es aceptar
 *   algo que nadie puede demostrar.
 * - **No aceptar es una decision valida.** Nada se borra por no aceptar, y la persona puede irse sin
 *   quedar atrapada aqui: cerrar la sesion, o borrar su cuenta (la API deja ver, exportar y borrar la
 *   cuenta aunque haya textos pendientes). Lo que hizo sin conexion se queda guardado y se envia si
 *   un dia acepta.
 * - **El registro incompleto va primero**, igual que en la API: si falta la fecha de nacimiento, se
 *   lleva a completarlo.
 */
export function ActualizamosNuestrosTextos() {
  const { sesion, salir } = useSesion();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const destino = (ubicacion.state as { volverA?: string } | null)?.volverA ?? RUTAS.PANEL;
  const persona = sesion?.user.id ?? null;

  // `null`: todavia no se sabe cual de los dos cambio.
  const [pendientes, setPendientes] = useState<readonly TextoPendiente[] | null>(null);
  const [marcadas, setMarcadas] = useState<Readonly<Record<TextoPendiente, boolean>>>({
    aviso_de_privacidad: false,
    terminos: false,
  });
  const [estado, setEstado] = useState<EstadoDeEnvio>('listo');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const control = new AbortController();

    consultarElEstadoDelRegistro(control.signal)
      .then((resultado) => {
        if (control.signal.aborted) {
          return;
        }

        if (resultado.estado === 'textos-pendientes') {
          setPendientes(resultado.pendientes);
          return;
        }

        if (resultado.estado === 'completo') {
          // Quien esta al dia no tiene nada que hacer aqui: llego por la direccion o con el boton de atras.
          if (persona !== null) {
            recordarQueElRegistroEstaCompleto(persona);
          }

          void navegar(destino, { replace: true });
          return;
        }

        // Antes de volver a aceptar nada hay que completar el registro.
        void navegar(RUTAS.COMPLETAR_REGISTRO, { replace: true, state: { volverA: destino } });
      })
      .catch(() => {
        // Sin conexion no se sabe cual cambio, y la pantalla sirve igual: la API manda y ignora lo
        // que no estaba pendiente.
        if (!control.signal.aborted) {
          setPendientes(LOS_DOS);
        }
      });

    return () => control.abort();
  }, [destino, navegar, persona]);

  if (pendientes === null) {
    return (
      <p role="status" aria-live="polite" className="solo-lectores">
        Comprobando tus textos
      </p>
    );
  }

  const ocupado = estado !== 'listo';
  const todoMarcado = pendientes.every((texto) => marcadas[texto]);
  const solo = pendientes.length === 1;

  function marcar(texto: TextoPendiente, valor: boolean) {
    setMarcadas((antes) => ({ ...antes, [texto]: valor }));
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setError(null);

    if (pendientes === null || !todoMarcado) {
      return;
    }

    setEstado('enviando');

    try {
      // Las versiones las dice la API, que es su unica fuente.
      const textos = await consultarLosTextosVigentes();

      await aceptarLosTextos({ pendientes, textos });
    } catch (fallo) {
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

  return (
    <LienzoDeAcceso
      titulo="Actualizamos nuestros textos"
      entradilla={`Cambiamos ${queCambio(pendientes)}. Para seguir usando VSD Health necesitamos que ${solo && pendientes[0] === 'aviso_de_privacidad' ? 'lo leas y lo aceptes' : 'los leas y los aceptes'} de nuevo. Si prefieres no aceptar, no se borra nada: puedes cerrar la sesión o borrar tu cuenta.`}
      pie={
        <>
          <button
            type="button"
            className="acceso__enlace acceso__enlace--boton"
            disabled={ocupado}
            onClick={() => {
              void salir();
            }}
          >
            Prefiero no aceptar y cerrar la sesión
          </button>
          <BorrarDesdeAqui />
        </>
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

        {pendientes.includes('aviso_de_privacidad') && (
          <Aparece>
            <Casilla
              etiqueta="Acepto el aviso de privacidad y el tratamiento de mis datos"
              nota={
                <>
                  VSD Health maneja información relacionada con tu bienestar, que la ley considera
                  sensible.{' '}
                  <EnlaceAlDocumento ruta={RUTAS.PRIVACIDAD}>
                    Leer el aviso de privacidad
                  </EnlaceAlDocumento>
                </>
              }
              marcada={marcadas.aviso_de_privacidad}
              disabled={ocupado}
              onChange={(valor) => marcar('aviso_de_privacidad', valor)}
            />
          </Aparece>
        )}

        {pendientes.includes('terminos') && (
          <Aparece>
            <Casilla
              etiqueta="Acepto los términos y condiciones"
              nota={
                <>
                  VSD Health no formula, no diagnostica y no reemplaza a un especialista médico.{' '}
                  <EnlaceAlDocumento ruta={RUTAS.TERMINOS}>Leer los términos</EnlaceAlDocumento>
                </>
              }
              marcada={marcadas.terminos}
              disabled={ocupado}
              onChange={(valor) => marcar('terminos', valor)}
            />
          </Aparece>
        )}

        <Aparece>
          {/* Sin marcar todo lo que cambio no hay autorizacion expresa, asi que el boton no deja
              continuar. La API lo vuelve a comprobar: esto es comodidad, no el control. */}
          <BotonDeEnvio estado={todoMarcado ? estado : 'listo'} textoAlTerminar="Listo">
            Aceptar y continuar
          </BotonDeEnvio>
        </Aparece>

        {!todoMarcado && (
          <Aparece>
            <p className="campo__ayuda">Hace falta aceptar para seguir usando VSD Health.</p>
          </Aparece>
        )}
      </form>
    </LienzoDeAcceso>
  );
}

/**
 * «Quiero borrar mi cuenta», plegado: para quien no quiere aceptar y prefiere irse del todo.
 *
 * Pide la frase exacta, igual que el perfil y que la API. Si la API la borra, tambien se olvida todo
 * lo que este equipo guardaba de ella, **antes** de cerrar la sesion, para que no dependa de que
 * cerrarla salga bien. Si no la borra, no se toca nada.
 */
function BorrarDesdeAqui() {
  const { salir } = useSesion();
  const navegar = useNavigate();
  const [frase, setFrase] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function borrar(evento: FormEvent) {
    evento.preventDefault();

    if (frase !== FRASE_PARA_BORRAR) {
      return;
    }

    setOcupado(true);
    setError(null);

    try {
      await borrarMiCuenta(frase);
      await olvidarLosDatosDeLaSesionActual();
      await salir();
      void navegar(RUTAS.INICIO, { replace: true });
    } catch (fallo) {
      setOcupado(false);
      setError(
        fallo instanceof ErrorDeLaApi && fallo.codigo === 'BORRADO_NO_COMPLETADO'
          ? 'No se pudo borrar la cuenta en este momento, así que no se borró nada. Inténtalo en unos minutos.'
          : 'No se pudo borrar la cuenta. Revisa tu conexión e inténtalo de nuevo.',
      );
    }
  }

  return (
    <details className="acceso__detalles">
      <summary className="acceso__enlace">Quiero borrar mi cuenta</summary>

      <form className="acceso__formulario" onSubmit={(e) => void borrar(e)} noValidate>
        <p className="campo__ayuda">
          Se borran tu cuenta, tus resultados, tu diario y tu acceso. Solo queda una constancia de
          lo que aceptaste y cuándo, sin tu nombre ni tu correo: la ley nos pide poder demostrarlo.
          No tiene vuelta atrás.
        </p>

        {error !== null && (
          <p className="aviso aviso--error" role="alert">
            {error}
          </p>
        )}

        <Campo
          etiqueta={`Para confirmar, escribe ${FRASE_PARA_BORRAR}`}
          autoComplete="off"
          value={frase}
          disabled={ocupado}
          onChange={(evento) => setFrase(evento.target.value)}
        />

        <button
          type="submit"
          className="acceso__peligro"
          disabled={ocupado || frase !== FRASE_PARA_BORRAR}
        >
          {ocupado ? 'Borrando…' : 'Borrar mi cuenta para siempre'}
        </button>
      </form>
    </details>
  );
}
