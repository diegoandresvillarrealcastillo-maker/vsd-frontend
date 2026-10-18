import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { SesionDeLaActividad } from '../../../infraestructura/api/progreso.ts';
import {
  ANAGRAMA,
  CALCULO,
  CESTAS,
  COMPLETAR,
  ESCENA,
  FLUJO,
  INTRUSO,
  LISTA,
  PUNTOS,
  sesionDeCognicion,
} from '../../../pruebas/sesionesDeCognicion.ts';
import { mecanicaDe } from './registro.tsx';

/**
 * Que pantalla corresponde a cada actividad (SCRUM-209).
 *
 * Primero por identificador: las nueve de siempre tienen su pantalla escrita a mano. Si la
 * actividad no esta ahi pero tiene un **motor**, se elige por el motor. Asi una mecanica nueva
 * sobre un motor que ya existe es una fila en la base y no un cambio en el codigo de pantallas.
 */
const SECUENCIA_DE_NUMEROS = '0acd0000-0000-4000-8000-000000000002';
const UNA_NUEVA = '0acd0000-0000-4000-8000-0000000000a1';

const UN_MOMENTO_BUENO = '0acd0000-0000-4000-8000-000000000009';

const alTerminar = vi.fn();

const CASILLAS: SesionDeLaActividad = {
  id: 's-1',
  titulo: 'Cuatro colores',
  nivel: 1,
  parametros: {
    casillas: [
      { clave: 'circulo', nombre: 'círculo verde', forma: 'círculo', color: 'verde' },
      { clave: 'cuadrado', nombre: 'cuadrado azul', forma: 'cuadrado', color: 'azul' },
    ],
    largoInicial: 3,
    rondas: 4,
    msPorElemento: 1000,
    msDeMargen: 1000,
    msDestello: 700,
  },
};

const RESPIRACION: SesionDeLaActividad = {
  id: 's-2',
  titulo: 'Inhalar 4, exhalar 6',
  nivel: 1,
  parametros: {
    advertenciaInicial: 'Si te mareas o te incomoda, suelta el patrón y respira como siempre.',
    patron: { inhalaSegundos: 4, exhalaSegundos: 6, pausaSegundos: 0 },
    duracionSegundos: 120,
  },
};

const TRES_COSAS: SesionDeLaActividad = {
  id: 's-3',
  titulo: 'Algo que probaste',
  nivel: 1,
  parametros: {
    invitacion: 'Algo que probaste hoy, aunque sea pequeño.',
    campos: 3,
    minimo: 1,
    largoMaximo: 200,
    permiteNingunaHoy: true,
  },
};

function pantalla(id: string, motor?: string, sesion?: SesionDeLaActividad) {
  const mecanica = mecanicaDe(id, motor);

  if (mecanica === undefined) {
    return undefined;
  }

  return render(mecanica({ alTerminar, enviando: false, sesion }));
}

