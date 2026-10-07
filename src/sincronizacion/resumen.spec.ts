import { describe, expect, it } from 'vitest';

import { nuevaOperacion, type Operacion, type TipoDeOperacion } from './cola.ts';
import type {
  MotivoDeSincronizacion,
  ResultadoDeSincronizacion,
  ResumenDeSincronizacion,
} from './motor.ts';
import {
  avisoDeSinConexion,
  cambioParaMostrar,
  cambios,
  cuandoFue,
  cambiosParaMostrar,
  construirAviso,
  contarCambios,
  descripcionDelCambio,
  indicadorDe,
  motivoDelFallo,
} from './resumen.ts';

const AHORA = new Date('2026-10-07T15:00:00.000Z');

let contador = 0;

function operacion(cambiosAlEstado: Partial<Operacion> = {}): Operacion {
  contador += 1;

  return {
    ...nuevaOperacion(
      {
        operationId: `op-${String(contador)}`,
        tipo: 'diario.escribir',
        entidad: `diario:${String(contador)}`,
        payload: { contenido: 'TEXTO-MUY-PRIVADO' },
      },
      new Date('2026-10-07T14:00:00.000Z'),
    ),
    orden: contador,
    ...cambiosAlEstado,
  };
}

const SIN_NADA: ResumenDeSincronizacion = {
  enviadas: 0,
  requierenAtencion: 0,
  conflictos: 0,
  pendientes: 0,
  recibos: [],
};

function resultado(
  estado: ResultadoDeSincronizacion['estado'],
  resumen: Partial<ResumenDeSincronizacion> = {},
): ResultadoDeSincronizacion {
  return { estado, resumen: { ...SIN_NADA, ...resumen } };
}

function aviso(
  r: ResultadoDeSincronizacion,
  motivo: MotivoDeSincronizacion = 'conexion',
  estabaSinConexion = false,
) {
  return construirAviso({ resultado: r, motivo, estabaSinConexion });
}

describe('cambios', () => {
  it('uno en singular, el resto en plural, y cero tambien', () => {
    expect(cambios(0)).toBe('0 cambios');
    expect(cambios(1)).toBe('1 cambio');
    expect(cambios(2)).toBe('2 cambios');
    expect(cambios(12)).toBe('12 cambios');
  });
});

describe('descripcionDelCambio: se nombra el tipo, nunca lo escrito', () => {
  it.each<[TipoDeOperacion, string]>([
    ['resultado.registrar', 'Resultado de una actividad'],
    ['diario.escribir', 'Anotación del diario'],
    ['diario.editar', 'Corrección de una anotación del diario'],
    ['pendiente.crear', 'Pendiente nuevo'],
    ['pendiente.editar', 'Cambio en un pendiente'],
    ['pendiente.borrar', 'Pendiente borrado'],
  ])('%s', (tipo, esperado) => {
    expect(descripcionDelCambio(tipo)).toBe(esperado);
  });
});

describe('contarCambios', () => {
  it('sin operaciones, todo en cero', () => {
    expect(contarCambios([])).toEqual({
      porEnviar: 0,
      requierenAtencion: 0,
      conflictos: 0,
      total: 0,
    });
  });

  it('separa lo que espera, lo que pide atencion y los conflictos', () => {
    const contadores = contarCambios([
      operacion({ estado: 'pendiente' }),
      operacion({ estado: 'pendiente' }),
      operacion({ estado: 'enviando' }),
      operacion({ estado: 'requiere_atencion' }),
      operacion({ estado: 'conflicto' }),
      operacion({ estado: 'conflicto' }),
    ]);

    expect(contadores).toEqual({ porEnviar: 3, requierenAtencion: 1, conflictos: 2, total: 6 });
  });

  it('lo que ya se envio no cuenta: ya no esta solo en este equipo', () => {
    const contadores = contarCambios([
      operacion({ estado: 'hecha' }),
      operacion({ estado: 'hecha' }),
    ]);

    expect(contadores.total).toBe(0);
  });
});

