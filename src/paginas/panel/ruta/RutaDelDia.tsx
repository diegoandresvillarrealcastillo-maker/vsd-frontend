import { Confeti } from '../../../componentes/Confeti.tsx';
import { EstadoVacio } from '../../../componentes/EstadoVacio.tsx';
import '../../../estilos/ruta.css';
import type { Modulo } from '../../../infraestructura/api/cuenta.ts';
import { AcordeonDeModulo } from '../AcordeonDeModulo.tsx';
import { Icono } from '../Icono.tsx';
import type { RutaDelDia as Ruta } from './construirLaRuta.ts';

/**
 * Lo que toca hoy (SCRUM-170), con los modulos activos juntos como pestañas que se despliegan.
 *
 * Cada pestaña dice lo que toca hoy en ese modulo; al abrirla se ve su ruta de 365 dias, con la
 * vista ya en el dia activo, y lo de hoy se abre desde el punto «Hoy» de esa ruta. La meta del dia
 * son unas tres actividades repartidas entre los modulos (`construirLaRuta`); con una sola que se
 * haga, la racha ya cuenta.
 *
 * Nada aqui castiga: no hay vidas, ni rachas que se rompan, ni nada que se pierda por no hacer algo
 * hoy. Lo que no se hizo espera, sin avisos.
 *
 * Que modulo esta abierto lo decide el panel (solo uno a la vez, y se recuerda el ultimo).
 */
export function RutaDelDia({
  ruta,
  nuevas,
  desplegado,
  alAlternar,
}: {
  ruta: Ruta;
  /** Los ids de las actividades que se acaban de hacer, para celebrarlas. */
  nuevas: ReadonlySet<string>;
  desplegado: Modulo | null;
  alAlternar: (modulo: Modulo) => void;
}) {
  return (
    <section className="app__caja ruta" aria-labelledby="titulo-ruta">
      {/* La cabecera es lo que senala el tutorial: siempre esta y siempre es pequena. */}
      <div className="ruta__cabecera" data-tutorial="ruta">
        <div>
          <p className="app__antetitulo">Para hoy</p>
          <h2 id="titulo-ruta" className="app__titulo app__titulo--mediano">
            Tu ruta de hoy
          </h2>
        </div>

        {ruta.total > 0 && (
          <span className="app__contador">
            {ruta.hechas} de {ruta.total}
          </span>
        )}
      </div>

      {ruta.modulos.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no hay nada para hoy"
          texto="Cuando elijas un módulo, aquí aparecerá lo que te toca cada día."
          icono={<Icono nombre="activity" tamano={22} />}
        />
      ) : (
        <div className="ruta__modulos">
          {ruta.modulos.map((progreso) => (
            <AcordeonDeModulo
              key={progreso.modulo}
              progreso={progreso}
              abierto={desplegado === progreso.modulo}
              alAlternar={() => alAlternar(progreso.modulo)}
            />
          ))}
        </div>
      )}

      {/* El confeti sale cuando el plan se completa ahora, no al abrir uno ya completo. */}
      {ruta.planCompleto && <LogroDelDia celebrando={nuevas.size > 0} />}
    </section>
  );
}

/** Lo que se ve al lograr el dia. Se anuncia sin interrumpir: es una buena noticia, no una alerta. */
function LogroDelDia({ celebrando }: { celebrando: boolean }) {
  return (
    <div className="ruta__logro">
      <span className="ruta__logro-icono">
        <Icono nombre="star" tamano={28} />
        {celebrando && <Confeti />}
      </span>

      <div>
        <p className="ruta__logro-titulo">¡Lo lograste hoy!</p>
        <p className="ruta__logro-texto">Descansar también es cuidarte</p>
      </div>

      <p className="solo-lectores" role="status">
        Terminaste tu ruta de hoy.
      </p>
    </div>
  );
}