describe('mecanicaDe', () => {
  it('por identificador, las nueve de siempre, sin necesidad de motor', () => {
    for (let n = 1; n <= 9; n += 1) {
      expect(mecanicaDe(`0acd0000-0000-4000-8000-00000000000${String(n)}`)).toBeDefined();
    }
  });

  it('el identificador manda sobre el motor: la secuencia de numeros sigue siendo la de digitos', () => {
    // Tiene motor `secuencia`, igual que «Recuerda los colores», pero se juega distinto.
    pantalla(SECUENCIA_DE_NUMEROS, 'secuencia');

    expect(screen.getByText(/Son 12 rondas/)).toBeInTheDocument();
    expect(screen.queryByText(/una casilla más/)).not.toBeInTheDocument();
  });

  it('sin pantalla por identificador, el motor secuencia elige la de casillas', () => {
    pantalla(UNA_NUEVA, 'secuencia', CASILLAS);

    expect(screen.getByText(/Son 4 rondas/)).toBeInTheDocument();
    expect(screen.getByText(/una casilla más/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Empezar/ })).toBeInTheDocument();
  });

  it('esa pantalla, sin sesion, lo dice: no hay con que pintarla', () => {
    pantalla(UNA_NUEVA, 'secuencia');

    expect(screen.getByText(/necesita la sesión de hoy/)).toBeInTheDocument();
  });

  it('el motor guia_paso_a_paso elige la respiracion guiada', () => {
    pantalla(UNA_NUEVA, 'guia_paso_a_paso', RESPIRACION);

    expect(screen.getByRole('heading', { name: 'Antes de empezar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Empezar/ })).toBeInTheDocument();
  });

  it('la respiracion, sin sesion, lo dice: no hay con que pintarla', () => {
    pantalla(UNA_NUEVA, 'guia_paso_a_paso');

    expect(screen.getByText(/necesita la sesión de hoy/)).toBeInTheDocument();
  });

  it('el motor escritura_breve elige la de varios campos', () => {
    pantalla(UNA_NUEVA, 'escritura_breve', TRES_COSAS);

    expect(screen.getAllByRole('textbox')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Hoy no me sale ninguna' })).toBeInTheDocument();
  });

  it('la de varios campos, sin sesion, lo dice: no tiene respaldo', () => {
    pantalla(UNA_NUEVA, 'escritura_breve');

    expect(screen.getByText(/necesita la sesión de hoy/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('«Un momento bueno del dia» sigue con su pantalla de siempre aunque tenga el mismo motor', () => {
    // Sin sesion usa lo de siempre: su pregunta y su boton, no el aviso de que falta la sesion.
    pantalla(UN_MOMENTO_BUENO, 'escritura_breve');

    expect(screen.getByRole('textbox', { name: '¿Qué estuvo bien hoy?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hoy no me sale ninguno' })).toBeInTheDocument();
    expect(screen.queryByText(/necesita la sesión de hoy/)).not.toBeInTheDocument();
  });

  it('un motor que todavia no tiene pantalla, o ninguno, no tiene mecanica', () => {
    expect(mecanicaDe(UNA_NUEVA, 'cuestionario_corto')).toBeUndefined();
    expect(mecanicaDe(UNA_NUEVA, 'motor_que_no_existe')).toBeUndefined();
    expect(mecanicaDe(UNA_NUEVA)).toBeUndefined();
    expect(mecanicaDe('no-es-un-identificador')).toBeUndefined();
  });

  describe.each([
    ['tocar_el_objetivo', 'flujo', FLUJO, /Toca solo si es el sol/],
    ['tocar_el_objetivo', 'puntos', PUNTOS, /Toca los puntos en orden/],
    ['ver_ocultar_recordar', 'lista', LISTA, /Verás una lista durante unos 10 segundos/],
    ['ver_ocultar_recordar', 'escena', ESCENA, /Verás unas figuras en una cuadrícula/],
    ['clasificar', 'intruso', INTRUSO, /En cada ronda hay cuatro palabras/],
    ['clasificar', 'cestas', CESTAS, /Lleva cada tarjeta a su cesta/],
    ['palabras', 'completar', COMPLETAR, /Son 3 palabras con letras que faltan/],
    ['palabras', 'anagrama', ANAGRAMA, /Son 3 palabras con las letras revueltas/],
    ['calculo', undefined, CALCULO, /Son 3 cuentas cortas/],
  ] as const)('el motor %s en su modo %s (SCRUM-225)', (motor, modo, parametros, presentacion) => {
    it('elige la pantalla de su modo por el `modo` de la sesion', () => {
      pantalla(UNA_NUEVA, motor, sesionDeCognicion(parametros));

      expect(screen.getByText(presentacion)).toBeInTheDocument();
      expect(screen.queryByText(/necesita la sesión de hoy/)).not.toBeInTheDocument();
      expect(modo === undefined || parametros.modo === modo).toBe(true);
    });

    it('sin sesion, lo dice: lo que se juega sale entero de la sesion', () => {
      pantalla(UNA_NUEVA, motor);

      expect(screen.getByText(/necesita la sesión de hoy/)).toBeInTheDocument();
    });
  });

  it('un motor de varios modos, ante un modo que no conoce, dice que necesita la sesion de hoy', () => {
    pantalla(
      UNA_NUEVA,
      'tocar_el_objetivo',
      sesionDeCognicion({ ...FLUJO, modo: 'otro_modo_del_futuro' }),
    );

    expect(screen.getByText(/necesita la sesión de hoy/)).toBeInTheDocument();
  });

  it('el identificador manda sobre el motor tambien con las sesiones nuevas', () => {
    // «Recuerda los colores» comparte motor `secuencia` con la de casillas y se sigue jugando por su id.
    pantalla(SECUENCIA_DE_NUMEROS, 'clasificar', sesionDeCognicion(INTRUSO));

    expect(screen.queryByText(/En cada ronda hay cuatro palabras/)).not.toBeInTheDocument();
  });

  it('un nombre del prototipo del objeto no es una mecanica, ni como identificador ni como motor', () => {
    for (const nombre of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(mecanicaDe(nombre), nombre).toBeUndefined();
      expect(mecanicaDe(UNA_NUEVA, nombre), nombre).toBeUndefined();
    }
  });
});
