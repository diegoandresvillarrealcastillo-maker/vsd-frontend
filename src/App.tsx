import { Navigate, Route, Routes } from 'react-router-dom';

import { Portada } from './paginas/Portada.tsx';
import { RUTAS } from './rutas/rutas.ts';

/**
 * El mapa de la aplicacion.
 *
 * Las rutas publicas y las protegidas quedan separadas desde el principio,
 * aunque hoy no haya ninguna protegida todavia. Es mas facil respetar una
 * division que ya existe que introducirla cuando ya hay veinte rutas puestas
 * de cualquier manera.
 */
export function App() {
  return (
    <Routes>
      {/* ---------- Publicas ---------- */}
      <Route path={RUTAS.INICIO} element={<Portada />} />

      {/* ---------- Autenticacion (SCRUM-73) ---------- */}
      {/* ---------- Protegidas (SCRUM-72) ---------- */}

      {/* Una direccion que no existe no merece una pantalla de error: se
          vuelve a la portada, que es lo que la persona queria de todos modos. */}
      <Route path="*" element={<Navigate to={RUTAS.INICIO} replace />} />
    </Routes>
  );
}
