import { consultarLaVersionDelAviso } from '../infraestructura/api/aviso.ts';
import {
  consultarLaCuentaPropia,
  darDeAltaLaCuenta,
  type Cuenta,
} from '../infraestructura/api/cuenta.ts';
import { consultarElProgreso, type ProgresoDelModulo } from '../infraestructura/api/progreso.ts';
import { fijarLaZonaDeLaCuenta } from '../tiempo/zonaHoraria.ts';
import { cicloActual } from './ciclo.ts';
import type { Operacion } from './cola.ts';
import {
  leerConCopia,
  leerSoloLaCopiaConFecha,
  modificarLaCopia,
  type LecturaConCopia,
} from './lecturas.ts';

/**
 * La cuenta y el progreso con copia en este dispositivo (SCRUM-140): lo que necesitan el panel
 * y el sendero.
 *
 * Es de la persona, asi que vive en su almacen, cifrado, y se borra al cerrar sesion (ver
 * `diarioLocal.ts`). Se guardan **juntos**, tal como los dijo el servidor: una cuenta de un
 * momento y un progreso de otro darian un panel que nunca existio.
 *
 * ## Lo que no se inventa
 *
 * El progreso lo calcula el servidor (las etapas, las sesiones, lo que toca hoy), y el cliente
 * no cuenta nada por su cuenta para que no haya dos versiones del mismo numero. Sin conexion se
 * ensena la copia, **diciendo de cuando es**, y encima solo se pone una cosa que el servidor
 * no puede contradecir: que lo que la persona hizo hoy, y esta en la cola o ya se envio, esta
 * hecho (`paginas/panel/conLoQueEstaEnLaCola.ts`).
 */

export const CLAVE_DEL_PANEL = 'panel';

export interface DatosDelPanel {
  readonly cuenta: Cuenta;
  readonly progreso: readonly ProgresoDelModulo[];
}

type Objeto = Readonly<Record<string, unknown>>;

function esObjeto(valor: unknown): valor is Objeto {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/** Lo guardado puede ser de otra version de la aplicacion: si no se entiende, no sirve. */
function esDatosDelPanel(valor: unknown): valor is DatosDelPanel {
  return (
    esObjeto(valor) &&
    esObjeto(valor.cuenta) &&
    typeof valor.cuenta.id === 'string' &&
    Array.isArray(valor.cuenta.modulosActivos) &&
    Array.isArray(valor.progreso) &&
    valor.progreso.every(
      (modulo: unknown) =>
        esObjeto(modulo) &&
        typeof modulo.modulo === 'string' &&
        esObjeto(modulo.etapa) &&
        Array.isArray(modulo.hoy),
    )
  );
}

export interface OpcionesDelPanel {
  readonly senal?: AbortSignal;
  /**
   * Dar de alta la cuenta antes de leer, como hacen las pantallas: alguien puede abrir una
   * direccion directamente, antes de que exista su cuenta. **La lectura por adelantado no lo
   * hace**: dar de alta registra el consentimiento, y eso solo lo hace una pantalla.
   */
  readonly darDeAlta?: boolean;
}

/**
 * La cuenta y el progreso: del servidor si se puede, de la copia si no. Ver `leerConCopia`
 * para el resto del comportamiento (tiempo de espera, errores que la copia no tapa).
 *
 * Si es la copia, la zona horaria de la cuenta se vuelve a fijar: de ella depende que dia es
 * "hoy", y eso lo hace la API al responder, no la copia.
 */
export async function leerElPanelConCopia(
  opciones: OpcionesDelPanel = {},
): Promise<LecturaConCopia<DatosDelPanel>> {
  const { senal, darDeAlta = false } = opciones;

  const lectura = await leerConCopia<DatosDelPanel>(
    CLAVE_DEL_PANEL,
    async () => {
      const cuenta = darDeAlta
        ? await darDeAltaLaCuenta(await consultarLaVersionDelAviso(senal), senal)
        : await consultarLaCuentaPropia(senal);

      return {
        estado: 'nuevo',
        valor: { cuenta, progreso: await consultarElProgreso(senal) },
        etag: null,
      };
    },
    senal,
  );

  if (lectura.deLaCopia) {
    // Una copia que no se entiende es como no tenerla: lo mismo que decir que no hay red.
    if (!esDatosDelPanel(lectura.valor)) {
      throw new TypeError('La copia del panel no se puede leer.');
    }

    fijarLaZonaDeLaCuenta(lectura.valor.cuenta.zonaHoraria);
  }

  return lectura;
}

/**
 * La cuenta que hay guardada, **sin preguntar a nadie** (SCRUM-142): el perfil la ensena sin
 * conexion, con todo deshabilitado, para que se vea que es lo que hay y que cambiarlo exige
 * conexion. `null` si no hay copia o no se entiende.
 *
 * Como en `leerElPanelConCopia`, la zona horaria de la cuenta se vuelve a fijar: de ella depende
 * lo que dice la pantalla (la hora de los avisos, por ejemplo), y eso lo hace la API al responder,
 * no la copia.
 */
export async function leerLaCuentaGuardada(): Promise<{
  readonly cuenta: Cuenta;
  readonly guardadoEn: string;
} | null> {
  const guardada = await leerSoloLaCopiaConFecha<unknown>(CLAVE_DEL_PANEL);

  if (guardada === null || !esDatosDelPanel(guardada.valor)) {
    return null;
  }

  fijarLaZonaDeLaCuenta(guardada.valor.cuenta.zonaHoraria);

  return { cuenta: guardada.valor.cuenta, guardadoEn: guardada.guardadoEn };
}

/**
 * Deja guardado lo ultimo que se supo, cuando algo de la cuenta cambio (activar un modulo,
 * la bienvenida): si no, sin conexion se veria el panel de antes. Nunca falla.
 */
export function guardarElPanel(datos: DatosDelPanel): Promise<void> {
  return modificarLaCopia<DatosDelPanel>(CLAVE_DEL_PANEL, () => datos);
}

/** Lo del panel que hay en la cola: los resultados de actividades, enviados o no. */
export async function leerLosResultadosDeLaCola(): Promise<readonly Operacion[]> {
  try {
    return ((await cicloActual()?.almacen.operaciones()) ?? []).filter(
      (operacion) =>
        operacion.tipo === 'resultado.registrar' &&
        operacion.ilegible !== true &&
        // Los que la API rechazo no cuentan como hechos.
        (operacion.estado === 'pendiente' ||
          operacion.estado === 'enviando' ||
          operacion.estado === 'hecha'),
    );
  } catch {
    return [];
  }
}

/** Cuantos resultados siguen sin enviarse. */
export function cuantosResultadosSinEnviar(resultados: readonly Operacion[]): number {
  return resultados.filter(
    (operacion) => operacion.estado === 'pendiente' || operacion.estado === 'enviando',
  ).length;
}

/**
 * Lee la cuenta y el progreso por adelantado, para tenerlos cuando no haya conexion. Ver
 * `precarga.ts`.
 */
export function precargarElPanel(): Promise<unknown> {
  return leerElPanelConCopia();
}
