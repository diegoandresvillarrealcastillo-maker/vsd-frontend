import type { ReactElement } from 'react';

/**
 * Los dibujos de la biblioteca de pictogramas del catalogo (SCRUM-225): 60 figuras sencillas en una
 * cuadricula de 24 x 24, dibujadas en codigo y no como imagenes sueltas. Pesan casi nada, toman su color de
 * `currentColor` y cambian solas con el tema.
 *
 * Son adorno para quien ve (R10): lo que distingue una figura de otra para un lector de pantalla es su
 * **nombre escrito**, que viaja en cada sesion. Por eso aqui basta con que se reconozcan a simple vista.
 *
 * Reglas de dibujo, para que se vean como una familia:
 *
 * - Lo macizo va relleno; los detalles finos (tallos, rayos, lineas) van con `fill="none"` y trazo.
 * - Los huecos (un ojo, una ventana, las semillas) se dibujan con la clase `pict-hueco`, que toma el color del
 *   fondo: asi se leen igual sobre claro y oscuro.
 *
 * La lista de claves tiene que coincidir con la del backend (`src/pruebas/catalogo/pictogramas.ts`); la prueba de
 * `pictogramasDelCatalogo.json` comprueba que cada una tiene su dibujo.
 */

const sin = { fill: 'none' } as const;

