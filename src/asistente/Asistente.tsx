import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from 'react';

import { useDialogo } from '../componentes/useDialogo.ts';
import { useEnLinea } from '../conexion/useEnLinea.ts';
import '../estilos/actividad.css';
import '../estilos/asistente.css';
import {
  LARGO_MAXIMO_DE_LA_PREGUNTA,
  type Recurso,
  type RespuestaDelAsistente,
} from '../infraestructura/api/asistente.ts';
import { LineasDeAtencion } from '../paginas/actividad/LineasDeAtencion.tsx';
import {
  DIRECTORIO_INTERNACIONAL,
  esZonaDeColombia,
  lineasDeRespaldo,
} from '../paginas/actividad/lineasParaMostrar.ts';
import type { ReglasLocales } from '../infraestructura/api/reglasLocales.ts';
import { zonaActual } from '../tiempo/zonaHoraria.ts';
import type { Marco } from './marco.ts';
import { lineasDeLaZona } from './reglasLocales.ts';
import { useConversacion, type Mensaje, type MotivoDelFallo } from './useConversacion.ts';
import { useReglasLocales } from './useReglasLocales.ts';

/**
 * VSD IA, el asistente que se abre desde la mascota (SCRUM-100).
 *
 * - Usa el asistente por reglas del backend tal cual: sus intenciones, sus
 *   recursos y su deteccion de riesgo, que va siempre primero. Si el texto
 *   tiene una senal de riesgo, la respuesta ensena siempre las lineas de
 *   atencion.
 * - Lo escrito no se guarda: vive en memoria mientras esta abierto y se
 *   olvida al cerrarlo.
 * - Nunca se queda cargando: sin conexion, o si tarda demasiado, lo dice. Y
 *   como entonces no se sabe que habria respondido, deja a mano las dos
 *   lineas nacionales.
 * - Se abre a la vez que la mascota vuela a su esquina. Con
 *   `prefers-reduced-motion`, aparece sin desplazarse.
 * - **Sin conexion es un asistente mixto** (SCRUM-141): responde un saludo, un
 *   agradecimiento, una despedida, donde buscar ayuda y las lineas de atencion si hay una
 *   senal de riesgo, con lo que el servidor publico y este dispositivo guardo. Lo demas
 *   exige conexion y lo dice. Cada respuesta dada asi lo dice tambien.
 */

/** Para empezar: una por cada cosa que el asistente sabe responder. */
const SUGERENCIAS = [
  '¿Cómo puedo dormir mejor?',
  '¿Qué significa mi resultado?',
  '¿Dónde busco ayuda?',
] as const;

const TEXTO_DEL_FALLO: Readonly<Record<MotivoDelFallo, string>> = {
  'sin-conexion': 'No tienes conexión, así que no pude responderte.',
  // Hay con que responder lo basico, pero esto no es basico (SCRUM-141).
  'exige-conexion': 'Esto lo puedo responder cuando tengas conexión.',
  tarda: 'Estoy tardando más de la cuenta en responder.',
  muchas: 'Vas más rápido de lo que puedo responder. Espera un momento.',
  otro: 'Algo falló y no pude responderte.',
};

/** Lo que se dice arriba mientras no hay conexion y hay con que responder lo basico. */
const AVISO_SIN_CONEXION =
  'Sin conexión. Puedo saludarte y decirte dónde buscar ayuda; lo demás lo respondo cuando vuelvas a tener conexión.';

