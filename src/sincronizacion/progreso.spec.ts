import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EventoDelMotor } from './motor.ts';
import { suscribirAlProgreso, type Progreso } from './progreso.ts';

/**
 * El progreso, aislado del resto del nucleo: el ciclo y el motor son dobles que cada
 * prueba mueve a mano.
 */
const mundo = vi.hoisted(() => ({
  ciclo: null as null | { motor: { suscribir: (oyente: (evento: unknown) => void) => () => void } },
  oyentesDelCiclo: new Set<() => void>(),
  oyentesDeLaCola: new Set<() => void>(),
}));

vi.mock('./ciclo.ts', () => ({
  cicloActual: () => mundo.ciclo,
  suscribirAlCiclo: (oyente: () => void) => {
    mundo.oyentesDelCiclo.add(oyente);

    return () => {
      mundo.oyentesDelCiclo.delete(oyente);
    };
  },
  suscribirALaCola: (oyente: () => void) => {
    mundo.oyentesDeLaCola.add(oyente);

    return () => {
      mundo.oyentesDeLaCola.delete(oyente);
    };
  },
}));

function crearCiclo() {
  const oyentes = new Set<(evento: unknown) => void>();

  return {
    ciclo: {
      motor: {
        suscribir: (oyente: (evento: unknown) => void) => {
          oyentes.add(oyente);

          return () => {
            oyentes.delete(oyente);
          };
        },
      },
    },
    emitir: (evento: Partial<EventoDelMotor> & { tipo: string }) => {
      [...oyentes].forEach((oyente) => {
        oyente(evento);
      });
    },
    oyentes: () => oyentes.size,
  };
}

beforeEach(() => {
  mundo.ciclo = null;
  mundo.oyentesDelCiclo.clear();
  mundo.oyentesDeLaCola.clear();
});

function escuchar() {
  const vistos: Progreso[] = [];
  const dejar = suscribirAlProgreso((progreso) => vistos.push(progreso));

  return { vistos, dejar };
}

describe('suscribirAlProgreso (SCRUM-139)', () => {
  it('avisa una vez al empezar, para partir de lo que hay', () => {
    const { vistos } = escuchar();

    expect(vistos).toEqual([{ sincronizando: false }]);
  });

  it('avisa cuando la cola cambia', () => {
    const { vistos } = escuchar();

    [...mundo.oyentesDeLaCola].forEach((oyente) => {
      oyente();
    });

    expect(vistos).toHaveLength(2);
  });

  it('avisa cuando se abre o se cierra el almacen', () => {
    const { vistos } = escuchar();

    [...mundo.oyentesDelCiclo].forEach((oyente) => {
      oyente();
    });

    expect(vistos).toHaveLength(2);
  });

  describe('con un motor', () => {
    it('dice que esta sincronizando entre el inicio y el fin de una tanda', () => {
      const c = crearCiclo();

      mundo.ciclo = c.ciclo;

      const { vistos } = escuchar();

      c.emitir({ tipo: 'inicio' });
      c.emitir({ tipo: 'fin' });

      expect(vistos.map((v) => v.sincronizando)).toEqual([false, true, false]);
    });

    it('cada envio avisa, sin cambiar si esta sincronizando', () => {
      const c = crearCiclo();

      mundo.ciclo = c.ciclo;

      const { vistos } = escuchar();

      c.emitir({ tipo: 'inicio' });
      c.emitir({ tipo: 'enviada' });

      expect(vistos.map((v) => v.sincronizando)).toEqual([false, true, true]);
    });

    it('al abrirse otro almacen escucha a su motor y deja de escuchar al anterior', () => {
      const primero = crearCiclo();
      const segundo = crearCiclo();

      mundo.ciclo = primero.ciclo;

      const { vistos } = escuchar();

      primero.emitir({ tipo: 'inicio' });
      mundo.ciclo = segundo.ciclo;
      [...mundo.oyentesDelCiclo].forEach((oyente) => {
        oyente();
      });

      expect(primero.oyentes()).toBe(0);
      expect(segundo.oyentes()).toBe(1);
      // Lo que estaba pasando en el motor anterior no cuenta en el nuevo.
      expect(vistos.at(-1)).toEqual({ sincronizando: false });

      const antes = vistos.length;

      primero.emitir({ tipo: 'fin' });

      expect(vistos).toHaveLength(antes);

      segundo.emitir({ tipo: 'inicio' });

      expect(vistos.at(-1)).toEqual({ sincronizando: true });
    });

    it('al cerrarse el almacen no queda escuchando a nadie', () => {
      const c = crearCiclo();

      mundo.ciclo = c.ciclo;
      escuchar();
      mundo.ciclo = null;
      [...mundo.oyentesDelCiclo].forEach((oyente) => {
        oyente();
      });

      expect(c.oyentes()).toBe(0);
    });
  });

  it('al dejar de escuchar, no queda nada colgado y no avisa mas', () => {
    const c = crearCiclo();

    mundo.ciclo = c.ciclo;

    const { vistos, dejar } = escuchar();

    dejar();

    expect(c.oyentes()).toBe(0);
    expect(mundo.oyentesDeLaCola.size).toBe(0);
    expect(mundo.oyentesDelCiclo.size).toBe(0);

    c.emitir({ tipo: 'fin' });

    expect(vistos).toHaveLength(1);
  });
});
