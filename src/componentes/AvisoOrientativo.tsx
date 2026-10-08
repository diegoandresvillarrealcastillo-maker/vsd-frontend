import '../estilos/avisos-clinicos.css';

/** La frase, escrita una sola vez: es la misma en todas las pantallas. */
export const TEXTO_DEL_AVISO_ORIENTATIVO =
  'Orientativo. No es un diagnóstico ni reemplaza a un profesional.';

/**
 * La linea que recuerda, donde se ve un resultado, que es orientativo
 * (L-03 de la auditoria 360).
 *
 * El aviso estaba en la portada, en el registro y en la descripcion del sitio, es
 * decir, **antes** de entrar. Dentro de la aplicacion, donde alguien lee un nivel
 * como «con margen para mejorar» o conversa con VSD IA, no habia ninguna linea que
 * dijera que no es un diagnostico. Esta es esa linea.
 *
 * ## Por que es fija y corta
 *
 * Una advertencia larga se aprende a saltar; una linea corta que siempre esta en
 * el mismo sitio, no. Tampoco lleva colores propios: toma el de lo que tiene
 * alrededor, para que se lea igual en el tema claro, en el oscuro y dentro de la
 * tarjeta del asistente, sin tener que cuidar un contraste por separado en cada
 * uno.
 */
export function AvisoOrientativo({ className }: { className?: string }) {
  return (
    <p className={className === undefined ? 'aviso-orientativo' : `aviso-orientativo ${className}`}>
      {TEXTO_DEL_AVISO_ORIENTATIVO}
    </p>
  );
}
