import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * Revisa las dependencias de produccion en busca de vulnerabilidades graves
 * (SCRUM-155).
 *
 *   node scripts/revisar-dependencias.mjs
 *
 * Corre `npm audit --omit=dev` y falla si queda algun aviso `high` o
 * `critical` que no este en `vulnerabilidades-aceptadas.json`.
 *
 * ## Por que no solo `npm audit --audit-level=high`
 *
 * Hay avisos que no se pueden resolver todavia: dependen de una herramienta
 * (la CLI de Prisma) cuya correccion que ofrece npm es bajar una version mayor.
 * Con `--audit-level` solo hay dos caminos, y los dos son malos: dejar el CI en
 * rojo para siempre, hasta que nadie lo mire, o quitar la comprobacion.
 *
 * Aqui un aviso se **acepta por escrito**: con su identificador, el motivo y
 * una fecha en que deja de valer. Pasada la fecha el CI vuelve a fallar y
 * alguien tiene que volver a decidir. Un riesgo aceptado sin fecha es un riesgo
 * olvidado.
 *
 * Se mira por **aviso** (GHSA) y no por paquete: aceptar `mysql2` entero
 * taparia tambien el aviso que salga la semana siguiente.
 *
 * Sin dependencias: lo que vigila la cadena de suministro no deberia traer la
 * suya.
 */

const GRAVES = new Set(['high', 'critical']);
const ID_DE_AVISO = /^GHSA(-[a-z0-9]{4}){3}$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** El identificador publico de un aviso: lo ultimo de su URL, `GHSA-xxxx-xxxx-xxxx`. */
export function idDelAviso(aviso) {
  const url = typeof aviso.url === 'string' ? aviso.url : '';

  return url.split('/').filter(Boolean).at(-1) ?? String(aviso.source);
}

/**
 * Los avisos graves del informe de `npm audit --json`, sin repetir.
 *
 * Cada paquete afectado enumera en `via` lo que lo afecta: o bien el aviso
 * mismo (un objeto) o bien otro paquete (un texto) que arrastra el aviso. Solo
 * los objetos son avisos; los textos se ignoran para no contar lo mismo dos
 * veces.
 */
