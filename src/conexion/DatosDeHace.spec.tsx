import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DatosDeHace } from './DatosDeHace.tsx';

const AHORA = new Date('2026-10-07T12:00:00.000Z');

describe('DatosDeHace', () => {
  it('dice de cuando son los datos y que se ponen al dia con conexion', () => {
    render(<DatosDeHace guardadoEn="2026-10-07T09:00:00.000Z" ahora={AHORA} />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Datos de hace 3 h. Se ponen al día solo cuando haya conexión.',
    );
  });

  it('sin nada por enviar no habla de lo que se hizo sin conexion', () => {
    render(<DatosDeHace guardadoEn="2026-10-07T09:00:00.000Z" ahora={AHORA} />);

    expect(screen.getByRole('status')).not.toHaveTextContent(/sin conexión se contará/);
  });

  it('con cosas por enviar, dice que se contaran cuando se envien', () => {
    render(<DatosDeHace guardadoEn="2026-10-07T09:00:00.000Z" ahora={AHORA} porEnviar={2} />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Lo que hiciste sin conexión se contará cuando se envíe.',
    );
  });

  it('de hace menos de un minuto, un momento', () => {
    render(<DatosDeHace guardadoEn="2026-10-07T11:59:50.000Z" ahora={AHORA} />);

    expect(screen.getByRole('status')).toHaveTextContent('Datos de hace un momento.');
  });
});