describe('indicadorDe', () => {
  const nada = contarCambios([]);
  const con = (porEnviar: number, requierenAtencion = 0, conflictos = 0) => ({
    porEnviar,
    requierenAtencion,
    conflictos,
    total: porEnviar + requierenAtencion + conflictos,
  });

  it('sin conexion y sin nada guardado, solo lo dice', () => {
    expect(indicadorDe('sin_conexion', false, nada)).toEqual({
      texto: 'Sin conexión',
      tono: 'aviso',
      cantidad: 0,
    });
  });

  it('sin conexion con cambios, dice cuantos hay guardados en este equipo', () => {
    expect(indicadorDe('sin_conexion', false, con(3)).texto).toBe(
      'Sin conexión · 3 cambios guardados en este equipo',
    );
    expect(indicadorDe('sin_conexion', false, con(1)).texto).toBe(
      'Sin conexión · 1 cambio guardado en este equipo',
    );
    expect(indicadorDe('sin_conexion', false, con(3)).cantidad).toBe(3);
  });

  it('sin conexion cuenta todo lo guardado, tambien lo que pide atencion', () => {
    const indicador = indicadorDe('sin_conexion', false, con(1, 1, 1));

    expect(indicador.texto).toBe('Sin conexión · 3 cambios guardados en este equipo');
    expect(indicador.tono).toBe('atencion');
  });

  it('sin conexion y sincronizando: manda la falta de conexion', () => {
    expect(indicadorDe('sin_conexion', true, con(2)).texto).toMatch(/^Sin conexión/);
  });

  it('con conexion y sincronizando, lo dice', () => {
    expect(indicadorDe('con_conexion', true, con(2))).toEqual({
      texto: 'Sincronizando…',
      tono: 'aviso',
      cantidad: 2,
    });
  });

  it('con conexion y algo por enviar', () => {
    expect(indicadorDe('con_conexion', false, con(1))).toEqual({
      texto: '1 cambio por enviar',
      tono: 'aviso',
      cantidad: 1,
    });
    expect(indicadorDe('con_conexion', false, con(4)).texto).toBe('4 cambios por enviar');
  });

  it('lo que necesita a la persona manda sobre lo que espera', () => {
    expect(indicadorDe('con_conexion', false, con(3, 1))).toMatchObject({
      texto: '1 cambio necesita tu atención',
      tono: 'atencion',
      cantidad: 4,
    });
    expect(indicadorDe('con_conexion', false, con(0, 2, 1)).texto).toBe(
      '3 cambios necesitan tu atención',
    );
  });

  it('un conflicto tambien pide atencion', () => {
    expect(indicadorDe('con_conexion', false, con(0, 0, 1))).toMatchObject({
      texto: '1 cambio necesita tu atención',
      tono: 'atencion',
    });
  });

  it('sincronizando, aunque haya algo que pide atencion, dice que sincroniza', () => {
    expect(indicadorDe('con_conexion', true, con(1, 1)).texto).toBe('Sincronizando…');
  });

  it('con conexion y nada pendiente, todo enviado', () => {
    expect(indicadorDe('con_conexion', false, nada)).toEqual({
      texto: 'Todo enviado',
      tono: 'normal',
      cantidad: 0,
    });
  });
});

