import axe from 'axe-core';

/**
 * Accesibilidad con axe en las pruebas de cada pantalla (C-03 de la auditoria 360).
 *
 * El contraste y el manejo con teclado se revisaron a mano, pantalla por pantalla,
 * y una regresion habria pasado el CI sin aviso. axe revisa lo que se puede decidir
 * mirando la pagina ya pintada: que cada control tenga nombre, que las imagenes
 * tengan texto alternativo, que los `aria-*` apunten a algo que existe, que no haya
 * identificadores repetidos, que los encabezados no se salten niveles.
 *
 * ## Lo que jsdom no puede decidir
 *
 * - **El contraste de color** (`color-contrast`): jsdom no calcula el aspecto de nada.
 *   Lo cubre Lighthouse en el CI, que corre en un navegador de verdad.
 * - **Los puntos de referencia de la pagina** (`region`): una pantalla se pinta sola,
 *   sin el `<main>` ni el resto que le pone `App`, y exigirlos aqui daria un fallo en
 *   cada una que no dice nada.
 *
 * Todo lo demas se aplica entero: las reglas de WCAG 2.1 nivel A y AA y las buenas
 * practicas de axe, entre ellas la que vigila que los encabezados no se salten
 * niveles.
 */
const ETIQUETAS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

/**
 * Cuantos encabezados de primer nivel hay en `raiz` (SEO-04). Una pantalla tiene
 * uno: ni dos, que confunden a un lector de pantalla y a un buscador sobre de que
 * trata la pagina, ni ninguno.
 */
export function cuantosH1(raiz: ParentNode = document.body): number {
  return raiz.querySelectorAll('h1, [role="heading"][aria-level="1"]').length;
}

/**
 * Lo que axe encuentra mal en `raiz`, una linea por problema, o una lista vacia.
 *
 * Se devuelve texto y no el resultado de axe para que `expect(...).toEqual([])` diga,
 * al fallar, que regla se rompio y en que elemento, y no un objeto de cuarenta
 * campos.
 */
export async function fallosDeAccesibilidad(
  raiz: Element | Document = document.body,
): Promise<string[]> {
  const resultado = await axe.run(raiz, {
    runOnly: { type: 'tag', values: ETIQUETAS },
    rules: {
      'color-contrast': { enabled: false },
      region: { enabled: false },
      // Son del documento entero (`<title>`, `lang`), que en una prueba no existe.
      'document-title': { enabled: false },
      'html-has-lang': { enabled: false },
      'html-lang-valid': { enabled: false },
      // Piden un `<main>` y un solo encabezado de primer nivel en TODA la pagina. Una
      // pantalla se pinta sola, sin el `<main>` que le pone `App`; el h1 unico se
      // comprueba aparte, por pantalla, con `cuantosH1`.
      'landmark-one-main': { enabled: false },
      'page-has-heading-one': { enabled: false },
    },
  });

  return resultado.violations.map((fallo) => {
    const donde = fallo.nodes.map((nodo) => nodo.target.join(' ')).join(' | ');

    return `${fallo.id} (${fallo.impact ?? 'sin impacto'}): ${fallo.help}. En: ${donde}`;
  });
}
