import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { BotonDeEnvio, type EstadoDeEnvio } from '../../componentes/BotonDeEnvio.tsx';
import { Campo } from '../../componentes/Campo.tsx';
import { RUTAS } from '../../rutas/rutas.ts';
import { useSesion } from '../../sesion/useSesion.ts';
import { Aparece, LienzoDeAcceso } from './LienzoDeAcceso.tsx';

export function Recuperar() {
  const { pedirRecuperacion } = useSesion();

  const [correo, setCorreo] = useState('');
  const [estado, setEstado] = useState<EstadoDeEnvio>('listo');
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    setEstado('enviando');

    const resultado = await pedirRecuperacion(correo);

    if (!resultado.ok) {
      setEstado('listo');
      setError(resultado.mensaje ?? 'No se pudo enviar.');
      return;
    }

    setEstado('hecho');
    setEnviado(true);
  }

  if (enviado) {
    return (
      <LienzoDeAcceso
        titulo="Revisa tu correo"
        entradilla="Si existe una cuenta con esa direccion, te acabamos de enviar un enlace."
        pie={
          <Link className="acceso__enlace" to={RUTAS.ACCESO}>
            Volver al inicio de sesion
          </Link>
        }
      >
        <Aparece>
          {/* La frase de arriba dice "si existe una cuenta" a proposito.
              Confirmar que un correo esta registrado convertiria esta pantalla
              en una forma de averiguar quien usa la aplicacion, probando
              direcciones una a una. En una herramienta de bienestar, eso no lo
              tiene que poder consultar nadie. */}
          <p className="aviso aviso--bien">
            Si no lo ves en unos minutos, mira en correo no deseado.
          </p>
        </Aparece>
      </LienzoDeAcceso>
    );
  }

  return (
    <LienzoDeAcceso
      titulo="Recuperar el acceso"
      entradilla="Te enviamos un enlace para poner una contrasena nueva."
      pie={
        <Link className="acceso__enlace" to={RUTAS.ACCESO}>
          Volver al inicio de sesion
        </Link>
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
            disabled={estado !== 'listo'}
            onChange={(e) => setCorreo(e.target.value)}
          />
        </Aparece>

        <Aparece>
          <BotonDeEnvio estado={estado} textoAlTerminar="Enviado">
            Enviarme el enlace
          </BotonDeEnvio>
        </Aparece>
      </form>
    </LienzoDeAcceso>
  );
}