export const DIBUJOS: Readonly<Record<string, ReactElement>> = {
  // ---------------------------------------------------------------- formas
  circulo: <circle cx="12" cy="12" r="9" />,
  cuadrado: <rect x="4" y="4" width="16" height="16" rx="2.5" />,
  triangulo: <polygon points="12,3.5 21.5,20 2.5,20" />,
  rombo: <polygon points="12,2.5 21.5,12 12,21.5 2.5,12" />,
  estrella: (
    <polygon points="12,2.5 14.9,8.7 21.7,9.4 16.6,14 18.1,20.8 12,17.3 5.9,20.8 7.4,14 2.3,9.4 9.1,8.7" />
  ),
  hoja: (
    <path d="M20 4C11 4 5 8.5 5 15c0 1.9.6 3.6 1.6 5C8 14.8 12 11.4 17 9.5c-4.2 3.3-7 6.6-8.4 10.5C15.9 20 20 14.3 20 4z" />
  ),
  gota: (
    <path d="M12 2.5c3 4.2 6.5 7.6 6.5 11.5a6.5 6.5 0 1 1-13 0C5.500 10.100 9 6.700 12 2.500z" />
  ),
  luna: <path d="M20 14.6A8.6 8.6 0 0 1 9.4 4a8.6 8.6 0 1 0 10.600 10.600z" />,
  nube: (
    <path d="M7 18.5a4.5 4.5 0 0 1-.7-8.95A6 6 0 0 1 17.900 9.600 4.500 4.500 0 0 1 17.500 18.500H7z" />
  ),

  // ---------------------------------------------------------------- frutas
  manzana: (
    <>
      <path d="M12 8.200c-1.600-1.300-3.600-1.700-5.200-.8C5 8.400 4.300 10.700 5 13.500c.8 3.300 3 6.500 5 6.500.9 0 1.300-.4 2-.4s1.100.4 2 .4c2 0 4.200-3.200 5-6.500.7-2.800 0-5.100-1.800-6.100-1.600-.9-3.600-.5-5.200.8z" />
      <path d="M12 8c0-2 1-3.600 2.600-4.600" {...sin} />
      <path d="M14.500 4.200c1.400-.8 3-.5 3.800.2-1 1.200-2.800 1.500-3.800-.2z" />
    </>
  ),
  pera: (
    <>
      <path d="M12 5c-1.500 0-2 1.200-2.200 2.500C8 9 6 10.500 6 14c0 4 2.700 6 6 6s6-2 6-6c0-3.500-2-5-3.800-6.500C14 6.200 13.500 5 12 5z" />
      <path d="M12 5c0-1.300.4-2.200 1.400-2.800" {...sin} />
    </>
  ),
  uva: (
    <>
      <circle cx="8" cy="10" r="2.700" />
      <circle cx="12" cy="10" r="2.700" />
      <circle cx="16" cy="10" r="2.700" />
      <circle cx="10" cy="14.200" r="2.700" />
      <circle cx="14" cy="14.200" r="2.700" />
      <circle cx="12" cy="18.400" r="2.700" />
      <path d="M12 7.200V4c1.200-.2 2.200.2 3 1" {...sin} />
      <path d="M12.500 4.500c1-1.500 3-1.800 4.500-1-.8 1.600-3 2.200-4.500 1z" />
    </>
  ),
  naranja: (
    <>
      <circle cx="12" cy="13.500" r="7.500" />
      <path d="M12 6c0-1.500.8-2.500 2.200-3" {...sin} />
      <path d="M12.500 6.200c1.500-1.500 3.500-1.500 5-.7-1 1.600-3.600 2-5 .7z" />
    </>
  ),
  banano: (
    <path d="M4.500 8c.5 5.500 5 11.500 12.500 11.500 2 0 3.300-.6 3.800-1.500-1.500.5-3 .3-4.800-.5C10.500 15 8.500 11 8.200 6.500 7 6 5.500 6.300 4.500 8z" />
  ),
  fresa: (
    <>
      <path d="M12 21c-5-3-7.500-7-6.500-10.500.7-2.300 3-3.500 6.500-3.500s5.800 1.200 6.500 3.500C19.500 14 17 18 12 21z" />
      <path d="M8 6.500c1.200-1.500 2.500-2 4-1.500 1.500-.5 2.800 0 4 1.500-1 1-2.500 1.500-4 1-1.500.5-3 0-4-1z" />
      <circle className="pict-hueco" cx="9.500" cy="11.500" r=".9" />
      <circle className="pict-hueco" cx="14.500" cy="11.500" r=".9" />
      <circle className="pict-hueco" cx="12" cy="14.500" r=".9" />
      <circle className="pict-hueco" cx="10" cy="17" r=".9" />
      <circle className="pict-hueco" cx="14" cy="17" r=".9" />
    </>
  ),
  limon: (
    <>
      <path d="M3 12c1.500-3.500 5-5.500 9-5.500s7.500 2 9 5.500c-1.500 3.500-5 5.500-9 5.500S4.500 15.500 3 12z" />
      <path d="M12 6.500c0-1 .5-1.800 1.500-2.300" {...sin} />
    </>
  ),
  cereza: (
    <>
      <circle cx="8" cy="17" r="3.500" />
      <circle cx="16" cy="16" r="3.500" />
      <path d="M8 13.500C8.500 9 10.500 6 13 4.500M16 12.500C15.500 8.500 14 6 13 4.500" {...sin} />
      <path d="M13 4.500c1.500-1 3.500-1 5 0-1.200 1.600-3.500 1.800-5 0z" />
    </>
  ),
  pina: (
    <>
      <ellipse cx="12" cy="15" rx="5.500" ry="6.500" />
      <path
        d="M12 8.500c-.5-2-2-3.500-4-4 1.200 1.200 1.700 2.300 1.800 3.800M12 8.500c.5-2 2-3.500 4-4-1.200 1.200-1.700 2.300-1.800 3.800M12 8.500V3"
        {...sin}
      />
      <path className="pict-trazo-hueco" d="M8.500 12.500l7 7M15.500 12.500l-7 7" {...sin} />
    </>
  ),

  // -------------------------------------------------------------- animales
  gato: (
    <>
      <path d="M5 4l4 3.500h6L19 4v8.500c0 4-3 7-7 7s-7-3-7-7z" />
      <circle className="pict-hueco" cx="9.500" cy="12" r="1.100" />
      <circle className="pict-hueco" cx="14.500" cy="12" r="1.100" />
      <path className="pict-hueco" d="M11 15h2l-1 1.200z" />
      <path
        className="pict-trazo-hueco"
        d="M3.500 14.500l4-.8M3.500 17l4-1.500M20.500 14.500l-4-.8M20.500 17l-4-1.500"
        {...sin}
      />
    </>
  ),
  perro: (
    <>
      <path d="M8 5.500C5.500 5 3.500 7 3.500 11v3c0 1.200 1.800 1.500 2.800.5C7.300 13.500 7.500 11 8 8.500z" />
      <path d="M16 5.500c2.500-.5 4.500 1.500 4.500 5.500v3c0 1.200-1.800 1.500-2.800.5-1-1-1.200-3.500-1.700-6z" />
      <path d="M8 6h8v9c0 2.500-1.800 4.500-4 4.500S8 17.500 8 15z" />
      <circle className="pict-hueco" cx="10" cy="11" r="1" />
      <circle className="pict-hueco" cx="14" cy="11" r="1" />
      <ellipse cx="12" cy="15" rx="1.800" ry="1.300" />
      <path className="pict-trazo-hueco" d="M12 16.500v1.800" {...sin} />
    </>
  ),
  pez: (
    <>
      <path d="M3 12c2-4 5.500-6 9-6 3.500 0 6 2.500 7.500 6-1.500 3.500-4 6-7.500 6-3.500 0-7-2-9-6z" />
      <path d="M19 12l3.500-4v8z" />
      <circle className="pict-hueco" cx="8" cy="11" r="1.100" />
    </>
  ),
  ave: (
    <>
      <path d="M4 15c0-4 3-7 7-7 .5-2 2-3.500 4-3.500 1.500 0 2.500.8 3 1.800l2.500 1.200-2.500 1c0 5-3 8.500-7 8.500H8.500L5 19.500z" />
      <circle className="pict-hueco" cx="15" cy="7.200" r=".9" />
      <path d="M9 19.500v2.500M13 19v3" {...sin} />
    </>
  ),
  mariposa: (
    <>
      <path d="M12 12C10 7 6 4.500 3.500 5.500c-1 2.500.5 6 4 7-2.500.5-3.500 2.500-3 4.500 2 1 4.500 0 6-2.500z" />
      <path d="M12 12c2-5 6-7.500 8.500-6.500 1 2.500-.5 6-4 7 2.500.5 3.500 2.500 3 4.500-2 1-4.500 0-6-2.500z" />
      <path
        d="M12 8v10M12 8c-.5-1.500-1.500-2.500-2.500-3M12 8c.5-1.500 1.500-2.500 2.500-3"
        {...sin}
      />
    </>
  ),
  tortuga: (
    <>
      <path d="M5 16c0-4.500 3-8 7-8s7 3.500 7 8z" />
      <path
        className="pict-trazo-hueco"
        d="M9.500 9.200l1.500 3 1.500-3M13.500 13l2.800-1.800M8 13l-1-1.500"
        {...sin}
      />
      <path d="M19 14.500c1.500-.5 3 0 3 1.500s-1 2-2.500 1.500zM4 16.500H3M6.500 16v3M10 16v3M14 16v3M17.500 16v3" />
    </>
  ),
  conejo: (
    <>
      <path d="M8.500 3.500c1.800 0 2.300 2.500 2.300 6H7.500c-.5-3.500-.2-6 1-6z" />
      <path d="M15.500 3.500c-1.800 0-2.300 2.500-2.300 6h3.300c.5-3.500.2-6-1-6z" />
      <circle cx="12" cy="14" r="6" />
      <circle className="pict-hueco" cx="9.500" cy="13" r="1" />
      <circle className="pict-hueco" cx="14.500" cy="13" r="1" />
      <path
        className="pict-trazo-hueco"
        d="M12 15.500v1.500M10.500 17.500c.8.500 2.200.5 3 0"
        {...sin}
      />
    </>
  ),
  abeja: (
    <>
      <path d="M8 8c-2.500-3-6-1.500-5 1.500s4 2.500 5-1.500zM16 8c2.500-3 6-1.500 5 1.500s-4 2.500-5-1.500z" />
      <ellipse cx="12" cy="14" rx="5" ry="6" />
      <path className="pict-trazo-hueco" d="M7.500 12h9M7 15.500h10M8.500 18.500h7" {...sin} />
      <path d="M12 8V5M10 5.500l-1-2M14 5.500l1-2" {...sin} />
    </>
  ),
  caracol: (
    <>
      <path d="M3 18.500h15.500c2 0 3-1 3-2.500V8.500" {...sin} />
      <circle cx="13" cy="12" r="6" />
      <path className="pict-trazo-hueco" d="M13 12m-3 0a3 3 0 1 1 3 3" {...sin} />
      <path d="M21.500 8.500l-1-3M19.500 8.500l-.5-3" {...sin} />
      <path d="M3 18.500c0-2.500 1.500-4 3.500-4h2L7 18.500z" />
    </>
  ),

  // ----------------------------------------------------------------- clima
  sol: (
    <>
      <circle cx="12" cy="12" r="4.500" />
      <path
        d="M12 2.500v3M12 18.500v3M2.500 12h3M18.500 12h3M5.300 5.300l2.100 2.100M16.600 16.600l2.100 2.100M5.300 18.700l2.100-2.100M16.600 7.400l2.100-2.100"
        {...sin}
      />
    </>
  ),
  lluvia: (
    <>
      <path d="M7 14a4.500 4.500 0 0 1-.7-8.950A6 6 0 0 1 17.900 5.100 4.500 4.500 0 0 1 17.500 14H7z" />
      <path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" {...sin} />
    </>
  ),
  rayo: <polygon points="13.500,2 5,13.500 11,13.500 9.500,22 19,10 12.500,10" />,
  copo: (
    <path
      d="M12 2.500v19M3.800 7.300l16.400 9.400M3.800 16.700l16.400-9.400M9.500 4l2.500 2 2.500-2M9.500 20l2.500-2 2.500 2"
      {...sin}
    />
  ),
  viento: (
    <path
      d="M3 9h10.500a2.500 2.500 0 1 0-2.500-2.500M3 13h15a2.500 2.500 0 1 1-2.500 2.500M3 17h7.500a2 2 0 1 1-2 2"
      {...sin}
    />
  ),
  arcoiris: (
    <>
      <path d="M3 18a9 9 0 0 1 18 0" {...sin} />
      <path d="M6 18a6 6 0 0 1 12 0" {...sin} />
      <path d="M9 18a3 3 0 0 1 6 0" {...sin} />
    </>
  ),
  sombrilla: (
    <>
      <path d="M3 12a9 9 0 0 1 18 0c-1.500-1.500-3-1.500-4.500 0-1.500-1.500-3-1.500-4.500 0-1.500-1.500-3-1.500-4.500 0C6 10.500 4.500 10.500 3 12z" />
      <path d="M12 12v7a2 2 0 0 0 4 0" {...sin} />
      <path d="M12 3V2" {...sin} />
    </>
  ),

  // ------------------------------------------------------------ naturaleza
  arbol: (
    <>
      <circle cx="12" cy="9" r="6.500" />
      <rect x="10.500" y="14" width="3" height="7.500" rx="1" />
    </>
  ),
  flor: (
    <>
      <circle cx="12" cy="6.500" r="3" />
      <circle cx="17.500" cy="10.500" r="3" />
      <circle cx="15.500" cy="16.500" r="3" />
      <circle cx="8.500" cy="16.500" r="3" />
      <circle cx="6.500" cy="10.500" r="3" />
      <circle className="pict-hueco" cx="12" cy="12" r="2.200" />
    </>
  ),
  montana: (
    <>
      <polygon points="2,20 9.500,6 17,20" />
      <polygon points="11,20 17,10 22,20" />
      <path className="pict-trazo-hueco" d="M7.500 9.500l2 2 2-2" {...sin} />
    </>
  ),
  ola: (
    <path
      d="M2 14c2.500-4 5-4 7.500 0s5 4 7.500 0 3.500-3.500 5-2.500M2 19c2.500-4 5-4 7.500 0s5 4 7.500 0 3.500-3.500 5-2.500"
      {...sin}
    />
  ),
  hongo: (
    <>
      <path d="M3 12a9 8 0 0 1 18 0z" />
      <path d="M9 12h6v6a3 3 0 0 1-6 0z" />
      <circle className="pict-hueco" cx="8.500" cy="9" r="1.200" />
      <circle className="pict-hueco" cx="14.500" cy="7.500" r="1.200" />
    </>
  ),
  palmera: (
    <>
      <path d="M12.500 21.500c0-5 .3-8 .8-11.500" {...sin} strokeWidth="2.400" />
      <path d="M13 10C11 5.500 6.500 4.500 3 7.500 6.500 6.800 10 8 13 10zM13 10c2-4.500 6.500-5.500 10-2.500-3.500-.7-7 .5-10 2.500zM13 10C11.500 6.500 9 4.200 6 3.500 8 5.500 10.500 7.500 13 10zM13 10c1.500-3.500 4-5.800 7-6.500-2 2-4.500 4-7 6.500z" />
      <circle cx="13" cy="11" r="1.300" />
    </>
  ),
  cactus: (
    <>
      <rect x="9.500" y="4" width="5" height="17" rx="2.500" />
      <path
        d="M9.500 13H7a1.500 1.500 0 0 1-1.500-1.500V9M14.500 11H17a1.500 1.500 0 0 0 1.500-1.500V7"
        {...sin}
        strokeWidth="2.600"
      />
    </>
  ),
  trebol: (
    <>
      <circle cx="12" cy="6.800" r="3.700" />
      <circle cx="6.800" cy="12" r="3.700" />
      <circle cx="17.200" cy="12" r="3.700" />
      <circle cx="12" cy="17.200" r="3.700" />
      <path d="M13.500 14.500c1 2.500 2.500 4.500 4.500 6" {...sin} strokeWidth="1.800" />
    </>
  ),

  // ------------------------------------------------------------------ casa
  llave: (
    <>
      <circle cx="7.500" cy="8.500" r="4.500" />
      <circle className="pict-hueco" cx="7.500" cy="8.500" r="1.500" />
      <path d="M11 11.500l9.500 9.500M16 16l3-3M18.500 18.500l2-2" {...sin} strokeWidth="2.400" />
    </>
  ),
  taza: (
    <>
      <path d="M4 8h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
      <path d="M16 10h1.500a2.500 2.500 0 0 1 0 5H16" {...sin} />
      <path d="M8 3.500c-.7 1 .7 1.500 0 2.500M12 3.500c-.7 1 .7 1.500 0 2.500" {...sin} />
    </>
  ),
  silla: (
    <>
      <path d="M7 3h8l-1 9H8z" />
      <rect x="5" y="12" width="14" height="3" rx="1" />
      <path d="M7 15l-1 6M17 15l1 6M9 15v6M15 15v6" {...sin} strokeWidth="2" />
    </>
  ),
  lampara: (
    <>
      <path d="M7 3h10l3 10H4z" />
      <path d="M12 13v7M8 21h8" {...sin} strokeWidth="2" />
    </>
  ),
  puerta: (
    <>
      <rect x="5" y="2.500" width="14" height="19" rx="1.500" />
      <circle className="pict-hueco" cx="15.500" cy="12.500" r="1.100" />
      <rect className="pict-hueco" x="8" y="5.500" width="8" height="5" rx=".5" />
    </>
  ),
  ventana: (
    <>
      <rect x="3.500" y="3.500" width="17" height="17" rx="1.500" />
      <path
        className="pict-trazo-hueco"
        d="M12 3.500v17M3.500 12h17"
        {...sin}
        strokeWidth="1.800"
      />
    </>
  ),
  libro: (
    <>
      <path d="M12 6C10 4.500 6.500 4 3 4.500v13c3.500-.5 7 0 9 1.500 2-1.500 5.500-2 9-1.500v-13C17.500 4 14 4.500 12 6z" />
      <path className="pict-trazo-hueco" d="M12 6v13" {...sin} strokeWidth="1.800" />
    </>
  ),
  reloj: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path className="pict-trazo-hueco" d="M12 6.500V12l3.500 2" {...sin} strokeWidth="2" />
    </>
  ),
  cama: (
    <>
      <path d="M3 18V6M3 14h18v4M21 18v-3" {...sin} strokeWidth="2" />
      <rect x="5" y="10" width="5" height="4" rx="1.500" />
      <path d="M11 14v-2.500a2 2 0 0 1 2-2h4a4 4 0 0 1 4 4V14z" />
    </>
  ),

  // ------------------------------------------------------------- transporte
  bus: (
    <>
      <rect x="4" y="3.500" width="16" height="14" rx="3" />
      <rect className="pict-hueco" x="6" y="6" width="12" height="5" rx="1" />
      <circle className="pict-hueco" cx="8" cy="14" r="1.100" />
      <circle className="pict-hueco" cx="16" cy="14" r="1.100" />
      <path d="M7 17.500v3M17 17.500v3" {...sin} strokeWidth="2.400" />
    </>
  ),
  bicicleta: (
    <>
      <circle cx="6" cy="16" r="4" {...sin} strokeWidth="1.800" />
      <circle cx="18" cy="16" r="4" {...sin} strokeWidth="1.800" />
      <path d="M6 16l4-8h5l3 8M10 8l2 8H6M14 5h3" {...sin} strokeWidth="1.800" />
    </>
  ),
  barco: (
    <>
      <path d="M2.500 15h19l-3 5.500h-13z" />
      <path d="M12 3v11M12 4l6 8H12zM11 6.500L6 12h5z" />
    </>
  ),
  avion: (
    <path d="M21 3l-3 .5-5 5L5 6 3 8l7 4.500-3.500 3.500-3-.5-1 1 4 1.500 1.500 4 1-1-.5-3 3.500-3.500L17 21l2-2-2.500-8 5-5z" />
  ),
  tren: (
    <>
      <rect x="5" y="2.500" width="14" height="15" rx="3" />
      <rect className="pict-hueco" x="7" y="5" width="10" height="5" rx="1" />
      <circle className="pict-hueco" cx="9" cy="14" r="1.100" />
      <circle className="pict-hueco" cx="15" cy="14" r="1.100" />
      <path d="M8 21l2.500-3.500M16 21l-2.500-3.500" {...sin} strokeWidth="2" />
    </>
  ),
  carro: (
    <>
      <path d="M3 15l1.500-5c.4-1.300 1.500-2 3-2h9c1.500 0 2.600.7 3 2L21 15v3H3z" />
      <path className="pict-hueco" d="M6.500 10.500l.8-1.500h9.400l.8 1.500z" />
      <circle cx="7.500" cy="18" r="2.200" />
      <circle className="pict-hueco" cx="7.500" cy="18" r=".8" />
      <circle cx="16.500" cy="18" r="2.200" />
      <circle className="pict-hueco" cx="16.500" cy="18" r=".8" />
    </>
  ),
  moto: (
    <>
      <circle cx="5.500" cy="16" r="3.500" {...sin} strokeWidth="1.800" />
      <circle cx="18.500" cy="16" r="3.500" {...sin} strokeWidth="1.800" />
      <path d="M5.500 16l4-6h5l4 6M14.500 10l-1-4h3M8 10h6" {...sin} strokeWidth="1.800" />
      <rect x="9" y="10" width="6" height="3.500" rx="1" />
    </>
  ),
  cohete: (
    <>
      <path d="M12 2c3.500 2.500 5 6 5 10.500L15 17H9l-2-4.500C7 8 8.500 4.500 12 2z" />
      <circle className="pict-hueco" cx="12" cy="9.500" r="1.800" />
      <path d="M9 17l-3 1v-4zM15 17l3 1v-4zM11 19.500l1 2 1-2z" />
    </>
  ),
  globo: (
    <>
      <path d="M12 2.500c4 0 7 3 7 6.800 0 3-2 5-3.500 6.200H8.500C7 14.300 5 12.300 5 9.300 5 5.500 8 2.500 12 2.500z" />
      <path d="M9 15.500h6v3H9z" />
      <path d="M9 15.500L8 18.500M15 15.500l1 3" {...sin} />
    </>
  ),
};
