import type { Session } from '@supabase/supabase-js';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { SesionContexto, type EstadoDeSesion } from '../sesion/SesionContexto.ts';
import { RutaProtegida } from './RutaProtegida.tsx';
import { RUTAS } from './rutas.ts';

/**
 * Se construye el estado a mano en vez de levantar el proveedor. Asi la prueba
 * habla de lo unico que hace este componente —decidir si deja pasar— y no
 * depende de Supabase ni de la red.
 */
function estado(parcial: Partial<EstadoDeSesion>): EstadoDeSesion {
  const vacio = vi.fn();

  return {
    sesion: null,
    cargando: false,
    correo: null,
    registrarse: vacio,
    entrar: vacio,
    entrarConGoogle: vacio,
    pedirRecuperacion: vacio,
    cambiarContrasena: vacio,
    salir: vacio,
    ...parcial,
  };
}

const SESION_CUALQUIERA = { user: { email: 'alguien@ucundinamarca.edu.co' } } as Session;

/** Pinta la ruta de acceso mostrando a donde queria ir quien llego aqui. */
function PantallaDeAcceso() {
  const ubicacion = useLocation();
  const estadoDeRuta = ubicacion.state as { volverA?: string } | null;

  return <p>Acceso. Venia de: {estadoDeRuta?.volverA ?? 'ningun sitio'}</p>;
}

function pintar(valor: EstadoDeSesion, rutaInicial = RUTAS.PANEL) {
  return render(
    <SesionContexto.Provider value={valor}>
      <MemoryRouter initialEntries={[rutaInicial]}>
        <Routes>
          <Route path={RUTAS.ACCESO} element={<PantallaDeAcceso />} />
          <Route
            path={RUTAS.PANEL}
            element={
              <RutaProtegida>
                <p>Contenido reservado</p>
              </RutaProtegida>
            }
          />
        </Routes>
      </MemoryRouter>
    </SesionContexto.Provider>,
  );
}

describe('RutaProtegida', () => {
  it('deja pasar a quien tiene sesion', () => {
    pintar(estado({ sesion: SESION_CUALQUIERA }));

    expect(screen.getByText('Contenido reservado')).toBeInTheDocument();
  });

  it('manda a la pantalla de acceso a quien no la tiene', () => {
    pintar(estado({ sesion: null }));

    expect(screen.queryByText('Contenido reservado')).not.toBeInTheDocument();
    expect(screen.getByText(/^Acceso\./)).toBeInTheDocument();
  });

  it('recuerda a donde iba, para devolverla ahi despues de entrar', () => {
    pintar(estado({ sesion: null }));

    expect(screen.getByText(`Acceso. Venia de: ${RUTAS.PANEL}`)).toBeInTheDocument();
  });

  it('no expulsa a nadie mientras aun no sabe si hay sesion', () => {
    // Es el caso de recargar la pagina. Sin este estado, la aplicacion pinta
    // un instante como si no hubiera nadie y expulsa a quien si tenia sesion:
    // el parpadeo dura poco y la expulsion no se deshace sola.
    pintar(estado({ sesion: null, cargando: true }));

    expect(screen.queryByText(/^Acceso\./)).not.toBeInTheDocument();
    expect(screen.queryByText('Contenido reservado')).not.toBeInTheDocument();
  });
});
