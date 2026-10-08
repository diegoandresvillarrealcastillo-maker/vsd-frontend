import { useEffect, useId, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { Logo } from '../../componentes/Logo.tsx';
import { ID_DEL_CONTENIDO } from '../../componentes/SaltoAlContenido.tsx';
import '../../estilos/legal.css';
import { RUTAS, type Ruta } from '../../rutas/rutas.ts';
import { SelectorDeTema } from '../../tema/SelectorDeTema.tsx';
import {
  DATOS_DEL_RESPONSABLE,
  FECHA_DEL_BORRADOR,
  POR_DEFINIR,
  TEXTOS_REVISADOS,
} from './datosLegales.ts';
import { EnlacesLegales } from './EnlacesLegales.tsx';

export interface SeccionLegal {
  /** Para el enlace del indice. Sin tildes ni espacios. */
  readonly id: string;
  readonly titulo: string;
  readonly cuerpo: ReactNode;
}

interface Props {
  /** La direccion del documento, para marcarlo en el pie. */
  ruta: Ruta;
  titulo: string;
  entradilla: string;
  /**
   * La version que la persona acepta (la misma que tiene la API como vigente).
   * Las paginas que solo informan, como la de cookies, no la tienen: no hay nada
   * que aceptar.
   */
  version?: string;
  secciones: readonly SeccionLegal[];
}

/**
 * Un dato que falta por decidir, bien visible.
 *
 * Es lo que hay que buscar antes de dar por revisado un texto. Se pinta aparte
 * del resto para que nadie lo lea como si fuera parte del documento.
 */
export function PorDefinir({ que }: { que: string }) {
  return (
    <mark className="legal__pendiente">
      {POR_DEFINIR} {que}
    </mark>
  );
}

const ETIQUETA_DEL_DATO: Record<keyof typeof DATOS_DEL_RESPONSABLE, string> = {
  nombre: 'nombre o razón social del responsable',
  identificacion: 'NIT o documento de identidad',
  domicilio: 'dirección y ciudad',
  correo: 'correo de contacto',
  telefono: 'teléfono de contacto',
};

/**
 * Un dato del responsable: el valor si ya se decidio, o la marca visible si no.
 *
 * Asi el documento nunca repite a mano lo que vive en `datosLegales.ts`, y el
 * dia que el equipo lo complete cambia en todos los sitios a la vez.
 */
export function DatoDelResponsable({ campo }: { campo: keyof typeof DATOS_DEL_RESPONSABLE }) {
  const valor = DATOS_DEL_RESPONSABLE[campo];

  return valor === POR_DEFINIR ? <PorDefinir que={ETIQUETA_DEL_DATO[campo]} /> : <>{valor}</>;
}

/**
 * El marco que comparten los tres documentos legales.
 *
 * Es una pagina de lectura: un solo `h1`, un indice con enlaces a cada seccion,
 * secciones con su encabezado y la misma navegacion al final. Se pueden leer
 * sin sesion, porque se tienen que poder leer **antes** de aceptarlas.
 *
 * ## Mientras el texto sea un borrador
 *
 * Un aviso arriba lo dice (`TEXTOS_REVISADOS`). No es un adorno: es lo que
 * evita que un borrador pase por documento vigente sin que nadie lo haya
 * decidido.
 */
export function PaginaLegal({ ruta, titulo, entradilla, version, secciones }: Props) {
  const idDelIndice = useId();
  const { hash } = useLocation();

  // Un enlace a `/cookies#analitica` (el del banner) llega con la seccion ya
  // marcada en la direccion, pero el enrutador no se desplaza solo hasta ella.
  useEffect(() => {
    if (hash.length <= 1) {
      return;
    }

    try {
      document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
    } catch {
      // Un fragmento mal escrito a mano (`#%E0%A4%A`) no puede tumbar la pagina.
    }
  }, [hash]);

  return (
    <div className="legal">
      <header className="legal__cabecera">
        <Logo className="legal__marca" />

        {/* El selector va aqui y no flotando, como en la portada: es una pagina
            de lectura, y un control fijo en la esquina se queda encima del
            texto al bajar. */}
        <div className="legal__acciones">
          <Link className="legal__volver" to={RUTAS.INICIO}>
            Volver al inicio
          </Link>
          <SelectorDeTema />
        </div>
      </header>

      {/* Ver la nota de la portada: `tabIndex={-1}` lo hace capaz de recibir el
          foco con el enlace de salto sin meterlo en el orden de tabulacion. */}
      <main className="legal__principal" id={ID_DEL_CONTENIDO} tabIndex={-1}>
        <article>
          <h1 className="legal__titulo">{titulo}</h1>
          <p className="legal__entradilla">{entradilla}</p>
          <p className="legal__meta">
            {version === undefined ? '' : `Versión ${version} · `}
            {TEXTOS_REVISADOS ? 'Vigente' : `Borrador del ${FECHA_DEL_BORRADOR}`}
          </p>

          {!TEXTOS_REVISADOS && (
            <p className="legal__borrador" role="note">
              <strong>Borrador pendiente de revisión jurídica.</strong> Este texto describe lo que
              VSD Health hace hoy, pero todavía no lo ha revisado una persona con formación jurídica
              y tiene datos por completar, marcados como {POR_DEFINIR}. No es aún el documento
              vigente.
            </p>
          )}

          <nav className="legal__indice" aria-labelledby={idDelIndice}>
            <h2 className="legal__indice-titulo" id={idDelIndice}>
              En este documento
            </h2>
            <ol className="legal__indice-lista">
              {secciones.map((seccion) => (
                <li key={seccion.id}>
                  <a href={`#${seccion.id}`}>{seccion.titulo}</a>
                </li>
              ))}
            </ol>
          </nav>

          {secciones.map((seccion, posicion) => (
            <section
              className="legal__seccion"
              key={seccion.id}
              id={seccion.id}
              aria-labelledby={`${seccion.id}-titulo`}
            >
              <h2 className="legal__seccion-titulo" id={`${seccion.id}-titulo`}>
                {posicion + 1}. {seccion.titulo}
              </h2>
              {seccion.cuerpo}
            </section>
          ))}
        </article>
      </main>

      <footer className="legal__pie">
        <EnlacesLegales actual={ruta} />
        <p className="legal__pie-nota">
          VSD Health no diagnostica, no formula medicamentos y no reemplaza a un especialista
          médico.
        </p>
      </footer>
    </div>
  );
}
