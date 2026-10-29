import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { SesionContexto, type EstadoDeSesion } from '../../sesion/SesionContexto.ts';
import { MODULOS, ORDEN } from '../panel/modulos.ts';
import { Portada } from './Portada.tsx';

/**
 * La portada dice lo que la aplicacion hace de verdad (SCRUM-313).
 *
 * Antes ensenaba tres pantallas que no existen (el animo de la semana, «2 de 3 hoy», las horas de
 * sueno) y prometia ver si «vas mejor o peor». La aplicacion es un plan diario de actividades cortas
 * en tres modulos: eso es lo que la portada tiene que contar, con las mismas palabras que la
 * aplicacion (`MODULOS`) para que no se separen.
 */
function estado(): EstadoDeSesion {
  const vacio = vi.fn().mockResolvedValue({ ok: true });

  return {
    sesion: null,
    cargando: false,
    correo: null,
    registrarse: vacio,
    entrar: vacio,
    entrarConGoogle: vacio,
    pedirRecuperacion: vacio,
    cambiarContrasena: vacio,
    pedirCodigoDeVerificacion: vacio,
    cambiarContrasenaConCodigo: vacio,
    salir: vi.fn(),
  };
}

function pintar() {
  return render(
    <SesionContexto.Provider value={estado()}>
      <MemoryRouter>
        <Portada />
      </MemoryRouter>
    </SesionContexto.Provider>,
  );
}

function seccion(id: string): HTMLElement {
  const encontrada = document.getElementById(id);

  if (encontrada === null) {
    throw new Error(`No hay una seccion #${id}`);
  }

  return encontrada;
}

describe('el heroe cuenta que es la aplicacion', () => {
  it('el titulo nombra los tres campos y el ritmo de un dia a la vez', () => {
    pintar();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Cuerpo, mente y emociones, un día a la vez.',
    );
  });

  it('la entradilla habla de una ruta corta de actividades que la persona elige, sin metas ni presion', () => {
    pintar();

    const entradilla = document.querySelector('.heroe__entradilla');

    expect(entradilla).toHaveTextContent('una ruta corta de actividades');
    expect(entradilla).toHaveTextContent('Tú eliges por dónde empezar');
    expect(entradilla).toHaveTextContent('sin metas ni presión');
    expect(entradilla).toHaveTextContent('Sin diagnósticos y sin compararte con nadie');
  });
});

describe('«Qué hace» muestra los tres modulos reales', () => {
  it('tiene un titulo que anuncia los tres modulos y la forma de elegirlos', () => {
    pintar();

    const que = within(seccion('que-hace'));

    expect(
      que.getByRole('heading', { level: 2, name: 'Tres módulos para empezar por donde quieras' }),
    ).toBeInTheDocument();
    expect(que.getByText(/Al empezar escoges uno, dos o los tres/)).toBeInTheDocument();
    expect(que.getByText(/los cambias después desde tu perfil/)).toBeInTheDocument();
  });

  it.each(ORDEN)(
    'el modulo «%s» lleva su nombre y su frase, las mismas de la aplicacion',
    (modulo) => {
      pintar();

      const tarjeta = within(seccion('que-hace'))
        .getByRole('heading', {
          level: 3,
          name: MODULOS[modulo].titulo,
        })
        .closest('article');

      expect(tarjeta).not.toBeNull();
      expect(tarjeta).toHaveTextContent(MODULOS[modulo].descripcion);
    },
  );

  it.each(ORDEN)('el modulo «%s» cita al menos tres actividades en una lista', (modulo) => {
    pintar();

    const tarjeta = within(seccion('que-hace'))
      .getByRole('heading', { level: 3, name: MODULOS[modulo].titulo })
      .closest('article');

    expect(within(tarjeta!).getAllByRole('listitem').length).toBeGreaterThanOrEqual(3);
  });

  it('cita solo actividades del catalogo publicado', () => {
    pintar();

    const que = seccion('que-hace');

    // Una muestra de cada modulo, tomada de las migraciones del catalogo publicado en el backend.
    for (const nombre of [
      'Respiración guiada',
      'Escaneo corporal',
      'Recuerda los colores',
      'Une los puntos en orden',
      'Rueda de emociones',
      'Ancla 5-4-3-2-1',
    ]) {
      expect(que).toHaveTextContent(nombre);
    }

    // Nombres que sonaban bien pero no existen.
    expect(que).not.toHaveTextContent(/Parejas|Atención sostenida/);
  });

  it('dice que hay ademas diario, semaforo, llama, asistente y mascota', () => {
    pintar();

    const resto = document.querySelector('.modulos__resto');

    expect(resto).not.toBeNull();

    for (const cosa of ['diario', 'semáforo', 'llama', 'VSD IA', 'mascota']) {
      expect(resto).toHaveTextContent(cosa);
    }
  });

  it('ya no ensena las pantallas que no existen ni promete lo que no hace', () => {
    const { container } = pintar();
    const texto = container.textContent ?? '';

    expect(texto).not.toMatch(/mejor o peor/i);
    expect(texto).not.toMatch(/tres cosas por hacer/i);
    expect(texto).not.toMatch(/2 de 3 hoy/i);
    expect(texto).not.toMatch(/noches cortas/i);
    expect(texto).not.toMatch(/h de media/i);
    expect(texto).not.toMatch(/Lo que ves cada día/i);
    expect(texto).not.toMatch(/cuánto dormiste/i);
    expect(container.querySelector('.metrica, .sueno')).toBeNull();
  });
});

describe('«Cómo funciona» cuenta los tres pasos de verdad', () => {
  it('eliges por donde empezar, haces algo corto cada dia y vuelves cuando puedas', () => {
    pintar();

    const como = within(seccion('como-funciona'));

    for (const titulo of [
      'Eliges por dónde empezar',
      'Haces algo corto cada día',
      'Vuelves cuando puedas',
    ]) {
      expect(como.getByRole('heading', { level: 3, name: titulo })).toBeInTheDocument();
    }
  });

  it('el segundo paso deja elegir la actividad y el orden, sin metas ni presion', () => {
    pintar();

    expect(seccion('como-funciona')).toHaveTextContent(
      'Eliges cuál y en qué orden: sin metas ni presión.',
    );
  });

  it('el tercero explica la llama: cuenta los dias, descansa y se enciende al volver', () => {
    pintar();

    const como = seccion('como-funciona');

    expect(como).toHaveTextContent('Tu llama cuenta los días en que haces algo');
    expect(como).toHaveTextContent('descansa y se enciende de nuevo cuando regreses');
  });
});
