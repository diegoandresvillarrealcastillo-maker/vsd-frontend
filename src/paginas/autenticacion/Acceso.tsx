import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { BotonDeEnvio, type EstadoDeEnvio } from '../../componentes/BotonDeEnvio.tsx';
import { BotonDeGoogle } from '../../componentes/BotonDeGoogle.tsx';
import { Campo } from '../../componentes/Campo.tsx';
import { Casilla } from '../../componentes/Casilla.tsx';
import { entorno } from '../../infraestructura/entorno.ts';
import { RUTAS } from '../../rutas/rutas.ts';
import { useSesion } from '../../sesion/useSesion.ts';
import { Aparece, LienzoDeAcceso } from './LienzoDeAcceso.tsx';

export function Acceso() {
  const { entrar, entrarConGoogle } = useSesion();
  const navegar = useNavigate();
  const ubicacion = useLocation();

  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [recordar, setRecordar] = useState(true);
  const [estado, setEstado] = useState<EstadoDeEnvio>('listo');
  const [error, setError] = useState<string | null>(null);

  // A donde queria ir antes de que la ruta protegida la mandara aqui.
  const destino = (ubicacion.state as { volverA?: string } | null)?.volverA ?? RUTAS.PANEL;

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    setEstado('enviando');

    const resultado = await entrar({ correo, contrasena, recordar });

    if (!resultado.ok) {
      setEstado('listo');
      setError(resultado.mensaje ?? 'No se pudo entrar.');
      return;
    }

    // El check se ve un momento antes de cambiar de pantalla. Sin esa pausa la
    // animacion no llega a existir y el boton parpadea sin decir nada.
    setEstado('hecho');
    setTimeout(() => navegar(destino, { replace: true }), 420);
  }

  const ocupado = estado !== 'listo';

  return (
    <LienzoDeAcceso
      titulo="Hola de nuevo"
      entradilla="Entra para seguir donde lo dejaste."
      pie={
        <>
          <span>
            ¿No tienes cuenta?{' '}
            <Link className="acceso__enlace" to={RUTAS.REGISTRO}>
              Crea una
            </Link>
          </span>
          <Link className="acceso__enlace" to={RUTAS.RECUPERAR}>
            Olvide mi contrasena
          </Link>
        </>
      }
    >
      <form className="acceso__formulario" onSubmit={(e) => void enviar(e)} noValidate>
        {error !== null && (
          <Aparece>
            {/* `alert` hace que un lector de pantalla lo lea en cuanto aparece,
                sin esperar a que la persona lo busque. */}
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
            name="current-password"
            autoComplete="current-password"
            required
            value={contrasena}
            disabled={ocupado}
            onChange={(e) => setContrasena(e.target.value)}
          />
        </Aparece>

        <Aparece>
          <Casilla
            etiqueta="No recordar en este equipo"
            nota="Para computadores compartidos: la sesion se cierra al cerrar la pestana."
            marcada={!recordar}
            disabled={ocupado}
            onChange={(marcada) => setRecordar(!marcada)}
          />
        </Aparece>

        <Aparece>
          <BotonDeEnvio estado={estado} textoAlTerminar="Entrando">
            Entrar
          </BotonDeEnvio>
        </Aparece>

        {/* El botón de Google solo aparece cuando sus credenciales existen.
            Enseñarlo sin ellas lleva a una pantalla de error de Google, y
            quien lo pulse va a pensar que la aplicación está rota. */}
        {entorno.conGoogle && (
          <>
            <Aparece>
              <div className="separador">
                <span>o</span>
              </div>
            </Aparece>

            <Aparece>
              <BotonDeGoogle disabled={ocupado} onClick={() => void entrarConGoogle(recordar)} />
            </Aparece>
          </>
        )}
      </form>
    </LienzoDeAcceso>
  );
}
