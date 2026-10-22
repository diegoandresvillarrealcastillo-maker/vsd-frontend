import '../estilos/racha-panel.css';

/**
 * La barra de progreso hacia el proximo hito (SCRUM-243).
 *
 * Parte del ultimo hito logrado y llega al siguiente: a los 12 dias, entre el hito de 7 y el de 14,
 * va por el 71 %. Se llena con `transform`, no con `width`, para que se anime sin recalcular la
 * pagina; con `prefers-reduced-motion` aparece ya llena.
 *
 * No pinta nada si el servidor no dijo el proximo hito (0) o si no esta por delante del anterior:
 * seria un dato roto, y una barra a medias no le sirve a nadie.
 */
export function BarraDeProgresoDeLaRacha({
  dias,
  hitoAnterior,
  proximoHito,
}: {
  dias: number;
  hitoAnterior: number;
  proximoHito: number;
}) {
  if (proximoHito <= 0 || proximoHito <= hitoAnterior) {
    return null;
  }

  const actual = Math.min(Math.max(dias, hitoAnterior), proximoHito);
  const avance = (actual - hitoAnterior) / (proximoHito - hitoAnterior);
  const faltan = proximoHito - actual;

  return (
    <div className="racha-progreso">
      <div className="racha-progreso__texto">
        <span>{`${String(dias)} de ${String(proximoHito)} días`}</span>
        <span className="racha-progreso__faltan">
          {faltan === 1 ? 'Falta 1 día' : `Faltan ${String(faltan)} días`}
        </span>
      </div>

      <div
        className="racha-progreso__carril"
        role="progressbar"
        aria-label="Progreso hacia tu próximo hito"
        aria-valuemin={hitoAnterior}
        aria-valuemax={proximoHito}
        aria-valuenow={actual}
        aria-valuetext={`${String(dias)} de ${String(proximoHito)} días`}
      >
        <span
          className="racha-progreso__relleno"
          style={{ transform: `scaleX(${String(avance)})` }}
        />
      </div>
    </div>
  );
}
