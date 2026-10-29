# Avisos de dependencias

Registro de los avisos de seguridad que SonarQube muestra sobre las dependencias del frontend (SCRUM-297 y SCRUM-300). Aqui queda por escrito que se corrigio, que sigue abierto, por que, y que se vigila. Ultima revision: 28/10/2026.

## Como leerlo

- **Ningun aviso se oculta ni se rebaja.** Lo que no tiene version corregida se documenta aqui; no se marca como resuelto ni como seguro.
- **SonarQube y `npm audit` no dicen lo mismo, y ninguno reemplaza al otro.** `npm audit` solo ve los avisos que GitHub ya reviso y que traen un rango de versiones; los de `picomatch` y `uri-js` estan publicados sin revisar y sin rango, asi que `npm audit` no los muestra y `scripts/revisar-dependencias.mjs` (que se apoya en `npm audit`) tampoco los vigila. Por eso se llevan a mano en este archivo.
- Un aviso solo se da por resuelto despues de un nuevo analisis de SonarQube sobre `desarrollo` que ya no lo muestre.
- **Las gravedades se muestran de las dos fuentes**, la de GitHub y el CVSS que muestra SonarQube, porque pueden diferir (SonarQube puntua mas alto en algunos avisos). Ninguna es una gravedad nuestra y no se rebaja ninguna: la referencia es la mas alta.

## Corregidos

| Paquete                | Aviso                                                                         | Antes   | Ahora   | Como                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------- | ------- | ------- | ------------------------------------------------------------------------------------- |
| `serialize-javascript` | GHSA-m5mm-p8h7-m29v (CVE-2026-115754 y CVE-2026-115897, son el mismo defecto) | 7.1.2   | 7.1.4   | `npm update serialize-javascript`; ningun padre lo fijaba, solo cambia el lockfile    |
| `katex`                | GHSA-238p-pmpm-9mq7 (CVE-2026-103923)                                         | 0.16.47 | 0.18.10 | `overrides` acotado a `mermaid` en `package.json` (primera version corregida: 0.18.2) |

Comprobado con OSV: `katex@0.18.10` y `serialize-javascript@7.1.4` no tienen avisos.

**Por que un override para katex y no subir al padre.** `katex` entra por `@excalidraw/excalidraw` → `@excalidraw/mermaid-to-excalidraw@2.2.2` → `mermaid@11`, que pide `katex ^0.16`. Excalidraw `0.18.1` es la ultima version publicada y fija `mermaid-to-excalidraw` exacta, asi que no hay padre que subir. Mermaid 12 ya pide `katex ^0.18`, y mermaid solo llama a `katex.renderToString` con opciones que no cambiaron. El override esta limitado a `mermaid`: `katex` no es dependencia directa de nada mas.

**Comprobacion de compatibilidad (28/10/2026).**

- Con las opciones exactas de mermaid (`throwOnError`, `displayMode`, `output: 'mathml'`), la salida de `0.16.47` y `0.18.10` es identica en siete formulas. Con `output: 'htmlAndMathml'` (solo lo usa mermaid si el navegador no soporta MathML) cambia el prefijo de las clases (`katex-base`, `katex-strut`); la aplicacion no carga la hoja de estilos de KaTeX ni antes ni ahora.
- En un navegador real, `mermaid@11.17.2` con `katex@0.18.10` pinta `$$…$$` como MathML (`<math>`, `<mfrac>`), `parseMermaidToExcalidraw` convierte flujos y secuencias con y sin formulas, y Excalidraw monta el lienzo con esos elementos, sin errores en consola.
- En `npm run build`, `katex` sigue siendo un fragmento aparte que carga el editor de diagramas bajo demanda: `index.html` no referencia ni el editor ni `katex`.

**Cuando quitar el override.** Dependabot no actualiza lo que esta en `overrides`. Cuando Excalidraw suba a una version cuyo `mermaid` pida `katex ^0.18` o superior, hay que quitar el bloque `mermaid` de `overrides`.

## Siguen abiertos: sin version corregida

