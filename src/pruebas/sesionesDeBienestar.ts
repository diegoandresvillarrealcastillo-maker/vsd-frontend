/**
 * Sesiones de prueba de la guia de pasos (SCRUM-226): el motor `guia_paso_a_paso` en su modo `pasos`, con la forma
 * que manda el servidor y que valida el contrato del dominio (ADR 0030).
 */

/** Estiramiento (BIE-02): pasos manuales, con figura, advertencia, intro, cierre y aviso de siempre. */
export const ESTIRAMIENTO = {
  modo: 'pasos',
  advertenciaInicial: 'Hazlo sin dolor: si algo duele, para.',
  intro: 'Tres movimientos suaves, uno tras otro, desde una silla.',
  avance: 'manual',
  pasos: [
    {
      titulo: 'Cuello: la oreja al hombro derecho',
      texto: 'Deja caer la oreja derecha hacia el hombro derecho, sin forzar.',
      pictograma: 'cuello:inclinar-der',
    },
    {
      titulo: 'Cuello: la oreja al hombro izquierdo',
      texto: 'Ahora la oreja izquierda hacia el hombro izquierdo, sin forzar.',
      pictograma: 'cuello:inclinar-izq',
    },
    { texto: 'Suelta los hombros y respira normal.', pictograma: 'cuello:soltar' },
  ],
  cierre: 'Eso es todo. Tu cuerpo lo nota.',
  avisoSiempre: 'Si algo duele, para.',
};

/** Ancla 5-4-3-2-1 (EMO-03): sin tiempo, con las lineas de atencion a mano. */
export const ANCLA = {
  modo: 'pasos',
  advertenciaInicial: 'No hace falta cerrar los ojos. Puedes parar cuando quieras.',
  intro: 'Un ejercicio de cinco pasos para volver al presente. No hay tiempo.',
  avance: 'manual',
  pasos: [
    { titulo: 'Cinco cosas que ves', texto: 'Mira a tu alrededor y nombra cinco cosas que ves.' },
    { titulo: 'Cuatro que sientes', texto: 'Nota cuatro cosas que sientes con el tacto.' },
    { titulo: 'Tres que oyes', texto: 'Escucha tres sonidos, cercanos o lejanos.' },
  ],
  cierre: 'Aquí estás. Eso es suficiente.',
  avisoSiempre: 'Si lo necesitas, hay personas que pueden acompañarte.',
  conLineasDeAyuda: true,
};

/** Un respiro (BIE-09): se elige entre varios, nada impuesto. */
export const RESPIRO = {
  modo: 'pasos',
  intro: 'Una pausa de uno o dos minutos. Elige la que te venga mejor.',
  avance: 'manual',
  elecciones: [
    {
      clave: 'lejos',
      nombre: 'Mirar lejos',
      descripcion: 'Descansar la vista mirando hacia lo lejano.',
      pictograma: 'montana',
      pasos: [
        { titulo: 'Mira lejos', texto: 'Busca algo lejano por la ventana y míralo con calma.' },
        { titulo: 'Vuelve', texto: 'Cuando quieras, vuelve a lo que tenías cerca.' },
      ],
    },
    {
      clave: 'ventana',
      nombre: 'Mirar por la ventana',
      pasos: [
        { texto: 'Sigue con la mirada algo que se mueva.' },
        { texto: 'Nota cómo está el cielo hoy.' },
        { texto: 'Respira una vez, sin prisa.' },
      ],
    },
  ],
  cierre: 'Listo. Un respiro es un respiro.',
  avisoSiempre: 'Puedes parar cuando quieras.',
};

/** Avance automatico: cada paso dura sus segundos. */
export const AUTOMATICA = {
  modo: 'pasos',
  avance: 'auto',
  pasos: [
    { titulo: 'Primero', texto: 'Suelta la mandíbula.', segundos: 10 },
    { titulo: 'Segundo', texto: 'Suelta los hombros.', segundos: 20 },
    { titulo: 'Tercero', texto: 'Suelta las manos.', segundos: 5 },
  ],
};
