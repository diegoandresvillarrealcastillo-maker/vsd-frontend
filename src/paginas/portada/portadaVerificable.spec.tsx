import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { RUTAS } from '../../rutas/rutas.ts';
import { SesionContexto, type EstadoDeSesion } from '../../sesion/SesionContexto.ts';
import { Portada } from './Portada.tsx';

/**
 * Lo que dice la portada tiene que poder demostrarse (L-04 de la auditoria 360).
 *
 * Una promesa absoluta que no se cumple al pie de la letra —«ni siquiera a quien
 * administra la aplicacion»— es un riesgo ante la autoridad y ante la confianza de
 * la persona: los proveedores que alojan el servicio procesan los datos, y quien
 * tenga la credencial de la base podria leerlos. Lo que si se puede decir es lo que
 * la aplicacion hace.
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

describe('La portada no promete lo que no puede demostrar', () => {
  it('no usa promesas absolutas sobre quien puede ver los datos', () => {
    const { container } = pintar();
    const texto = container.textContent ?? '';

    expect(texto).not.toMatch(/ni siquiera/i);
    expect(texto).not.toMatch(/solo tuyos/i);
    expect(texto).not.toMatch(/nadie m[aá]s/i);
    expect(texto).not.toMatch(/100 ?%|totalmente seguro|completamente seguro/i);
  });

  it('dice lo que si es cierto: la aplicacion no ensena el diario ni los resultados al equipo, y se pueden llevar o borrar', () => {
    pintar();

    const limite = screen
      .getByRole('heading', { name: 'Lo que VSD Health no hace' })
      .closest('div');

    expect(limite).not.toBeNull();
    expect(limite).toHaveTextContent(
      'No le muestra tu diario ni tus resultados a nadie del equipo desde la aplicación.',
    );
    expect(limite).toHaveTextContent('Puedes descargarlos o borrarlos cuando quieras.');
  });

  it('esa linea lleva al aviso de privacidad, donde se explica como se cuidan los datos', () => {
    pintar();

    expect(screen.getByRole('link', { name: 'Cómo cuidamos tus datos' })).toHaveAttribute(
      'href',
      RUTAS.PRIVACIDAD,
    );
  });

  it('junto a las garantias dice que es solo para mayores de 18 anos, y que los datos se llevan o se borran', () => {
    pintar();

    const garantias = document.querySelector('.garantias');

    expect(garantias).not.toBeNull();
    expect(garantias).toHaveTextContent('No diagnostica');
    expect(garantias).toHaveTextContent('No formula medicamentos');
    expect(garantias).toHaveTextContent('Descargas o borras tus datos');
    expect(garantias).toHaveTextContent('Solo para mayores de 18 años');
  });

  it('el pie tambien lo dice', () => {
    pintar();

    const pie = screen.getByRole('contentinfo');

    expect(pie).toHaveTextContent('Es solo para mayores de 18 años');
    expect(within(pie).getByRole('link', { name: 'Privacidad' })).toBeInTheDocument();
  });

  it('el cierre dice que se pide la fecha de nacimiento: lo necesario, pero tambien eso', () => {
    pintar();

    expect(
      screen.getByText(
        /solo te pedimos lo necesario: tu correo, una contraseña y tu fecha de nacimiento/i,
      ),
    ).toBeInTheDocument();
  });

  it('no dice que no hay calificaciones, porque las actividades si muestran un nivel orientativo', () => {
    const { container } = pintar();

    expect(container.textContent).not.toMatch(/no hay calificaciones/i);
    expect(container.textContent).not.toMatch(/ni puntajes/i);
  });
});