export function avisosGraves(informe) {
  const encontrados = new Map();

  for (const vulnerabilidad of Object.values(informe.vulnerabilities ?? {})) {
    for (const via of vulnerabilidad.via ?? []) {
      if (typeof via === 'string' || !GRAVES.has(via.severity)) {
        continue;
      }

      const id = idDelAviso(via);

      encontrados.set(id, {
        id,
        paquete: via.name,
        severidad: via.severity,
        titulo: via.title,
      });
    }
  }

  return [...encontrados.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Lee `vulnerabilidades-aceptadas.json` y comprueba que cada entrada diga lo
 * que tiene que decir. Lanza con un mensaje que nombra la entrada.
 */
export function leerLasAceptadas(texto) {
  let contenido;

  try {
    contenido = JSON.parse(texto);
  } catch {
    throw new Error('vulnerabilidades-aceptadas.json no es un JSON valido.');
  }

  if (!Array.isArray(contenido.aceptadas)) {
    throw new Error('vulnerabilidades-aceptadas.json necesita una lista "aceptadas".');
  }

  contenido.aceptadas.forEach((entrada, posicion) => {
    const donde = `aceptadas[${posicion}]`;

    if (typeof entrada.id !== 'string' || !ID_DE_AVISO.test(entrada.id)) {
      throw new Error(`${donde}: "id" tiene que ser un identificador GHSA-xxxx-xxxx-xxxx.`);
    }

    if (typeof entrada.motivo !== 'string' || entrada.motivo.trim().length < 20) {
      throw new Error(`${donde} (${entrada.id}): "motivo" tiene que explicar por que se acepta.`);
    }

    if (
      typeof entrada.vence !== 'string' ||
      !FECHA.test(entrada.vence) ||
      Number.isNaN(Date.parse(`${entrada.vence}T00:00:00Z`))
    ) {
      throw new Error(`${donde} (${entrada.id}): "vence" tiene que ser una fecha AAAA-MM-DD.`);
    }
  });

  return contenido.aceptadas;
}

/**
 * Cruza los avisos graves con los aceptados.
 *
 * `hoy` es un `AAAA-MM-DD`. Una aceptacion vale **hasta** su fecha, inclusive.
 */
export function evaluar(informe, aceptadas, hoy) {
  const graves = avisosGraves(informe);
  const sinResolver = [];
  const vencidas = [];
  const vigentes = [];

  for (const aviso of graves) {
    const aceptada = aceptadas.find((una) => una.id === aviso.id);

    if (aceptada === undefined) {
      sinResolver.push(aviso);
    } else if (aceptada.vence < hoy) {
      vencidas.push({ ...aviso, vence: aceptada.vence });
    } else {
      vigentes.push({ ...aviso, vence: aceptada.vence, motivo: aceptada.motivo });
    }
  }

  // Aceptados que el informe ya no trae: se corrigieron o dejaron de aplicar.
  // No hace fallar, pero se dice, para que la lista no se llene de basura.
  const sobrantes = aceptadas.filter((una) => !graves.some((aviso) => aviso.id === una.id));

  return {
    ok: sinResolver.length === 0 && vencidas.length === 0,
    sinResolver,
    vencidas,
    vigentes,
    sobrantes,
  };
}

/** El texto del resultado, para el registro del CI. */
export function describir(resultado) {
  const lineas = [];

  for (const aviso of resultado.sinResolver) {
    lineas.push(
      `::error::${aviso.id} (${aviso.severidad}) en ${aviso.paquete}: ${aviso.titulo}. ` +
        'Actualiza la dependencia o, si no se puede, aceptalo en vulnerabilidades-aceptadas.json.',
    );
  }

  for (const aviso of resultado.vencidas) {
    lineas.push(
      `::error::La aceptacion de ${aviso.id} (${aviso.paquete}) vencio el ${aviso.vence}. ` +
        'Vuelve a decidir: actualiza la dependencia o renueva la fecha con un motivo nuevo.',
    );
  }

  for (const aviso of resultado.vigentes) {
    lineas.push(`Aceptado hasta ${aviso.vence}: ${aviso.id} en ${aviso.paquete}.`);
  }

  for (const una of resultado.sobrantes) {
    lineas.push(
      `::warning::${una.id} esta en vulnerabilidades-aceptadas.json pero ya no aparece: quitalo.`,
    );
  }

  if (resultado.ok) {
    lineas.push('Sin avisos graves sin resolver en las dependencias de produccion.');
  }

  return lineas.join('\n');
}

/** Pregunta a npm y devuelve el informe. Lanza si npm no pudo responder. */
function pedirElInforme() {
  // Como una sola orden y con shell, no como lista de argumentos: en Windows
  // `npm` es un .cmd y sin shell no se encuentra, y Node avisa de que pasar una
  // lista de argumentos con shell no los escapa. Aqui no hay nada variable.
  const respuesta = spawnSync('npm audit --omit=dev --json', {
    encoding: 'utf8',
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  });

  let informe;

  try {
    informe = JSON.parse(respuesta.stdout);
  } catch {
    throw new Error(`npm audit no devolvio un informe.\n${respuesta.stderr}`);
  }

  // Sin red o con el registro caido, npm responde con `error` en lugar de un
  // informe. Pasar en silencio seria creer que no hay vulnerabilidades cuando
  // en realidad no se pudo mirar.
  if (informe.error !== undefined) {
    throw new Error(`npm audit no pudo revisar: ${informe.error.summary ?? informe.error.code}`);
  }

  return informe;
}

function principal() {
  const aceptadas = leerLasAceptadas(readFileSync('vulnerabilidades-aceptadas.json', 'utf8'));
  const hoy = new Date().toISOString().slice(0, 10);
  const resultado = evaluar(pedirElInforme(), aceptadas, hoy);

  console.log(describir(resultado));
  process.exitCode = resultado.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    principal();
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}
