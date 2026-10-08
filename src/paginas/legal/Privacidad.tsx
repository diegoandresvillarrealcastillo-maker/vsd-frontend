import { Link } from 'react-router-dom';

import { RUTAS } from '../../rutas/rutas.ts';
import { VERSIONES_PUBLICADAS } from './datosLegales.ts';
import { DatoDelResponsable, PaginaLegal, PorDefinir, type SeccionLegal } from './PaginaLegal.tsx';
import { DatosDeLaAnalitica, ProveedorGoogleAnalytics } from './TextosDeAnalitica.tsx';

/**
 * El aviso de privacidad y la politica de tratamiento de datos personales.
 *
 * Cada afirmacion de aqui es algo que la aplicacion hace de verdad (o que deja
 * de hacer). Lo que depende de una decision del equipo esta marcado con
 * `PorDefinir`. Cuando la aplicacion cambie lo que hace con los datos, este
 * texto cambia con ella y la version sube: ver `VERSIONES_PUBLICADAS`.
 *
 * Marco: Ley 1581 de 2012 (proteccion de datos personales) y su decreto
 * reglamentario.
 */
const SECCIONES: readonly SeccionLegal[] = [
  {
    id: 'responsable',
    titulo: 'Quién es el responsable de tus datos',
    cuerpo: (
      <>
        <p>
          El responsable del tratamiento de tus datos personales es quien administra VSD Health.
          Estos son sus datos de contacto:
        </p>
        <ul>
          <li>
            Nombre o razón social: <DatoDelResponsable campo="nombre" />
          </li>
          <li>
            Identificación: <DatoDelResponsable campo="identificacion" />
          </li>
          <li>
            Domicilio: <DatoDelResponsable campo="domicilio" />
          </li>
          <li>
            Correo para ejercer tus derechos: <DatoDelResponsable campo="correo" />
          </li>
          <li>
            Teléfono: <DatoDelResponsable campo="telefono" />
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'mayores-de-edad',
    titulo: 'VSD Health es solo para mayores de 18 años',
    cuerpo: (
      <>
        <p>
          Por la naturaleza de los datos que maneja y por las garantías que la ley exige para tratar
          datos de menores de edad,{' '}
          <strong>VSD Health es solo para personas mayores de 18 años</strong>. Al crear tu cuenta
          te pedimos tu fecha de nacimiento y la comprobamos en nuestros servidores.
        </p>
        <p>
          Si la fecha indica que eres menor de edad, no creamos tu cuenta, no guardamos ninguno de
          tus datos y borramos la identidad que se hubiera creado con tu correo en nuestro proveedor
          de acceso. Cuando cumplas 18 años te daremos la bienvenida.
        </p>
      </>
    ),
  },
  {
    id: 'datos',
    titulo: 'Qué datos tratamos',
    cuerpo: (
      <>
        <h3>Los de tu cuenta</h3>
        <ul>
          <li>Tu correo electrónico.</li>
          <li>
            Tu contraseña, si te registras con correo. <strong>No la vemos ni la guardamos</strong>:
            la recibe y la custodia nuestro proveedor de acceso.
          </li>
          <li>
            Si entras con Google, el identificador y el correo que Google comparte con nosotros.
          </li>
          <li>Tu nombre, si decides escribirlo, para saludarte.</li>
          <li>Tu fecha de nacimiento, que usamos solo para comprobar que eres mayor de edad.</li>
          <li>Tu zona horaria, para saber qué día es para ti.</li>
          <li>
            Qué versión de este aviso y de los términos aceptaste, y cuándo. Es la prueba de lo que
            autorizaste.
          </li>
        </ul>

        <h3>Los relacionados con tu bienestar</h3>
        <p>
          Son los que más cuidamos, y la ley los llama <em>datos sensibles</em> porque se refieren a
          tu salud y a tu intimidad:
        </p>
        <ul>
          <li>Tus respuestas y resultados en las actividades, con su nivel orientativo.</li>
          <li>Lo que escribes y dibujas en tu diario.</li>
          <li>Los pendientes del semáforo y su avance.</li>
          <li>Los módulos y la mascota que eliges.</li>
        </ul>

        <h3>Los archivos que tú subes</h3>
        <ul>
          <li>Tu foto de perfil, si pones una.</li>
          <li>Tu mascota propia (un dibujo), si subes una.</li>
        </ul>

        <h3>Los de los avisos</h3>
        <p>
          Si activas los avisos, la hora que eliges y la dirección técnica de tu navegador, que es
          lo que permite entregártelos.
        </p>

        <h3>Los técnicos</h3>
        <p>
          Al conectarte, los proveedores que alojan el servicio registran datos técnicos como la
          dirección IP y el tipo de navegador. Los necesitan para que el servicio funcione y para
          detectar abusos.
        </p>

        {/* Solo donde hay analitica (SCRUM-161). */}
        <DatosDeLaAnalitica />
      </>
    ),
  },
  {
    id: 'datos-sensibles',
    titulo: 'Sobre los datos sensibles',
    cuerpo: (
      <>
        <p>
          Responder las actividades o escribir tu diario es siempre voluntario: ninguna persona está
          obligada a dar datos sensibles, y puedes usar lo que quieras de VSD Health sin usar el
          resto.
        </p>
        <p>
          Los tratamos únicamente para darte el servicio. No los vendemos, no los usamos para
          publicidad y no los combinamos con información de otras fuentes. Al aceptar este aviso nos
          autorizas, de forma previa, expresa e informada, a tratarlos para las finalidades de
          abajo.
        </p>
        <p>
          La autorización la puedes revocar cuando quieras borrando tu cuenta. La revocación no
          afecta lo que ya se hizo mientras la tenías.
        </p>
      </>
    ),
  },
  {
    id: 'finalidades',
    titulo: 'Para qué los usamos',
    cuerpo: (
      <>
        <ul>
          <li>Crear y mantener tu cuenta, y comprobar que eres mayor de edad.</li>
          <li>
            Ofrecerte las actividades, mostrarte tu progreso y guardar tu diario y tus pendientes.
          </li>
          <li>Enviarte los avisos que actives y los correos de activación y recuperación.</li>
          <li>Proteger el servicio: evitar abusos, accesos indebidos y fraudes.</li>
          <li>Responder tus consultas y reclamos, y cumplir la ley.</li>
        </ul>
        <p>
          <strong>El diario solo se lee para recomendarte algo si tú lo permites.</strong> Esa
          opción empieza apagada y la cambias en tu perfil. Apagada, el diario se guarda y se te
          devuelve, y nada más.
        </p>
        <p>
          El asistente funciona con reglas propias, no con un servicio externo de inteligencia
          artificial, y no guarda lo que le escribes.
        </p>
      </>
    ),
  },
  {
    id: 'terceros',
    titulo: 'Con quién los compartimos',
    cuerpo: (
      <>
        <p>
          No vendemos tus datos. Para ofrecer el servicio usamos proveedores que los tratan por
          nuestra cuenta, con instrucciones nuestras:
        </p>
        <ul>
          <li>
            <strong>Supabase</strong>: tu acceso, la base de datos y el almacenamiento de tus
            archivos.
          </li>
          <li>
            <strong>Render</strong>: el servidor de la aplicación.
          </li>
          <li>
            <strong>Vercel</strong>: la entrega de este sitio web.
          </li>
          <li>
            <strong>Brevo</strong>: el envío de los correos de activación y recuperación.
          </li>
          <li>
            <strong>Google</strong>: solo si eliges entrar con Google.
          </li>
          <ProveedorGoogleAnalytics />
          <li>
            El servicio de avisos de tu navegador (según cuál uses, Google, Apple o Mozilla), solo
            si activas los avisos.
          </li>
        </ul>
        <p>
          También entregaremos información a una autoridad cuando una norma o una orden judicial nos
          obligue.
        </p>
        <p>
          El rol de administrador de la aplicación gestiona el catálogo de actividades y recursos.
          No tiene acceso a los resultados, al diario ni a la información personal de las personas.
          Quien opera la infraestructura puede, por la naturaleza técnica del servicio, tener acceso
          a la base de datos para mantenerla.
        </p>
      </>
    ),
  },
  {
    id: 'donde',
    titulo: 'Dónde se guardan',
    cuerpo: (
      <>
        <p>
          Nuestros proveedores operan servidores dentro y fuera de Colombia, principalmente en
          Estados Unidos. Al aceptar este aviso autorizas que tus datos se transmitan y se almacenen
          allí para prestarte el servicio. Esos proveedores tratan los datos bajo sus propias
          medidas de seguridad y sus propios términos.
        </p>
        <p className="legal__nota">
          <PorDefinir que="que la persona revisora confirme las condiciones de la transferencia internacional (Ley 1581, art. 26)" />
        </p>
      </>
    ),
  },
  {
    id: 'conservacion',
    titulo: 'Cuánto tiempo los conservamos',
    cuerpo: (
      <>
        <p>
          Mientras tengas tu cuenta. Cuando la borras desde tu perfil, eliminamos tu cuenta, tus
          resultados, tu diario, tus pendientes, tus archivos y tu identidad en el proveedor de
          acceso. Es todo o nada: si algo falla, no se borra nada y puedes reintentar.
        </p>
        <p>
          Las copias de respaldo de los proveedores pueden conservar datos por un tiempo limitado
          después de borrarlos: <PorDefinir que="plazo de las copias de respaldo" />.
        </p>
      </>
    ),
  },
  {
    id: 'derechos',
    titulo: 'Tus derechos y cómo ejercerlos',
    cuerpo: (
      <>
        <p>Como titular de tus datos tienes derecho a:</p>
        <ul>
          <li>Conocer, actualizar y rectificar tus datos.</li>
          <li>Pedir prueba de la autorización que diste.</li>
          <li>Ser informado de cómo los usamos.</li>
          <li>Revocar la autorización y pedir que suprimamos tus datos.</li>
          <li>Acceder gratis a tus datos.</li>
          <li>
            Presentar quejas ante la Superintendencia de Industria y Comercio (
            <a href="https://www.sic.gov.co" rel="noreferrer noopener" target="_blank">
              sic.gov.co
            </a>
            ) por infracciones a la ley.
          </li>
        </ul>
        <h3>Sin esperar a nadie, en la aplicación</h3>
        <ul>
          <li>
            <strong>Descargar tus datos</strong> en tu perfil: te entrega en un archivo todo lo que
            guardamos de ti.
          </li>
          <li>
            <strong>Borrar tu cuenta</strong> en tu perfil, con todo lo tuyo.
          </li>
          <li>Cambiar tu nombre y tus preferencias.</li>
        </ul>
        <h3>Por escrito</h3>
        <p>
          Escríbenos a <DatoDelResponsable campo="correo" /> para cualquier consulta o reclamo.
          Respondemos las consultas en máximo 10 días hábiles (prorrogables 5 más, avisándote el
          motivo) y los reclamos en máximo 15 días hábiles (prorrogables hasta 8 más).
        </p>
      </>
    ),
  },
  {
    id: 'seguridad',
    titulo: 'Cómo protegemos tus datos',
    cuerpo: (
      <>
        <ul>
          <li>La conexión con el sitio y con la aplicación va cifrada (HTTPS).</li>
          <li>
            La base de datos aísla la información de cada persona: cada cuenta solo puede leer y
            modificar lo suyo.
          </li>
          <li>Las contraseñas las gestiona un proveedor especializado, no nosotros.</li>
          <li>
            Lo que guardamos en tu dispositivo para usar la aplicación sin conexión va cifrado.
          </li>
        </ul>
        <p>
          Ningún sistema es infalible. Si llegáramos a tener un incidente que afecte tus datos, te
          lo contaremos y avisaremos a la autoridad cuando la ley lo exija.
        </p>
      </>
    ),
  },
  {
    id: 'cambios',
    titulo: 'Cambios en este aviso',
    cuerpo: (
      <>
        <p>
          Cada versión de este aviso tiene un número, y guardamos cuál aceptaste y cuándo. Si cambia
          de forma que afecte tus datos, publicaremos la nueva versión, te pediremos que la aceptes
          de nuevo y conservaremos la anterior como prueba de lo que aceptaste antes.
        </p>
        <p>
          Esta es la versión {VERSIONES_PUBLICADAS.privacidad}. Para saber cómo usamos el
          almacenamiento de tu navegador, mira la{' '}
          <Link to={RUTAS.COOKIES}>política de cookies</Link>; para las reglas de uso del servicio,
          los <Link to={RUTAS.TERMINOS}>términos</Link>.
        </p>
      </>
    ),
  },
];

export function Privacidad() {
  return (
    <PaginaLegal
      ruta={RUTAS.PRIVACIDAD}
      titulo="Aviso de privacidad"
      entradilla="Qué datos tuyos guardamos, para qué, con quién los compartimos y cómo ejercer tus derechos."
      version={VERSIONES_PUBLICADAS.privacidad}
      secciones={SECCIONES}
    />
  );
}
