import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { BotonDeEnvio, type EstadoDeEnvio } from '../../componentes/BotonDeEnvio.tsx';
import { Campo } from '../../componentes/Campo.tsx';
import { RUTAS } from '../../rutas/rutas.ts';
import { useSesion } from '../../sesion/useSesion.ts';
import { Aparece, LienzoDeAcceso } from './LienzoDeAcceso.tsx';

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

/**
 * A donde lleva el enlace del correo de recuperacion.
 *
 * Cuando se llega por ese enlace, Supabase ya dejo una sesion abierta al
 * leerlo: por eso aqui se puede cambiar la contrasena sin pedir la anterior,
 * que la persona justamente no recuerda.
 *
 * Si alguien entra a esta direccion a pelo, sin haber venido del correo, no
 * hay sesion y se le dice que pida el enlace.
 */
export function ContrasenaNueva() {
  const { cambiarContrasena, sesion, cargando } = useSesion();
  const navegar = useNavigate();

  const [contrasena, setContrasena] = useState('');
  const [repetida, setRepetida] = useState('');
  const [estado, setEstado] = useState<EstadoDeEnvio>('listo');
  const [error, setError] = useState<string | null>(null);
  const [errorDeCampo, setErrorDeCampo] = useState<ErroresDeContrasena>({});

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setError(null);

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

    const resultado = await cambiarContrasena(contrasena);

    if (!resultado.ok) {
      setEstado('listo');
      setError(resultado.mensaje ?? 'No se pudo cambiar.');
      return;
    }

    setEstado('hecho');
    setTimeout(() => navegar(RUTAS.PANEL, { replace: true }), 420);
  }

  if (cargando) {
    return (
      <LienzoDeAcceso titulo="Un momento" entradilla="Comprobando el enlace.">
        <span className="solo-lectores" role="status" aria-live="polite">
          Comprobando el enlace
        </span>
      </LienzoDeAcceso>
    );
  }

  if (!sesion) {
    return (
      <LienzoDeAcceso
        titulo="El enlace no vale"
        entradilla="Puede que haya caducado o que ya se haya usado."
        pie={
          <Link className="acceso__enlace" to={RUTAS.RECUPERAR}>
            Pedir uno nuevo
          </Link>
        }
      >
        <Aparece>
          <p className="aviso aviso--error">
            Los enlaces de recuperacion duran poco y sirven una sola vez. Es a proposito: uno que
            durara para siempre seria una llave permanente en la bandeja de tu correo.
          </p>
        </Aparece>
      </LienzoDeAcceso>
    );
  }

  return (
    <LienzoDeAcceso titulo="Contrasena nueva" entradilla="Elige una y entras directo.">
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
            etiqueta="Contrasena nueva"
            type="password"
            name="new-password"
            autoComplete="new-password"
            required
            ayuda={`Al menos ${MINIMO} caracteres.`}
            error={errorDeCampo.contrasena}
            value={contrasena}
            disabled={estado !== 'listo'}
            onChange={(e) => setContrasena(e.target.value)}
          />
        </Aparece>

        <Aparece>
          <Campo
            etiqueta="Repitela"
            type="password"
            name="new-password-repeat"
            autoComplete="new-password"
            required
            error={errorDeCampo.repetida}
            value={repetida}
            disabled={estado !== 'listo'}
            onChange={(e) => setRepetida(e.target.value)}
          />
        </Aparece>

        <Aparece>
          <BotonDeEnvio estado={estado} textoAlTerminar="Cambiada">
            Guardar y entrar
          </BotonDeEnvio>
        </Aparece>
      </form>
    </LienzoDeAcceso>
  );
}
