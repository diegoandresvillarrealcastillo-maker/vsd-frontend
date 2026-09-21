import { useId, type InputHTMLAttributes } from 'react';

type Props = {
  etiqueta: string;
  /** Mensaje bajo el campo. Cuando existe, el campo se marca como invalido. */
  error?: string | undefined;
  /** Texto de apoyo permanente, por ejemplo el minimo de caracteres. */
  ayuda?: string | undefined;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'>;

/**
 * Un campo con su etiqueta, su ayuda y su error.
 *
 * Existe para que esas tres cosas no se puedan separar por descuido. Un input
 * sin etiqueta asociada deja a quien usa lector de pantalla sin saber que se le
 * pide, y es el error de accesibilidad mas facil de cometer.
 *
 * El error se anuncia con `aria-live`: quien no ve la pantalla se entera de que
 * algo fallo sin tener que ir a buscarlo campo por campo.
 */
export function Campo({ etiqueta, error, ayuda, ...resto }: Props) {
  const id = useId();
  const idError = `${id}-error`;
  const idAyuda = `${id}-ayuda`;

  const describenAlCampo = [ayuda ? idAyuda : null, error ? idError : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="campo">
      <label className="campo__etiqueta" htmlFor={id}>
        {etiqueta}
      </label>

      <input
        {...resto}
        id={id}
        className={`campo__entrada${error ? ' campo__entrada--conError' : ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describenAlCampo === '' ? undefined : describenAlCampo}
      />

      {ayuda !== undefined && (
        <span className="campo__ayuda" id={idAyuda}>
          {ayuda}
        </span>
      )}

      {error !== undefined && (
        <span className="campo__error" id={idError} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
