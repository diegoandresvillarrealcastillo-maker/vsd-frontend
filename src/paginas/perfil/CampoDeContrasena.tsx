import { useState, type ReactNode } from 'react';

import { OjoDeContrasena } from '../../componentes/OjoDeContrasena.tsx';

interface Props {
  id: string;
  etiqueta: string;
  /** Que contrasena revela el ojo, para el nombre accesible del boton. */
  objeto: string;
  valor: string;
  alCambiar: (valor: string) => void;
  /** El id de algo que describe al campo y vive fuera de el, como el medidor. */
  descritoPor?: string;
  /** Lo que va debajo del campo, por ejemplo el medidor de la contrasena. */
  children?: ReactNode;
}

/**
 * Un campo de contrasena nueva con el ojo que muestra lo escrito (SCRUM-181).
 *
 * Existe aparte de `Campo` a proposito: `Campo` y el estilo del ojo viven en la hoja
 * de acceso (`autenticacion.css`), con sus propios tokens, y Perfil no la carga. Aqui
 * el campo conserva la apariencia del resto de Perfil y reutiliza el mismo ojo
 * animado que ya usan acceso y registro.
 *
 * Cada campo guarda su propio estado: mostrar una contrasena no muestra la otra.
 * Nace oculta siempre, porque el estado vive en el componente y se pierde al cerrar
 * el formulario.
 *
 * Es de contrasena **nueva**: `new-password` evita que el navegador ofrezca la
 * actual, y apagar la correccion y la mayuscula inicial evita que, ya revelada, el
 * teclado del movil la "arregle" mientras se escribe.
 */
export function CampoDeContrasena({
  id,
  etiqueta,
  objeto,
  valor,
  alCambiar,
  descritoPor,
  children,
}: Props) {
  const [revelada, setRevelada] = useState(false);

  return (
    <div className="bienvenida__campo">
      <label htmlFor={id} className="bienvenida__etiqueta">
        {etiqueta}
      </label>
      <div className="bienvenida__caja">
        <input
          id={id}
          type={revelada ? 'text' : 'password'}
          className="bienvenida__entrada bienvenida__entrada--conOjo"
          value={valor}
          onChange={(evento) => alCambiar(evento.target.value)}
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby={descritoPor}
        />
        <OjoDeContrasena
          visible={revelada}
          objeto={objeto}
          onClick={() => setRevelada((antes) => !antes)}
        />
      </div>
      {children}
    </div>
  );
}
