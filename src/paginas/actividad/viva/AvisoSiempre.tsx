import { useId, useState } from 'react';

import '../../../estilos/avisoSiempre.css';
import { useReglasLocales } from '../../../asistente/useReglasLocales.ts';
import { lineasDeLaZona } from '../../../asistente/reglasLocales.ts';
import { zonaActual } from '../../../tiempo/zonaHoraria.ts';
import { LineasDeAtencion } from '../LineasDeAtencion.tsx';

/**
 * El acceso a las lineas de atencion, siempre a mano durante la actividad. Las reglas locales se leen al
 * montarse (con conexion o de la copia), de modo que al abrirlas ya estan: quien las busca en un mal momento
 * no espera. Sin reglas todavia, `LineasDeAtencion` usa su respaldo: nunca se queda sin un telefono, y nunca
 * ensena las de otro pais.
 */
function AccesoALasLineas() {
  const reglas = useReglasLocales();
  const [abiertas, setAbiertas] = useState(false);
  const idDelPanel = useId();

  return (
    <div className="aviso-siempre__lineas">
      <button
        type="button"
        className="aviso-siempre__boton"
        aria-expanded={abiertas}
        aria-controls={idDelPanel}
        onClick={() => {
          setAbiertas((antes) => !antes);
        }}
      >
        {abiertas ? 'Ocultar las líneas de atención' : 'Líneas de atención'}
      </button>

      <div id={idDelPanel} hidden={!abiertas}>
        {abiertas && (
          <LineasDeAtencion
            lineas={reglas === null ? undefined : lineasDeLaZona(reglas, zonaActual())}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Una frase que queda a la vista durante **toda** la actividad («puedes parar cuando quieras», «si lo necesitas,
 * hay personas que pueden acompanarte»), y, si la sesion lo pide, el acceso a las lineas de atencion al lado.
 * Se ofrecen, no se imponen.
 */
export function AvisoSiempre({
  texto,
  conLineasDeAyuda = false,
}: {
  texto: string;
  conLineasDeAyuda?: boolean;
}) {
  return (
    <div className="aviso-siempre" role="note">
      <p className="aviso-siempre__texto">{texto}</p>
      {conLineasDeAyuda && <AccesoALasLineas />}
    </div>
  );
}
