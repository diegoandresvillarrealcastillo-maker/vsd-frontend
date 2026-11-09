import '../../../estilos/figuras.css';

export type ZonaCorporal = 'pies' | 'piernas' | 'abdomen' | 'pecho' | 'brazos' | 'cabeza';

/** Esquema visual de la zona que acompaña el escaneo corporal. Es decorativo: el paso conserva su texto. */
export function FiguraDeZonaCorporal({
  zona,
  tamano = 168,
}: {
  zona: ZonaCorporal;
  tamano?: number;
}) {
  return (
    <svg
      className="figura figura-zona-corporal"
      width={tamano}
      height={tamano}
      viewBox="0 0 120 180"
      aria-hidden="true"
      focusable="false"
      data-zona={zona}
    >
      <circle className="figura-zona-corporal__parte" data-parte="cabeza" cx="60" cy="23" r="14" />
      <path
        className="figura-zona-corporal__parte"
        data-parte="pecho"
        d="M45 43 Q60 36 75 43 L78 70 Q60 77 42 70 Z"
      />
      <path
        className="figura-zona-corporal__parte"
        data-parte="abdomen"
        d="M42 70 Q60 77 78 70 L75 94 Q60 101 45 94 Z"
      />
      <path
        className="figura-zona-corporal__parte"
        data-parte="brazos"
        d="M44 45 Q39 42 36 48 L27 81 Q26 86 31 88 Q35 89 37 84 L48 60 Z M76 45 Q81 42 84 48 L93 81 Q94 86 89 88 Q85 89 83 84 L72 60 Z"
      />
      <path
        className="figura-zona-corporal__parte"
        data-parte="piernas"
        d="M46 94 Q60 100 74 94 L71 139 Q69 145 64 143 L60 108 L56 143 Q51 145 49 139 Z"
      />
      <path
        className="figura-zona-corporal__parte"
        data-parte="pies"
        d="M50 138 Q56 139 58 143 L58 151 Q57 155 50 155 L39 154 Q36 152 40 149 Z M62 143 Q64 139 70 138 L80 149 Q84 152 81 154 L70 155 Q63 155 62 151 Z"
      />
      <path className="figura-zona-corporal__eje" d="M60 39 V45 M60 96 V102" />
    </svg>
  );
}
