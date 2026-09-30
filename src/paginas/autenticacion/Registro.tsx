import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { BotonDeEnvio, type EstadoDeEnvio } from '../../componentes/BotonDeEnvio.tsx';
import { BotonDeGoogle } from '../../componentes/BotonDeGoogle.tsx';
import { Campo } from '../../componentes/Campo.tsx';
import { Casilla } from '../../componentes/Casilla.tsx';
import { entorno } from '../../infraestructura/entorno.ts';
import { RUTAS } from '../../rutas/rutas.ts';
import { useSesion } from '../../sesion/useSesion.ts';
import { Aparece, LienzoDeAcceso } from './LienzoDeAcceso.tsx';
import { PistasDelCorreo } from './PistasDelCorreo.tsx';

/** Minimo de caracteres. Supabase rechaza por debajo de ocho. */
const MINIMO = 8;

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

  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [repetida, setRepetida] = useState('');
  const [acepta, setAcepta] = useState(false);
  const [estado, setEstado] = useState<EstadoDeEnvio>('listo');
  const [error, setError] = useState<string | null>(null);
  const [errorDeCampo, setErrorDeCampo] = useState<ErroresDeContrasena>({});
  const [enviado, setEnviado] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setError(null);

    // Sin consentimiento no se intenta siquiera. El proveedor lo vuelve a
    // comprobar y es el que manda, pero mandar la peticion sabiendo que va a
    // ser rechazada gasta un intento del limite de Supabase y deja al boton
    // dando vueltas para nada.
    if (!acepta) {
      return;
    }

    // Lo que se puede comprobar aqui se comprueba aqui: es mas rapido y no
    // gasta un intento contra el servidor. Lo que decide de verdad sigue
    // siendo el servidor.
    const fallos: ErroresDeContrasena = {};

    if (contrasena.length < MINIMO) {
      fallos.contrasena = `Necesita al menos ${MINIMO} caracteres.`;
    }

    if (repetida !== contrasena) {
      fallos.repetida = 'Las dos contraseñas no coinciden.';
    }

    setErrorDeCampo(fallos);

    if (Object.keys(fallos).length > 0) {
      return;
    }

    setEstado('enviando');

    const resultado = await registrarse({
      correo,
      contrasena,
      aceptaElAviso: acepta,
    });

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
        titulo="Ya te enviamos el correo"
        // Se dice que la cuenta existe y que le falta un paso. Un "revisa tu
        // correo" a secas deja sin saber si el registro funciono o no.
        entradilla={`Tu cuenta ya está creada. Para activarla, abre ${correo} y pulsa el enlace que acabamos de mandarte.`}
        pie={
          <Link className="acceso__enlace" to={RUTAS.ACCESO}>
            Volver al inicio de sesión
          </Link>
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
            ayuda={`Al menos ${MINIMO} caracteres.`}
            error={errorDeCampo.contrasena}
            value={contrasena}
            disabled={ocupado}
            onChange={(e) => setContrasena(e.target.value)}
          />
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

        <Aparece>
          <Casilla
            etiqueta="Acepto el tratamiento de mis datos"
            nota="VSD Health maneja información relacionada con tu bienestar. No diagnostica, no formula medicamentos y no reemplaza a ningún profesional."
            marcada={acepta}
            disabled={ocupado}
            onChange={setAcepta}
          />
        </Aparece>

        <Aparece>
          {/* Sin el consentimiento no hay base legal para guardar un solo dato
              de salud, asi que el boton no deja continuar. La comprobacion se
              repite en el proveedor: esto es comodidad, no el control. */}
          <BotonDeEnvio estado={acepta ? estado : 'listo'} textoAlTerminar="Cuenta creada">
            Crear cuenta
          </BotonDeEnvio>
        </Aparece>

        {!acepta && (
          <Aparece>
            <p className="campo__ayuda">Para continuar hace falta aceptar el aviso.</p>
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
              {/* Al registrarse siempre se recuerda: la pregunta de si guardar
                  la sesion solo la hace la pantalla de inicio de sesion. */}
              <BotonDeGoogle disabled={ocupado} onClick={() => void entrarConGoogle(true)}>
                Registrarme con Google
              </BotonDeGoogle>
            </Aparece>
          </>
        )}
      </form>
    </LienzoDeAcceso>
  );
}
