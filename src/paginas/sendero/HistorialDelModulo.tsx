import { useId } from 'react';

import { EstadoDeCarga } from '../../componentes/EstadoDeCarga.tsx';
import { EstadoVacio } from '../../componentes/EstadoVacio.tsx';
import type { HechoDelHistorial } from '../../infraestructura/api/historial.ts';
import type { Modulo } from '../../infraestructura/api/cuenta.ts';
import { horaDe, nombreDelDia } from '../diario/calendarioDelDiario.ts';
import { Icono } from '../panel/Icono.tsx';
import { useHistorialDelModulo } from './useHistorialDelModulo.ts';

/** Los hechos de un mismo dia, en el orden en que llegaron (del mas reciente al mas antiguo). */
interface DiaDelHistorial {
  readonly dia: string;
  readonly hechos: readonly HechoDelHistorial[];
}

/**
 * Agrupa por dia **sin reordenar**: el servidor ya los entrega del mas reciente al mas antiguo,
 * y un dia puede quedar partido entre dos paginas; al sumar la segunda, sus hechos se unen al
 * mismo grupo en lugar de abrir otro igual.
 */
function agruparPorDia(hechos: readonly HechoDelHistorial[]): readonly DiaDelHistorial[] {
  const grupos: { dia: string; hechos: HechoDelHistorial[] }[] = [];

  for (const hecho of hechos) {
    const ultimo = grupos.at(-1);

    if (ultimo?.dia === hecho.dia) {
      ultimo.hechos.push(hecho);
    } else {
      grupos.push({ dia: hecho.dia, hechos: [hecho] });
    }
  }

  return grupos;
}

/**
 * Lo que la persona hizo en un modulo, de lo mas reciente a lo mas antiguo (SCRUM-184).
 *
 * - **Solo que hizo y cuando**: la actividad y la hora, agrupadas por dia. Nada de puntajes,
 *   niveles ni «como le fue»: aqui nada se califica ni se compara.
 * - **Por paginas que arma el servidor**, con «Ver mas»: ni se baja todo ni se corta en seco.
 * - **Sin conexion** no hay historial (no se guarda en este equipo) y se dice con calma,
 *   apuntando a lo de hoy, que si tiene copia. No tapa el sendero.
 */
export function HistorialDelModulo({
  modulo,
  titulo,
  hoy,
}: {
  modulo: Modulo;
  titulo: string;
  /** El dia de hoy (AAAA-MM-DD, en la zona de la persona): para decir «Hoy» y «Ayer». */
  hoy: string;
}) {
  const idDelTitulo = useId();
  const historial = useHistorialDelModulo(modulo);
  const dias = agruparPorDia(historial.hechos);

  return (
    <section className="app__caja sendero__historial" aria-labelledby={idDelTitulo}>
      <div className="sendero__historial-cabecera">
        <h2 id={idDelTitulo} className="perfil__apartado-titulo">
          Tu historial
        </h2>
      </div>

      <p className="app__nota">
        Lo que hiciste en {titulo}, de lo más reciente a lo más antiguo. Aquí nada se califica.
      </p>

      {historial.fase.fase === 'cargando' && (
        <EstadoDeCarga mensaje="Cargando tu historial…" tarjetas={1} />
      )}

      {historial.fase.fase === 'error' && (
        <div className="app__aviso app__aviso--fallo" role="alert">
          <p>{historial.fase.mensaje}</p>
          <button type="button" className="app__boton" onClick={historial.reintentar}>
            Reintentar
          </button>
        </div>
      )}

      {historial.fase.fase === 'listo' && dias.length === 0 && (
        <EstadoVacio
          titulo="Todavía no hay nada en tu historial"
          texto={`Cuando hagas una actividad de ${titulo}, aparece aquí.`}
          icono={<Icono nombre="calendar" tamano={22} />}
        />
      )}

      {dias.map(({ dia, hechos }) => {
        const nombre = nombreDelDia(dia, hoy);

        return (
          <article key={dia} className="sendero__historial-dia">
            <h3 className="sendero__historial-fecha">{nombre}</h3>

            <ol className="sendero__historial-lista" aria-label={nombre}>
              {hechos.map((hecho) => (
                <li key={hecho.id} className="sendero__historial-hecho">
                  <span className="sendero__historial-hora">{horaDe(hecho.hechaEn)}</span>
                  <span className="sendero__historial-nombre">{hecho.actividad.nombre}</span>
                </li>
              ))}
            </ol>
          </article>
        );
      })}

      {historial.errorAlCargarMas !== null && (
        <p className="app__aviso app__aviso--fallo" role="alert">
          {historial.errorAlCargarMas}
        </p>
      )}

      {historial.fase.fase === 'listo' && historial.hayMas && (
        <button
          type="button"
          className="pildora pildora--fantasma sendero__historial-mas"
          disabled={historial.cargandoMas}
          onClick={historial.verMas}
        >
          {historial.cargandoMas ? 'Cargando…' : 'Ver más'}
        </button>
      )}
    </section>
  );
}
