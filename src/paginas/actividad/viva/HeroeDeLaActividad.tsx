import type { Modulo } from '../../../infraestructura/api/cuenta.ts';
import { Icono } from '../../panel/Icono.tsx';
import { MODULOS } from '../../panel/modulos.ts';

import '../../../estilos/viva.css';

/**
 * La cabecera de una actividad (SCRUM-173): un bloque con el color del modulo, una insignia que
 * flota y el nombre de la actividad en grande. Dice de un vistazo donde esta la persona y que
 * va a hacer.
 *
 * Aqui vive el `<h1>` de la pantalla. El texto es blanco sobre el color pleno del modulo, que
 * llega a 4,5:1 como minimo.
 */
export function HeroeDeLaActividad({
  modulo,
  categoria,
  nombre,
  descripcion,
}: {
  modulo: Modulo | undefined;
  categoria: string;
  nombre: string;
  descripcion?: string;
}) {
  return (
    <section className="viva-heroe">
      <span className="viva-heroe__brillo" aria-hidden="true" />
      <span className="viva-heroe__insignia" aria-hidden="true">
        <Icono nombre={modulo === undefined ? 'sparkles' : MODULOS[modulo].icono} tamano={34} />
      </span>

      <div className="viva-heroe__texto">
        <p className="viva-heroe__categoria">{categoria}</p>
        <h1 className="viva-heroe__titulo">{nombre}</h1>
        {descripcion !== undefined && <p className="viva-heroe__descripcion">{descripcion}</p>}
      </div>
    </section>
  );
}
