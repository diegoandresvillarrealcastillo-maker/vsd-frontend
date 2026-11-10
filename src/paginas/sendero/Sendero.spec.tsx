import type { Session } from '@supabase/supabase-js';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Cuenta } from '../../infraestructura/api/cuenta.ts';
import type { ProgresoDelModulo } from '../../infraestructura/api/progreso.ts';
import { cuantosH1, fallosDeAccesibilidad } from '../../pruebas/axe.ts';
import { RUTAS, rutaDeModulo } from '../../rutas/rutas.ts';
import { SesionContexto, type EstadoDeSesion } from '../../sesion/SesionContexto.ts';
import { Sendero } from './Sendero.tsx';

const {
  consultarLaVersionDelAviso,
  darDeAltaLaCuenta,
  consultarElProgreso,
  consultarElHistorial,
  consultarSesionesPublicadas,
  consultarSesionesHechas,
} = vi.hoisted(() => ({
  consultarLaVersionDelAviso: vi.fn(),
  darDeAltaLaCuenta: vi.fn(),
  consultarElProgreso: vi.fn(),
  consultarElHistorial: vi.fn(),
  consultarSesionesPublicadas: vi.fn(),
  consultarSesionesHechas: vi.fn(),
}));

vi.mock('../../infraestructura/api/pendientes.ts', () => ({
  consultarElSemaforo: () => Promise.resolve({ pendientes: [], recordatorio: null }),
}));
vi.mock('../../infraestructura/api/aviso.ts', () => ({ consultarLaVersionDelAviso }));
vi.mock('../../infraestructura/api/cuenta.ts', () => ({ darDeAltaLaCuenta }));
vi.mock('../../infraestructura/api/progreso.ts', () => ({ consultarElProgreso }));
vi.mock('../../infraestructura/api/historial.ts', () => ({ consultarElHistorial }));
vi.mock('../../infraestructura/api/sesionesPublicadas.ts', () => ({
  consultarSesionesPublicadas,
  consultarSesionesHechas,
}));

const CUENTA: Cuenta = {
  id: '11111111-1111-4111-8111-111111111111',
  correo: 'marina@ejemplo.test',
  rol: 'usuario',
  nombre: 'Marina',
  consentimiento: { versionPolitica: '2026-09-1', aceptadoEn: '2026-09-26T15:00:00.000Z' },
  registradoEn: '2026-09-26T15:00:00.000Z',
  modulosActivos: ['bienestar'],
  mascota: null,
  diarioConRecomendaciones: false,
  acompanamientoPorDias: false,
  zonaHoraria: 'America/Bogota',
};

const PROGRESO: ProgresoDelModulo = {
  modulo: 'bienestar',
  sesiones: 3,
  etapa: { numero: 1, esTemporada: false, sesionesHechas: 3, sesionesDeLaEtapa: 5 },
  hoy: [
    { id: '0acd0000-0000-4000-8000-000000000002', nombre: 'Cómo dormiste anoche', hecha: false },
  ],
};

function estado(): EstadoDeSesion {
  const vacio = vi.fn();
  return {
    sesion: { user: { email: CUENTA.correo } } as Session,
    cargando: false,
    correo: CUENTA.correo,
    registrarse: vacio,
    entrar: vacio,
    entrarConGoogle: vacio,
    pedirRecuperacion: vacio,
    cambiarContrasena: vacio,
    pedirCodigoDeVerificacion: vacio,
    cambiarContrasenaConCodigo: vacio,
    salir: vacio,
  };
}

function pintar(ruta = rutaDeModulo('bienestar')) {
  return render(
    <SesionContexto.Provider value={estado()}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path={RUTAS.MODULO} element={<Sendero />} />
          <Route path={RUTAS.PANEL} element={<p>Panel</p>} />
        </Routes>
      </MemoryRouter>
    </SesionContexto.Provider>,
  );
}

beforeEach(() => {
  consultarLaVersionDelAviso.mockResolvedValue('version-de-la-api');
  darDeAltaLaCuenta.mockResolvedValue(CUENTA);
  consultarElProgreso.mockResolvedValue([PROGRESO]);
  consultarElHistorial.mockResolvedValue({ hechos: [], siguientePagina: null });
  consultarSesionesHechas.mockResolvedValue([]);
  consultarSesionesPublicadas.mockResolvedValue(
    Array.from({ length: 58 }, (_, indice) => ({
      id: `sesion-${indice + 1}`,
      idActividad: `actividad-${indice + 1}`,
      titulo: `Actividad ${indice + 1}`,
      actividad: `Actividad ${indice + 1}`,
      nivel: 1,
    })),
  );
});
afterEach(() => vi.clearAllMocks());

describe('Sendero de sesiones publicadas (SCRUM-322)', () => {
  it('permite iniciar la sugerida y abrir también actividades pendientes futuras', async () => {
    const usuario = userEvent.setup();
    pintar();
    const arbol = await screen.findByRole('region', { name: 'Actividades de bienestar' });
    expect(within(arbol).getAllByRole('button')).toHaveLength(58);
    await usuario.click(within(arbol).getByRole('button', { name: /sugerida para hoy/ }));
    expect(screen.getByRole('link', { name: /^Comenzar Actividad/ })).toBeInTheDocument();
    expect(within(arbol).getAllByRole('button', { name: /pendiente/ })).toHaveLength(57);
    const pendientes = within(arbol).getAllByRole('button', { name: /pendiente/ });
    expect(pendientes.every((boton) => !(boton as HTMLButtonElement).disabled)).toBe(true);
    expect(
      pendientes.every((boton) => boton.classList.contains('arbol-sesiones__punto--pendiente')),
    ).toBe(true);
    const primeraPendiente = pendientes[0];
    if (primeraPendiente === undefined) throw new Error('Se esperaba una actividad pendiente.');
    await usuario.click(primeraPendiente);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Comenzar Actividad/ })).toBeInTheDocument();
  });

  it('mantiene el árbol accesible con el popover abierto', async () => {
    const usuario = userEvent.setup();
    pintar();
    const arbol = await screen.findByRole('region', { name: 'Actividades de bienestar' });
    await usuario.click(within(arbol).getByRole('button', { name: /sugerida para hoy/ }));
    expect(cuantosH1()).toBe(1);
    expect(await fallosDeAccesibilidad()).toEqual([]);
  });

  it('permite reintentar la consulta del catálogo', async () => {
    consultarSesionesPublicadas.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const usuario = userEvent.setup();
    pintar();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos cargar las actividades.',
    );
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(
      await screen.findByRole('region', { name: 'Actividades de bienestar' }),
    ).toBeInTheDocument();
  });

  it('conserva el historial sin bloquear el sendero', async () => {
    consultarElHistorial.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    pintar();
    expect(
      await screen.findByRole('region', { name: 'Actividades de bienestar' }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/hace falta conexión/)).toBeInTheDocument();
  });

  it('no consulta un módulo inexistente y permite volver al panel', () => {
    pintar('/modulo/astrologia');
    expect(screen.getByRole('alert')).toHaveTextContent('Ese módulo no existe');
    expect(consultarElProgreso).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Volver a tu panel' })).toHaveAttribute(
      'href',
      RUTAS.PANEL,
    );
  });
});
