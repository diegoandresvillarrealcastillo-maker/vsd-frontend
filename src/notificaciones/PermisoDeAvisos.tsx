import { useEffect, useId, useRef, useState } from 'react';

import { useDialogo } from '../componentes/useDialogo.ts';
import '../estilos/tutorial.css';
import {
  consultarLasNotificaciones,
  suscribirEsteNavegador,
} from '../infraestructura/api/notificaciones.ts';
import { sprite } from '../mascota/sprites.ts';
import { avisosYaPreguntados, marcarQueYaSePregunto } from './memoriaDelPermiso.ts';
import {
  capacidadDelNavegador,
  PermisoNegadoError,
  permisoDeAvisos,
  suscribirNavegador,
} from './navegador.ts';

/**
 * La ventana que ofrece los avisos (SCRUM-188), despues del tutorial de bienvenida.
 *
 * ## Que ofrece y cuando
 *
 * - **Navegador que puede y permiso sin decidir:** explica que son los avisos y ofrece
 *   activarlos. El permiso **solo se pide con un clic** en «Activar avisos»: pedirlo al abrir la
 *   pagina es lo que los navegadores castigan y lo que la gente rechaza sin leer.
 * - **iPhone sin la aplicacion instalada:** alli el permiso no existe hasta instalarla en la
 *   pantalla de inicio. En vez de pedirlo, explica como instalarla.
 * - **Nada** si el navegador no recibe avisos, si ya hay permiso o ya se nego (no se puede volver
 *   a pedir: Perfil › Avisos lo explica), si el servidor todavia no tiene avisos, o si no hay
 *   conexion para saberlo. En esos casos no pinta ni un hueco.
 *
 * ## Sin insistir
 *
 * Se ofrece **una sola vez por cuenta y equipo**: cualquier respuesta —activar, «ahora no»,
 * Escape, «entendido»— la deja contestada. Un fallo de red no cuenta como respuesta: se vuelve
 * a ofrecer otro dia. Nada de esto toca lo que se elige en Perfil › Avisos.
 */

type Fase =
  | { readonly tipo: 'pensando' }
  | { readonly tipo: 'oculto' }
  | { readonly tipo: 'ofrecer'; readonly clavePublica: string }
  | { readonly tipo: 'instalar' }
  | { readonly tipo: 'resultado'; readonly activado: boolean };

const SIN_CONEXION =
  'No pudimos activarlos ahora. Revisa tu conexión e inténtalo de nuevo, o hazlo más tarde desde tu perfil.';

/**
 * Lo que se puede decidir sin preguntarle nada al servidor. Solo queda «pensando» cuando el
 * navegador puede y el permiso esta sin decidir: ahi si hace falta saber si hay avisos.
 */
function faseInicial(cuenta: string): Fase {
  if (avisosYaPreguntados(cuenta)) {
    return { tipo: 'oculto' };
  }

  const capacidad = capacidadDelNavegador();

  if (capacidad === 'sin-soporte') {
    return { tipo: 'oculto' };
  }

  if (capacidad === 'iphone-sin-instalar') {
    // Explicar como instalar no necesita al servidor.
    return { tipo: 'instalar' };
  }

  // El permiso ya se decidio: concedido, no hay nada que pedir; negado, no se puede volver a pedir.
  if (permisoDeAvisos() !== 'default') {
    return { tipo: 'oculto' };
  }

  return { tipo: 'pensando' };
}

export function PermisoDeAvisos({ cuenta }: { cuenta: string }) {
  const [fase, setFase] = useState<Fase>(() => faseInicial(cuenta));
  const pensando = fase.tipo === 'pensando';

  useEffect(() => {
    if (!pensando) {
      return undefined;
    }

    const control = new AbortController();

    consultarLasNotificaciones(control.signal).then(
      (datos) => {
        if (control.signal.aborted) {
          return;
        }

        setFase(
          datos.disponible && datos.clavePublica !== null
            ? { tipo: 'ofrecer', clavePublica: datos.clavePublica }
            : { tipo: 'oculto' },
        );
      },
      () => {
        // Sin conexion: no se pregunta ahora ni se da por contestado.
        if (!control.signal.aborted) {
          setFase({ tipo: 'oculto' });
        }
      },
    );

    return () => control.abort();
  }, [pensando]);

  if (fase.tipo === 'pensando' || fase.tipo === 'oculto') {
    return null;
  }

  return <Ventana cuenta={cuenta} fase={fase} alCerrar={() => setFase({ tipo: 'oculto' })} />;
}

