import { useId, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { BotonDeEnvio, type EstadoDeEnvio } from '../../componentes/BotonDeEnvio.tsx';
import { CaptchaDeTurnstile } from '../../captcha/CaptchaDeTurnstile.tsx';
import { ESPERA_DEL_CAPTCHA, useCaptcha } from '../../captcha/useCaptcha.ts';
import { BotonDeGoogle } from '../../componentes/BotonDeGoogle.tsx';
import { Campo } from '../../componentes/Campo.tsx';
import { MedidorDeContrasena } from '../../componentes/MedidorDeContrasena.tsx';
import { entorno } from '../../infraestructura/entorno.ts';
import { RUTAS } from '../../rutas/rutas.ts';
import { evaluarLaFecha } from '../../sesion/edad.ts';
import { mensajeSiNoCumple } from '../../sesion/reglaDeContrasena.ts';
import { useSesion } from '../../sesion/useSesion.ts';
import { CamposDelRegistro } from './CamposDelRegistro.tsx';
import { Aparece, LienzoDeAcceso } from './LienzoDeAcceso.tsx';
import { PistasDelCorreo } from './PistasDelCorreo.tsx';

/**
 * Los dos unicos errores que esta pantalla comprueba por su cuenta.
 *
 * Se declaran con nombre en vez de usar un diccionario suelto: asi un campo
 * mal escrito es un error de compilacion y no una casilla que nunca se pinta.
 */
interface ErroresDeContrasena {
  contrasena?: string;
  repetida?: string;
}

export function Registro() {
  const { registrarse, entrarConGoogle } = useSesion();
  const navegar = useNavigate();

  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [repetida, setRepetida] = useState('');
  const [fecha, setFecha] = useState('');
  const [avisoAceptado, setAvisoAceptado] = useState(false);
  const [terminosAceptados, setTerminosAceptados] = useState(false);
  const [estado, setEstado] = useState<EstadoDeEnvio>('listo');
  const [error, setError] = useState<string | null>(null);
  const [errorDeCampo, setErrorDeCampo] = useState<ErroresDeContrasena>({});
  const [errorDeLaFecha, setErrorDeLaFecha] = useState<string | undefined>(undefined);
  const [enviado, setEnviado] = useState(false);
  const idMedidor = useId();
  const captcha = useCaptcha();

  const acepta = avisoAceptado && terminosAceptados;

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    setErrorDeLaFecha(undefined);

    // Sin consentimiento no se intenta siquiera. El proveedor lo vuelve a
    // comprobar y es el que manda, pero mandar la peticion sabiendo que va a
    // ser rechazada gasta un intento del limite de Supabase y deja al boton
    // dando vueltas para nada.
    if (!acepta) {
      return;
    }

    // La edad va antes que todo lo demas, y antes de llamar a nadie. Quien es
    // menor ve la pantalla de rechazo al instante, y como ningun dato suyo sale
    // del dispositivo no se le crea una identidad que despues haya que borrar.
    // Esto es una cortesia: la API repite la comprobacion, y es la que vale.
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
      // Lo escrito se descarta: no se guarda en ninguna parte.
      setFecha('');
      setCorreo('');
      setContrasena('');
      setRepetida('');
      void navegar(RUTAS.SOLO_MAYORES, { replace: true });
      return;
    }

    // Lo que se puede comprobar aqui se comprueba aqui: es mas rapido y no
    // gasta un intento contra el servidor. Lo que decide de verdad sigue
    // siendo el servidor.
    const fallos: ErroresDeContrasena = {};

    const faltaAlgo = mensajeSiNoCumple(contrasena);

    if (faltaAlgo !== null) {
      fallos.contrasena = faltaAlgo;
    }

    if (repetida !== contrasena) {
      fallos.repetida = 'Las dos contraseñas no coinciden.';
    }

    setErrorDeCampo(fallos);

    if (Object.keys(fallos).length > 0) {
      return;
    }

    // Despues de lo que la persona puede corregir, no antes: que espere a
    // Cloudflare solo cuando ya no queda nada por arreglar en el formulario.
    if (captcha.activo && captcha.token === null) {
      setError(ESPERA_DEL_CAPTCHA);
      return;
    }

    setEstado('enviando');

    // La fecha no se manda a Supabase: no hace falta para crear la identidad, y
    // no tiene por que quedar en ningun sitio que no sea nuestra base. Al entrar
    // por primera vez se vuelve a pedir, y es entonces cuando la API la guarda.
    const resultado = await registrarse({
      correo,
      contrasena,
      aceptaElAviso: avisoAceptado,
      aceptaLosTerminos: terminosAceptados,
      ...(captcha.token === null ? {} : { captchaToken: captcha.token }),
    });

    // Cada token vale una vez, salga como salga el intento.
    captcha.reiniciar();

    if (!resultado.ok) {
      setEstado('listo');
      setError(resultado.mensaje ?? 'No se pudo crear la cuenta.');
      return;
    }

    setEstado('hecho');
    setEnviado(true);
  }

  const ocupado = estado !== 'listo';

  if (enviado) {
    return (
      <LienzoDeAcceso
        titulo="Revisa tu correo"
        // Esta pantalla sale igual si el correo es nuevo o ya tenia cuenta, y lo
        // que dice tiene que ser cierto en los dos casos: ni «tu cuenta ya esta
        // creada» (falso si ya existia) ni «ese correo ya esta registrado» (lo
        // delata). Es la misma regla de Recuperar.tsx (S-08 de la auditoria 360).
        // Quien ya tenia cuenta no se queda esperando un correo que no va a
        // llegar: el pie le deja a un enlace entrar o recuperar la contrasena.
        entradilla={`Si ${correo} es un correo válido, te enviamos un mensaje para continuar. Ábrelo y pulsa el enlace. Al entrar por primera vez te pediremos confirmar tu fecha de nacimiento y aceptar el aviso y los términos.`}
        pie={
          <span>
            ¿Ya tenías una cuenta con este correo?{' '}
            <Link className="acceso__enlace" to={RUTAS.ACCESO}>
              Entra
            </Link>{' '}
            o{' '}
            <Link className="acceso__enlace" to={RUTAS.RECUPERAR}>
              recupera tu contraseña
            </Link>
          </span>
        }
      >
        <PistasDelCorreo />
      </LienzoDeAcceso>
    );
  }

  return (
    <LienzoDeAcceso
      titulo="Crear cuenta"
      entradilla="Es gratis y solo pedimos lo necesario."
      pie={
        <span>
          ¿Ya tienes cuenta?{' '}
          <Link className="acceso__enlace" to={RUTAS.ACCESO}>
            Entra
          </Link>
        </span>
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

        <Aparece>
          <Campo
            etiqueta="Correo"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            required
            ayuda="Aquí te llega el enlace para activar la cuenta, así que usa uno al que puedas entrar."
            value={correo}
            disabled={ocupado}
            onChange={(e) => setCorreo(e.target.value)}
          />
        </Aparece>

        <Aparece>
          <Campo
            etiqueta="Contraseña"
            type="password"
            name="new-password"
            autoComplete="new-password"
            required
            descritoPor={idMedidor}
            error={errorDeCampo.contrasena}
            value={contrasena}
            disabled={ocupado}
            onChange={(e) => setContrasena(e.target.value)}
          />
          <MedidorDeContrasena contrasena={contrasena} id={idMedidor} />
        </Aparece>

        <Aparece>
          <Campo
            etiqueta="Repite la contraseña"
            type="password"
            name="new-password-repeat"
            autoComplete="new-password"
            required
            error={errorDeCampo.repetida}
            value={repetida}
            disabled={ocupado}
            onChange={(e) => setRepetida(e.target.value)}
          />
        </Aparece>

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

        {captcha.activo && (
          <Aparece>
            <CaptchaDeTurnstile captcha={captcha} accion="registro" />
          </Aparece>
        )}

        <Aparece>
          {/* Sin el consentimiento no hay base legal para guardar un solo dato
              de salud, asi que el boton no deja continuar. La comprobacion se
              repite en el proveedor: esto es comodidad, no el control. */}
          <BotonDeEnvio estado={acepta ? estado : 'listo'} textoAlTerminar="Listo">
            Crear cuenta
          </BotonDeEnvio>
        </Aparece>

        {!acepta && (
          <Aparece>
            <p className="campo__ayuda">
              Para continuar hace falta aceptar el aviso de privacidad y los términos.
            </p>
          </Aparece>
        )}

        {/* Ver la nota de Acceso.tsx: sin credenciales de OAuth, el botón
            lleva a una pantalla de error de Google. */}
        {entorno.conGoogle && (
          <>
            <Aparece>
              <div className="separador">
                <span>o</span>
              </div>
            </Aparece>

            <Aparece>
              {/* Aqui no se pregunta si mantener la sesion, y en un equipo
                  compartido lo seguro es no hacerlo (SCRUM-164): se cierra al
                  cerrar la pestana. Quien quiera conservarla en su equipo la
                  pide en la pantalla de acceso. */}
              <BotonDeGoogle disabled={ocupado} onClick={() => void entrarConGoogle(false)}>
                Registrarme con Google
              </BotonDeGoogle>
            </Aparece>

            <Aparece>
              {/* Google crea la identidad antes de que se pueda preguntar nada,
                  asi que la fecha y las casillas se piden despues, en «Completa
                  tu registro». Hay que decirlo antes de pulsar. */}
              <p className="campo__ayuda">
                Con Google te pediremos tu fecha de nacimiento y que aceptes el aviso de privacidad
                y los términos en el siguiente paso.
              </p>
            </Aparece>
          </>
        )}
      </form>
    </LienzoDeAcceso>
  );
}
