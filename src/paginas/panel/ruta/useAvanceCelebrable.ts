import { useEffect, useMemo, useState } from 'react';

/**
 * Lo que se acaba de hacer, para celebrarlo (SCRUM-170).
 *
 * Compara lo hecho ahora con lo que el panel vio la ultima vez **en esta sesion del
 * navegador**. Asi, quien termina una actividad y vuelve al panel ve su punto recien
 * hecho y el avance que se llena, y quien abre el panel por la manana no ve nada raro.
 *
 * La memoria vive en una variable del modulo y nada se guarda en el equipo: se pierde al
 * recargar la pagina, que es lo que se quiere (la celebracion es de ese momento, no un
 * dato de la persona). Se borra al cerrar sesion, como las demas memorias de la persona,
 * para que quien entre despues no vea celebrado lo que hizo otra.
 */
let vistas: ReadonlySet<string> | null = null;

/** Al cerrar sesion, y en las pruebas: la proxima vez que se vea el panel todo es «de antes». */
export function olvidarLoVisto(): void {
  vistas = null;
}

export function useAvanceCelebrable(idsHechos: readonly string[]): {
  /** Las que se hicieron desde la ultima vez que se vio el panel, o con el panel abierto. */
  readonly nuevas: ReadonlySet<string>;
} {
  // Lo visto al montar. La primera vez no hay nada nuevo: todo lo hecho ya estaba hecho.
  const [antes] = useState<ReadonlySet<string>>(() => vistas ?? new Set(idsHechos));
  const clave = idsHechos.join('|');
  const nuevas = useMemo(
    () => new Set(idsHechos.filter((id) => !antes.has(id))),
    // `clave` representa a `idsHechos`: cambia solo cuando cambia su contenido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [antes, clave],
  );

  // Se guarda lo de ahora, sin acumular: lo que dejo de estar hecho se olvida.
  useEffect(() => {
    vistas = new Set(idsHechos);
  }, [idsHechos]);

  return { nuevas };
}