Los tres paquetes estan afectados **hasta la ultima version publicada**. Se evaluaron las salidas posibles (subir el padre, reemplazar el paquete, quitarlo) y ninguna es compatible hoy; el detalle esta en cada uno.

### deepmerge 4.3.1 — GHSA-gcqx-w48m-w2h4 (CVE-2026-93753)

- **Que es.** `mergeObject()` no valida las claves que escribe: un objeto con claves como `__proto__` puede agregar propiedades al prototipo del resultado. Gravedad: baja en GitHub (CVSS 3.1: 5.3; 4.0: 2.7), pero **CVSS 7.5 (alta) en SonarQube**. Afectadas: `>= 4.2.0, <= 4.3.1`; sin version corregida (la 4.3.1 es la ultima, de marzo de 2023).
- **Quien lo trae.** `vite-plugin-pwa` → `workbox-build` → `@rollup/plugin-node-resolve` → `deepmerge`. Solo desarrollo y compilacion: genera el Service Worker.
- **Por que no se corrige.** `@rollup/plugin-node-resolve@16.0.3` (la ultima) sigue pidiendo `deepmerge ^4.2.2`, y `workbox-build@7.4.1` tambien es la ultima. La unica salida que ofrece `npm audit fix --force` es bajar a `workbox-build@5.1.4`, una version mayor mas vieja: no es una opcion. Workbox no se puede quitar: `vite-plugin-pwa` lo usa para inyectar la lista de archivos del Service Worker.
- **Condicion de explotacion.** Que alguien le pase a `deepmerge` objetos controlados por un atacante con claves de prototipo. Aqui solo mezcla las opciones del plugin con sus valores por omision, y esas opciones las escribimos nosotros en `vite.config.ts`.
- **Evidencia de alcance.** `npm audit --omit=dev` da 0 avisos; `deepmerge` no esta en el paquete que reciben los usuarios (en `dist/` no aparece su codigo).
- **Riesgo pendiente.** Bajo en la practica; sigue abierto mientras no exista version corregida.

### picomatch 4.0.7 — GHSA-fc5q-39xc-vjpf (CVE-2026-112366)

- **Que es.** Denegacion de servicio por expresion regular (ReDoS): patrones con un extglob repetido de una sola rama, como `+(*)` o `+(*a)`, producen un retroceso exponencial sobre cadenas cortas y bloquean el ciclo de eventos de Node.js. Gravedad: **alta** en GitHub (CVSS 3.1: 7.5; 4.0: 8.7) y CVSS 8.7 (alta) en SonarQube. El aviso esta sin revisar en GitHub y sin rango de versiones, por eso `npm audit` no lo muestra. Afecta hasta la 4.0.7, la ultima. La correccion propuesta (`micromatch/picomatch#194`) sigue abierta y no hay version publicada.
- **Quien lo trae.** Una sola version instalada (4.0.7) por varias herramientas de desarrollo: `vite`, `vitest`, `lint-staged`, `tinyglobby` (de `vite-plugin-pwa`), `workbox-build` (`@rollup/pluginutils`) y `sass` (`@parcel/watcher`, via `@excalidraw/excalidraw`). Esta ultima aparece en `npm ls --omit=dev` porque Excalidraw declara `sass` como dependencia, pero `sass` no se ejecuta en produccion.
- **Por que no se corrige.** No hay version corregida en ninguna linea: el propio reporte menciona tambien la 2.3.1 como afectada, asi que forzar otra version no ayuda. No se puede quitar: es la base de la busqueda de archivos de Vite y de las pruebas.
- **Condicion de explotacion.** Que alguien le entregue a picomatch un patron con esa forma. Los patrones que usamos son literales de nuestra configuracion (`**/*.{js,css,html,svg,png,webp,ico,woff2,webmanifest}`, `src/**/*.spec.{ts,tsx}`, `*.{ts,tsx}` en `lint-staged`) y ninguno usa extglob; buscamos `+(`, `*(`, `@(`, `!(` y `?(` en los archivos de configuracion y no hay. Ningun usuario de la aplicacion puede aportar un patron: no corre en el navegador.
- **Evidencia de alcance.** El paquete compilado no contiene codigo de picomatch (`analyzeRepeatedExtglob`, `picomatch` no aparecen en `dist/`). `@parcel/watcher` solo lo usa para filtrar rutas en modo vigilancia de `sass`, y el repositorio no tiene archivos `.scss`.
- **Mitigacion.** Revisar en cada Pull Request que ningun patron nuevo de configuracion (Vite, Vitest, ESLint, `lint-staged`, GitHub Actions) use extglob repetido.
- **Riesgo pendiente.** Sigue abierto; la gravedad es alta en las dos fuentes, aunque en este proyecto no hay camino por el que llegue un patron externo.

