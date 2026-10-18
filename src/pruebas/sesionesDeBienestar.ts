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

// ---------------------------------------------------------------------------
// cuestionario_corto sin puntaje (SCRUM-227)
// ---------------------------------------------------------------------------

/** Una practica del dia con tres respuestas que cuentan igual (BIE-03, BIE-04, BIE-05). */
export const TARJETA = {
  modo: 'tarjeta',
  indicacion: 'Una práctica pequeña para hoy.',
  titulo: 'Apagar las pantallas un rato antes de dormir',
  texto: 'Prueba dejar el teléfono lejos de la cama media hora antes de acostarte.',
  porQue: 'La luz de las pantallas puede hacer que cueste más dormirse.',
  opciones: [
    { clave: 'si', texto: 'Lo probé hoy' },
    { clave: 'luego', texto: 'Lo pruebo otro día' },
    { clave: 'no', texto: 'Hoy no quise' },
  ],
  nota: 'Cualquiera de las tres está bien.',
  cierre: 'Gracias por contarlo.',
};

/** Unos gestos que se marcan, los que se hicieron o se haran (BIE-07). */
export const GESTOS = {
  modo: 'lista',
  indicacion: 'Antes de dormir, marca los que hagas hoy.',
  items: [
    { clave: 'luz', texto: 'Bajar las luces' },
    { clave: 'agua', texto: 'Tomar un poco de agua' },
    { clave: 'respirar', texto: 'Respirar tres veces con calma' },
    { clave: 'pantalla', texto: 'Dejar el teléfono lejos' },
  ],
  nota: 'Marcar ninguno también cuenta.',
  cierre: 'Que descanses.',
};

/** Preguntas con una opcion, varias y una hora; con el aviso de la noche (BIE-08). */
export const PREGUNTAS = {
  modo: 'preguntas',
  indicacion: 'Tres preguntas cortas sobre mañana.',
  preguntas: [
    {
      clave: 'hora',
      texto: '¿A qué hora piensas dormir?',
      tipo: 'hora',
      pista: 'Una hora aproximada.',
    },
    {
      clave: 'como',
      texto: '¿Cómo quieres despertar?',
      tipo: 'opcion',
      opciones: [
        { clave: 'tranquilo', texto: 'Con calma' },
        { clave: 'activo', texto: 'Con energía' },
      ],
    },
    {
      clave: 'ayudas',
      texto: '¿Qué te ayudaría a descansar?',
      tipo: 'varias',
      opciones: [
        { clave: 'silencio', texto: 'Silencio' },
        { clave: 'oscuridad', texto: 'Oscuridad' },
        { clave: 'musica', texto: 'Música suave' },
      ],
    },
  ],
  enlaceAlAviso: true,
  nota: 'Nada de esto se interpreta.',
  cierre: 'Gracias por contarlo.',
};

/** Preguntas con una frase siempre a la vista y las lineas de atencion a mano (EMO-08). */
export const PREGUNTAS_CON_AYUDA = {
  modo: 'preguntas',
  indicacion: 'Dos preguntas sobre quién te acompaña.',
  preguntas: [
    {
      clave: 'quien',
      texto: '¿Con quién cuentas hoy?',
      tipo: 'varias',
      opciones: [
        { clave: 'familia', texto: 'Familia' },
        { clave: 'amistades', texto: 'Amistades' },
        { clave: 'nadie', texto: 'Hoy con nadie' },
      ],
    },
    {
      clave: 'ganas',
      texto: '¿Quieres hablar con alguien hoy?',
      tipo: 'opcion',
      opciones: [
        { clave: 'si', texto: 'Sí' },
        { clave: 'quiza', texto: 'Quizá' },
        { clave: 'no', texto: 'Hoy no' },
      ],
    },
  ],
  avisoSiempre: 'Si lo necesitas, hay personas que pueden acompañarte.',
  conLineasDeAyuda: true,
};

/** La rueda de emociones: tres niveles, con una puerta de entrada (EMO-01). */
export const RUEDA = {
  modo: 'rueda',
  indicacion: '¿Cuál se parece más a lo que sientes?',
  puerta: {
    titulo: 'Ponerle nombre',
    texto: 'No hay respuestas correctas. Elige lo que más se parezca, de lo amplio a lo fino.',
  },
  rueda: [
    {
      clave: 'alegria',
      nombre: 'Alegría',
      hijos: [
        {
          clave: 'serenidad',
          nombre: 'Serenidad',
          hijos: [
            {
              clave: 'calma',
              nombre: 'Calma',
              definicion: 'Calma: sentir que todo está en su lugar.',
            },
            {
              clave: 'alivio',
              nombre: 'Alivio',
              definicion: 'Alivio: sentir que algo pesado ya pasó.',
            },
          ],
        },
        {
          clave: 'entusiasmo',
          nombre: 'Entusiasmo',
          hijos: [
            { clave: 'ilusion', nombre: 'Ilusión', definicion: 'Ilusión: esperar algo con ganas.' },
            {
              clave: 'orgullo',
              nombre: 'Orgullo',
              definicion: 'Orgullo: sentir que algo salió bien.',
            },
          ],
        },
      ],
    },
    {
      clave: 'tristeza',
      nombre: 'Tristeza',
      hijos: [
        {
          clave: 'soledad',
          nombre: 'Soledad',
          hijos: [
            {
              clave: 'nostalgia',
              nombre: 'Nostalgia',
              definicion: 'Nostalgia: extrañar algo que fue.',
            },
            { clave: 'vacio', nombre: 'Vacío', definicion: 'Vacío: sentir que falta algo.' },
          ],
        },
        {
          clave: 'cansancio',
          nombre: 'Cansancio',
          hijos: [
            {
              clave: 'agotamiento',
              nombre: 'Agotamiento',
              definicion: 'Agotamiento: no tener fuerzas.',
            },
            { clave: 'desgano', nombre: 'Desgano', definicion: 'Desgano: no tener ganas de nada.' },
          ],
        },
      ],
    },
  ],
  linea: { invitacion: 'Si quieres, cuéntalo en una línea.', largoMaximo: 160 },
  cierre: 'Ponerle nombre ayuda a verlo. Gracias.',
};

// ---------------------------------------------------------------------------
// escritura_breve ampliada (SCRUM-227)
// ---------------------------------------------------------------------------

/** Dos campos con etiqueta, su propio boton de «hoy no» y su cierre (EMO-09). */
export const CIERRE_DEL_DIA = {
  invitacion: 'Dos líneas para cerrar el día.',
  campos: 2,
  minimo: 1,
  largoMaximo: 200,
  etiquetas: ['Lo que dejo', 'Lo que me llevo'],
  permiteNingunaHoy: true,
  textoNinguna: 'Hoy lo dejo todo para mañana',
  cierre: 'Día cerrado. Gracias por contarlo.',
};

/** La carta que se guarda en el diario (EMO-05). */
export const CARTA = {
  invitacion: 'Dile algo amable a quien despierta mañana.',
  campos: 1,
  minimo: 1,
  largoMaximo: 500,
  guardarParaManana: true,
  cierre: 'Quedó guardada en tu diario.',
};
