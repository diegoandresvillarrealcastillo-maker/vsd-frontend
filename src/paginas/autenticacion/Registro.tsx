import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { BotonDeEnvio, type EstadoDeEnvio } from '../../componentes/BotonDeEnvio.tsx';
import { BotonDeGoogle } from '../../componentes/BotonDeGoogle.tsx';
import { Campo } from '../../componentes/Campo.tsx';
import { entorno } from '../../infraestructura/entorno.ts';
import { RUTAS } from '../../rutas/rutas.ts';
import { useSesion } from '../../sesion/useSesion.ts';
import { Aparece, LienzoDeAcceso } from './LienzoDeAcceso.tsx';

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
  const [recordar, setRecordar] = useState(true);
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
      fallos.repetida = 'Las dos contrasenas no coinciden.';
    }

    setErrorDeCampo(fallos);

    if (Object.keys(fallos).length > 0) {
      return;
    }

    setEstado('enviando');

    const resultado = await registrarse({
      correo,
      contrasena,
      recordar,
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
        titulo="Revisa tu correo"
        entradilla={`Te enviamos un enlace a ${correo} para confirmar la cuenta.`}
        pie={
          <Link className="acceso__enlace" to={RUTAS.ACCESO}>
            Volver al inicio de sesion
          </Link>
        }
      >
        <Aparece>
          <p className="aviso aviso--bien">
            Si no lo ves en unos minutos, mira en correo no deseado. El enlace caduca, asi que usalo
            pronto.
          </p>
        </Aparece>
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
            value={correo}
            disabled={ocupado}
            onChange={(e) => setCorreo(e.target.value)}
          />
        </Aparece>

        <Aparece>
          <Campo
            etiqueta="Contrasena"
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
            etiqueta="Repite la contrasena"
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
          <label className="casilla">
            <input
              type="checkbox"
              checked={acepta}
              required
              disabled={ocupado}
              onChange={(e) => setAcepta(e.target.checked)}
            />
            <span>
              Acepto el tratamiento de mis datos
              <span className="casilla__nota">
                VSD Health maneja informacion relacionada con tu bienestar. No diagnostica, no
                formula medicamentos y no reemplaza a ningun profesional.
              </span>
            </span>
          </label>
        </Aparece>

        <Aparece>
          <label className="casilla">
            <input
              type="checkbox"
              checked={!recordar}
              disabled={ocupado}
              onChange={(e) => setRecordar(!e.target.checked)}
            />
            <span>
              No recordar en este equipo
              <span className="casilla__nota">
                Para computadores compartidos: la sesion se cierra al cerrar la pestana.
              </span>
            </span>
          </label>
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
              <BotonDeGoogle disabled={ocupado} onClick={() => void entrarConGoogle(recordar)}>
                Registrarme con Google
              </BotonDeGoogle>
            </Aparece>
          </>
        )}
      </form>
    </LienzoDeAcceso>
  );
}
