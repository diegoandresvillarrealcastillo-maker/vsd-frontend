import type { SesionDeLaActividad } from '../infraestructura/api/progreso.ts';

/**
 * Sesiones de prueba para los motores de Cognicion del catalogo (SCRUM-225): una por motor y modo, con la forma
 * que manda el servidor en `sesion.parametros` y que valida el contrato del dominio (ADR 0030).
 *
 * Son pequenas a proposito (las reales traen mas rondas) pero respetan los mismos limites que lee
 * `parametrosDeLaCognicion.ts`, de modo que una prueba que las rompa a mano sabe que rompe una regla.
 */

export function sesionDeCognicion(
  parametros: Record<string, unknown>,
  titulo = 'Una sesión',
): SesionDeLaActividad {
  return { id: 's-1', titulo, nivel: 1, parametros };
}

// tocar_el_objetivo · flujo (COG-05)

export const FLUJO = {
  modo: 'flujo',
  objetivos: [{ clave: 'sol', nombre: 'el sol', pictograma: 'sol' }],
  otros: [
    { clave: 'luna', nombre: 'la luna', pictograma: 'luna' },
    { clave: 'nube', nombre: 'la nube', pictograma: 'nube' },
  ],
  // Doce estimulos y tres veces el objetivo.
  secuencia: [
    'luna',
    'sol',
    'nube',
    'luna',
    'sol',
    'nube',
    'luna',
    'nube',
    'sol',
    'luna',
    'nube',
    'luna',
  ],
  msPorEstimulo: 1000,
  puntosMaximos: 3,
};

// tocar_el_objetivo · puntos (COG-08)

export const PUNTOS = {
  modo: 'puntos',
  indicacion: 'Toca los puntos en orden, del 1 al 5.',
  puntos: [
    { etiqueta: '1', x: 50, y: 50 },
    { etiqueta: '2', x: 80, y: 20 },
    { etiqueta: '3', x: 80, y: 80 },
    { etiqueta: '4', x: 20, y: 20 },
    { etiqueta: '5', x: 20, y: 80 },
  ],
  puntosMaximos: 5,
};

// ver_ocultar_recordar · lista (COG-06)

export const LISTA = {
  modo: 'lista',
  contexto: 'En el mercado',
  segundosVista: 10,
  elementos: [
    { clave: 'papa', nombre: 'papa' },
    { clave: 'tomate', nombre: 'tomate' },
    { clave: 'arroz', nombre: 'arroz' },
    { clave: 'huevos', nombre: 'huevos' },
  ],
  distractores: [
    { clave: 'pan', nombre: 'pan' },
    { clave: 'leche', nombre: 'leche' },
    { clave: 'cebolla', nombre: 'cebolla' },
    { clave: 'aguacate', nombre: 'aguacate' },
  ],
  puntosMaximos: 4,
};

// ver_ocultar_recordar · escena (COG-09)

export const ESCENA = {
  modo: 'escena',
  segundosVista: 8,
  filas: 2,
  columnas: 2,
  celdas: [
    { fila: 1, columna: 1, pictograma: 'ola', nombre: 'ola' },
    { fila: 1, columna: 2, pictograma: 'silla', nombre: 'silla' },
    { fila: 2, columna: 1, pictograma: 'sol', nombre: 'sol' },
    { fila: 2, columna: 2, pictograma: 'rayo', nombre: 'rayo' },
  ],
  preguntas: [
    {
      texto: '¿Qué había arriba a la izquierda?',
      fila: 1,
      columna: 1,
      opciones: [
        { pictograma: 'sol', nombre: 'sol' },
        { pictograma: 'ola', nombre: 'ola' },
        { pictograma: 'hoja', nombre: 'hoja' },
      ],
      correcta: 1,
    },
    {
      texto: '¿Qué había arriba a la derecha?',
      fila: 1,
      columna: 2,
      opciones: [
        { pictograma: 'silla', nombre: 'silla' },
        { pictograma: 'luna', nombre: 'luna' },
        { pictograma: 'nube', nombre: 'nube' },
      ],
      correcta: 0,
    },
    {
      texto: '¿Qué había abajo a la derecha?',
      fila: 2,
      columna: 2,
      opciones: [
        { pictograma: 'hoja', nombre: 'hoja' },
        { pictograma: 'rayo', nombre: 'rayo' },
        { pictograma: 'gota', nombre: 'gota' },
      ],
      correcta: 1,
    },
  ],
  puntosMaximos: 3,
};

