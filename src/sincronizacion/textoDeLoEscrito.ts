import type { NodoDelDocumento } from '../infraestructura/api/diario.ts';
import type { Operacion } from './cola.ts';

/**
 * El texto de lo que alguien escribio en su diario, para poder **copiarlo antes de tirarlo**
 * (SCRUM-142).
 *
 * Una anotacion que la API rechazo se puede descartar, y descartarla borra lo escrito. El
 * panel de lo guardado no ensena nunca el contenido (puede quedar abierto frente a otra
 * persona), asi que lo que se ofrece es **copiarlo sin mostrarlo**.
 */

/** Los bloques que son una linea propia. Lo demas (listas, citas...) solo agrupa. */
const LINEA_PROPIA: ReadonlySet<string> = new Set(['paragraph', 'heading', 'codeBlock']);

function enUnaLinea(nodo: NodoDelDocumento): string {
  if (typeof nodo.text === 'string') {
    return nodo.text;
  }

  if (nodo.type === 'hardBreak') {
    return '\n';
  }

  return (nodo.content ?? []).map(enUnaLinea).join('');
}

function lineasDe(nodo: NodoDelDocumento): string[] {
  if (LINEA_PROPIA.has(nodo.type)) {
    return [enUnaLinea(nodo)];
  }

  if (typeof nodo.text === 'string') {
    return [nodo.text];
  }

  return (nodo.content ?? []).flatMap(lineasDe);
}

/** El texto plano de un documento: una linea por parrafo, sin las lineas vacias de los extremos. */
export function textoDeUnDocumento(documento: NodoDelDocumento): string {
  return lineasDe(documento)
    .join('\n')
    .replace(/^\n+|\n+$/gu, '');
}

function esObjeto(valor: unknown): valor is Readonly<Record<string, unknown>> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function esDocumento(valor: unknown): valor is NodoDelDocumento {
  return esObjeto(valor) && typeof valor.type === 'string';
}

export interface TextoDeLoEscrito {
  /** El titulo (si lo hay) y despues el texto. */
  readonly texto: string;
  /** Si la anotacion lleva diagramas: esos no se copian como texto. */
  readonly conDiagramas: boolean;
}

/**
 * Lo que alguien escribio en una anotacion del diario que sigue en la cola, o `null` si la
 * operacion no es de eso o no tiene nada escrito.
 */
export function textoDeLoEscrito(operacion: Operacion): TextoDeLoEscrito | null {
  if (operacion.tipo !== 'diario.escribir' && operacion.tipo !== 'diario.editar') {
    return null;
  }

  const { payload } = operacion;

  if (!esObjeto(payload)) {
    return null;
  }

  const titulo =
    typeof payload.titulo === 'string' && payload.titulo.trim() !== ''
      ? payload.titulo.trim()
      : null;
  const cuerpo = esDocumento(payload.contenido) ? textoDeUnDocumento(payload.contenido) : '';
  const texto = [titulo, cuerpo].filter((parte) => parte !== null && parte !== '').join('\n\n');

  if (texto === '') {
    return null;
  }

  return {
    texto,
    conDiagramas: Array.isArray(payload.adjuntos) && payload.adjuntos.length > 0,
  };
}