### uri-js 4.4.1 — tres avisos

| Aviso                                 | Que es                                                                                                                                          | GitHub          | SonarQube (CVSS) |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ---------------- |
| GHSA-ffpj-9hx9-929p (CVE-2026-93690)  | `removeDotSegments` entra en un bucle infinito si un segmento de la ruta empieza con separadores Unicode de linea o parrafo (con IRI activado). | Alta (CVSS 7.5) | 7.5 (alta)       |
| GHSA-7g43-p94j-qr58 (CVE-2026-93751)  | `pctDecChars` decodifica secuencias UTF-8 invalidas o demasiado largas como caracteres ASCII de control: puede colar `../` o saltos de linea.   | Media           | 6.5 (media)      |
| GHSA-cw9r-3wqp-32hm (CVE-2026-103387) | `URI.parse` del manejador `mailto` lanza una excepcion que nadie captura.                                                                       | Baja            | 4.3 (media)      |

- **Estado.** Los tres estan sin revisar en GitHub y afectan hasta la 4.4.1, la ultima (de junio de 2023); el proyecto no ha respondido a los reportes (`garycourt/uri-js#103`, `#105`, `#106`).
- **Quien lo trae.** `eslint` → `ajv@6` → `uri-js`. Solo desarrollo: el lint.
- **Por que no se corrige.**
  - ESLint `10.13.0` (la ultima) sigue pidiendo `ajv ^6.14.0`, asi que subirlo no cambia nada.
  - Forzar `ajv@8` no funciona: ESLint carga `ajv/lib/refs/json-schema-draft-04.json` y usa la opcion `schemaId: 'auto'`, que solo existen en `ajv@6` (`node_modules/eslint/lib/shared/ajv.js`).
  - Reemplazar `uri-js` por otro paquete con un override pondria una combinacion que ni `ajv@6` ni ESLint soportan bajo el control de calidad del repositorio. No se hace.
- **Condicion de explotacion.** Que `ajv` procese una direccion controlada por un atacante. Aqui solo resuelve los `$id` y `$ref` de los esquemas JSON de ESLint, de sus reglas y de nuestra configuracion; ninguno viene de usuarios ni de la red.
- **Evidencia de alcance.** `npm audit --omit=dev` da 0 avisos y `uri-js` no aparece en `npm ls --omit=dev`; en `dist/` no estan `removeDotSegments` ni `pctDecChars`.
- **Riesgo pendiente.** Sigue abierto; el paquete esta sin mantenimiento, asi que lo mas probable es que se resuelva cuando ESLint deje `ajv@6`.

## Como seguirlos

Revisar este archivo cada mes y cuando Dependabot proponga subir `eslint`, `workbox-build`, `vite-plugin-pwa`, `@excalidraw/excalidraw` o `picomatch`. Cuando salga una version corregida: actualizar (`npm update <paquete>` si el rango del padre la permite), pasar la tabla de arriba, y esperar al analisis de SonarQube para darlo por resuelto.

```bash
npm ls deepmerge picomatch uri-js katex serialize-javascript   # quien trae cada uno y en que version
npm ls --omit=dev picomatch uri-js deepmerge                    # lo que entra en el arbol de produccion
npm audit --omit=dev                                            # lo que ve npm; debe dar 0
npm view picomatch dist-tags.latest                             # si ya hay version nueva
```

Para consultar un paquete contra OSV: `https://api.osv.dev/v1/query` con `{"package":{"name":"picomatch","ecosystem":"npm"},"version":"4.0.7"}`.