describe('motivoDelFallo: por que no se pudo, sin repetir lo escrito', () => {
  const error = (codigo: string, estado?: number) => ({
    codigo,
    ...(estado === undefined ? {} : { estado }),
    momento: '2026-10-07T14:00:00.000Z',
  });

  it.each([
    ['SIN_RESPUESTA', 'El servidor no respondió después de varios intentos.'],
    ['PAYLOAD_INVALIDO', 'Lo guardado no tiene la forma que se espera.'],
    ['IDENTIFICADOR_DE_OPERACION_NO_COINCIDE', 'Lo guardado no tiene la forma que se espera.'],
    ['PAYLOAD_VERSION_NO_SOPORTADA', 'Lo guardó una versión más nueva de la aplicación.'],
    ['ALMACEN_ILEGIBLE', 'No se pudo leer lo guardado en este equipo.'],
    ['REFERENCIA_SIN_RESOLVER', 'Depende de algo que no llegó a crearse.'],
    ['VERSION_DESACTUALIZADA', 'Otro dispositivo lo cambió antes. No se pisó nada.'],
    ['EDICION_FUERA_DE_PLAZO', 'Pasó la hora para corregirlo. No se cambió nada.'],
  ])('%s', (codigo, texto) => {
    expect(motivoDelFallo(error(codigo))).toBe(texto);
  });

  it('segun el estado HTTP, cuando el codigo no dice mas', () => {
    expect(motivoDelFallo(error('PENDIENTE_NO_ENCONTRADO', 404))).toBe(
      'Ya no existe en el servidor.',
    );
    expect(motivoDelFallo(error('PROHIBIDO', 403))).toBe('No tienes permiso para este cambio.');
  });

  it('lo demas y lo desconocido, con una frase neutra', () => {
    expect(motivoDelFallo(error('PENDIENTE_INVALIDO', 400))).toBe(
      'El servidor no aceptó este cambio.',
    );
    expect(motivoDelFallo(error('ALGO_NUEVO'))).toBe('El servidor no aceptó este cambio.');
    expect(motivoDelFallo(null)).toBe('El servidor no aceptó este cambio.');
  });

  it('el codigo gana al estado', () => {
    expect(motivoDelFallo(error('SIN_RESPUESTA', 404))).toBe(
      'El servidor no respondió después de varios intentos.',
    );
  });
});

describe('cambioParaMostrar', () => {
  it('lleva el tipo, la hora y el estado, y nada de lo escrito', () => {
    const cambio = cambioParaMostrar(operacion({ tipo: 'diario.escribir' }), AHORA);

    expect(cambio).toMatchObject({
      tipo: 'diario.escribir',
      descripcion: 'Anotación del diario',
      creadaEn: '2026-10-07T14:00:00.000Z',
      estado: 'pendiente',
    });
    expect(JSON.stringify(cambio)).not.toContain('TEXTO-MUY-PRIVADO');
  });

  it('pendiente: se envia solo, y no hay nada que hacer', () => {
    expect(cambioParaMostrar(operacion(), AHORA)).toMatchObject({
      detalle: 'Guardado en este equipo. Se enviará solo.',
      puedeReintentarse: false,
      puedeDescartarse: false,
    });
  });

  it('pendiente esperando un reintento: dice a que hora', () => {
    const cambio = cambioParaMostrar(
      operacion({ proximoIntento: new Date(AHORA.getTime() + 5 * 60_000).toISOString() }),
      AHORA,
    );

    expect(cambio.detalle).toMatch(/^Se volverá a intentar a las .+\.$/);
    expect(cambio.puedeDescartarse).toBe(false);
  });

  it('un reintento cuya hora es justo ahora ya toca: no se dice que se volvera a intentar', () => {
    const cambio = cambioParaMostrar(operacion({ proximoIntento: AHORA.toISOString() }), AHORA);

    expect(cambio.detalle).toBe('Guardado en este equipo. Se enviará solo.');
  });

  it('un reintento cuya hora ya paso es igual que no tener hora', () => {
    const cambio = cambioParaMostrar(
      operacion({ proximoIntento: new Date(AHORA.getTime() - 60_000).toISOString() }),
      AHORA,
    );

    expect(cambio.detalle).toBe('Guardado en este equipo. Se enviará solo.');
  });

  it('enviando', () => {
    expect(cambioParaMostrar(operacion({ estado: 'enviando' }), AHORA)).toMatchObject({
      detalle: 'Enviando…',
      puedeReintentarse: false,
      puedeDescartarse: false,
    });
  });

  it('requiere atencion: dice por que y se puede reintentar o descartar', () => {
    const cambio = cambioParaMostrar(
      operacion({
        estado: 'requiere_atencion',
        error: { codigo: 'SIN_RESPUESTA', momento: AHORA.toISOString() },
      }),
      AHORA,
    );

    expect(cambio).toMatchObject({
      detalle: 'El servidor no respondió después de varios intentos.',
      puedeReintentarse: true,
      puedeDescartarse: true,
    });
  });

  it('lo ilegible solo se puede descartar: no hay con que reenviar', () => {
    expect(
      cambioParaMostrar(operacion({ estado: 'requiere_atencion', ilegible: true }), AHORA),
    ).toMatchObject({ puedeReintentarse: false, puedeDescartarse: true });
  });

  it('un conflicto solo se descarta: reintentar chocaria con lo mismo', () => {
    expect(
      cambioParaMostrar(
        operacion({
          estado: 'conflicto',
          error: { codigo: 'VERSION_DESACTUALIZADA', estado: 409, momento: AHORA.toISOString() },
        }),
        AHORA,
      ),
    ).toMatchObject({
      detalle: 'Otro dispositivo lo cambió antes. No se pisó nada.',
      puedeReintentarse: false,
      puedeDescartarse: true,
    });
  });

  it('hecha: enviado, y nada que hacer', () => {
    expect(cambioParaMostrar(operacion({ estado: 'hecha' }), AHORA)).toMatchObject({
      detalle: 'Enviado',
      puedeReintentarse: false,
      puedeDescartarse: false,
    });
  });
});

