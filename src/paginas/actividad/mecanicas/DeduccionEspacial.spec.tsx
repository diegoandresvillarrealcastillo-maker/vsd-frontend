import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { sesionDeCognicion } from '../../../pruebas/sesionesDeCognicion.ts';
import { DeduccionEspacial } from './DeduccionEspacial.tsx';
import type { LoQueProduceLaActividad } from '../useCompletarActividad.ts';

const PARAMETROS = {
  modo: 'deduccion_espacial',
  filas: 3,
  columnas: 3,
  celdas: [
    { clave: 'triangulo-rojo', etiqueta: 'Triángulo rojo', fila: 1, columna: 1 },
    { clave: 'cuadrado-azul', etiqueta: 'Cuadrado azul', fila: 1, columna: 2 },
    { clave: 'circulo-amarillo', etiqueta: 'Círculo amarillo', fila: 1, columna: 3 },
    { clave: 'cuadrado-verde', etiqueta: 'Cuadrado verde', fila: 2, columna: 1 },
    { clave: 'triangulo-amarillo', etiqueta: 'Triángulo amarillo', fila: 2, columna: 2 },
    { clave: 'circulo-azul', etiqueta: 'Círculo azul', fila: 2, columna: 3 },
    { clave: 'cuadrado-amarillo', etiqueta: 'Cuadrado amarillo', fila: 3, columna: 1 },
    { clave: 'circulo-rojo', etiqueta: 'Círculo rojo', fila: 3, columna: 2 },
    { clave: 'triangulo-verde', etiqueta: 'Triángulo verde', fila: 3, columna: 3 },
  ],
  pistas: ['Tiene cuatro lados.', 'No está en la última fila.', 'No es verde.'],
  solucion: 'cuadrado-azul',
  explicacion: 'El cuadrado azul es la única figura que cumple las tres pistas.',
  puntosMaximos: 1,
};

afterEach(cleanup);

describe('DeduccionEspacial', () => {
  it('presenta su cuadrícula propia y solo permite revisar tras elegir una casilla', async () => {
    const usuario = userEvent.setup();
    render(
      <DeduccionEspacial
        alTerminar={vi.fn()}
        enviando={false}
        sesion={sesionDeCognicion(PARAMETROS)}
      />,
    );

    expect(screen.getByText('Cruza forma y posición.')).toBeInTheDocument();
    expect(screen.queryByText('Tiene cuatro lados.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Fila/ })).not.toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Empezar' }));
    expect(screen.getAllByRole('button', { name: /Fila/ })).toHaveLength(9);
    expect(screen.getByRole('button', { name: 'Revisar mi elección' })).toBeDisabled();

    await usuario.click(screen.getByRole('button', { name: /Fila 1, columna 2/ }));
    expect(screen.getByRole('button', { name: /Fila 1, columna 2/ })).toHaveAttribute(
      'data-marcada',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Revisar mi elección' })).toBeEnabled();
  });

  it('explica la deducción y entrega un resultado una sola vez', async () => {
    const usuario = userEvent.setup();
    const alTerminar = vi.fn<(resultado: LoQueProduceLaActividad) => void>();
    render(
      <DeduccionEspacial
        alTerminar={alTerminar}
        enviando={false}
        sesion={sesionDeCognicion(PARAMETROS)}
      />,
    );

    await usuario.click(screen.getByRole('button', { name: 'Empezar' }));
    await usuario.click(screen.getByRole('button', { name: /Fila 1, columna 2/ }));
    await usuario.click(screen.getByRole('button', { name: 'Revisar mi elección' }));

    expect(screen.getByRole('status')).toHaveTextContent('La respuesta era Cuadrado azul.');
    expect(screen.getByRole('button', { name: /respuesta correcta/ })).toHaveAttribute(
      'data-estado',
      'correcta',
    );
    await usuario.click(screen.getByRole('button', { name: 'Terminar' }));
    await usuario.click(screen.getByRole('button', { name: 'Terminar' }));
    expect(alTerminar).toHaveBeenCalledTimes(1);
    const producido = alTerminar.mock.calls[0]?.[0];
    expect(producido?.score).toBe(1);
    expect(producido?.metadata?.aciertos).toBe(1);
  });

  it('no enseña una partida si falta la sesión válida', () => {
    render(<DeduccionEspacial alTerminar={vi.fn()} enviando={false} />);

    expect(screen.getByText(/necesita la sesión de hoy/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Empezar' })).not.toBeInTheDocument();
  });
});
