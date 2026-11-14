import { describe, expect, it } from 'vitest';

import { DescifradoFallido, abrir, esSellado, generarLaClave, sellar } from './cifrado.ts';

const CONTEXTO = 'persona-1|cola|op-1|payload';

/** Los bytes de un sellado como texto, para buscar en ellos. */
function comoTexto(datos: ArrayBuffer): string {
  return new TextDecoder('latin1').decode(datos);
}

describe('cifrar y descifrar', () => {
  it.each([
    ['un objeto', { texto: 'Pedir la cita medica', nivel: 'urgente', hecho: false }],
    ['una lista', [1, 'dos', { tres: 3 }, null]],
    ['un texto con tildes, enies y emojis', 'Hoy me senti mal 😔 — «cansado», ¿y mañana?'],
    ['un numero', 42.5],
    ['cero', 0],
    ['verdadero', true],
    ['falso', false],
    ['nulo', null],
    ['un texto vacio', ''],
    ['un objeto vacio', {}],
    ['algo anidado', { a: { b: { c: [1, { d: 'e' }] } } }],
  ])('devuelve %s tal cual', async (_nombre, valor) => {
    const clave = await generarLaClave();

    const sellado = await sellar(clave, CONTEXTO, valor);

    expect(await abrir(clave, CONTEXTO, sellado)).toEqual(valor);
  });

  it('undefined se guarda como null: JSON no lo representa y no puede desaparecer', async () => {
    const clave = await generarLaClave();

    expect(await abrir(clave, CONTEXTO, await sellar(clave, CONTEXTO, undefined))).toBeNull();
  });

  it('un contenido grande tambien', async () => {
    const clave = await generarLaClave();
    const grande = { texto: 'x'.repeat(200_000) };

    expect(await abrir(clave, CONTEXTO, await sellar(clave, CONTEXTO, grande))).toEqual(grande);
  });
});

describe('lo cifrado no es legible', () => {
  it('los bytes guardados no contienen el texto original', async () => {
    const clave = await generarLaClave();
    const sellado = await sellar(clave, CONTEXTO, { texto: 'MUY-SECRETO-123 me siento sin ganas' });

    expect(comoTexto(sellado.datos)).not.toContain('MUY-SECRETO-123');
    expect(comoTexto(sellado.datos)).not.toContain('sin ganas');
    expect(comoTexto(sellado.datos)).not.toContain('texto');
  });

  it('el IV es de 12 bytes (96 bits), el tamano que recomienda AES-GCM', async () => {
    const clave = await generarLaClave();

    expect((await sellar(clave, CONTEXTO, 'a')).iv.byteLength).toBe(12);
  });

  it('cada cifrado usa un IV nuevo: repetirlo con la misma clave destruye la garantia', async () => {
    const clave = await generarLaClave();
    const ivs = new Set<string>();

    for (let i = 0; i < 200; i += 1) {
      ivs.add([...(await sellar(clave, CONTEXTO, 'lo mismo')).iv].join(','));
    }

    expect(ivs.size).toBe(200);
  });

  it('el mismo valor cifrado dos veces da bytes distintos', async () => {
    const clave = await generarLaClave();
    const uno = await sellar(clave, CONTEXTO, 'lo mismo');
    const otro = await sellar(clave, CONTEXTO, 'lo mismo');

    expect(comoTexto(uno.datos)).not.toBe(comoTexto(otro.datos));
  });
});

