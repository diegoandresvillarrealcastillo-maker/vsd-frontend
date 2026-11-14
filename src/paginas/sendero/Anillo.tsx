/** El anillo alrededor del punto de hoy: se llena con lo hecho hoy. */
export function Anillo({ avance }: { avance: number }) {
  const radio = 46;
  const circunferencia = 2 * Math.PI * radio;

  return (
    <svg className="sendero__anillo" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <circle className="sendero__anillo-fondo" cx="50" cy="50" r={radio} />
      <circle
        className="sendero__anillo-avance"
        cx="50"
        cy="50"
        r={radio}
        strokeDasharray={circunferencia}
        strokeDashoffset={circunferencia * (1 - avance)}
      />
    </svg>
  );
}