function Ventana({
  cuenta,
  fase,
  alCerrar,
}: {
  cuenta: string;
  fase: Exclude<Fase, { tipo: 'pensando' } | { tipo: 'oculto' }>;
  alCerrar: () => void;
}) {
  const [resultado, setResultado] = useState<boolean | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const principal = useRef<HTMLButtonElement>(null);
  const idDelTitulo = useId();
  const idDelTexto = useId();

  /** Cualquier respuesta la deja contestada: no se vuelve a ofrecer sola. */
  function cerrar() {
    marcarQueYaSePregunto(cuenta);
    alCerrar();
  }

  const caja = useDialogo<HTMLDivElement>(cerrar, principal);

  async function activar(clavePublica: string) {
    setOcupado(true);
    setFallo(null);

    try {
      await suscribirEsteNavegador(await suscribirNavegador(clavePublica));
      marcarQueYaSePregunto(cuenta);
      setResultado(true);
    } catch (error) {
      if (error instanceof PermisoNegadoError) {
        // Decir que no es una respuesta valida: no se reprocha ni se vuelve a preguntar.
        marcarQueYaSePregunto(cuenta);
        setResultado(false);
      } else {
        setFallo(SIN_CONEXION);
      }
    } finally {
      setOcupado(false);
    }
  }

  let titulo: string;
  let texto: string;

  if (resultado === true) {
    titulo = 'Listo';
    texto =
      'Este dispositivo recibirá tus avisos. En tu perfil eliges cuáles quieres y a qué hora.';
  } else if (resultado === false) {
    titulo = 'No pasa nada';
    texto = 'Puedes activarlos cuando quieras desde tu perfil.';
  } else if (fase.tipo === 'instalar') {
    titulo = 'Para recibir avisos, instala la app';
    texto =
      'En iPhone los avisos solo funcionan con VSD Health en tu pantalla de inicio. Toca el botón de compartir de Safari y elige «Añadir a pantalla de inicio».';
  } else {
    titulo = '¿Quieres que te avisemos?';
    texto =
      'Podemos mandarte avisos aunque no tengas la app abierta: cuántos pendientes tienes o una invitación a tu momento del día. Nunca dicen nada de tu salud, y los apagas cuando quieras desde tu perfil.';
  }

  const terminado = resultado !== null;

  return (
    <div className="tutorial">
      <div
        ref={caja}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idDelTitulo}
        aria-describedby={idDelTexto}
        className="tutorial__caja"
      >
        <img
          className="tutorial__fungito"
          src={sprite('fungito', terminado && resultado ? 'celebrando' : 'normal')}
          alt=""
          width={120}
          height={120}
        />

        <h2 id={idDelTitulo} className="tutorial__titulo">
          {titulo}
        </h2>
        <p id={idDelTexto} className="tutorial__texto">
          {texto}
        </p>

        {fallo !== null && (
          <p className="tutorial__texto" role="alert">
            {fallo}
          </p>
        )}

        <div className="tutorial__acciones">
          {terminado || fase.tipo === 'instalar' ? (
            <div className="tutorial__navegacion">
              <button
                ref={principal}
                type="button"
                className="tutorial__boton tutorial__boton--principal"
                onClick={cerrar}
              >
                {terminado ? 'Cerrar' : 'Entendido'}
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="tutorial__omitir"
                onClick={cerrar}
                disabled={ocupado}
              >
                Ahora no
              </button>
              <div className="tutorial__navegacion">
                <button
                  ref={principal}
                  type="button"
                  className="tutorial__boton tutorial__boton--principal"
                  disabled={ocupado}
                  onClick={() => void activar(fase.tipo === 'ofrecer' ? fase.clavePublica : '')}
                >
                  Activar avisos
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