describe('lo cifrado no se puede alterar ni mover sin que se note', () => {
  it('con otra clave no se descifra', async () => {
    const clave = await generarLaClave();
    const otra = await generarLaClave();
    const sellado = await sellar(clave, CONTEXTO, { a: 1 });

    await expect(abrir(otra, CONTEXTO, sellado)).rejects.toBeInstanceOf(DescifradoFallido);
  });

  it('con otro contexto no se descifra: un registro movido a otra fila no sirve', async () => {
    const clave = await generarLaClave();
    const sellado = await sellar(clave, 'persona-1|cola|op-1|payload', { a: 1 });

    await expect(abrir(clave, 'persona-1|cola|op-2|payload', sellado)).rejects.toBeInstanceOf(
      DescifradoFallido,
    );
    await expect(abrir(clave, 'persona-2|cola|op-1|payload', sellado)).rejects.toBeInstanceOf(
      DescifradoFallido,
    );
    await expect(abrir(clave, 'persona-1|cola|op-1|recibo', sellado)).rejects.toBeInstanceOf(
      DescifradoFallido,
    );
  });

  it('un byte alterado en los datos no se descifra', async () => {
    const clave = await generarLaClave();
    const sellado = await sellar(clave, CONTEXTO, { a: 1 });
    const alterados = new Uint8Array(sellado.datos.slice(0));

    alterados[0] = (alterados[0] ?? 0) ^ 0x01;

    await expect(
      abrir(clave, CONTEXTO, { iv: sellado.iv, datos: alterados.buffer }),
    ).rejects.toBeInstanceOf(DescifradoFallido);
  });

  it('un byte alterado en la etiqueta de autenticacion (el final) tampoco', async () => {
    const clave = await generarLaClave();
    const sellado = await sellar(clave, CONTEXTO, { a: 1 });
    const alterados = new Uint8Array(sellado.datos.slice(0));
    const ultimo = alterados.length - 1;

    alterados[ultimo] = (alterados[ultimo] ?? 0) ^ 0xff;

    await expect(
      abrir(clave, CONTEXTO, { iv: sellado.iv, datos: alterados.buffer }),
    ).rejects.toBeInstanceOf(DescifradoFallido);
  });

  it('un IV alterado no se descifra', async () => {
    const clave = await generarLaClave();
    const sellado = await sellar(clave, CONTEXTO, { a: 1 });
    const iv = new Uint8Array(sellado.iv);

    iv[0] = (iv[0] ?? 0) ^ 0x01;

    await expect(abrir(clave, CONTEXTO, { iv, datos: sellado.datos })).rejects.toBeInstanceOf(
      DescifradoFallido,
    );
  });

  it('unos datos truncados no se descifran', async () => {
    const clave = await generarLaClave();
    const sellado = await sellar(clave, CONTEXTO, { a: 1 });

    await expect(
      abrir(clave, CONTEXTO, { iv: sellado.iv, datos: sellado.datos.slice(0, 5) }),
    ).rejects.toBeInstanceOf(DescifradoFallido);
  });

  it('lo que se descifra bien pero no es JSON tambien es un fallo', async () => {
    const clave = await generarLaClave();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const datos = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(CONTEXTO) },
      clave,
      new TextEncoder().encode('esto no es json {'),
    );

    await expect(abrir(clave, CONTEXTO, { iv, datos })).rejects.toBeInstanceOf(DescifradoFallido);
  });

  it('el error no cuenta lo que contenia', async () => {
    const clave = await generarLaClave();
    const otra = await generarLaClave();
    const sellado = await sellar(clave, CONTEXTO, { texto: 'MUY-SECRETO-123' });

    const error = await abrir(otra, CONTEXTO, sellado).catch((causa: unknown) => causa);

    expect(String((error as Error).message)).not.toContain('MUY-SECRETO');
    expect((error as Error).name).toBe('DescifradoFallido');
  });
});

describe('la clave', () => {
  it('es AES-GCM de 256 bits', async () => {
    const clave = await generarLaClave();

    expect(clave.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 });
    expect(clave.usages.sort()).toEqual(['decrypt', 'encrypt']);
  });

  it('no es extraible: el codigo no puede leer sus bytes', async () => {
    const clave = await generarLaClave();

    expect(clave.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', clave)).rejects.toThrow();
  });

  it('cada clave es distinta', async () => {
    const una = await generarLaClave();
    const otra = await generarLaClave();
    const sellado = await sellar(una, CONTEXTO, 'x');

    await expect(abrir(otra, CONTEXTO, sellado)).rejects.toBeInstanceOf(DescifradoFallido);
  });
});

describe('esSellado', () => {
  it('reconoce un sellado de verdad', async () => {
    expect(esSellado(await sellar(await generarLaClave(), CONTEXTO, 'x'))).toBe(true);
  });

  it.each([
    ['nulo', null],
    ['un texto', 'sellado'],
    ['un objeto vacio', {}],
    ['sin datos', { iv: new Uint8Array(12) }],
    ['sin IV', { datos: new ArrayBuffer(8) }],
    ['con un IV de otro largo', { iv: new Uint8Array(8), datos: new ArrayBuffer(8) }],
    ['con un IV que no son bytes', { iv: [1, 2, 3], datos: new ArrayBuffer(8) }],
    ['con datos que no son bytes', { iv: new Uint8Array(12), datos: 'abc' }],
  ])('no reconoce %s', (_nombre, valor) => {
    expect(esSellado(valor)).toBe(false);
  });
});
