import type { CSSProperties } from 'react';

import '../estilos/racha-panel.css';
import type { DiaDeLaSemana, EstadoDelDia } from '../infraestructura/api/racha.ts';

/**
 * La semana de la racha (SCRUM-243): siete dias, de lunes a domingo, cada uno con su estado.
 *
 * Los dias hechos (o cubiertos por un congelamiento) que van seguidos se unen con una barra, como una
 * cadena. Lo que se dice con color y con forma tambien se dice con texto —«lunes: hecho»— para quien
 * lee con un lector de pantalla; las letras y las marcas son decorativas.
 *
 * `intensa` hace brillar mas la cadena (los hitos de una semana o mas). `retraso` es cuantos segundos
 * espera antes de empezar a marcar los dias, para que la celebracion los encienda a su tiempo.
 *
 * Con una semana que no tiene siete dias (un servidor viejo, un dato roto) no pinta nada.
 */

const NOMBRES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] as const;
const LETRAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;

const TEXTO_DEL_ESTADO: Readonly<Record<EstadoDelDia, string>> = {
  hecho: 'hecho',
  cubierto: 'cubierto por un congelamiento',
  hoy: 'hoy',
  sinActividad: 'sin actividad',
  futuro: 'todavía no',
};

function sumaAlEncadenado(estado: EstadoDelDia): boolean {
  return estado === 'hecho' || estado === 'cubierto';
}

/** El dibujo de la marca: un visto para lo hecho y un copo para lo que cubrio un congelamiento. */
function Marca({ estado }: { estado: EstadoDelDia }) {
  if (estado === 'hecho') {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
        <path
          className="racha-semana__visto"
          d="m5.5 12.5 4 4L18.5 7.5"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (estado === 'cubierto') {
    return (
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" />
      </svg>
    );
  }

  return null;
}

export function SemanaDeLaRacha({
  semana,
  intensa = false,
  retraso = 0,
}: {
  semana: readonly DiaDeLaSemana[];
  intensa?: boolean;
  retraso?: number;
}) {
  if (semana.length !== 7) {
    return null;
  }

  return (
    <ul
      className={`racha-semana${intensa ? ' racha-semana--intensa' : ''}`}
      aria-label="Tu semana"
      style={{ '--retraso': `${String(retraso)}s` } as CSSProperties}
    >
      {semana.map(({ dia, estado }, indice) => {
        const siguiente = semana[indice + 1];
        const une =
          sumaAlEncadenado(estado) && siguiente !== undefined && sumaAlEncadenado(siguiente.estado);

        return (
          <li
            key={dia}
            className={`racha-semana__dia racha-semana__dia--${estado}${une ? ' racha-semana__dia--une' : ''}`}
            style={{ '--i': indice } as CSSProperties}
          >
            <span className="racha-semana__letra" aria-hidden="true">
              {LETRAS[indice]}
            </span>
            <span className="racha-semana__marca" aria-hidden="true">
              <Marca estado={estado} />
            </span>
            <span className="solo-lectores">{`${NOMBRES[indice] ?? ''}: ${TEXTO_DEL_ESTADO[estado]}`}</span>
          </li>
        );
      })}
    </ul>
  );
}
