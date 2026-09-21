import { AnimatePresence } from 'framer-motion';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { Panel } from './paginas/Panel.tsx';
import { Portada } from './paginas/Portada.tsx';
import { Acceso } from './paginas/autenticacion/Acceso.tsx';
import { ContrasenaNueva } from './paginas/autenticacion/ContrasenaNueva.tsx';
import { Recuperar } from './paginas/autenticacion/Recuperar.tsx';
import { Registro } from './paginas/autenticacion/Registro.tsx';
import { RutaProtegida } from './rutas/RutaProtegida.tsx';
import { RUTAS } from './rutas/rutas.ts';

/**
 * El mapa de la aplicacion.
 *
 * Las rutas publicas y las protegidas quedan separadas a la vista. Es mas
 * facil respetar una division que ya existe que introducirla cuando hay veinte
 * rutas puestas de cualquier manera.
 *
 * `AnimatePresence` con la ubicacion como clave es lo que permite que la
 * tarjeta de acceso se transforme entre las pantallas de autenticacion en vez
 * de desaparecer y volver: sin el, React desmonta la ruta vieja antes de que
 * Framer Motion pueda emparejarla con la nueva.
 */
export function App() {
  const ubicacion = useLocation();

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <Routes location={ubicacion} key={ubicacion.pathname}>
        {/* ---------- Publicas ---------- */}
        <Route path={RUTAS.INICIO} element={<Portada />} />

        {/* ---------- Autenticacion ---------- */}
        <Route path={RUTAS.ACCESO} element={<Acceso />} />
        <Route path={RUTAS.REGISTRO} element={<Registro />} />
        <Route path={RUTAS.RECUPERAR} element={<Recuperar />} />
        <Route path={RUTAS.CONTRASENA_NUEVA} element={<ContrasenaNueva />} />

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
    </AnimatePresence>
  );
}