describe('cambiosParaMostrar', () => {
  it('deja fuera lo que ya se envio', () => {
    const lista = cambiosParaMostrar([operacion({ estado: 'hecha' }), operacion()], AHORA);

    expect(lista).toHaveLength(1);
  });

  it('lo que necesita a la persona va primero; el resto, en el orden en que se hizo', () => {
    const a = operacion({ estado: 'pendiente', orden: 1 });
    const b = operacion({ estado: 'requiere_atencion', orden: 2 });
    const c = operacion({ estado: 'pendiente', orden: 3 });
    const d = operacion({ estado: 'conflicto', orden: 4 });

    const ids = cambiosParaMostrar([c, d, a, b], AHORA).map((cambio) => cambio.operationId);

    expect(ids).toEqual([b.operationId, d.operationId, a.operationId, c.operationId]);
  });

  it('no cambia la lista que recibe', () => {
    const entrada = [operacion({ orden: 2 }), operacion({ orden: 1, estado: 'requiere_atencion' })];
    const copia = [...entrada];

    cambiosParaMostrar(entrada, AHORA);

    expect(entrada).toEqual(copia);
  });
});

describe('construirAviso: uno por tanda, no uno por cambio', () => {
  describe('todo salio bien', () => {
    it('al volver la conexion, con varios cambios', () => {
      expect(aviso(resultado('terminada', { enviadas: 3 }), 'conexion', true)).toMatchObject({
        texto:
          'Volviste a tener conexión. Enviamos 3 cambios que estaban guardados en este equipo.',
        tono: 'exito',
        enviadas: 3,
        verLista: false,
        pedirEntrar: false,
      });
    });

    it('al volver la conexion, con un solo cambio, en singular', () => {
      expect(aviso(resultado('terminada', { enviadas: 1 }), 'conexion', true)?.texto).toBe(
        'Volviste a tener conexión. Enviamos 1 cambio que estaba guardado en este equipo.',
      );
    });

    it('a peticion de la persona', () => {
      expect(aviso(resultado('terminada', { enviadas: 2 }), 'manual')?.texto).toBe(
        'Listo. Enviamos 2 cambios que estaban guardados en este equipo.',
      );
    });

    it('a peticion, aunque antes no hubiera conexion, no dice que volvio: ella lo pidio', () => {
      expect(aviso(resultado('terminada', { enviadas: 2 }), 'manual', true)?.texto).toBe(
        'Listo. Enviamos 2 cambios que estaban guardados en este equipo.',
      );
    });

    it('sin haber perdido la conexion (al abrir, o por un reintento), solo lo que se envio', () => {
      expect(aviso(resultado('terminada', { enviadas: 2 }), 'apertura')?.texto).toBe(
        'Enviamos 2 cambios que estaban guardados en este equipo.',
      );
      expect(aviso(resultado('terminada', { enviadas: 1 }), 'programada')?.texto).toBe(
        'Enviamos 1 cambio que estaba guardado en este equipo.',
      );
    });
  });

  describe('no hay nada que enviar', () => {
    it('al volver la conexion, solo se dice que volvio', () => {
      expect(aviso(resultado('nada_que_hacer'), 'conexion', true)).toMatchObject({
        texto: 'Volviste a tener conexión.',
        tono: 'exito',
        enviadas: 0,
      });
      expect(aviso(resultado('terminada'), 'conexion', true)?.texto).toBe(
        'Volviste a tener conexión.',
      );
    });

    it('a peticion de la persona hay que contestarle', () => {
      expect(aviso(resultado('nada_que_hacer'), 'manual')?.texto).toBe(
        'No hay cambios por enviar.',
      );
      expect(aviso(resultado('terminada'), 'manual')?.texto).toBe('No hay cambios por enviar.');
    });

    it.each<MotivoDeSincronizacion>(['apertura', 'programada', 'conexion'])(
      'por %s y sin haber perdido la conexion, se calla',
      (motivo) => {
        expect(aviso(resultado('nada_que_hacer'), motivo)).toBeNull();
        expect(aviso(resultado('terminada'), motivo)).toBeNull();
      },
    );
  });

  describe('algo no salio', () => {
    it('lo enviado y lo que necesita atencion, en un solo aviso que lleva a la lista', () => {
      const a = aviso(
        resultado('terminada', { enviadas: 2, requierenAtencion: 1 }),
        'conexion',
        true,
      );

      expect(a).toMatchObject({
        texto: 'Volviste a tener conexión. Enviamos 2 cambios. 1 cambio necesita tu atención.',
        tono: 'atencion',
        verLista: true,
        enviadas: 2,
      });
    });

    it('los conflictos cuentan como atencion', () => {
      expect(
        aviso(
          resultado('terminada', { enviadas: 1, requierenAtencion: 1, conflictos: 2 }),
          'manual',
        )?.texto,
      ).toBe('Enviamos 1 cambio. 3 cambios necesitan tu atención.');
    });

    it('si nada salio y hay rechazos, lo dice', () => {
      const a = aviso(resultado('terminada', { requierenAtencion: 2 }), 'manual');

      expect(a).toMatchObject({
        texto: '2 cambios necesitan tu atención.',
        tono: 'atencion',
        verLista: true,
        enviadas: 0,
      });
    });

    it('lo enviado y lo que se volvera a intentar', () => {
      expect(aviso(resultado('terminada', { enviadas: 1, pendientes: 1 }), 'conexion')?.texto).toBe(
        'Enviamos 1 cambio. 1 cambio sigue guardado en este equipo y se volverá a intentar.',
      );
      expect(aviso(resultado('terminada', { enviadas: 1, pendientes: 3 }), 'conexion')?.texto).toBe(
        'Enviamos 1 cambio. 3 cambios siguen guardados en este equipo y se volverán a intentar.',
      );
    });

    it('todo junto', () => {
      expect(
        aviso(
          resultado('terminada', { enviadas: 2, requierenAtencion: 1, pendientes: 2 }),
          'conexion',
          true,
        )?.texto,
      ).toBe(
        'Volviste a tener conexión. Enviamos 2 cambios. 1 cambio necesita tu atención. 2 cambios siguen guardados en este equipo y se volverán a intentar.',
      );
    });

    it('si el servidor no responde y nada salio, a peticion se dice; por su cuenta, se calla', () => {
      const sinRespuesta = resultado('terminada', { pendientes: 2 });

      expect(aviso(sinRespuesta, 'manual')).toMatchObject({
        texto: '2 cambios siguen guardados en este equipo y se volverán a intentar.',
        tono: 'atencion',
        verLista: true,
      });
      // Avisar en cada reintento seria ruido.
      expect(aviso(sinRespuesta, 'programada')).toBeNull();
      expect(aviso(sinRespuesta, 'apertura')).toBeNull();
    });

    it('si acaba de volver la conexion y el servidor no responde, tambien se dice', () => {
      expect(aviso(resultado('terminada', { pendientes: 1 }), 'conexion', true)?.texto).toBe(
        'Volviste a tener conexión. 1 cambio sigue guardado en este equipo y se volverá a intentar.',
      );
    });

    it('pero un rechazo se dice siempre, aunque nadie lo haya pedido: la persona tiene que enterarse', () => {
      expect(aviso(resultado('terminada', { requierenAtencion: 1 }), 'programada')?.texto).toBe(
        '1 cambio necesita tu atención.',
      );
    });
  });

  describe('la sesion vencio', () => {
    it('pide entrar de nuevo y dice que sigue guardado', () => {
      expect(aviso(resultado('sesion_vencida', { pendientes: 3 }), 'manual')).toMatchObject({
        texto: 'Tu sesión venció. Entra de nuevo para enviar 3 cambios guardados en este equipo.',
        tono: 'atencion',
        pedirEntrar: true,
        verLista: false,
      });
    });

    it('en singular', () => {
      expect(aviso(resultado('sesion_vencida', { pendientes: 1 }))?.texto).toBe(
        'Tu sesión venció. Entra de nuevo para enviar 1 cambio guardado en este equipo.',
      );
    });

    it('si ya se habia enviado algo, y no queda nada, solo pide entrar', () => {
      expect(aviso(resultado('sesion_vencida', { enviadas: 2 }))?.texto).toBe(
        'Tu sesión venció. Entra de nuevo para seguir.',
      );
    });

    it('sin nada guardado ni enviado no hay nada que decir', () => {
      expect(aviso(resultado('sesion_vencida'))).toBeNull();
    });
  });

  describe('lo que no se avisa', () => {
    it.each(['ocupada', 'sin_sesion', 'persona_distinta'] as const)(
      '%s: el indicador o la pantalla ya lo dicen',
      (estado) => {
        expect(aviso(resultado(estado, { pendientes: 2 }), 'manual', true)).toBeNull();
      },
    );

    it('sin conexion, por su cuenta: el indicador ya lo dice, no se repite en cada intento', () => {
      expect(aviso(resultado('sin_conexion', { pendientes: 2 }), 'programada', true)).toBeNull();
      expect(aviso(resultado('sin_conexion', { pendientes: 2 }), 'conexion', true)).toBeNull();
    });
  });

  describe('la persona pide enviar y no hay conexion', () => {
    it('hay que contestarle, y decirle que no se perdio nada', () => {
      expect(aviso(resultado('sin_conexion', { pendientes: 2 }), 'manual')).toMatchObject({
        texto: 'Sigues sin conexión. Tus cambios siguen guardados en este equipo.',
        tono: 'info',
        enviadas: 0,
        verLista: false,
      });
    });
  });

  describe('avisoDeSinConexion', () => {
    it('tranquiliza: lo que se haga se guarda y se envia despues', () => {
      expect(avisoDeSinConexion()).toEqual({
        texto:
          'Sin conexión. Lo que hagas se guarda en este equipo y se envía cuando vuelva la conexión.',
        tono: 'info',
        enviadas: 0,
        verLista: false,
        pedirEntrar: false,
        sugiereAcompanamiento: false,
        lineasDeAtencion: [],
      });
    });
  });

  describe('el acompanamiento', () => {
    const linea = (id: string) => ({ id, titulo: `Linea ${id}`, tipo: 'telefono' });
    const recibo = (sugiere: boolean, lineas: unknown) => ({
      operationId: 'a',
      tipo: 'resultado.registrar' as const,
      recibo: { id: 'r', sugiereAcompanamiento: sugiere, lineasDeAtencion: lineas },
    });

    it('si lo enviado lo sugiere, trae las lineas', () => {
      const a = aviso(
        resultado('terminada', { enviadas: 1, recibos: [recibo(true, [linea('1'), linea('2')])] }),
        'conexion',
        true,
      );

      expect(a?.sugiereAcompanamiento).toBe(true);
      expect(a?.lineasDeAtencion.map((l) => l.id)).toEqual(['1', '2']);
    });

    it('sin sugerencia, no trae nada', () => {
      const a = aviso(
        resultado('terminada', { enviadas: 1, recibos: [recibo(false, [linea('1')])] }),
        'conexion',
      );

      expect(a?.sugiereAcompanamiento).toBe(false);
      expect(a?.lineasDeAtencion).toEqual([]);
    });

    it('las lineas repetidas de varios resultados se muestran una vez', () => {
      const a = aviso(
        resultado('terminada', {
          enviadas: 2,
          recibos: [recibo(true, [linea('1')]), recibo(true, [linea('1'), linea('2')])],
        }),
        'conexion',
      );

      expect(a?.lineasDeAtencion.map((l) => l.id)).toEqual(['1', '2']);
    });

    it('sugiere aunque la API no mande lineas (una version anterior)', () => {
      const a = aviso(
        resultado('terminada', { enviadas: 1, recibos: [recibo(true, undefined)] }),
        'conexion',
      );

      expect(a?.sugiereAcompanamiento).toBe(true);
      expect(a?.lineasDeAtencion).toEqual([]);
    });

    it('un recibo que no dice nada del acompanamiento no lo sugiere', () => {
      const a = aviso(
        resultado('terminada', {
          enviadas: 2,
          recibos: [
            { operationId: 'a', tipo: 'resultado.registrar', recibo: { id: 'r' } },
            {
              operationId: 'b',
              tipo: 'resultado.registrar',
              recibo: { lineasDeAtencion: [linea('1')] },
            },
          ],
        }),
        'conexion',
      );

      expect(a?.sugiereAcompanamiento).toBe(false);
      expect(a?.lineasDeAtencion).toEqual([]);
    });

    it('un recibo que no es lo que se espera no rompe nada', () => {
      const a = aviso(
        resultado('terminada', {
          enviadas: 4,
          recibos: [
            { operationId: 'a', tipo: 'pendiente.crear', recibo: null },
            { operationId: 'b', tipo: 'pendiente.crear', recibo: 'texto' },
            { operationId: 'c', tipo: 'pendiente.crear', recibo: [true] },
            recibo(true, [{ sin: 'id' }, 7, null, linea('9')]),
          ],
        }),
        'conexion',
      );

      expect(a?.sugiereAcompanamiento).toBe(true);
      expect(a?.lineasDeAtencion.map((l) => l.id)).toEqual(['9']);
    });

    it('tambien viaja con un aviso de que algo no salio', () => {
      const a = aviso(
        resultado('terminada', {
          enviadas: 1,
          requierenAtencion: 1,
          recibos: [recibo(true, [linea('1')])],
        }),
        'manual',
      );

      expect(a?.tono).toBe('atencion');
      expect(a?.sugiereAcompanamiento).toBe(true);
    });
  });
});

describe('cuandoFue', () => {
  it('lo de hoy, solo con la hora', () => {
    const texto = cuandoFue('2026-10-07T14:05:00.000Z', AHORA);

    expect(texto).toMatch(/\d{1,2}:05/);
    expect(texto).not.toMatch(/oct/i);
  });

  it('lo de otro dia, con el dia y la hora', () => {
    const texto = cuandoFue('2026-10-05T14:05:00.000Z', AHORA);

    expect(texto).toMatch(/5/);
    expect(texto).toMatch(/oct/i);
    expect(texto).toMatch(/:05/);
  });
});
