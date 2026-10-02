import { motion, useReducedMotion } from 'framer-motion';

import { REACCION_SUAVE } from '../estilos/movimiento.ts';

interface Props {
  onClick: () => void;
  disabled?: boolean;
  children?: string;
}

/**
 * Entrar con la cuenta de Google.
 *
 * Para quien tiene correo institucional es el camino mas corto: un boton en
 * lugar de recordar otra contrasena.
 *
 * Reacciona menos que el boton principal, y es a proposito. Dos controles que
 * responden igual de fuerte compiten por la atencion; la jerarquia tambien se
 * construye con el movimiento, no solo con el color.
 *
 * No lleva `type="submit"`: dentro de un formulario, un boton sin tipo lo
 * envia, y aqui lo que hace es marcharse a Google.
 */
export function BotonDeGoogle({ onClick, disabled, children = 'Continuar con Google' }: Props) {
  const sinMovimiento = useReducedMotion();
  const reaccion = sinMovimiento || disabled ? {} : REACCION_SUAVE;

  return (
    <motion.button
      type="button"
      className="google"
      onClick={onClick}
      disabled={disabled}
      {...reaccion}
    >
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
        />
        <path
          fill="#34A853"
          d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
        />
        <path
          fill="#FBBC05"
          d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
        />
        <path
          fill="#EA4335"
          d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
        />
      </svg>
      {children}
    </motion.button>
  );
}
