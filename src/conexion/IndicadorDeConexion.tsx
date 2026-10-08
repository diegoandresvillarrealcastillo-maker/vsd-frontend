import { useEffect, useId, useRef, useState } from 'react';

import '../estilos/conexion.css';
import { Icono, type NombreDeIcono } from '../paginas/panel/Icono.tsx';
import { useSincronizacion } from '../sincronizacion/estado.ts';
import { PanelDeSincronizacion } from './PanelDeSincronizacion.tsx';

/**
 * El indicador de la barra de arriba (SCRUM-137): dice si hay conexion, cuantos
 * cambios siguen guardados en este equipo y si se esta enviando, y abre la lista.
 *
 * Esta siempre. Con todo enviado es solo un icono discreto; con algo que decir, se
 * lee: "Sin conexión · 3 cambios guardados en este equipo". El color solo no dice
 * nada: el estado siempre esta en el texto y en el nombre del boton.
 *
 * Es un boton que abre un panel (un desplegable, no un dialogo): quien lo abre
 * puede seguir viendo la pantalla de detras. Escape o pulsar fuera lo cierra.
 */

function iconoPara(
  sinConexion: boolean,
  sincronizando: boolean,
  tono: 'normal' | 'aviso' | 'atencion',
): NombreDeIcono {
  if (sinConexion) {
    return 'cloud-off';
  }

  if (sincronizando) {
    return 'refresh';
  }

  return tono === 'atencion' ? 'alert' : 'cloud';
}

export function IndicadorDeConexion() {
  const { indicador, conexion, sincronizando, peticionDeLista } = useSincronizacion();
  const [abierto, setAbierto] = useState(false);
  /** Se abrio porque un aviso lo pidio, y no porque la persona pulso el boton. */
  const [abiertoPorUnAviso, setAbiertoPorUnAviso] = useState(false);
  const idDelPanel = useId();
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  /** La ultima peticion de abrir la lista que ya se atendio. */
  const peticionAtendida = useRef(peticionDeLista);

  // Un aviso pidio ver la lista ("Ver la lista"). Se abre solo cuando el numero
  // cambia, no cada vez que se pinta.
  useEffect(() => {
    if (peticionDeLista !== peticionAtendida.current) {
      peticionAtendida.current = peticionDeLista;
      setAbiertoPorUnAviso(true);
      setAbierto(true);
    }
  }, [peticionDeLista]);

  useEffect(() => {
    if (!abierto) {
      return undefined;
    }

    function alPulsarFuera(evento: MouseEvent) {
      if (!contenedor.current?.contains(evento.target as Node)) {
        setAbierto(false);
      }
    }

    function alPulsarTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        setAbierto(false);
        // Quien cerro con el teclado sigue ahi.
        boton.current?.focus();
      }
    }

    document.addEventListener('mousedown', alPulsarFuera);
    document.addEventListener('keydown', alPulsarTecla);

    return () => {
      document.removeEventListener('mousedown', alPulsarFuera);
      document.removeEventListener('keydown', alPulsarTecla);
    };
  }, [abierto]);

  const sinConexion = conexion === 'sin_conexion';
  // Con todo enviado y conexion, solo el icono: lo normal no pide atencion.
  const soloIcono = indicador.tono === 'normal';

  return (
    <div className="conexion" ref={contenedor}>
      <button
        ref={boton}
        type="button"
        className={`conexion__boton conexion__boton--${indicador.tono}${soloIcono ? ' conexion__boton--discreto' : ''}${sincronizando && !sinConexion ? ' conexion__boton--sincronizando' : ''}`}
        aria-expanded={abierto}
        aria-controls={abierto ? idDelPanel : undefined}
        // Empieza por lo que se ve, para que quien lo dicta por voz lo encuentre.
        aria-label={`${indicador.texto}. ${abierto ? 'Cerrar' : 'Ver'} el estado de la sincronización`}
        onClick={() => {
          setAbiertoPorUnAviso(false);
          setAbierto((antes) => !antes);
        }}
      >
        <Icono nombre={iconoPara(sinConexion, sincronizando, indicador.tono)} tamano={18} />
        {!soloIcono && <span className="conexion__texto">{indicador.texto}</span>}
        {indicador.cantidad > 0 && (
          <span className="conexion__numero" aria-hidden="true">
            {indicador.cantidad}
          </span>
        )}
      </button>

      {abierto && (
        <PanelDeSincronizacion
          id={idDelPanel}
          enfocar={abiertoPorUnAviso}
          alCerrar={() => {
            setAbierto(false);
            boton.current?.focus();
          }}
        />
      )}
    </div>
  );
}
