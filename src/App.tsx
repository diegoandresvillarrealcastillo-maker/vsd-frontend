import { Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { BannerDeAnalitica } from './analitica/BannerDeAnalitica.tsx';
import { PantallaDeCarga } from './componentes/PantallaDeCarga.tsx';
import { SaltoAlContenido } from './componentes/SaltoAlContenido.tsx';
import { LimiteDeErrores } from './errores/LimiteDeErrores.tsx';
import { Portada } from './paginas/portada/Portada.tsx';
import {
  Acceso,
  Actividad,
  ActualizamosNuestrosTextos,
  CompletarRegistro,
  ContrasenaNueva,
  Cookies,
  Diario,
  Panel,
  Perfil,
  Privacidad,
  Recuperar,
  Registro,
  Sendero,
  SoloMayores,
  Terminos,
} from './rutas/paginas.ts';
import { RutaDeInvitado } from './rutas/RutaDeInvitado.tsx';
import { RutaProtegida } from './rutas/RutaProtegida.tsx';
import { RUTAS } from './rutas/rutas.ts';

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
 * ---------------------------------------------------------------------------
 * Cada pantalla se baja cuando se necesita (SCRUM-283)
 * ---------------------------------------------------------------------------
 *
 * Solo la portada va en el paquete principal; las demas estan en `rutas/paginas.ts`. Mientras
 * llega la primera, `Suspense` muestra la misma pantalla de carga que el `index.html` pinto al abrir,
 * asi que no hay un salto entre una y otra. Al navegar despues, `react-router` conserva la pantalla de
 * antes hasta que la nueva esta lista (la transicion no enseña el respaldo).
 *
 * Aqui no hay `AnimatePresence`: sobre `<Routes>` la pantalla que se iba no tenia un nodo del que
 * Framer Motion pudiera sacarla y se quedaba debajo de la nueva, con dos `main` a la vez. Cada
 * pantalla se anima por dentro (la tarjeta de acceso con su `layoutId`, la pastilla de la barra).
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

      {/* Un error al pintar una pantalla ya no deja la aplicacion en blanco
          (SCRUM-156): sale la pantalla de error con una salida y las lineas de
          atencion, y navegar a otra ruta la quita sola. */}
      <LimiteDeErrores origen="ruta" restablecerCon={ubicacion.pathname}>
        <Suspense fallback={<PantallaDeCarga mensaje="Preparando tu espacio…" />}>
          <Routes>
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

            {/* Lo que ve quien resulta menor de 18 anos. Publica: se llega despues
              de cerrar la sesion, y no pide ni guarda nada. */}
            <Route path={RUTAS.SOLO_MAYORES} element={<SoloMayores />} />

            {/* Pide sesion pero no el registro completo: es justo lo que hace. */}
            <Route
              path={RUTAS.COMPLETAR_REGISTRO}
              element={
                <RutaProtegida sinRegistro>
                  <CompletarRegistro />
                </RutaProtegida>
              }
            />

            {/* Pide sesion pero no el registro completo: es donde se vuelve a aceptar el aviso o los
              terminos cuando cambian (SCRUM-237), asi que no puede exigir estar al dia. */}
            <Route
              path={RUTAS.ACTUALIZAMOS_TEXTOS}
              element={
                <RutaProtegida sinRegistro>
                  <ActualizamosNuestrosTextos />
                </RutaProtegida>
              }
            />

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
                  <Diario />
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
        </Suspense>
      </LimiteDeErrores>
    </>
  );
}
