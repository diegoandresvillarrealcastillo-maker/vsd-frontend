import { Link, useParams } from 'react-router-dom';

import { Logo } from '../../componentes/Logo.tsx';
import { ID_DEL_CONTENIDO } from '../../componentes/SaltoAlContenido.tsx';
import '../../estilos/actividad.css';
import type { ResultadoRegistrado } from '../../infraestructura/api/resultados.ts';
import { RUTAS } from '../../rutas/rutas.ts';
import { SelectorDeTema } from '../../tema/SelectorDeTema.tsx';
import { mecanicaDe } from './mecanicas/registro.tsx';
import { useCompletarActividad, type LoQueProduceLaActividad } from './useCompletarActividad.ts';

/**
 * Hacer una actividad, de principio a fin.
 *
 * Esta pantalla **no sabe jugar a nada**. Carga la actividad, monta la mecanica
 * que le corresponde, y cuando esa mecanica dice que termino, registra el
 * resultado y cuenta como fue. Anadir una actividad nueva no la toca: se
 * escribe su mecanica y se apunta en el registro.
 */
export function Actividad() {
  const { id } = useParams<{ id: string }>();
  const { estado, completar, reintentar, empezarDeNuevo } = useCompletarActividad(id);

  return (
    <div className="actividad">
      <header className="actividad__barra">
        <Logo to={RUTAS.PANEL} className="actividad__marca" />

        <Link className="actividad__volver" to={RUTAS.PANEL}>
          Volver al panel
        </Link>

        <SelectorDeTema variante="incrustado" />
      </header>

      <main id={ID_DEL_CONTENIDO} tabIndex={-1} className="actividad__contenido">
        <div className="actividad__caja">
          {estado.fase === 'cargando' && (
            <p className="actividad__cargando" role="status">
              Cargando la actividad…
            </p>
          )}

          {estado.fase === 'no-existe' && (
            <>
              <h1>Esta actividad no existe</h1>
              <p className="actividad__texto">
                Puede que el enlace esté mal escrito, o que la actividad ya no esté disponible.
              </p>
              <Link className="pildora" to={RUTAS.PANEL}>
                Volver al panel
              </Link>
            </>
          )}

          {(estado.fase === 'lista' || estado.fase === 'enviando') && (
            <>
              <p className="actividad__categoria">{estado.ficha.categoria.nombre}</p>
              <h1>{estado.ficha.actividad.nombre}</h1>

              {estado.ficha.actividad.descripcion !== undefined && (
                <p className="actividad__texto">{estado.ficha.actividad.descripcion}</p>
              )}

              <Mecanica
                idDeLaActividad={estado.ficha.actividad.id}
                alTerminar={completar}
                enviando={estado.fase === 'enviando'}
              />
            </>
          )}

          {estado.fase === 'hecha' && (
            <Terminada resultado={estado.resultado} alRepetir={empezarDeNuevo} />
          )}

          {/* `role="alert"` interrumpe, y aqui corresponde: si algo fallo al
              guardar, la persona tiene que enterarse antes de irse. */}
          {estado.fase === 'error' && (
            <div className="actividad__fallo" role="alert">
              <p className="actividad__texto">{estado.mensaje}</p>

              <div className="actividad__acciones">
                <button type="button" className="pildora" onClick={reintentar}>
                  Reintentar
                </button>

                <Link className="pildora pildora--fantasma" to={RUTAS.PANEL}>
                  Volver al panel
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/** La mecanica de la actividad, o el aviso de que todavia no existe. */
function Mecanica({
  idDeLaActividad,
  alTerminar,
  enviando,
}: {
  idDeLaActividad: string;
  alTerminar: (produjo: LoQueProduceLaActividad) => void;
  enviando: boolean;
}) {
  const mecanica = mecanicaDe(idDeLaActividad);

  if (mecanica === undefined) {
    return (
      <div className="actividad__pendiente">
        <p className="actividad__texto">
          Esta actividad todavía no se puede hacer. Está en el catálogo porque forma parte de lo que
          VSD Health va a ofrecer, y llega con su módulo.
        </p>
        <Link className="pildora pildora--fantasma" to={RUTAS.PANEL}>
          Ver las demás
        </Link>
      </div>
    );
  }

  return mecanica({ alTerminar, enviando });
}

/**
 * Lo que se ve al terminar.
 *
 * El nivel se muestra **solo si la actividad lo produce**, y eso lo dice la
 * respuesta del servidor, no el tipo de la actividad. Hay bitacoras que
 * puntuan: decidirlo por el tipo dejaria sin su nivel a quien registre el
 * sueno, y sin dar ningun error.
 *
 * El texto de cada nivel se redacta aqui en terminos orientativos. No es un
 * diagnostico y no lo parece: "anoche descansaste bien" acompana, "nivel 8 de
 * 10" califica.
 */
function Terminada({
  resultado,
  alRepetir,
}: {
  resultado: ResultadoRegistrado;
  alRepetir: () => void;
}) {
  return (
    <>
      <h1>Listo</h1>

      {resultado.nivelOrientativo === undefined ? (
        <p className="actividad__texto">
          Quedó registrado. Esta actividad no se valora: guarda lo que hiciste para que puedas ver
          cómo evoluciona.
        </p>
      ) : (
        <p className={`actividad__nivel actividad__nivel--${resultado.nivelOrientativo}`}>
          {textoDelNivel(resultado.nivelOrientativo)}
        </p>
      )}

      {/* Las lineas de atencion llegan con SCRUM-94; hasta entonces no se
          promete un sitio donde no estan. */}
      {resultado.sugiereAcompanamiento && (
        <p className="actividad__apoyo">
          Si esto se repite y te está pesando, contarlo a alguien de confianza ayuda más que
          aguantarlo en silencio.
        </p>
      )}

      <div className="actividad__acciones">
        <button type="button" className="pildora pildora--fantasma" onClick={alRepetir}>
          Hacerla otra vez
        </button>

        <Link className="pildora" to={RUTAS.PANEL}>
          Volver al panel
        </Link>
      </div>
    </>
  );
}

function textoDelNivel(nivel: NonNullable<ResultadoRegistrado['nivelOrientativo']>): string {
  if (nivel === 'favorable') {
    return 'Vas bien. Sigue así.';
  }

  if (nivel === 'en_seguimiento') {
    return 'Va razonable, con margen para mejorar.';
  }

  return 'Conviene prestarle atención estos días.';
}