export function Asistente({
  marco,
  ladoDeLaMascota,
  nombreDeLaMascota,
  alCerrar,
}: {
  marco: Marco;
  ladoDeLaMascota: number;
  nombreDeLaMascota: string;
  alCerrar: () => void;
}) {
  const sinMovimiento = useReducedMotion() ?? false;
  const campo = useRef<HTMLTextAreaElement>(null);
  const caja = useDialogo<HTMLDivElement>(alCerrar, campo);
  const final = useRef<HTMLDivElement>(null);
  const idDelTitulo = useId();
  const idDelCampo = useId();
  const [texto, setTexto] = useState('');
  const reglas = useReglasLocales();
  const enLinea = useEnLinea();
  const { mensajes, esperando, enviar } = useConversacion(reglas, nombreDeLaMascota);

  // Lo ultimo siempre a la vista.
  useEffect(() => {
    final.current?.scrollIntoView({ block: 'end' });
  }, [mensajes, esperando]);

  function mandar(pregunta: string) {
    if (pregunta.trim() === '' || esperando) {
      return;
    }

    setTexto('');
    void enviar(pregunta);
    campo.current?.focus();
  }

  function alEnviar(evento: FormEvent) {
    evento.preventDefault();
    mandar(texto);
  }

  const estilo = {
    left: marco.left,
    top: marco.top,
    width: marco.width,
    height: marco.height,
    '--lado-de-la-mascota': `${ladoDeLaMascota}px`,
  } as CSSProperties;

  return (
    <div className="asistente-velo" onClick={alCerrar}>
      {/* El marco lo pone en su sitio; dentro, lo que se anima. */}
      <div
        className="asistente-marco"
        style={estilo}
        onClick={(evento) => evento.stopPropagation()}
      >
        <motion.div
          ref={caja}
          role="dialog"
          aria-modal="true"
          aria-labelledby={idDelTitulo}
          className="asistente"
          // Crece desde la esquina donde se posa la mascota. Sin movimiento,
          // solo aparece.
          initial={sinMovimiento ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={
            sinMovimiento ? { duration: 0.15 } : { type: 'spring', stiffness: 380, damping: 32 }
          }
        >
          <header className="asistente__cabecera">
            <div>
              <h2 id={idDelTitulo} className="asistente__titulo">
                VSD IA
              </h2>
              <p className="asistente__subtitulo">Con {nombreDeLaMascota}</p>
            </div>
            <button
              type="button"
              className="asistente__cerrar"
              aria-label="Cerrar VSD IA"
              onClick={alCerrar}
            >
              ×
            </button>
          </header>

          <div className="asistente__conversacion">
            {!enLinea && reglas !== null && (
              <p className="asistente__sin-conexion" role="status">
                {AVISO_SIN_CONEXION}
              </p>
            )}

            <p className="asistente__nota">
              Pregúntame por tu descanso, por lo que significa un resultado o por dónde buscar
              ayuda. Lo que escribas aquí no se guarda.
            </p>

            {mensajes.length === 0 && (
              <ul className="asistente__sugerencias" aria-label="Para empezar">
                {SUGERENCIAS.map((sugerencia) => (
                  <li key={sugerencia}>
                    <button
                      type="button"
                      className="asistente__sugerencia"
                      onClick={() => mandar(sugerencia)}
                    >
                      {sugerencia}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Un registro: lo nuevo se anuncia sin interrumpir. */}
            <ol className="asistente__mensajes" role="log" aria-label="Conversación">
              {mensajes.map((mensaje) => (
                <li
                  key={mensaje.id}
                  className={`asistente__mensaje asistente__mensaje--${mensaje.de}`}
                >
                  <ContenidoDelMensaje
                    mensaje={mensaje}
                    reglas={reglas}
                    esperando={esperando}
                    alReintentar={(pregunta) => void enviar(pregunta, { reintento: true })}
                  />
                </li>
              ))}
            </ol>

            {esperando && (
              <p className="asistente__esperando" role="status">
                Pensando…
              </p>
            )}

            <div ref={final} />
          </div>

          <form className="asistente__formulario" onSubmit={alEnviar}>
            <label htmlFor={idDelCampo} className="solo-lectores">
              Escribe tu pregunta
            </label>
            <textarea
              ref={campo}
              id={idDelCampo}
              className="asistente__campo"
              rows={2}
              value={texto}
              maxLength={LARGO_MAXIMO_DE_LA_PREGUNTA}
              placeholder="Escribe aquí…"
              autoComplete="off"
              onChange={(evento) => setTexto(evento.target.value)}
              onKeyDown={(evento) => {
                // Enter envia; Mayus+Enter, salto de linea.
                if (evento.key === 'Enter' && !evento.shiftKey) {
                  evento.preventDefault();
                  mandar(texto);
                }
              }}
            />
            <button
              type="submit"
              className="asistente__enviar"
              disabled={esperando || texto.trim() === ''}
            >
              Enviar
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

function ContenidoDelMensaje({
  mensaje,
  reglas,
  esperando,
  alReintentar,
}: {
  mensaje: Mensaje;
  reglas: ReglasLocales | null;
  esperando: boolean;
  alReintentar: (pregunta: string) => void;
}) {
  switch (mensaje.de) {
    case 'persona':
      return (
        <p>
          <span className="solo-lectores">Tú: </span>
          {mensaje.texto}
        </p>
      );
    case 'asistente':
      return <Respuesta respuesta={mensaje.respuesta} sinConexion={mensaje.sinConexion} />;
    case 'fallo':
      return (
        <div className="asistente__fallo" role="alert">
          <p>{TEXTO_DEL_FALLO[mensaje.motivo]}</p>
          <button
            type="button"
            className="asistente__reintentar"
            disabled={esperando}
            onClick={() => alReintentar(mensaje.pregunta)}
          >
            Reintentar
          </button>
          <p className="asistente__respaldo">
            <RespaldoDelFallo reglas={reglas} />
          </p>
        </div>
      );
  }
}

/**
 * Los telefonos a mano cuando no se pudo responder (SCRUM-124).
 *
 * Como no se sabe que habria respondido el servidor, quedan a mano los de
 * respaldo: las lineas del pais de la persona que el servidor publico y este
 * dispositivo guardo (SCRUM-141) o, si no hay nada guardado, las de Colombia. Solo hay
 * telefonos para quien esta en un pais con lineas verificadas: a cualquier otra
 * persona se le manda al directorio, porque un numero de otro pais ensenado
 * como suyo es el peor error posible.
 */
function RespaldoDelFallo({ reglas }: { reglas: ReglasLocales | null }) {
  const zona = zonaActual();

  // Con las lineas que el servidor publico (SCRUM-141), las del pais de la persona: las
  // mismas que ve con conexion. Solo las que atienden en todo el pais, que son las que
  // sirven a quien no sabe de que ciudad es cada una.
  const delPais =
    reglas === null
      ? []
      : lineasDeLaZona(reglas, zona).filter(
          (linea) => linea.tipo === 'contacto' && linea.cobertura === 'nacional',
        );

  if (delPais.length > 0) {
    return (
      <>
        Si necesitas hablar con alguien ahora, estas líneas atienden por teléfono en todo el país:{' '}
        {delPais.map((linea) => linea.titulo).join(' · ')}.
      </>
    );
  }

  if (esZonaDeColombia(zona)) {
    return (
      <>
        Si necesitas hablar con alguien ahora, estas líneas atienden por teléfono en todo el país:{' '}
        {lineasDeRespaldo(zona)
          .map((linea) => linea.titulo)
          .join(' · ')}
        .
      </>
    );
  }

  return (
    <>
      Si necesitas hablar con alguien ahora, busca una línea de ayuda del lugar donde estás en{' '}
      <a
        href={DIRECTORIO_INTERNACIONAL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="el directorio internacional de líneas de ayuda (se abre en otra pestaña)"
      >
        el directorio internacional
      </a>
      . Si hay riesgo inmediato para la vida de alguien, llama al número de emergencias del lugar
      donde estás.
    </>
  );
}

/** Lo que respondio el asistente, con sus recursos. */
function Respuesta({
  respuesta,
  sinConexion,
}: {
  respuesta: RespuestaDelAsistente;
  sinConexion: boolean;
}) {
  const contactos = respuesta.recursos.filter((recurso) => recurso.tipo === 'contacto');
  const otros = respuesta.recursos.filter((recurso) => recurso.tipo !== 'contacto');

  return (
    <div className={respuesta.senalDeRiesgo ? 'asistente__respuesta--acompana' : undefined}>
      <p>
        <span className="solo-lectores">VSD IA: </span>
        {respuesta.mensaje}
      </p>

      {/* Con una senal de riesgo, las lineas salen siempre: si el servidor no
          mandara ninguna, las de respaldo. */}
      {(respuesta.senalDeRiesgo || respuesta.incluyeLineasDeAtencion) && (
        <LineasDeAtencion lineas={contactos} />
      )}

      {otros.length > 0 && <Recursos recursos={otros} />}

      {/* Lo respondio este dispositivo con lo que tenia guardado: se dice, no se disfraza. */}
      {sinConexion && <p className="asistente__origen">Respondido sin conexión</p>}
    </div>
  );
}

function Recursos({ recursos }: { recursos: readonly Recurso[] }) {
  return (
    <ul className="asistente__recursos">
      {recursos.map((recurso) => (
        <li key={recurso.id} className="asistente__recurso">
          <p className="asistente__recurso-titulo">{recurso.titulo}</p>
          {recurso.descripcion !== undefined && <p>{recurso.descripcion}</p>}
          {recurso.enlace !== undefined && (
            <a
              href={recurso.enlace}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Leer más sobre ${recurso.titulo} (se abre en otra pestaña)`}
            >
              Leer más
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
