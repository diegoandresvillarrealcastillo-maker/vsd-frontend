import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { Logo } from '../../componentes/Logo.tsx';
import { ID_DEL_CONTENIDO } from '../../componentes/SaltoAlContenido.tsx';
import { ENTRADA, REACCION_DE_BOTON } from '../../estilos/movimiento.ts';
import { entorno } from '../../infraestructura/entorno.ts';
import { RUTAS } from '../../rutas/rutas.ts';
import { useSesion } from '../../sesion/useSesion.ts';
import { SelectorDeTema } from '../../tema/SelectorDeTema.tsx';
import { AnillosDeConstancia } from './AnillosDeConstancia.tsx';
import { BarrasDeSueno, MEDIA_DE_SUENO } from './BarrasDeSueno.tsx';
import { InvitacionAlEntrar } from './InvitacionAlEntrar.tsx';
import { NavegacionFlotante } from './NavegacionFlotante.tsx';
import { PulsoDeAnimo } from './PulsoDeAnimo.tsx';
import { TarjetaDeMetrica } from './TarjetaDeMetrica.tsx';
import { TarjetaDePaso } from './TarjetaDePaso.tsx';
import '../../estilos/portada.css';

/**
 * La portada.
 *
 * ---------------------------------------------------------------------------
 * Por que es corta
 * ---------------------------------------------------------------------------
 *
 * Cinco bloques y se acaba. Una portada que se baja eternamente no convence a
 * nadie: cansa. Y quien llega a una herramienta de bienestar no suele llegar
 * con energia de sobra para leer doce secciones antes de encontrar el boton.
 *
 * ---------------------------------------------------------------------------
 * Por que el limite esta en la portada y no escondido en un pie
 * ---------------------------------------------------------------------------
 *
 * Lo que VSD Health no hace ocupa una seccion entera, con su propio fondo y su
 * corte de color. No es letra pequena: es la parte que evita que alguien deje
 * de buscar ayuda de verdad porque cree que esto la sustituye.
 */

/** Cada bloque entra al aparecer, una sola vez. */
function Entra({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={ENTRADA}
    >
      {children}
    </motion.div>
  );
}

function Marca({ children }: { children: ReactNode }) {
  return (
    <span className="garantias__punto">
      <svg
        className="garantias__marca"
        viewBox="0 0 24 24"
        width="15"
        height="15"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M4 12.5l5 5L20 6.5"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {children}
    </span>
  );
}

const NO_HACE: readonly string[] = [
  'No diagnostica ningún trastorno, ni lo insinúa.',
  'No formula, sugiere ni desaconseja medicamentos.',
  'No reemplaza a un psicólogo, un médico ni un psiquiatra.',
  'No le muestra tu información a nadie más, ni siquiera a quien administra la aplicación.',
];

interface Paso {
  readonly titulo: string;
  readonly texto: string;
}

const PASOS: readonly Paso[] = [
  {
    titulo: 'Cuentas cómo estás',
    texto:
      'Respondes unas preguntas cortas. No tienes que escribir párrafos ni explicarle nada a nadie.',
  },
  {
    titulo: 'Te proponemos algo corto',
    texto: 'Una actividad de respiración, de atención o de movimiento. Duran minutos, no horas.',
  },
  {
    titulo: 'Vuelves mañana',
    texto: 'La idea es hacerlo varios días seguidos. Ahí es cuando empiezas a ver algo.',
  },
];

interface Persona {
  readonly nombre: string;
  readonly rol: string;
}

const EQUIPO: readonly Persona[] = [
  { nombre: 'Diego Andrés Villarreal Castillo', rol: 'Product Owner y desarrollo' },
  { nombre: 'Samuel Villa Pérez', rol: 'Scrum Master y desarrollo' },
];

