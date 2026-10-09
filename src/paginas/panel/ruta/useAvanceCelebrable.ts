import { useEffect, useRef, useState } from 'react';

/**
 * Lo que se acaba de hacer, para celebrarlo (SCRUM-170).
 *
 * Compara lo hecho ahora con lo que el panel vio la ultima vez **en esta sesion del
 * navegador**. Asi, quien termina una actividad y vuelve al panel ve su punto recien
 * hecho y el avance que se llena, y quien abre el panel por la manana no ve nada raro.
 *
 * La memoria vive en una variable del modulo y nada se guarda en el equipo: se pierde al
 * recargar la pagina, que es lo que se quiere (la celebracion es de ese momento, no un
 * dato de la persona).
 */
let vistas: ReadonlySet<string> | null = null;

/** Solo para las pruebas: cada una empieza sin haber visto nada. */
export function olvidarLoVisto(): void {
  vistas = null;
}

export function useAvanceCelebrable(idsHechos: readonly string[]): {
  /** Las que se hicieron desde la ultima vez que se vio el panel. */
  readonly nuevas: ReadonlySet<string>;
} {
  const clave = idsHechos.join('|');
  const conocidas = useRef<ReadonlySet<string> | null>(null);

  // La primera vez que se ve el panel no hay nada nuevo: todo lo hecho ya estaba hecho.
  const [nuevas, setNuevas] = useState<ReadonlySet<string>>(() => {
    const antes = vistas;

    return new Set(antes === null ? [] : idsHechos.filter((id) => !antes.has(id)));
  });

  useEffect(() => {
    const base = conocidas.current ?? vistas ?? new Set(idsHechos);
    const mas = idsHechos.filter((id) => !base.has(id) && !nuevas.has(id));

    if (mas.length > 0) {
      setNuevas((antes) => new Set([...antes, ...mas]));
    }

    const ahora = new Set([...base, ...idsHechos]);

    conocidas.current = ahora;
    vistas = ahora;
    // `clave` representa a `idsHechos`: cambia solo cuando cambia su contenido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  return { nuevas };
}
