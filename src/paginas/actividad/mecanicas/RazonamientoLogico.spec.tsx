import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { LoQueProduceLaActividad } from '../useCompletarActividad.ts';
import { RazonamientoLogico } from './RazonamientoLogico.tsx';

const sesion = {
  id: '5e510110-0000-4000-8000-000000000011',
  titulo: 'Las plumas de Lina',
  nivel: 1,
  parametros: {
    modo: 'deduccion_logica',
    premisas: ['Todas las aves del parque tienen plumas.', 'Lina es un ave del parque.'],
    opciones: [
      { clave: 'plumas', texto: 'Lina tiene plumas.', correcta: true },
      { clave: 'vuela', texto: 'Lina puede volar.', correcta: false },
      { clave: 'duena', texto: 'Todas las aves son de Lina.', correcta: false },
    ],
    explicacion: 'Lina pertenece al grupo descrito en la primera premisa.',
    puntosMaximos: 1,
  },
};

describe('RazonamientoLogico', () => {
  it('presenta la sesion con el flujo visual compartido de Cognicion', () => {
    render(<RazonamientoLogico alTerminar={vi.fn()} enviando={false} sesion={sesion} />);
    expect(screen.getByText('Leamos lo que sabemos.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));
    expect(screen.getByText('Relaciona las premisas')).toBeInTheDocument();
    expect(screen.getByText('Todas las aves del parque tienen plumas.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lina tiene plumas.' })).toHaveClass(
      'juego__opcion',
      'cognicion365__opcion',
    );
  });

  it('revisa la conclusion y registra el puntaje al terminar', () => {
    const alTerminar = vi.fn<(producido: LoQueProduceLaActividad) => void>();
    render(<RazonamientoLogico alTerminar={alTerminar} enviando={false} sesion={sesion} />);
    fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lina tiene plumas.' }));
    fireEvent.click(screen.getByRole('button', { name: 'Revisar mi conclusión' }));
    expect(screen.getByRole('status')).toHaveTextContent('Lina pertenece al grupo');
    fireEvent.click(screen.getByRole('button', { name: 'Terminar' }));
    const resultado = alTerminar.mock.calls[0]?.[0];
    expect(resultado?.score).toBe(1);
    expect(resultado?.metadata?.mecanica).toBe('deduccion_logica');
  });
});
