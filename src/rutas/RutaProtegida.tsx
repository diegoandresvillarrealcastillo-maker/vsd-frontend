import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { EstadoDeCarga } from '../componentes/EstadoDeCarga.tsx';
import { useRegistroCompleto } from '../sesion/useRegistroCompleto.ts';
import { useSesion } from '../sesion/useSesion.ts';
import { RUTAS } from './rutas.ts';

interface Props {
  children: ReactNode;
  /**
   * Para la pantalla que completa el registro y para las que no tienen sentido
   * sin cuenta: ahi no se comprueba que el registro este completo, porque es
   * justo lo que van a hacer.
   */
  sinRegistro?: boolean;
}

/**
 * Envuelve lo que solo puede ver quien tiene sesion **y su registro completo**.
 *
 * Esto es comodidad, no seguridad. Quien quiera saltarselo puede hacerlo desde
 * las herramientas del navegador en diez segundos, y por eso lo que de verdad
 * protege esta en otro sitio: el token que la API verifica y las politicas de
 * aislamiento de la base. Ocultar una pantalla no es un control de acceso. Lo
 * mismo vale para el registro: a una cuenta incompleta la API le responde 403 en
 * todo lo demas, haya pasado por aqui o no.
 *
 * ## Los textos que cambian (SCRUM-237)
 *
 * Quien tiene el registro completo pero acepto una version del aviso o de los terminos que ya no es la
 * vigente se lleva a «Actualizamos nuestros textos». Se entera de dos maneras: al comprobar el
 * registro, y por un 403 de la API en cualquier llamada (una version nueva con la sesion abierta).
 *
 * ## El registro
 *
 * Quien tiene identidad pero no ha declarado su fecha de nacimiento ni marcado
 * las casillas —entro con Google, confirmo su correo en otro dispositivo, o es una
 * cuenta de antes de que se pidiera— se lleva a «Completa tu registro» antes de
 * ver nada. El panel ya no da de alta por su cuenta: eso era lo que dejaba a
 * quien entraba con Google con un consentimiento que nadie habia dado.
 */
export function RutaProtegida({ children, sinRegistro = false }: Props) {
  const { sesion, cargando } = useSesion();
  const ubicacion = useLocation();
  const registro = useRegistroCompleto(
    sesion?.user.id ?? null,
    !sinRegistro && !cargando && sesion !== null,
  );

  if (cargando) {
    // Todavia no se sabe si hay sesion. Redirigir ahora expulsaria a quien si
    // la tiene, cada vez que recarga la pagina.
    return <EstadoDeCarga mensaje="Comprobando la sesión" tarjetas={1} tardio />;
  }

  if (!sesion) {
    // Se anota a donde iba para devolverla ahi despues de entrar. Sin esto,
    // cualquier enlace compartido acaba en la portada y hay que volver a
    // buscar lo que se estaba mirando.
    return <Navigate to={RUTAS.ACCESO} replace state={{ volverA: ubicacion.pathname }} />;
  }

  if (!sinRegistro) {
    if (registro === 'comprobando') {
      return <EstadoDeCarga mensaje="Comprobando tu registro" tarjetas={1} tardio />;
    }

    if (registro === 'pendiente') {
      return (
        <Navigate to={RUTAS.COMPLETAR_REGISTRO} replace state={{ volverA: ubicacion.pathname }} />
      );
    }

    // Tiene el registro completo, pero el aviso o los terminos cambiaron desde que los acepto
    // (SCRUM-237). La API le responde 403 en todo lo demas, haya pasado por aqui o no.
    if (registro === 'textos-pendientes') {
      return (
        <Navigate to={RUTAS.ACTUALIZAMOS_TEXTOS} replace state={{ volverA: ubicacion.pathname }} />
      );
    }
  }

  return <>{children}</>;
}
