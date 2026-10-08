import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from 'react';

import { AvisoOrientativo } from '../componentes/AvisoOrientativo.tsx';
import { alPulsarElFondo } from '../componentes/alPulsarElFondo.ts';
import { useDialogo } from '../componentes/useDialogo.ts';
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
import { zonaActual } from '../tiempo/zonaHoraria.ts';
import type { Marco } from './marco.ts';
import { useConversacion, type Mensaje, type MotivoDelFallo } from './useConversacion.ts';

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
 */

/** Para empezar: una por cada cosa que el asistente sabe responder. */
const SUGERENCIAS = [
  '¿Cómo puedo dormir mejor?',
  '¿Qué significa mi resultado?',
  '¿Dónde busco ayuda?',
] as const;

const TEXTO_DEL_FALLO: Readonly<Record<MotivoDelFallo, string>> = {
  'sin-conexion': 'No tienes conexión, así que no pude responderte.',
  tarda: 'Estoy tardando más de la cuenta en responder.',
  muchas: 'Vas más rápido de lo que puedo responder. Espera un momento.',
  otro: 'Algo falló y no pude responderte.',
};

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
  const { mensajes, esperando, enviar } = useConversacion();

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
    <div className="asistente-velo" role="presentation" onClick={alPulsarElFondo(alCerrar)}>
      {/* El marco lo pone en su sitio; dentro, lo que se anima. Pulsar en el
          marco, que no es el fondo, no cierra. */}
      <div className="asistente-marco" style={estilo}>
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
              {/* En la cabecera y no en cada respuesta: se ve desde que se abre,
                  antes de preguntar nada (L-03 de la auditoria 360). */}
              <AvisoOrientativo />
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

            {/* Un registro: lo nuevo se anuncia sin interrumpir. El rol va en un
                contenedor y no en la propia lista (C-03 de la auditoria 360): un
                `<ol role="log">` deja de ser una lista, y sus `<li>` quedan sueltos. */}
            <div role="log" aria-label="Conversación">
              <ol className="asistente__mensajes">
                {mensajes.map((mensaje) => (
                  <li
                    key={mensaje.id}
                    className={`asistente__mensaje asistente__mensaje--${mensaje.de}`}
                  >
                    <ContenidoDelMensaje
                      mensaje={mensaje}
                      esperando={esperando}
                      alReintentar={(pregunta) => void enviar(pregunta, { reintento: true })}
                    />
                  </li>
                ))}
              </ol>
            </div>

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
  esperando,
  alReintentar,
}: {
  mensaje: Mensaje;
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
      return <Respuesta respuesta={mensaje.respuesta} />;
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
            <RespaldoDelFallo />
          </p>
        </div>
      );
  }
}

/**
 * Los telefonos a mano cuando no se pudo responder (SCRUM-124).
 *
 * Como no se sabe que habria respondido el servidor, quedan a mano los de
 * respaldo. Solo hay telefonos para quien esta en Colombia: a cualquier otra
 * persona se le manda al directorio, porque un numero de otro pais ensenado
 * como suyo es el peor error posible.
 */
function RespaldoDelFallo() {
  const zona = zonaActual();

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
function Respuesta({ respuesta }: { respuesta: RespuestaDelAsistente }) {
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
