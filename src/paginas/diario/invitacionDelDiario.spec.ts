import { describe, expect, it } from 'vitest';

import contratoJson from '../../asistente/contrato/reglas-locales.json';
import { responderSinConexion } from '../../asistente/reglasLocales.ts';
import type { ReglasLocales } from '../../infraestructura/api/reglasLocales.ts';
import { INVITACION_DEL_DIARIO } from './invitacionDelDiario.ts';

const REGLAS = (contratoJson as unknown as { paquete: ReglasLocales }).paquete;

describe('la invitacion del diario (SCRUM-194)', () => {
  it('la pregunta lleva a «dónde busco ayuda», tambien sin conexion', () => {
    expect(
      responderSinConexion(REGLAS, {
        texto: INVITACION_DEL_DIARIO.pregunta,
        zona: 'America/Bogota',
      }),
    ).toMatchObject({ tipo: 'ayuda', intencion: 'donde_busco_ayuda' });
  });

  it('el texto no lleva ningun telefono ni nombra lo escrito', () => {
    expect(INVITACION_DEL_DIARIO.texto).not.toMatch(/\d{3}/u);
    expect(INVITACION_DEL_DIARIO.texto).not.toMatch(/suicid|morir|diagn/iu);
  });

  it('se puede dejar para otro momento, sin culpa', () => {
    expect(INVITACION_DEL_DIARIO.rechazar).toBe('Ahora no');
  });
});
