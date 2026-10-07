import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { PESO_MAXIMO_DEL_SVG } from '../../foto/comprobarElSvg.ts';
import { PASOS_DE_LA_GUIA, textoDe } from './contenidoDeLaGuia.ts';
import {
  GuiaDeLaMascotaPropia,
  NOMBRE_DE_LA_GUIA_EN_PDF,
  RUTA_DE_LA_GUIA_EN_PDF,
} from './GuiaDeLaMascotaPropia.tsx';

/** La guia para preparar el dibujo de la mascota propia (SCRUM-122). */
function guia(): HTMLDetailsElement {
  const detalles = screen.getByText('Cómo preparar mi dibujo').closest('details');

  if (detalles === null) {
    throw new Error('La guia no es un <details>');
  }

  return detalles;
}

describe('GuiaDeLaMascotaPropia', () => {
  it('empieza cerrada: no estorba a quien ya sabe como hacerlo', () => {
    render(<GuiaDeLaMascotaPropia />);

    expect(guia().open).toBe(false);
  });

  it('se abre con su titulo, que es lo que se ve y se toca', async () => {
    render(<GuiaDeLaMascotaPropia />);

    await userEvent.setup().click(screen.getByText('Cómo preparar mi dibujo'));

    expect(guia().open).toBe(true);
  });

  it('el titulo se alcanza con teclado', async () => {
    render(<GuiaDeLaMascotaPropia />);

    await userEvent.setup().tab();

    // Abrirla con Enter o con Espacio es el comportamiento nativo de `<summary>`
    // en el navegador; `user-event` no lo emula, asi que no se prueba aqui.
    expect(screen.getByText('Cómo preparar mi dibujo')).toHaveFocus();
  });

  it('son pasos en orden: dibujar, lienzo, formas, textos, exportar, peso y subir', () => {
    render(<GuiaDeLaMascotaPropia />);

    const pasos = guia().querySelectorAll('ol > li');

    expect([...pasos].map((paso) => paso.querySelector('strong')?.textContent)).toEqual([
      'Dibuja en un programa de dibujo vectorial.',
      'Usa un lienzo cuadrado.',
      'Dibuja solo con formas y colores.',
      'Convierte los textos en formas.',
      'Exporta como SVG.',
      `Comprueba que pese menos de ${PESO_MAXIMO_DEL_SVG / 1024} KB.`,
      'Súbelo con «Subir mi dibujo».',
    ]);
  });

  it('muestra el texto de cada paso y cada uno de sus puntos, tal cual', () => {
    render(<GuiaDeLaMascotaPropia />);

    const texto = guia().textContent.replace(/\s+/g, ' ');

    for (const paso of PASOS_DE_LA_GUIA) {
      for (const parte of [
        ...(paso.texto === undefined ? [] : [textoDe(paso.texto)]),
        ...(paso.puntos ?? []).map(textoDe),
      ]) {
        expect(texto, parte).toContain(parte);
      }
    }
  });

  it('las teclas van marcadas como teclas, en el orden en que aparecen', () => {
    render(<GuiaDeLaMascotaPropia />);

    const esperadas = PASOS_DE_LA_GUIA.flatMap((paso) => [
      ...(paso.texto ?? []),
      ...(paso.puntos ?? []).flat(),
    ]).flatMap((trozo) => (typeof trozo !== 'string' && 'tecla' in trozo ? [trozo.tecla] : []));

    expect(esperadas.length).toBeGreaterThan(5);
    expect([...guia().querySelectorAll('kbd')].map((tecla) => tecla.textContent)).toEqual(
      esperadas,
    );
  });

  it('nombra los tres programas y dice como convertir los textos y como exportar en cada uno', () => {
    render(<GuiaDeLaMascotaPropia />);

    const texto = guia().textContent;

    for (const programa of ['Figma', 'Inkscape', 'Illustrator']) {
      // Una vez para convertir el texto y otra para exportar, como minimo.
      expect(texto.split(programa).length - 1).toBeGreaterThanOrEqual(2);
    }

    expect(texto).toContain('Aplanar');
    expect(texto).toContain('Objeto a camino');
    expect(texto).toContain('Crear contornos');
    expect(texto).toContain('SVG simple');
    expect(texto).toContain('Atributos de presentación');
  });

  it('dice lo que se admite y lo que no, como lo decide el servidor', () => {
    render(<GuiaDeLaMascotaPropia />);

    const texto = guia().textContent;

    expect(texto).toContain('Se admiten: círculos, óvalos, rectángulos, líneas, polígonos');
    expect(texto).toContain('colores lisos y degradados');
    expect(texto).toContain(
      'No se admiten: textos, imágenes metidas dentro del dibujo, filtros y sombras difuminadas',
    );
    expect(texto).toContain('se rechaza por seguridad');
  });

  it('el peso que dice es el que comprueba el navegador', () => {
    render(<GuiaDeLaMascotaPropia />);

    expect(guia()).toHaveTextContent('menos de 100 KB');
    expect(PESO_MAXIMO_DEL_SVG).toBe(100 * 1024);
  });

  it('aclara que lo que se ve no es el archivo tal cual', () => {
    render(<GuiaDeLaMascotaPropia />);

    expect(guia()).toHaveTextContent('antes de guardarlo lo reescribimos');
  });

  it('enlaza a la guia en PDF, que se descarga', () => {
    render(<GuiaDeLaMascotaPropia />);

    const enlace = screen.getByRole('link', { name: 'Descargar esta guía en PDF' });

    expect(enlace).toHaveAttribute('href', RUTA_DE_LA_GUIA_EN_PDF);
    expect(enlace).toHaveAttribute('download', NOMBRE_DE_LA_GUIA_EN_PDF);
    // Un archivo fijo de esta misma aplicacion, no un enlace a otro sitio.
    expect(RUTA_DE_LA_GUIA_EN_PDF).toMatch(/^\/[a-z-]+\.pdf$/);
  });
});