export function Portada() {
  const { sesion } = useSesion();

  return (
    <div className="portada">
      <NavegacionFlotante />

      {/* Aqui flota: no hay ningun recuadro al que pertenecer. */}
      <SelectorDeTema />

      {/* Todo lo que no es navegacion ni pie va dentro. Es lo que permite que
          el enlace de salto exista y que un lector de pantalla pueda ir
          directo al contenido. `tabIndex={-1}` no lo mete en el orden de
          tabulacion: lo hace capaz de recibir el foco al usar ese enlace. */}
      <main id={ID_DEL_CONTENIDO} tabIndex={-1}>
        {/* ---------- Heroe ---------- */}
        <header className="heroe">
          <motion.div
            className="heroe__contenido"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...ENTRADA, delay: 0.08 }}
          >
            <p className="heroe__etiqueta">Bienestar emocional y cognitivo</p>

            <h1 className="heroe__titulo">
              Lo que sientes, puesto en <span className="destacado">claro</span>.
            </h1>

            <p className="heroe__entradilla">
              Registra cómo te sientes, cuánto dormiste y qué hiciste hoy. Con los días vas a ver
              cómo cambia todo eso. Sin diagnósticos y sin ponerte una nota.
            </p>

            {/* A quien ya entró no se le ofrece crear una cuenta ni entrar: ya
                hizo las dos cosas, y verlo otra vez hace dudar de si la sesión
                se perdió. Lo único que necesita es volver a lo suyo.

                Mientras no se sabe, se enseña la versión de quien no entró:
                es el caso de casi todo el que llega a una portada. */}
            <div className="heroe__acciones">
              {sesion ? (
                <motion.span {...REACCION_DE_BOTON}>
                  <Link className="pildora pildora--fuerte pildora--grande" to={RUTAS.PANEL}>
                    Ir a mi panel
                  </Link>
                </motion.span>
              ) : (
                <>
                  <motion.span {...REACCION_DE_BOTON}>
                    <Link className="pildora pildora--fuerte pildora--grande" to={RUTAS.REGISTRO}>
                      Crear cuenta
                    </Link>
                  </motion.span>

                  <motion.span {...REACCION_DE_BOTON}>
                    <Link className="pildora pildora--fantasma pildora--grande" to={RUTAS.ACCESO}>
                      Ya tengo cuenta
                    </Link>
                  </motion.span>
                </>
              )}
            </div>

            {/* Va pegada a los botones a proposito: responde a la duda que
                aparece justo al mirarlos, no tres pantallas mas abajo. */}
            <div className="garantias">
              <Marca>No diagnostica</Marca>
              <Marca>No formula medicamentos</Marca>
              <Marca>Tus datos son solo tuyos</Marca>
            </div>
          </motion.div>
        </header>

        {/* ---------- Lo que ves cada dia ---------- */}
        <section className="seccion" id="que-hace">
          <Entra>
            <h2 className="seccion__titulo">Lo que ves cada día</h2>
            <p className="seccion__entradilla">
              Todo lo que aparece aquí lo registraste tú. No hay calificaciones ni puntajes.
            </p>
          </Entra>

          <div className="metricas">
            <Entra>
              <TarjetaDeMetrica
                etiqueta="Ánimo"
                titulo="Cómo estuvo tu semana"
                texto="Contar cómo te sientes te toma veinte segundos. Después de unos días ves si vas mejor o peor, que mirando un solo día no se nota."
                dibujo={(activa) => <PulsoDeAnimo activa={activa} />}
              />
            </Entra>

            <Entra>
              <TarjetaDeMetrica
                etiqueta="Constancia"
                titulo={
                  <>
                    {/* El espacio va escrito y no lo pone el margen del CSS:
                        sin el, un lector de pantalla lee "2de 3 hoy". */}
                    <span className="metrica__cifra">2</span>{' '}
                    <span className="metrica__unidad">de 3 hoy</span>
                  </>
                }
                texto="Cada día tienes tres cosas por hacer: contar cómo estás, anotar cuánto dormiste y hacer una actividad. Si te queda una pendiente, no pasa nada."
                dibujo={(activa) => <AnillosDeConstancia activa={activa} />}
              />
            </Entra>

            <Entra>
              <TarjetaDeMetrica
                etiqueta="Descanso"
                titulo={
                  <>
                    <span className="metrica__cifra">
                      {MEDIA_DE_SUENO.toFixed(1).replace('.', ',')}
                    </span>{' '}
                    <span className="metrica__unidad">h de media</span>
                  </>
                }
                texto="Anotas cuánto dormiste cada noche. Con el tiempo se nota si las noches cortas coinciden con los días difíciles."
                dibujo={(activa) => <BarrasDeSueno activa={activa} />}
              />
            </Entra>
          </div>
        </section>

        {/* ---------- Como funciona ---------- */}
        <section className="seccion" id="como-funciona">
          <Entra>
            <h2 className="seccion__titulo">Cómo funciona</h2>
            <p className="seccion__entradilla">
              Tres pasos. Si fuera más largo, no lo harías un martes por la noche.
            </p>
          </Entra>

          <div className="pasos">
            {PASOS.map((paso, posicion) => (
              <Entra key={paso.titulo}>
                <TarjetaDePaso numero={posicion + 1} titulo={paso.titulo} texto={paso.texto} />
              </Entra>
            ))}
          </div>
        </section>

        {/* ---------- El limite ---------- */}
        <section className="limite" id="limite">
          <div className="limite__caja">
            <Entra>
              <h2 className="limite__titulo">Lo que VSD Health no hace</h2>
              <p className="limite__texto">
                No está aquí por cumplir un requisito. Si una aplicación de bienestar no dice hasta
                dónde llega, alguien puede terminar confiando en ella en lugar de buscar la ayuda
                que necesita.
              </p>

              <ul className="limite__lista">
                {NO_HACE.map((linea) => (
                  <li className="limite__punto" key={linea}>
                    <svg
                      className="limite__cruz"
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M6 6l12 12M18 6L6 18"
                        stroke="currentColor"
                        strokeWidth={2.4}
                        strokeLinecap="round"
                      />
                    </svg>
                    {linea}
                  </li>
                ))}
              </ul>

              <div className="limite__ayuda">
                <p>
                  Si estás pasando por un momento difícil, en Colombia puedes marcar{' '}
                  <strong>192 y elegir la opción 4</strong>, o el <strong>123</strong> si hay riesgo
                  inmediato. Las dos líneas son gratuitas y atienden a toda hora.
                </p>
              </div>
            </Entra>
          </div>
        </section>

        {/* ---------- Cierre ---------- */}
        <section className="seccion cierre">
          <Entra>
            <h2 className="cierre__titulo">{sesion ? 'Sigue donde ibas' : 'Empieza por hoy'}</h2>
            <p className="cierre__texto">
              {sesion
                ? 'Tu sesión sigue abierta en este dispositivo.'
                : 'Crear la cuenta te toma menos de un minuto y solo te pedimos lo necesario.'}
            </p>

            <motion.span {...REACCION_DE_BOTON}>
              <Link
                className="pildora pildora--fuerte pildora--grande"
                to={sesion ? RUTAS.PANEL : RUTAS.REGISTRO}
              >
                {sesion ? 'Ir a mi panel' : 'Crear cuenta'}
              </Link>
            </motion.span>
          </Entra>
        </section>
      </main>

      <footer className="pie">
        <div className="pie__caja">
          <div className="pie__marca">
            <Logo className="pie__marca-logo" />
            <p className="pie__aviso">
              Lo que VSD Health ofrece es orientativo y de apoyo: no diagnostica, no formula
              medicamentos y no reemplaza la atención de psicólogos, médicos ni psiquiatras.
            </p>
          </div>

          <div className="pie__equipo">
            <h2 className="pie__titulo">Quiénes lo hicimos</h2>
            <p className="pie__texto">
              VSD Health lo desarrollan dos personas de principio a fin: la base de datos, la API,
              la aplicación y este sitio.
            </p>

            <ul className="pie__personas">
              {EQUIPO.map((persona) => (
                <li className="pie__persona" key={persona.nombre}>
                  <span className="pie__nombre">{persona.nombre}</span>
                  <span className="pie__rol">{persona.rol}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pie__legal">
            <span>© {new Date().getFullYear()} VSD Health</span>
            <span>Ambiente: {entorno.nombre}</span>
          </div>
        </div>
      </footer>

      {/* No puede taparle a nadie los telefonos de atencion en crisis. */}
      <InvitacionAlEntrar noTapar="limite" />
    </div>
  );
}
