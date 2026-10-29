import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { LlamarAhora } from '../../componentes/LlamarAhora.tsx';
import { Logo } from '../../componentes/Logo.tsx';
import { ID_DEL_CONTENIDO } from '../../componentes/SaltoAlContenido.tsx';
import { EQUIPO, SOLO_PROBLEMAS_TECNICOS } from '../../equipo.ts';
import { ENTRADA, REACCION_DE_BOTON } from '../../estilos/movimiento.ts';
import type { Modulo } from '../../infraestructura/api/cuenta.ts';
import { entorno } from '../../infraestructura/entorno.ts';
import { RUTAS } from '../../rutas/rutas.ts';
import { useSesion } from '../../sesion/useSesion.ts';
import { SelectorDeTema } from '../../tema/SelectorDeTema.tsx';
import { LINEAS_DE_RESPALDO_DE_COLOMBIA } from '../actividad/lineasParaMostrar.ts';
import { EnlacesLegales } from '../legal/EnlacesLegales.tsx';
import { ORDEN } from '../panel/modulos.ts';
import { InvitacionAlEntrar } from './InvitacionAlEntrar.tsx';
import { NavegacionFlotante } from './NavegacionFlotante.tsx';
import { TarjetaDeModulo } from './TarjetaDeModulo.tsx';
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

interface Limite {
  readonly clave: string;
  readonly texto: ReactNode;
}

/**
 * Lo que VSD Health no hace.
 *
 * Cada linea tiene que poder demostrarse. La ultima decia que nadie veia tus
 * datos «ni siquiera quien administra la aplicacion»: una promesa absoluta que no
 * se cumple al pie de la letra, porque los proveedores que alojan el servicio
 * procesan los datos y quien tenga la credencial de la base podria leerlos
 * (L-04 de la auditoria 360). Se dice lo que si es cierto y se puede comprobar: la
 * aplicacion no le ensena a nadie del equipo el diario ni los resultados, y cada
 * persona puede llevarselos o borrarlos.
 */
const NO_HACE: readonly Limite[] = [
  { clave: 'diagnostico', texto: 'No diagnostica ningún trastorno, ni lo insinúa.' },
  { clave: 'medicamentos', texto: 'No formula, sugiere ni desaconseja medicamentos.' },
  { clave: 'profesionales', texto: 'No reemplaza a un psicólogo, un médico ni un psiquiatra.' },
  {
    clave: 'equipo',
    texto: (
      <>
        No le muestra tu diario ni tus resultados a nadie del equipo desde la aplicación. Puedes
        descargarlos o borrarlos cuando quieras.{' '}
        <Link to={RUTAS.PRIVACIDAD}>Cómo cuidamos tus datos</Link>
      </>
    ),
  },
];

interface Paso {
  readonly titulo: string;
  readonly texto: string;
}

/**
 * Lo que la aplicacion hace, en el orden en que la persona lo vive (SCRUM-313): elige sus modulos al
 * empezar, recibe una ruta de actividades cortas cada dia y la llama cuenta los dias sin reprochar.
 */
const PASOS: readonly Paso[] = [
  {
    titulo: 'Eliges por dónde empezar',
    texto: 'Al empezar escoges tus módulos. Puedes cambiarlos después desde tu perfil.',
  },
  {
    titulo: 'Haces algo corto cada día',
    texto:
      'Tu ruta de hoy trae actividades de unos minutos. Eliges cuál y en qué orden: sin metas ni presión.',
  },
  {
    titulo: 'Vuelves cuando puedas',
    texto:
      'Tu llama cuenta los días en que haces algo. Si un día no puedes, descansa y se enciende de nuevo cuando regreses.',
  },
];

/**
 * Las actividades que cita cada tarjeta: nombres del catalogo publicado (migraciones del backend),
 * no inventados. Si una sale del catalogo, tiene que salir de aqui.
 */
