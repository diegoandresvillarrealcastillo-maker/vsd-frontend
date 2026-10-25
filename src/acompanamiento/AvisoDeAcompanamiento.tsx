import { useId } from 'react';

import { LlamarAhora } from '../componentes/LlamarAhora.tsx';
import { ID_DEL_CONTENIDO } from '../componentes/SaltoAlContenido.tsx';
import '../estilos/acompanamiento.css';
import type { LineaDeAtencion } from '../infraestructura/api/resultados.ts';
import { lineasParaMostrar, textoDeCobertura } from '../paginas/actividad/lineasParaMostrar.ts';
import { useAcompanamiento } from './useAcompanamiento.ts';

/**
 * El aviso de acompanamiento por dias seguidos con atencion (SCRUM-177, ADR 0034 del backend).
 *
 * Es **una invitacion, no una alarma**: nada de rojo, de iconos de alerta ni de «busca ayuda urgente».
 * Quien llega aqui lleva dias dificiles, y el tono es el de alguien que deja un numero apuntado por si
 * hace falta. No es un diagnostico y lo dice.
 *
 * - **Moderado**: una pregunta, «¿Quieres hablarlo con un profesional?», que se cierra con «Ahora no».
 * - **Critico**: se queda a la vista, con las lineas de atencion del pais. **No es un modal** y no
 *   atrapa el foco ni el teclado: un aviso que no se puede ignorar puede danar justo a quien esta peor.
 *   No tiene boton de cerrar: es lo que el nivel pide, y se va solo cuando el servidor deja de
 *   decirlo.
 *
 * - **Abandono** (SCRUM-256, ADR 0035): para quien vuelve despues de varios dias sin registrar nada
 *   que venian con atencion. Es una **bienvenida**: se puede cerrar siempre, tambien el critico (que
 *   lleva las lineas). No afirma que la persona «se fue»: dice que no ha registrado nada.
 *
 * No sale ningun puntaje ni cuantos dias van: lo unico que se sabe es el nivel. Sin conexion se ve
 * lo ultimo que se supo, de la copia de este equipo.
 *
 * Va debajo de la barra de arriba, asi que aparece en cada pantalla que la lleva. Sus titulos no son
 * encabezados: llegan antes del `h1` de la pagina y no deben cambiarle el orden.
 */
export function AvisoDeAcompanamiento() {
  const { aviso, cerrar } = useAcompanamiento();
  const idDelTitulo = useId();

  if (aviso === null) {
    return null;
  }

  if (aviso.motivo === 'abandono') {
    const critico = aviso.nivel === 'critico';

    return (
      <section
        className={`acompanamiento acompanamiento--${aviso.nivel} acompanamiento--abandono`}
        aria-labelledby={idDelTitulo}
      >
        <p id={idDelTitulo} className="acompanamiento__titulo">
          {critico ? 'Aquí seguimos, cuando quieras' : '¿Cómo has estado?'}
        </p>
        <p className="acompanamiento__texto">
          {critico
            ? 'Hace unos días tus registros llevaban una semana pidiendo atención y desde entonces no has registrado nada. No tienes que ponerte al día con nada. Esto no es un diagnóstico: es una invitación para que no lo cargues en silencio. Aquí tienes a quién llamar o escribir. Si hay riesgo inmediato para tu vida, llama al número de emergencias del lugar donde estás.'
            : 'Hace unos días tus registros pedían atención y desde entonces no has registrado nada. No tienes que ponerte al día con nada. No es un diagnóstico: es una invitación. Si lo prefieres, en VSD IA puedes preguntar «¿Dónde busco ayuda?».'}
        </p>

        {critico && <ListaDeLineas lineas={aviso.lineasDeAtencion} />}

        <div className="acompanamiento__acciones">
          <button
            type="button"
            className="pildora pildora--fantasma"
            onClick={() => {
              cerrar();
              // El boton ya no esta: el foco pasa al contenido, y quien teclea no se queda en el aire.
              document.getElementById(ID_DEL_CONTENIDO)?.focus();
            }}
          >
            Ahora no
          </button>
        </div>
      </section>
    );
  }

  if (aviso.nivel === 'moderado') {
    return (
      <section className="acompanamiento acompanamiento--moderado" aria-labelledby={idDelTitulo}>
        <p id={idDelTitulo} className="acompanamiento__titulo">
          ¿Quieres hablarlo con un profesional?
        </p>
        <p className="acompanamiento__texto">
          Llevas unos días en los que tus registros piden atención. No es un diagnóstico: es una
          invitación. Si lo prefieres, en VSD IA puedes preguntar «¿Dónde busco ayuda?».
        </p>
        <div className="acompanamiento__acciones">
          <button
            type="button"
            className="pildora pildora--fantasma"
            onClick={() => {
              cerrar();
              // El boton ya no esta: el foco pasa al contenido, y quien teclea no se queda en el aire.
              document.getElementById(ID_DEL_CONTENIDO)?.focus();
            }}
          >
            Ahora no
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="acompanamiento acompanamiento--critico" aria-labelledby={idDelTitulo}>
      <p id={idDelTitulo} className="acompanamiento__titulo">
        Hablar con alguien puede ayudarte
      </p>
      <p className="acompanamiento__texto">
        Llevas una semana en la que tus registros piden atención. Esto no es un diagnóstico: es una
        señal para que no tengas que cargarlo en silencio. Aquí tienes a quién llamar o escribir. Si
        hay riesgo inmediato para tu vida, llama al número de emergencias del lugar donde estás.
      </p>

      <ListaDeLineas lineas={aviso.lineasDeAtencion} />
    </section>
  );
}

/** Las lineas de atencion del pais: a la vista, con su cobertura y su enlace. */
function ListaDeLineas({ lineas }: { readonly lineas: readonly LineaDeAtencion[] }) {
  return (
    <ul className="acompanamiento__lineas">
      {lineasParaMostrar(lineas).map((linea) => {
        const cobertura = textoDeCobertura(linea.cobertura);

        return (
          <li key={linea.id} className="acompanamiento__linea">
            <p className="acompanamiento__linea-titulo">
              <strong>{linea.titulo}</strong>
              {cobertura !== undefined && (
                <span className="acompanamiento__cobertura">{cobertura}</span>
              )}
            </p>

            {linea.descripcion !== undefined && (
              <p className="acompanamiento__linea-descripcion">{linea.descripcion}</p>
            )}

            <LlamarAhora linea={linea} />

            {linea.enlace !== undefined && (
              // El nombre accesible empieza por lo que se ve y dice de cual linea es: con varios
              // enlaces iguales, «Más información» solo no basta.
              <a
                className="acompanamiento__enlace"
                href={linea.enlace}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Más información sobre ${linea.titulo} (se abre en otra pestaña)`}
              >
                Más información
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
