import type { Session } from '@supabase/supabase-js';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatoCuriosoDelDia as Entregado } from '../infraestructura/api/datosCuriosos.ts';
import { SesionContexto, type EstadoDeSesion } from '../sesion/SesionContexto.ts';
import { DatoCuriosoDelDia } from './DatoCuriosoDelDia.tsx';
import { datoGuardadoDe, guardarElDato, olvidarElDatoGuardado } from './memoriaDelDia.ts';

/**
 * El mini-panel del dato curioso (SCRUM-185).
 *
 * Lo que se vigila: que se vea el dato del dia, que sin conexion siga viendose el ultimo que
 * se supo (el mismo dato del dia, aunque se haya cerrado la aplicacion), que ninguna persona
 * vea el dato guardado de otra y que, sin nada que mostrar, no deje un hueco ni invente uno.
 */
const { consultarElDatoDeHoy } = vi.hoisted(() => ({ consultarElDatoDeHoy: vi.fn() }));

vi.mock('../infraestructura/api/datosCuriosos.ts', () => ({ consultarElDatoDeHoy }));

const CUENTA = '11111111-1111-4111-8111-111111111111';
const OTRA = '22222222-2222-4222-9222-222222222222';

function entregado(texto: string, dia = '2026-10-13'): Entregado {
  return { dia, dato: { id: 'd0000000-0000-4000-8000-000000000001', texto, tema: 'animales' } };
}

function sesion(id: string | null = CUENTA): EstadoDeSesion {
  return {
    sesion: id === null ? null : ({ user: { id, email: 'ana@ejemplo.test' } } as Session),
    cargando: false,
    correo: id === null ? undefined : 'ana@ejemplo.test',
  } as unknown as EstadoDeSesion;
}

function pintar(valor: EstadoDeSesion = sesion()) {
  return render(
    <SesionContexto.Provider value={valor}>
      <DatoCuriosoDelDia />
    </SesionContexto.Provider>,
  );
}

beforeEach(() => {
  consultarElDatoDeHoy.mockReset();
  olvidarElDatoGuardado();
});

describe('DatoCuriosoDelDia', () => {
  it('muestra el dato de hoy con su invitacion', async () => {
    consultarElDatoDeHoy.mockResolvedValue(entregado('Los pulpos tienen tres corazones.'));

    pintar();

    expect(await screen.findByText('Los pulpos tienen tres corazones.')).toBeInTheDocument();
    expect(screen.getByText(/sabías que/i)).toBeInTheDocument();
  });

  it('se anuncia como una region con nombre, no como una alerta', async () => {
    consultarElDatoDeHoy.mockResolvedValue(entregado('Un dato.'));

    pintar();

    await screen.findByText('Un dato.');

    expect(screen.getByRole('region', { name: 'Dato curioso del día' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('mientras llega, y sin nada guardado, no pinta nada: no deja un hueco', () => {
    consultarElDatoDeHoy.mockReturnValue(new Promise(() => undefined));

    const { container } = pintar();

    expect(container).toBeEmptyDOMElement();
  });

  it('si todavia no hay ningun dato publicado, no pinta nada ni inventa uno', async () => {
    consultarElDatoDeHoy.mockResolvedValue({ dia: '2026-10-13', dato: null });

    const { container } = pintar();

    await waitFor(() => {
      expect(consultarElDatoDeHoy).toHaveBeenCalled();
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('sin sesion no pide nada ni pinta nada', () => {
    const { container } = pintar(sesion(null));

    expect(consultarElDatoDeHoy).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  describe('sin conexion', () => {
    it('si ya se vio hoy en este equipo, se ve el mismo aunque no llegue la respuesta', async () => {
      guardarElDato(CUENTA, entregado('Un dato que ya se habia visto.'));
      consultarElDatoDeHoy.mockRejectedValue(new TypeError('Failed to fetch'));

      pintar();

      expect(await screen.findByText('Un dato que ya se habia visto.')).toBeInTheDocument();
    });

    it('lo guarda para la proxima vez que se abra sin conexion', async () => {
      consultarElDatoDeHoy.mockResolvedValue(entregado('Un dato que se guarda.'));

      pintar();
      await screen.findByText('Un dato que se guarda.');

      expect(datoGuardadoDe(CUENTA)?.dato.texto).toBe('Un dato que se guarda.');
    });

    it('al volver la conexion se pone al dia con el del servidor', async () => {
      guardarElDato(CUENTA, entregado('El de ayer.', '2026-10-12'));
      consultarElDatoDeHoy.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      consultarElDatoDeHoy.mockResolvedValue(entregado('El de hoy.'));

      pintar();

      expect(await screen.findByText('El de ayer.')).toBeInTheDocument();

      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      expect(await screen.findByText('El de hoy.')).toBeInTheDocument();
      expect(screen.queryByText('El de ayer.')).toBeNull();
    });
  });

  describe('lo guardado es de una persona', () => {
    it('no se muestra el dato guardado de otra cuenta', () => {
      guardarElDato(OTRA, entregado('Un dato de otra persona.'));
      consultarElDatoDeHoy.mockReturnValue(new Promise(() => undefined));

      const { container } = pintar(sesion(CUENTA));

      expect(container).toBeEmptyDOMElement();
      expect(datoGuardadoDe(CUENTA)).toBeNull();
    });

    it('al cerrar la sesion se olvida', () => {
      guardarElDato(CUENTA, entregado('Algo.'));

      olvidarElDatoGuardado();

      expect(datoGuardadoDe(CUENTA)).toBeNull();
    });
  });
});
