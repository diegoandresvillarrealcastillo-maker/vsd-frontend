import { Link, useParams } from 'react-router-dom';

import { AvisoOrientativo } from '../../componentes/AvisoOrientativo.tsx';
import { MarcaDeLaApp } from '../../componentes/MarcaDeLaApp.tsx';
import { ID_DEL_CONTENIDO } from '../../componentes/SaltoAlContenido.tsx';
import '../../estilos/actividad.css';
import type { ActividadConSuCategoria } from '../../infraestructura/api/catalogo.ts';
import type { ResultadoRegistrado } from '../../infraestructura/api/resultados.ts';
import { RUTAS } from '../../rutas/rutas.ts';
import { SelectorDeTema } from '../../tema/SelectorDeTema.tsx';
import { LineasDeAtencion } from './LineasDeAtencion.tsx';
import { mecanicaDe } from './mecanicas/registro.tsx';
import { textoDelNivel } from './textoDelNivel.ts';
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
        <div className="actividad__marca">
          <MarcaDeLaApp />
        </div>

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

          {estado.fase === 'guardada' && (
            <GuardadaEnEsteEquipo ficha={estado.ficha} alRepetir={empezarDeNuevo} />
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
 * Lo que se ve al terminar **sin que haya salido todavia** (SCRUM-138): el resultado esta
 * guardado en este equipo, y se envia solo cuando se pueda.
 *
 * Se dice con claridad y sin simular que se envio. Y la orientacion no se promete como
 * ya hecha: la calcula el servidor, asi que se ensena **al sincronizar**. Si la
 * actividad no se valora, no hay orientacion que esperar y no se dice nada de ella.
 *
 * Cuando el resultado salga con la pantalla abierta, esta se cambia sola por la de
 * siempre.
 */
function GuardadaEnEsteEquipo({
  ficha,
  alRepetir,
}: {
  ficha: ActividadConSuCategoria;
  alRepetir: () => void;
}) {
  return (
    <>
      <h1>Listo</h1>

      <p className="actividad__texto" role="status">
        Guardado en este equipo.{' '}
        {ficha.actividad.produceNivel
          ? 'Te mostraremos la orientación cuando te conectes.'
          : 'Se enviará cuando te conectes.'}
      </p>

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
        <>
          <p className={`actividad__nivel actividad__nivel--${resultado.nivelOrientativo}`}>
            {textoDelNivel(resultado.nivelOrientativo)}
          </p>

          {/* Bajo cada nivel, siempre la misma linea: un resultado se lee sin la
              portada delante, y es donde mas hace falta recordar que no es un
              diagnostico (L-03 de la auditoria 360). */}
          <AvisoOrientativo />
        </>
      )}

      {/* Lo decide el servidor, por el nivel o por una senal en el texto
          libre. Aqui solo se ensena lo que dice. */}
      {resultado.sugiereAcompanamiento && <LineasDeAtencion lineas={resultado.lineasDeAtencion} />}

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
