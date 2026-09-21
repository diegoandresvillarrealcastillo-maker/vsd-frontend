import { entorno } from '../infraestructura/entorno.ts';

/**
 * Portada provisional.
 *
 * Existe para que el andamiaje tenga algo que mostrar y para dejar el aviso
 * clinico a la vista desde el primer dia. La portada de verdad es la epica
 * SCRUM-6.
 */
export function Portada() {
  return (
    <main
      style={{
        minHeight: '100%',
        display: 'grid',
        placeItems: 'center',
        padding: '16px',
      }}
    >
      <div style={{ maxWidth: '38rem', textAlign: 'center' }}>
        <h1 style={{ marginBottom: '0.25rem' }}>VSD Health</h1>
        <p style={{ color: 'var(--texto-tenue)', marginTop: 0 }}>
          Acompanamiento del bienestar emocional y cognitivo.
        </p>

        <p
          style={{
            marginTop: '2rem',
            padding: '1rem',
            border: '1px solid var(--borde)',
            borderRadius: 'var(--radio)',
            background: 'var(--fondo-elevado)',
            color: 'var(--texto-tenue)',
            textAlign: 'left',
          }}
        >
          <strong style={{ color: 'var(--texto)' }}>VSD Health no diagnostica</strong>, no formula
          medicamentos y no reemplaza la atencion de psicologos, medicos ni psiquiatras. Lo que
          ofrece es orientativo y de apoyo.
        </p>

        <p style={{ color: 'var(--texto-tenue)', fontSize: '0.875rem' }}>
          Ambiente: {entorno.nombre}
        </p>
      </div>
    </main>
  );
}
