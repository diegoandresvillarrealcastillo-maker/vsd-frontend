import { Link } from 'react-router-dom';

import { RUTAS } from '../../rutas/rutas.ts';
import { VERSIONES_PUBLICADAS } from './datosLegales.ts';
import { DatoDelResponsable, PaginaLegal, PorDefinir, type SeccionLegal } from './PaginaLegal.tsx';

/**
 * Los terminos y condiciones de uso.
 *
 * Dos frases mandan sobre el resto y salen de las reglas del proyecto: VSD
 * Health no formula, no diagnostica y no reemplaza a un especialista medico, y
 * es estrictamente para mayores de 18 anos. Si este texto cambia, esas dos
 * frases no se suavizan.
 */
const SECCIONES: readonly SeccionLegal[] = [
  {
    id: 'que-es',
    titulo: 'Qué es VSD Health y qué no es',
    cuerpo: (
      <>
        <p>
          VSD Health es una herramienta de apoyo para el bienestar emocional y cognitivo: te propone
          actividades cortas, te deja llevar un diario y te muestra tu constancia.
        </p>
        <p className="legal__destacado">
          <strong>
            VSD Health no formula, no diagnostica y no reemplaza a un especialista médico.
          </strong>{' '}
          No sustituye la atención de psicólogos, médicos ni psiquiatras. Los niveles y las
          etiquetas que ves son orientativos: no son un diagnóstico ni se pueden comparar con una
          escala clínica.
        </p>
        <p>
          Si estás pasando por un momento difícil, busca a un profesional de la salud o a una
          persona de confianza. Si estás en peligro o piensas en hacerte daño, comunícate ahora con
          los servicios de emergencia de tu país o con una línea de atención en crisis; la
          aplicación muestra las de tu país.
        </p>
      </>
    ),
  },
  {
    id: 'mayores-de-edad',
    titulo: 'Solo para mayores de 18 años',
    cuerpo: (
      <>
        <p>
          Para usar VSD Health tienes que ser mayor de 18 años. Al registrarte declaras tu fecha de
          nacimiento y declaras que es verdadera. La comprobamos en nuestros servidores, y si
          resulta que eres menor no creamos tu cuenta ni guardamos tus datos.
        </p>
        <p>
          Si descubrimos que una cuenta pertenece a una persona menor de edad, la cerraremos y
          borraremos sus datos.
        </p>
      </>
    ),
  },
  {
    id: 'cuenta',
    titulo: 'Tu cuenta',
    cuerpo: (
      <>
        <ul>
          <li>Da datos verdaderos y mantenlos al día.</li>
          <li>Cada persona tiene una sola cuenta, y es personal: no la compartas.</li>
          <li>
            Cuida tu contraseña. Si usas un equipo que no es tuyo, cierra la sesión al terminar.
          </li>
          <li>
            Avísanos si crees que alguien entró a tu cuenta. Eres responsable de lo que ocurra
            mientras la sesión esté abierta.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'uso',
    titulo: 'Cómo puedes usar el servicio',
    cuerpo: (
      <>
        <p>Puedes usar VSD Health para tu propio bienestar. No puedes:</p>
        <ul>
          <li>Entrar o intentar entrar a la cuenta de otra persona.</li>
          <li>
            Probar, saturar o intentar vulnerar la seguridad del servicio, ni extraer sus datos de
            forma automática.
          </li>
          <li>Subir archivos que no sean tuyos, que sean ilegales o que sean dañinos.</li>
          <li>Usarlo para hacer daño a otra persona, o para algo contrario a la ley.</li>
        </ul>
        <p>
          Podemos suspender una cuenta que incumpla estas reglas, avisándote cuando sea posible.
        </p>
      </>
    ),
  },
  {
    id: 'tu-contenido',
    titulo: 'Lo que escribes y subes es tuyo',
    cuerpo: (
      <>
        <p>
          Tu diario, tus respuestas, tu foto y tu mascota propia siguen siendo tuyos. Nos autorizas
          únicamente a guardarlos y a mostrártelos a ti para prestarte el servicio. Puedes
          descargarlos y borrarlos cuando quieras desde tu perfil.
        </p>
        <p>
          Cómo tratamos esos datos lo explica el{' '}
          <Link to={RUTAS.PRIVACIDAD}>aviso de privacidad</Link>.
        </p>
      </>
    ),
  },
  {
    id: 'disponibilidad',
    titulo: 'Disponibilidad y cambios del servicio',
    cuerpo: (
      <>
        <p>
          VSD Health es un proyecto en desarrollo. Puede cambiar, tener interrupciones o dejar de
          ofrecer alguna función. No garantizamos que esté disponible sin interrupciones, y te
          avisaremos con anticipación razonable de los cambios que afecten tus datos.
        </p>
        <p>
          Las funciones sin conexión guardan lo que haces en tu dispositivo y lo envían cuando
          vuelve la conexión. Si cierras sesión antes de que se envíe, o borras los datos del sitio,
          lo que no se envió se pierde.
        </p>
      </>
    ),
  },
  {
    id: 'propiedad',
    titulo: 'Propiedad intelectual',
    cuerpo: (
      <p>
        El nombre, el logo, el diseño, el código, las mascotas y los textos de VSD Health pertenecen
        a sus autores. Puedes usarlos para usar el servicio, pero no copiarlos ni distribuirlos sin
        permiso.
      </p>
    ),
  },
  {
    id: 'responsabilidad',
    titulo: 'Límites de nuestra responsabilidad',
    cuerpo: (
      <>
        <p>
          Hacemos lo posible para que lo que ves sea útil y esté bien cuidado, pero VSD Health se
          ofrece tal como está. No respondemos por decisiones de salud que tomes basándote
          únicamente en lo que muestra la aplicación, por eso insistimos en que no sustituye a un
          profesional.
        </p>
        <p className="legal__nota">
          <PorDefinir que="que la persona revisora redacte la limitación de responsabilidad conforme al Estatuto del Consumidor (Ley 1480 de 2011), que no se puede limitar por contrato" />
        </p>
      </>
    ),
  },
  {
    id: 'terminar',
    titulo: 'Cómo termina',
    cuerpo: (
      <p>
        Puedes dejar de usar VSD Health cuando quieras y borrar tu cuenta desde tu perfil. Al
        borrarla eliminamos tus datos como explica el aviso de privacidad.
      </p>
    ),
  },
  {
    id: 'cambios',
    titulo: 'Cambios en estos términos',
    cuerpo: (
      <p>
        Cada versión de estos términos tiene un número, y guardamos cuál aceptaste y cuándo. Si
        cambian, publicaremos la nueva versión y te pediremos que la aceptes de nuevo. Esta es la
        versión {VERSIONES_PUBLICADAS.terminos}.
      </p>
    ),
  },
  {
    id: 'ley',
    titulo: 'Ley aplicable y contacto',
    cuerpo: (
      <>
        <p>
          Estos términos se rigen por las leyes de Colombia. Para cualquier duda, consulta o reclamo
          escríbenos a <DatoDelResponsable campo="correo" />.
        </p>
        <p>
          Domicilio del responsable: <DatoDelResponsable campo="domicilio" />.
        </p>
      </>
    ),
  },
];

export function Terminos() {
  return (
    <PaginaLegal
      ruta={RUTAS.TERMINOS}
      titulo="Términos y condiciones"
      entradilla="Las reglas de uso de VSD Health, lo que ofrece y lo que no."
      version={VERSIONES_PUBLICADAS.terminos}
      secciones={SECCIONES}
    />
  );
}
