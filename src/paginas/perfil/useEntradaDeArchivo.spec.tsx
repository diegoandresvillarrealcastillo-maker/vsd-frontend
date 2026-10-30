import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { useEntradaDeArchivo } from './useEntradaDeArchivo.ts';

/**
 * Lo que comparten `TuFoto` y `TuMascotaPropia`: elegir un archivo y a donde va el foco al quitar
 * lo que habia. Cada pantalla prueba lo suyo; aqui, solo lo de los dos.
 */
function Prueba({ alElegir }: { alElegir: (archivo: File | undefined) => void }) {
  const {
    ocupado,
    setOcupado,
    aviso,
    setAviso,
    entrada,
    enfocarLaEntradaAlTerminar,
    idDeLaEntrada,
    tomarElArchivo,
  } = useEntradaDeArchivo();

  return (
    <>
      <input
        ref={entrada}
        id={idDeLaEntrada}
        type="file"
        aria-label="Archivo"
        disabled={ocupado !== null}
        onChange={(evento) => {
          alElegir(tomarElArchivo(evento));
        }}
      />
      <p>Ocupado: {ocupado ?? 'no'}</p>
      <p>Aviso: {aviso?.texto ?? 'ninguno'}</p>
      <button
        type="button"
        onClick={() => {
          setAviso({ tipo: 'fallo', texto: 'Algo pasó' });
        }}
      >
        Avisar
      </button>
      <button
        type="button"
        onClick={() => {
          enfocarLaEntradaAlTerminar();
          setOcupado('quitando');
        }}
      >
        Quitar
      </button>
      <button
        type="button"
        onClick={() => {
          setOcupado('guardando');
        }}
      >
        Guardar
      </button>
      <button
        type="button"
        onClick={() => {
          setOcupado(null);
        }}
      >
        Terminar
      </button>
    </>
  );
}

function pintar() {
  const alElegir = vi.fn();

  render(<Prueba alElegir={alElegir} />);

  return { alElegir, entrada: screen.getByLabelText('Archivo') };
}

describe('useEntradaDeArchivo', () => {
  it('al elegir un archivo lo entrega, queda guardando y limpia el aviso', async () => {
    const { alElegir, entrada } = pintar();
    const archivo = new File(['x'], 'dibujo.png', { type: 'image/png' });

    await userEvent.click(screen.getByRole('button', { name: 'Avisar' }));
    expect(screen.getByText('Aviso: Algo pasó')).toBeInTheDocument();

    await userEvent.upload(entrada, archivo);

    expect(alElegir).toHaveBeenCalledWith(archivo);
    expect(screen.getByText('Ocupado: guardando')).toBeInTheDocument();
    expect(screen.getByText('Aviso: ninguno')).toBeInTheDocument();
  });

  it('si se cierra el selector sin elegir, no entrega nada y no queda ocupado', () => {
    const { alElegir, entrada } = pintar();

    fireEvent.change(entrada, { target: { files: [] } });

    expect(alElegir).toHaveBeenCalledWith(undefined);
    expect(screen.getByText('Ocupado: no')).toBeInTheDocument();
  });

  it('al terminar de quitar, el foco pasa a la entrada, y solo esa vez', async () => {
    const { entrada } = pintar();

    await userEvent.click(screen.getByRole('button', { name: 'Quitar' }));
    expect(screen.getByText('Ocupado: quitando')).toBeInTheDocument();
    expect(entrada).not.toHaveFocus();

    await userEvent.click(screen.getByRole('button', { name: 'Terminar' }));
    expect(entrada).toHaveFocus();

    // Otra operacion que termina despues no vuelve a llevarse el foco.
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Terminar' }));

    expect(entrada).not.toHaveFocus();
  });

  it('si no se pidio, terminar no mueve el foco', async () => {
    const { entrada } = pintar();

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Terminar' }));

    expect(entrada).not.toHaveFocus();
  });
});
