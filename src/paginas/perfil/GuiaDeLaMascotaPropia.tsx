import { Fragment } from 'react';

import {
  NOTA_DE_LA_GUIA,
  PASOS_DE_LA_GUIA,
  TITULO_DE_LA_GUIA,
  type Texto,
} from './contenidoDeLaGuia.ts';

/** Donde esta la guia en PDF: un archivo fijo de `public/`, generado con `npm run guia-de-la-mascota`. */
export const RUTA_DE_LA_GUIA_EN_PDF = '/guia-de-la-mascota-propia.pdf';
export const NOMBRE_DE_LA_GUIA_EN_PDF = 'guia-de-la-mascota-propia.pdf';

/** Un texto con sus resaltados y sus teclas. */
function Trozos({ texto }: { texto: Texto }) {
  return texto.map((trozo, indice) => {
    if (typeof trozo === 'string') {
      return <Fragment key={indice}>{trozo}</Fragment>;
    }

    return 'negrita' in trozo ? (
      <strong key={indice}>{trozo.negrita}</strong>
    ) : (
      <kbd key={indice}>{trozo.tecla}</kbd>
    );
  });
}

/**
 * La guia para preparar el dibujo de la mascota propia (SCRUM-122).
 *
 * Quien dibuja no sabe que un SVG de un programa de dibujo trae mas cosas que el
 * dibujo —textos, filtros, hojas de estilo— y que la aplicacion solo admite
 * formas y colores. Esta guia lo dice **antes** de que el archivo se rechace, con
 * los pasos de los tres programas mas comunes. El contenido esta en
 * `contenidoDeLaGuia.ts`, compartido con el PDF.
 *
 * Va en un `<details>`: cerrada no estorba y abierta se lee entera. Es nativo,
 * asi que se abre con teclado y lo anuncian los lectores de pantalla sin nada
 * mas.
 */
export function GuiaDeLaMascotaPropia() {
  return (
    <details className="perfil__guia">
      <summary className="perfil__guia-resumen">{TITULO_DE_LA_GUIA}</summary>

      <div className="perfil__guia-cuerpo">
        <ol className="perfil__guia-pasos">
          {PASOS_DE_LA_GUIA.map((paso) => (
            <li key={paso.titulo}>
              <strong>{paso.titulo}</strong>
              {paso.texto !== undefined && (
                <>
                  {' '}
                  <Trozos texto={paso.texto} />
                </>
              )}
              {paso.puntos !== undefined && (
                <ul>
                  {paso.puntos.map((punto, indice) => (
                    <li key={indice}>
                      <Trozos texto={punto} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>

        <p className="app__nota perfil__ayuda">{NOTA_DE_LA_GUIA}</p>

        <p className="perfil__guia-pdf">
          <a href={RUTA_DE_LA_GUIA_EN_PDF} download={NOMBRE_DE_LA_GUIA_EN_PDF}>
            Descargar esta guía en PDF
          </a>
        </p>
      </div>
    </details>
  );
}
