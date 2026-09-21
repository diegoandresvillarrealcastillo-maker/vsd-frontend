import { useSesion } from '../sesion/useSesion.ts';

/**
 * Primera pantalla despues de entrar. Provisional.
 *
 * Existe para que las rutas protegidas tengan a donde llevar y para poder
 * comprobar que la sesion llega hasta aqui. El panel de verdad es la epica
 * SCRUM-12.
 */
export function Panel() {
  const { correo, salir } = useSesion();

  return (
    <main style={{ minHeight: '100%', display: 'grid', placeItems: 'center', padding: '16px' }}>
      <div style={{ maxWidth: '32rem', textAlign: 'center' }}>
        <h1>Ya estas dentro</h1>
        <p style={{ color: 'var(--texto-tenue)' }}>{correo}</p>

        <button type="button" onClick={() => void salir()}>
          Cerrar sesion
        </button>
      </div>
    </main>
  );
}
