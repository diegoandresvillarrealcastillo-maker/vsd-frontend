import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  documentoDeUnTexto,
  guardarLaCartaEnElDiario,
  TITULO_DE_LA_CARTA,
} from './cartaEnElDiario.ts';

/**
 * «Carta a mi de manana» (SCRUM-227, ficha EMO-05): lo escrito se guarda como una entrada del diario, por la
 * misma cola que cualquier cosa que se escribe en el diario. Aqui se mira lo que se encola: que sea una entrada
 * de hoy, con la carta tal cual, y que lance si no se pudo guardar.
 */
const { encolar } = vi.hoisted(() => ({ encolar: vi.fn() }));

vi.mock('../../sincronizacion/ciclo.ts', () => ({ encolar }));

afterEach(() => {
  encolar.mockReset();
});

describe('documentoDeUnTexto', () => {
  it('un parrafo por cada renglon', () => {
    expect(documentoDeUnTexto('Hola\nmañana')).toEqual({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hola' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'mañana' }] },
      ],
    });
  });

  it('un renglon vacio es un parrafo vacio, sin un texto vacio que el editor no admite', () => {
    const { content } = documentoDeUnTexto('Uno\n\nTres');

    expect(content?.[1]).toEqual({ type: 'paragraph' });
    expect(JSON.stringify(content)).not.toContain('"text":""');
  });

  it('entiende los saltos de linea de Windows', () => {
    expect(documentoDeUnTexto('Uno\r\nDos').content).toHaveLength(2);
  });

  it('el texto va tal cual: no es HTML ni se interpreta', () => {
    const { content } = documentoDeUnTexto('<b>hola</b> **nada**');

    expect(content?.[0]).toEqual({
      type: 'paragraph',
      content: [{ type: 'text', text: '<b>hola</b> **nada**' }],
    });
  });
});

describe('guardarLaCartaEnElDiario', () => {
  it('encola una entrada del diario de hoy, con su titulo y la carta entera', async () => {
    encolar.mockResolvedValue(undefined);

    await guardarLaCartaEnElDiario(
      'Que mañana vaya con calma.',
      new Date('2026-10-18T15:30:00-05:00'),
    );

    expect(encolar).toHaveBeenCalledTimes(1);

    const [datos] = encolar.mock.calls[0] as [
      { operationId: string; tipo: string; entidad: string; payload: Record<string, unknown> },
    ];

    expect(datos.tipo).toBe('diario.escribir');
    expect(datos.entidad).toBe(`diario:${datos.operationId}`);
    expect(datos.payload).toMatchObject({
      clientOperationId: datos.operationId,
      titulo: TITULO_DE_LA_CARTA,
      contenido: documentoDeUnTexto('Que mañana vaya con calma.'),
      escritaEn: '2026-10-18T20:30:00.000Z',
    });
    expect(datos.payload.dia).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('va como carta a mi de manana: es lo que hace que el servidor selle su texto (SCRUM-230)', async () => {
    encolar.mockResolvedValue(undefined);

    await guardarLaCartaEnElDiario('Que mañana vaya con calma.');

    const [datos] = encolar.mock.calls[0] as [{ payload: Record<string, unknown> }];

    expect(datos.payload.cartaAManana).toBe(true);
  });

  it('la entrada es de hoy, no de manana: el diario no admite fechas futuras', async () => {
    encolar.mockResolvedValue(undefined);

    const ahora = new Date();

    await guardarLaCartaEnElDiario('Hola', ahora);

    const [datos] = encolar.mock.calls[0] as [{ payload: { dia: string } }];
    const hoyUtc = ahora.toISOString().slice(0, 10);
    const ayer = new Date(ahora.getTime() - 86_400_000).toISOString().slice(0, 10);
    const manana = new Date(ahora.getTime() + 86_400_000).toISOString().slice(0, 10);

    expect([hoyUtc, ayer, manana]).toContain(datos.payload.dia);
    expect(datos.payload.dia <= manana).toBe(true);
  });

  it('cada carta lleva su propio identificador: reintentar una no duplica y dos no se pisan', async () => {
    encolar.mockResolvedValue(undefined);

    await guardarLaCartaEnElDiario('Una');
    await guardarLaCartaEnElDiario('Otra');

    const [a, b] = encolar.mock.calls.map(
      ([datos]) => (datos as { operationId: string }).operationId,
    );

    expect(a).not.toBe(b);
  });

  it('si no se pudo guardar en este equipo, lanza: quien llama no debe vaciar lo escrito', async () => {
    encolar.mockRejectedValue(new Error('No hay un almacen abierto'));

    await expect(guardarLaCartaEnElDiario('Hola')).rejects.toThrow('No hay un almacen abierto');
  });
});
