import { AnimatePresence } from 'framer-motion';
import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { BannerDeAnalitica } from './analitica/BannerDeAnalitica.tsx';
import { SaltoAlContenido } from './componentes/SaltoAlContenido.tsx';
import { Actividad } from './paginas/actividad/Actividad.tsx';
import { Panel } from './paginas/panel/Panel.tsx';
import { Perfil } from './paginas/perfil/Perfil.tsx';
import { Sendero } from './paginas/sendero/Sendero.tsx';
import { Acceso } from './paginas/autenticacion/Acceso.tsx';
import { ContrasenaNueva } from './paginas/autenticacion/ContrasenaNueva.tsx';
import { Recuperar } from './paginas/autenticacion/Recuperar.tsx';
import { Registro } from './paginas/autenticacion/Registro.tsx';
import { Cookies } from './paginas/legal/Cookies.tsx';
import { Privacidad } from './paginas/legal/Privacidad.tsx';
import { Terminos } from './paginas/legal/Terminos.tsx';
import { Portada } from './paginas/portada/Portada.tsx';
import { RutaDeInvitado } from './rutas/RutaDeInvitado.tsx';
import { RutaProtegida } from './rutas/RutaProtegida.tsx';
import { RUTAS } from './rutas/rutas.ts';

/**
 * El diario se carga aparte (SCRUM-96): su editor pesa, y quien no lo abre no
 * tiene por que descargarlo.
 */
const Diario = lazy(() =>
  import('./paginas/diario/Diario.tsx').then((modulo) => ({ default: modulo.Diario })),
);

/**
 * El mapa de la aplicacion.
 *
 * ---------------------------------------------------------------------------
 * Tres clases de ruta, y ninguna se cuela en otra
 * ---------------------------------------------------------------------------
 *
 * - **Publicas**: la portada y los documentos legales (privacidad, terminos y
 *   cookies). Cualquiera, con sesion o sin ella.
 * - **De invitado**: entrar, registrarse y pedir una contrasena nueva. Solo
 *   tienen sentido sin sesion; con sesion abierta llevan al panel. Rellenar un
 *   formulario que no va a cambiar nada es peor que no verlo.
 * - **Protegidas**: el panel. Sin sesion, al acceso, anotando a donde se iba.
 *
 * `/contrasena-nueva` queda fuera de las tres. Es la unica pantalla a la que
 * se llega **con** una sesion recien abierta por Supabase al leer el enlace
 * del correo, asi que tratarla como ruta de invitado la haria inalcanzable
 * justo cuando es valida. Su guarda vive dentro: sin esa sesion y sin un
 * motivo de error en la direccion, devuelve a pedir el enlace.
 *
 * ---------------------------------------------------------------------------
 * Que es y que no es esto
 * ---------------------------------------------------------------------------
 *
 * Esto ordena el recorrido; no protege nada. Quien quiera saltarselo puede
 * hacerlo desde las herramientas del navegador en diez segundos. Lo que de
 * verdad protege son el token que la API verifica y las politicas de
 * aislamiento de la base.
 *
 * `AnimatePresence` con la ubicacion como clave es lo que permite que la
 * tarjeta de acceso se transforme entre las pantallas de autenticacion en vez
 * de desaparecer y volver: sin el, React desmonta la ruta vieja antes de que
 * Framer Motion pueda emparejarla con la nueva.
 */
export function App() {
  const ubicacion = useLocation();

  return (
    <>
      {/* Lo primero del documento, para que sea la primera parada al tabular
          en cualquier pantalla. */}
      <SaltoAlContenido />

      {/* Sin identificador de medicion no se ve nunca (SCRUM-161). Va aqui, justo
          despues del salto, para que quien navega con teclado lo alcance pronto
          aunque se vea abajo. */}
      <BannerDeAnalitica />

      <AnimatePresence mode="popLayout" initial={false}>
        <Routes location={ubicacion} key={ubicacion.pathname}>
          {/* ---------- Publicas ---------- */}
          <Route path={RUTAS.INICIO} element={<Portada />} />
          <Route path={RUTAS.PRIVACIDAD} element={<Privacidad />} />
          <Route path={RUTAS.TERMINOS} element={<Terminos />} />
          <Route path={RUTAS.COOKIES} element={<Cookies />} />

          {/* ---------- Solo sin sesion ---------- */}
          <Route
            path={RUTAS.ACCESO}
            element={
              <RutaDeInvitado>
                <Acceso />
              </RutaDeInvitado>
            }
          />
          <Route
            path={RUTAS.REGISTRO}
            element={
              <RutaDeInvitado>
                <Registro />
              </RutaDeInvitado>
            }
          />
          <Route
            path={RUTAS.RECUPERAR}
            element={
              <RutaDeInvitado>
                <Recuperar />
              </RutaDeInvitado>
            }
          />

          {/* Se guarda sola: ver la nota de arriba. */}
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
          <Route
            path={RUTAS.PERFIL}
            element={
              <RutaProtegida>
                <Perfil />
              </RutaProtegida>
            }
          />
          <Route
            path={RUTAS.DIARIO}
            element={
              <RutaProtegida>
                <Suspense
                  fallback={
                    <p className="solo-lectores" role="status">
                      Cargando tu diario…
                    </p>
                  }
                >
                  <Diario />
                </Suspense>
              </RutaProtegida>
            }
          />
          <Route
            path={RUTAS.MODULO}
            element={
              <RutaProtegida>
                <Sendero />
              </RutaProtegida>
            }
          />
          <Route
            path={RUTAS.ACTIVIDAD}
            element={
              <RutaProtegida>
                <Actividad />
              </RutaProtegida>
            }
          />

          {/* Una direccion que no existe no merece una pantalla de error: se
              vuelve a la portada, que es lo que la persona queria de todos
              modos. */}
          <Route path="*" element={<Navigate to={RUTAS.INICIO} replace />} />
        </Routes>
      </AnimatePresence>
    </>
  );
}
