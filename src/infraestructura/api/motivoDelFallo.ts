/** Por que fallo la ultima comprobacion; `null` si salio bien o todavia no hubo ninguna. */
let motivo: string | null = null;

/**
 * Por que fallo la ultima comprobacion de conexion con la API, en una frase tecnica sin datos de la
 * persona (SCRUM-244).
 *
 * Dice desde que direccion se pregunto y a cual, porque la API solo contesta con permiso de lectura al
 * origen exacto de la PWA (`CORS_ORIGIN`): la misma comprobacion que sale bien desde la direccion de PRE
 * falla desde `localhost` o desde un enlace de vista previa, y sin esto las dos se ven igual.
 *
 * Vive aparte de `conexion.ts` para que quien lo lee (el ciclo de sincronizacion) no dependa de ese
 * archivo, que muchas pruebas reemplazan entero.
 */
export function motivoDelUltimoFallo(): string | null {
  return motivo;
}

export function recordarElMotivo(nuevo: string | null): void {
  motivo = nuevo;
}
