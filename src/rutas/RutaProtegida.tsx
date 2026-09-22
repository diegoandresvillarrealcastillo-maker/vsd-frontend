import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useSesion } from '../sesion/useSesion.ts';
import { RUTAS } from './rutas.ts';

/**
 * Envuelve lo que solo puede ver quien tiene sesion.
 *
 * Esto es comodidad, no seguridad. Quien quiera saltarselo puede hacerlo desde
 * las herramientas del navegador en diez segundos, y por eso lo que de verdad
 * protege esta en otro sitio: el token que la API verifica y las politicas de
 * aislamiento de la base. Ocultar una pantalla no es un control de acceso.
 */
export function RutaProtegida({ children }: { children: ReactNode }) {
  const { sesion, cargando } = useSesion();
  const ubicacion = useLocation();

  if (cargando) {
    // Todavia no se sabe si hay sesion. Redirigir ahora expulsaria a quien si
    // la tiene, cada vez que recarga la pagina.
    return (
      <p role="status" aria-live="polite" className="solo-lectores">
        Comprobando la sesión
      </p>
    );
  }

  if (!sesion) {
    // Se anota a donde iba para devolverla ahi despues de entrar. Sin esto,
    // cualquier enlace compartido acaba en la portada y hay que volver a
    // buscar lo que se estaba mirando.
    return <Navigate to={RUTAS.ACCESO} replace state={{ volverA: ubicacion.pathname }} />;
  }

  return <>{children}</>;
}
