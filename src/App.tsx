import { Navigate, Route, Routes } from 'react-router-dom';

import { Panel } from './paginas/Panel.tsx';
import { Portada } from './paginas/Portada.tsx';
import { RutaProtegida } from './rutas/RutaProtegida.tsx';
import { RUTAS } from './rutas/rutas.ts';

/**
 * El mapa de la aplicacion.
 *
 * Las rutas publicas y las protegidas quedan separadas a la vista. Es mas
 * facil respetar una division que ya existe que introducirla cuando hay veinte
 * rutas puestas de cualquier manera.
 */
export function App() {
  return (
    <Routes>
      {/* ---------- Publicas ---------- */}
      <Route path={RUTAS.INICIO} element={<Portada />} />

      {/* ---------- Autenticacion (SCRUM-73) ---------- */}

      {/* ---------- Protegidas ---------- */}
      <Route
        path={RUTAS.PANEL}
        element={
          <RutaProtegida>
            <Panel />
          </RutaProtegida>
        }
      />

      {/* Una direccion que no existe no merece una pantalla de error: se
          vuelve a la portada, que es lo que la persona queria de todos modos. */}
      <Route path="*" element={<Navigate to={RUTAS.INICIO} replace />} />
    </Routes>
  );
}