const ACTIVIDADES_DE_EJEMPLO: Readonly<Record<Modulo, readonly string[]>> = {
  bienestar: ['Respiración guiada', 'Pausa de estiramiento', 'Escaneo corporal', 'Antes de dormir'],
  cognicion: [
    'Recuerda los colores',
    'La palabra que sobra',
    'Cuentas con calma',
    'Une los puntos en orden',
  ],
  emociones: ['Rueda de emociones', 'Tres cosas buenas', 'Ancla 5-4-3-2-1', 'Carta a mí de mañana'],
};

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
              Cuerpo, mente y emociones, un <span className="destacado">día</span> a la vez.
            </h1>

            <p className="heroe__entradilla">
              Cada día, una ruta corta de actividades para tu bienestar, tu memoria y tus emociones.
              Tú eliges por dónde empezar, sin metas ni presión. Sin diagnósticos y sin compararte
              con nadie.
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
              <Marca>Descargas o borras tus datos</Marca>
              <Marca>Solo para mayores de 18 años</Marca>
            </div>
          </motion.div>
        </header>

        {/* ---------- Los tres modulos ---------- */}
        <section className="seccion" id="que-hace">
          <Entra>
            <h2 className="seccion__titulo">Tres módulos para empezar por donde quieras</h2>
            <p className="seccion__entradilla">
              Al empezar escoges uno, dos o los tres, y los cambias después desde tu perfil.
            </p>
          </Entra>

          <div className="modulos">
            {ORDEN.map((modulo) => (
              <Entra key={modulo}>
                <TarjetaDeModulo modulo={modulo} actividades={ACTIVIDADES_DE_EJEMPLO[modulo]} />
              </Entra>
            ))}
          </div>

          <p className="modulos__resto">
            También incluye un diario para escribir a tu ritmo, un semáforo para ordenar tus
            pendientes, una llama que cuenta tus días, un asistente para conversar (VSD IA) y una
            mascota que te acompaña.
          </p>
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
                {NO_HACE.map(({ clave, texto }) => (
                  <li className="limite__punto" key={clave}>
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
                    <span>{texto}</span>
                  </li>
                ))}
              </ul>

              <div className="limite__ayuda">
                <p>
                  Si estás pasando por un momento difícil, en Colombia puedes marcar{' '}
                  <strong>192 y elegir la opción 4</strong>, o el <strong>123</strong> si hay riesgo
                  inmediato. Las dos líneas son gratuitas y atienden a toda hora.
                </p>

                {/* Las dos son de Colombia y estan verificadas (SCRUM-257): el texto de arriba ya lo dice. */}
                <div className="limite__llamadas">
                  {LINEAS_DE_RESPALDO_DE_COLOMBIA.map((linea) => (
                    <LlamarAhora
                      key={linea.id}
                      linea={linea}
                      etiqueta={`Llamar al ${linea.telefono ?? ''}`}
                    />
                  ))}
                </div>
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
                : 'Crear la cuenta es rápido y solo te pedimos lo necesario: tu correo, una contraseña y tu fecha de nacimiento.'}
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
              medicamentos y no reemplaza la atención de psicólogos, médicos ni psiquiatras. Es solo
              para mayores de 18 años.
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
                  <a
                    className="pie__telefono"
                    href={`tel:${persona.telefono}`}
                    aria-label={`Llamar a ${persona.nombreCorto}, del equipo, por un problema técnico`}
                  >
                    {persona.telefonoEscrito}
                  </a>
                </li>
              ))}
            </ul>

            {/* Solo para problemas tecnicos y con todas las letras (SCRUM-257): no es una linea de ayuda. */}
            <p className="pie__texto">{SOLO_PROBLEMAS_TECNICOS}</p>
          </div>

          <div className="pie__legal">
            <span>© {new Date().getFullYear()} VSD Health</span>
            <EnlacesLegales />
            {/* El ambiente es un dato interno: ayuda a quien prueba en desarrollo o en
                PRE a saber donde esta, y a nadie mas. En produccion no se muestra
                (L-07 de la auditoria 360). */}
            {entorno.nombre !== 'production' && <span>Ambiente: {entorno.nombre}</span>}
          </div>
        </div>
      </footer>

      {/* No puede taparle a nadie los telefonos de atencion en crisis. */}
      <InvitacionAlEntrar noTapar="limite" />
    </div>
  );
}
