import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Cuenta, Mascota } from '../../../infraestructura/api/cuenta.ts';
import { sprite } from '../../../mascota/sprites.ts';
import { useMascotaDeLaPersona } from './mascotaDeLaPersona.ts';
import { ProveedorDeLaMascota } from './ProveedorDeLaMascota.tsx';
import { VozDeLaMascota } from './VozDeLaMascota.tsx';

/**
 * La mascota que se ve en una actividad es la que la persona tiene elegida en su cuenta
 * (SCRUM-173): la de la copia de este equipo mientras llega la cuenta, y la de la cuenta en
 * cuanto llega, que es la que manda.
 */
const { consultarLaCuentaPropia, leerLaCuentaGuardada } = vi.hoisted(() => ({
  consultarLaCuentaPropia: vi.fn(),
  leerLaCuentaGuardada: vi.fn(),
}));

vi.mock('../../../infraestructura/api/cuenta.ts', () => ({ consultarLaCuentaPropia }));
vi.mock('../../../sincronizacion/panelLocal.ts', () => ({ leerLaCuentaGuardada }));

function Habla() {
  const mascota = useMascotaDeLaPersona();

  return <VozDeLaMascota mascota={mascota} mensaje="Hola" />;
}

function pintar() {
  return render(
    <ProveedorDeLaMascota>
      <Habla />
    </ProveedorDeLaMascota>,
  );
}

const cara = (): string | null | undefined =>
  document.querySelector('.viva-voz__cara img')?.getAttribute('src');

const laCuenta = (mascota: Mascota | null) => ({ mascota }) as unknown as Cuenta;
const laCopia = (mascota: Mascota | null) => ({
  cuenta: laCuenta(mascota),
  guardadoEn: '2026-10-12T10:00:00.000Z',
});

/** Una promesa que se resuelve cuando la prueba quiere, para fijar quien llega primero. */
function pendiente<T>() {
  let resolver: (valor: T) => void = () => undefined;
  const promesa = new Promise<T>((resolve) => {
    resolver = resolve;
  });

  return { promesa, resolver };
}

beforeEach(() => {
  consultarLaCuentaPropia.mockReset();
  leerLaCuentaGuardada.mockReset();
});

describe('La mascota de las actividades', () => {
  it('es la que dice la cuenta', async () => {
    leerLaCuentaGuardada.mockResolvedValue(null);
    consultarLaCuentaPropia.mockResolvedValue(laCuenta({ forma: 'gato', nombre: 'Michi' }));

    pintar();

    await waitFor(() => expect(cara()).toBe(sprite('gato', 'normal')));
  });

  it('mientras llega la cuenta usa la copia, y cuando llega manda la cuenta', async () => {
    const cuenta = pendiente<Cuenta>();

    leerLaCuentaGuardada.mockResolvedValue(laCopia({ forma: 'ori', nombre: 'Ori' }));
    consultarLaCuentaPropia.mockReturnValue(cuenta.promesa);

    pintar();

    await waitFor(() => expect(cara()).toBe(sprite('ori', 'normal')));

    cuenta.resolver(laCuenta({ forma: 'obsidian', nombre: 'Obsi' }));

    // La copia se habia quedado atras: la persona cambio de mascota despues.
    await waitFor(() => expect(cara()).toBe(sprite('obsidian', 'normal')));
  });

  it('si la cuenta no responde, se queda con la de la copia', async () => {
    leerLaCuentaGuardada.mockResolvedValue(laCopia({ forma: 'sparky', nombre: 'Chispa' }));
    consultarLaCuentaPropia.mockRejectedValue(new TypeError('Failed to fetch'));

    pintar();

    await waitFor(() => expect(cara()).toBe(sprite('sparky', 'normal')));
    // Dejo pasar la peticion fallida para comprobar que no la borra.
    await Promise.resolve();
    expect(cara()).toBe(sprite('sparky', 'normal'));
  });

  it('una copia que llega tarde no pisa a la cuenta', async () => {
    const copia = pendiente<ReturnType<typeof laCopia>>();

    leerLaCuentaGuardada.mockReturnValue(copia.promesa);
    consultarLaCuentaPropia.mockResolvedValue(laCuenta({ forma: 'gato', nombre: 'Michi' }));

    pintar();

    await waitFor(() => expect(cara()).toBe(sprite('gato', 'normal')));

    copia.resolver(laCopia({ forma: 'ori', nombre: 'Ori' }));
    await Promise.resolve();

    expect(cara()).toBe(sprite('gato', 'normal'));
  });

  it('sin copia ni conexion se acompana con la de siempre', async () => {
    leerLaCuentaGuardada.mockRejectedValue(new Error('sin almacen'));
    consultarLaCuentaPropia.mockRejectedValue(new TypeError('Failed to fetch'));

    pintar();

    await waitFor(() => expect(cara()).toBe(sprite('fungito', 'normal')));
  });

  it('una cuenta sin mascota elegida todavia tambien acompana con la de siempre', async () => {
    leerLaCuentaGuardada.mockResolvedValue(null);
    consultarLaCuentaPropia.mockResolvedValue(laCuenta(null));

    pintar();

    await waitFor(() => expect(cara()).toBe(sprite('fungito', 'normal')));
  });

  it('al salir de la pantalla no pinta nada de lo que llegue despues', async () => {
    const cuenta = pendiente<Cuenta>();

    leerLaCuentaGuardada.mockResolvedValue(null);
    consultarLaCuentaPropia.mockReturnValue(cuenta.promesa);

    const { unmount } = pintar();

    unmount();
    cuenta.resolver(laCuenta({ forma: 'gato', nombre: 'Michi' }));
    await Promise.resolve();

    expect(screen.queryByText('Hola')).not.toBeInTheDocument();
  });
});