// clasificar · intruso (COG-02)

export const INTRUSO = {
  modo: 'intruso',
  rondas: [
    {
      palabras: ['mesa', 'caballo', 'gato', 'perro'],
      intruso: 0,
      razon: 'Las otras son animales.',
    },
    { palabras: ['rojo', 'azul', 'silla', 'verde'], intruso: 2, razon: 'Las otras son colores.' },
    {
      palabras: ['pera', 'manzana', 'uva', 'martillo'],
      intruso: 3,
      razon: 'Las otras son frutas.',
    },
  ],
  puntosMaximos: 3,
};

// clasificar · cestas con cesta correcta (COG-03)

export const CESTAS = {
  modo: 'cestas',
  indicacion: 'Lleva cada tarjeta a su cesta.',
  cestas: [
    { clave: 'frutas', nombre: 'Frutas' },
    { clave: 'verduras', nombre: 'Verduras' },
  ],
  elementos: [
    { clave: 'pera', nombre: 'pera', cesta: 'frutas' },
    { clave: 'espinaca', nombre: 'espinaca', cesta: 'verduras' },
    { clave: 'tomate', nombre: 'tomate', cesta: ['frutas', 'verduras'] },
    { clave: 'uva', nombre: 'uva', cesta: 'frutas' },
  ],
  puntosMaximos: 4,
};

// clasificar · cestas de reflexion, sin cesta correcta (EMO-04)

export const CESTAS_DE_REFLEXION = {
  modo: 'cestas',
  indicacion: 'Separa lo que puedes cambiar de lo que no.',
  cestas: [
    { clave: 'controlo', nombre: 'Lo controlo' },
    { clave: 'no-controlo', nombre: 'No lo controlo' },
  ],
  elementos: [
    { clave: 'a', nombre: 'Cómo respondo' },
    { clave: 'b', nombre: 'Lo que piensen otros' },
    { clave: 'c', nombre: 'Cuándo descanso' },
    { clave: 'd', nombre: 'El clima de mañana' },
  ],
  linea: { invitacion: '¿Qué harías con lo que sí controlas?', largoMaximo: 200 },
  cierre: 'Separarlo ya ordena un poco. Gracias.',
};

// palabras · completar (COG-07)

export const COMPLETAR = {
  modo: 'completar',
  palabras: [
    { pista: 'Una fruta', palabra: 'manzana', faltan: [3] },
    { pista: 'Un árbol', palabra: 'árbol', faltan: [0] },
    { pista: 'Un animal con cuernos', palabra: 'toro', faltan: [1, 2] },
  ],
  puntosMaximos: 3,
};

// palabras · anagrama (COG-07)

export const ANAGRAMA = {
  modo: 'anagrama',
  palabras: [
    { pista: 'Un animal', palabra: 'gato', revuelta: 'tago' },
    { pista: 'Algo para leer', palabra: 'libro', revuelta: 'bilro' },
    { pista: 'Un campo con ñ', palabra: 'año', revuelta: 'ñoa' },
  ],
  puntosMaximos: 3,
};

// calculo (COG-04)

export const CALCULO = {
  rondas: [
    { enunciado: '12 + 7', opciones: ['17', '19', '21'], correcta: 1 },
    { enunciado: '20 - 8', opciones: ['12', '10', '14'], correcta: 0 },
    { enunciado: '3 x 4', opciones: ['7', '14', '12'], correcta: 2 },
  ],
  puntosMaximos: 3,
};
