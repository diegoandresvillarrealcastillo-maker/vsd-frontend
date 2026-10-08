# VSD Health — Frontend

Aplicacion web progresiva (PWA) de **VSD Health**, una herramienta de
acompanamiento del bienestar emocional y cognitivo.

> ### Aviso importante
>
> **VSD Health no diagnostica, no formula medicamentos y no reemplaza la
> atencion de psicologos, medicos ni psiquiatras.**
>
> La informacion que ofrece es orientativa y de apoyo. Ante cualquier
> senal de alerta, la aplicacion remite a recursos de ayuda profesional.

---

## Contexto academico

|                 |                                                       |
| --------------- | ----------------------------------------------------- |
| **Institucion** | Universidad de Cundinamarca                           |
| **Programa**    | Ingenieria de Software                                |
| **Grupo**       | 501M                                                  |
| **Docente**     | Luiferney Ortiz Parra                                 |
| **Equipo**      | Diego Andres Villarreal Castillo · Samuel Villa Perez |

---

## Los dos repositorios

VSD Health se desarrolla en dos repositorios separados:

| Repositorio                                                                       | Contenido                                                         |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **vsd-frontend** (este)                                                           | PWA en React + TypeScript. Lo que ve y usa la persona.            |
| [vsd-backend](https://github.com/diegoandresvillarrealcastillo-maker/vsd-backend) | API en NestJS, base de datos y **toda la documentacion tecnica**. |

La documentacion de arquitectura, convenciones, seguridad y las
decisiones de diseno (ADR) viven en
[vsd-backend/docs](https://github.com/diegoandresvillarrealcastillo-maker/vsd-backend/tree/desarrollo/docs).

---

## Estado actual

La aplicacion **esta publicada en PRE**, en
[vsd-health-pre.vercel.app](https://vsd-health-pre.vercel.app), y trabaja
contra el API de PRE. PROD todavia no tiene despliegue.

Lo que ya tiene:

- **Portada** y las pantallas de registro, inicio de sesion y recuperacion de
  contrasena.
- **Panel** con los tres modulos, la eleccion de modulos al empezar y el
  sendero de cada uno.
- **Las actividades** de cognicion, bienestar y emociones, con las lineas de
  atencion a la vista.
- **Diario** por dia, con editor enriquecido y diagramas.
- **Semaforo de pendientes**, **avisos por Web Push** y la **mascota** con
  VSD IA.
- **Perfil**: preferencias, cambio de contrasena, exportar los datos y borrar
  la cuenta.
- Modo claro y oscuro, efecto vidrio y navegacion movil con dock flotante.
- Se puede **instalar** en la pantalla de inicio, tambien en iOS.

| Ciclo | Que se incorpora                                                    | Estado    |
| ----- | ------------------------------------------------------------------- | --------- |
| 1     | Repositorio, ramas, CI, documentacion                               | Terminado |
| 5     | Andamiaje React + TypeScript + Vite                                 | Terminado |
| 5     | Registro, inicio de sesion y recuperar contrasena                   | Terminado |
| 5     | Entrar con Google (SCRUM-74)                                        | Pendiente |
| 6     | Landing page                                                        | Terminado |
| 6     | Panel, actividades, sendero, diario, semaforo, avisos, perfil y PRE | En curso  |
| 7     | Funcionamiento sin conexion                                         | En curso  |

---

## Como ejecutarlo

Necesitas Node 24 y Git.

```bash
git clone https://github.com/diegoandresvillarrealcastillo-maker/vsd-frontend.git
cd vsd-frontend
npm install
```

Crea tu archivo de entorno a partir del ejemplo:

```bash
cp .env.example .env.local
```

Para ver la portada no hace falta configurar nada mas. Las credenciales de
Supabase solo se piden cuando se usa la autenticacion, y si faltan el error
dice cual es y donde ponerla.

Del panel en adelante hace falta el API: desde SCRUM-79 el panel da de alta la
cuenta y lee el catalogo contra `vsd-backend`. Arrancalo en local siguiendo su
README; el de PRE no sirve desde `localhost`, porque su `CORS_ORIGIN` solo
admite el dominio de la PWA de PRE.

Arranca la aplicacion:

```bash
npm run dev
```

Queda en **http://localhost:5173**. El puerto es fijo a proposito: las URL de
redireccion de Google se configuran por puerto, y saltar al siguiente libre
rompe ese inicio de sesion sin decir por que.

### Comandos disponibles

| Comando                 | Que hace                                                          |
| ----------------------- | ----------------------------------------------------------------- |
| `npm run dev`           | Arranca y recarga al guardar                                      |
| `npm run build`         | Revisa los tipos, compila a `dist/` y comprueba el service worker |
| `npm run preview`       | Sirve lo compilado, para comprobarlo                              |
| `npm test`              | Ejecuta las pruebas                                               |
| `npm run test:watch`    | Pruebas en modo continuo                                          |
| `npm run test:coverage` | Pruebas con informe de cobertura                                  |
| `npm run lint`          | Estilo y reglas de seguridad                                      |
| `npm run typecheck`     | Revisa los tipos sin compilar                                     |
| `npm run format`        | Da formato a todo el repositorio                                  |

### El service worker: abrir sin conexion (SCRUM-135)

`src/sw.ts` es el service worker. Hace tres cosas y solo estas: **guarda la
aplicacion** (los archivos de la compilacion) para abrirla sin red, **recibe los
avisos** por Web Push y **guarda la tipografia** de Google Fonts la primera vez
que se pide. El plugin `vite-plugin-pwa` solo le inyecta la lista de archivos.

**Lo que NO hace** es lo importante:

- **No toca la API, ni Supabase, ni nada que no sea de la aplicacion.** Lo que
  devuelve la API es de una persona, y esa copia no se borraria al cerrar sesion.
  Las copias propias de la aplicacion viven en IndexedDB, por persona (SCRUM-136).
- **No toma el control solo al instalarse una version nueva.** Guarda archivos con
  hash en el nombre: si una version nueva tomara el control con una pagina vieja
  abierta, esa pagina pediria archivos que ya no existen y se quedaria a medias
  sin ningun error que lo explique. La version nueva **espera**, la pagina avisa
  («Hay una version nueva») y la persona decide. Nunca se recarga una pagina sin
  que lo sepa quien la usa: podria estar escribiendo en su diario.

**Como se actualiza.** Al abrir la aplicacion, el navegador revisa si hay un
`sw.js` nuevo. Si lo hay, queda esperando y aparece el aviso:

| La persona...                 | Pasa...                                                    |
| ----------------------------- | ---------------------------------------------------------- |
| pulsa **Actualizar**          | Se activa la version nueva y esa pestana se recarga sola   |
| pulsa **Despues**             | Se esconde el aviso; vuelve a salir al abrir la aplicacion |
| la acepta en **otra pestana** | Esta no se recarga: ofrece «Recargar» y espera             |

Esto ultimo se hace con `onNeedReload` en `registrarElServiceWorker.ts`. Sin el,
el plugin recarga cualquier pestana en cuanto la version nueva se activa **por
cualquier via**, con lo que escribir en una pestana y aceptar la actualizacion en
otra bastaba para perder lo escrito.

**Lo que pesa.** La primera visita descarga en segundo plano unos 204 archivos:
**9,1 MiB sin comprimir; entre 2,8 MiB (Brotli) y 3,3 MiB (gzip) por la red**.
Casi todo es JavaScript (8,4 MiB), y lo mas pesado viene del editor de diagramas
del diario y sus dependencias. Se guarda entero a proposito: dejar fuera un archivo es una
aplicacion que abre sin conexion y falla al pedirlo. Si el tamano llegara a
importar, la primera opcion es sacar del paquete inicial lo que casi nadie usa
(los idiomas y diagramas de Excalidraw), no el limite de `vite.config.ts`.

**Como probarlo.** En desarrollo no hay service worker (guardar archivos mientras
cambian a cada rato es la forma de ver una version vieja sin saber por que). Para
probarlo, sobre una compilacion:

```bash
npm run build && npm run preview     # http://localhost:4173
```

Abrir la aplicacion, esperar unos segundos, apagar el servidor (o poner el
navegador sin conexion) y recargar: la portada y `/acceso` abren. Para ver el
aviso, compilar otra version distinta y, desde la consola,
`(await navigator.serviceWorker.getRegistration()).update()`.

**`npm run build` tambien lo comprueba** (`scripts/comprobar-el-service-worker.mjs`):
carga el `dist/sw.js` ya compilado en un entorno simulado y le manda eventos. Si
algo falla, **la compilacion falla**, y por tanto el CI y el despliegue de
Vercel: un service worker roto no se publica. Comprueba que guarda `index.html` y
cada JS y CSS de `dist/assets`, que **no responde** a la API ni a ningun otro
origen, que instalarse no llama a `skipWaiting`, y que los avisos y la ruta a la
que llevan (siempre de este mismo sitio) funcionan. Si cambia la logica de
`src/sw.ts` y esto no la cubre, hay que ampliarlo.

**Los avisos en desarrollo.** Como no hay service worker en desarrollo, activar
los avisos desde `npm run dev` no funciona; usar `npm run preview`.

**Un limite conocido.** Si la primera visita a la aplicacion queda abierta en una
pestana durante mucho tiempo, y despues se acepta una version nueva en otra, esa
pestana no ofrece recargar (Workbox no la cuenta como una actualizacion). No
pierde nada, pero seguira con archivos viejos hasta que se recargue.

### Dos reglas que impone el lint

No son de estilo. Las dos existen para que un descuido no acabe en el paquete
que se descarga cualquiera:

- **La URL de Supabase no se escribe en el codigo.** Sale de
  `import.meta.env.VITE_SUPABASE_URL`, que cambia con el ambiente.
- **La clave de servicio de Supabase no puede aparecer.** Da acceso total a la
  base y salta el aislamiento por RLS. En el frontend no existe.

### Los buscadores (SEO-02)

Lo que Google y los asistentes de IA leen, y lo que no deben leer:

- **`robots.txt`, `sitemap.xml`, `llms.txt` y `404.html`** no se escriben a mano:
  los genera `scripts/generar-los-archivos-de-busqueda.mjs` al final de
  `npm run build`, segun `VITE_APP_ENV`.
  - **`production`**: permite la portada y los documentos legales, cierra
    `/panel`, `/perfil`, `/diario`, `/modulo/`, `/actividad/` y
    `/contrasena-nueva`, y publica el sitemap. **Exige `VITE_URL_PUBLICA`** (el
    dominio con https): sin el, la compilacion falla en vez de publicar un
    sitemap roto.
  - **Cualquier otro** (PRE, local): `robots.txt` lo cierra todo, no hay sitemap,
    la pagina lleva `<meta name="robots" content="noindex">` y Vercel manda la
    cabecera `X-Robots-Tag: noindex` en PRE (`vsd-health-pre.vercel.app`) y en las
    vistas previas de las ramas (`*-git-*.vercel.app`). PRE tiene cuentas y datos de
    prueba; que se indexe no le sirve a nadie.
  - **Por que la regla no cubre todo `*.vercel.app`**: el dominio de produccion
    sera uno gratuito y generico de Vercel (`algo.vercel.app`), y una regla por
    `vercel.app` lo cerraria a los buscadores. `scripts/comprobar-las-cabeceras.mjs`
    lo vigila: falla si la regla deja de cubrir PRE o las vistas previas, o si pasa a
    cubrir un posible dominio de produccion. **Si PROD estrena un dominio propio o
    PRE cambia de nombre, hay que ajustar el host en `vercel.json`.**
- **Solo existen las rutas que existen.** `vercel.json` y `nginx/default.conf`
  reescriben a `index.html` unicamente las pantallas de `src/rutas/rutas.ts`; el
  resto es un 404 real, con una pagina estatica y `noindex` (antes cualquier
  direccion devolvia la portada con un 200, un «soft 404»). **Una ruta nueva en
  `rutas.ts` hay que agregarla a las dos reescrituras y clasificarla** (publica,
  privada o de acceso) en `scripts/generar-los-archivos-de-busqueda.spec.ts`: dos
  pruebas fallan si falta, y es a proposito, porque sin la reescritura esa
  pantalla daria 404 al recargarla.

### El almacen local: lo hecho sin conexion (SCRUM-136)

`src/sincronizacion/` guarda en el dispositivo lo que la persona hace sin conexion
y lo envia a la API cuando se puede. Son piezas pequenas y cada una responde a
una sola pregunta:

| Archivo              | Responde a...                                                           |
| -------------------- | ----------------------------------------------------------------------- |
| `almacenLocal.ts`    | Donde se guardan las lecturas y la cola (IndexedDB por persona)         |
| `cifrado.ts`         | Como se protege lo guardado (AES-GCM 256, clave que no sale del equipo) |
| `llavero.ts`         | Donde vive esa clave (otra base, aparte de los datos)                   |
| `cola.ts`            | En que orden se envia, cuando se reintenta y cuanto se espera           |
| `clasificarFallo.ts` | Si un fallo se reintenta, se detiene todo o pide atencion               |
| `ejecutores.ts`      | Como se envia cada tipo de operacion a la API                           |
| `motor.ts`           | Enviar lo pendiente sin perder ni duplicar nada                         |
| `ciclo.ts`           | Cuando se abre, se cierra y se **olvida** lo guardado                   |

**Lo que se garantiza.**

- **Nada se duplica.** Cada operacion lleva un identificador que se crea una vez,
  al guardarla, y es el mismo en cada reintento; la API responde con lo que ya
  tenia. Si la respuesta se pierde por el camino, reenviar es seguro.
- **Nada se pierde.** Una operacion no se descarta por fallar: se reintenta con
  espera creciente (5 s, 10 s... hasta 15 min, con un poco de azar) y, si el
  servidor la rechaza, queda **marcada para que la persona la vea**. Si la sesion
  caduca a medias, el envio se detiene y la cola sigue ahi.
- **El orden importa solo donde importa.** Editar un pendiente espera a que se
  cree; una anotacion rechazada no detiene a los pendientes.
- **Una sola sincronizacion a la vez**, aunque haya varias pestanas (Web Locks).
- **Nunca se envia con la sesion de otra persona.** Cada almacen es de una
  persona y el motor lo comprueba antes de cada envio.

**Cuando se olvida.** Hay dos finales de sesion y no son lo mismo:

| La sesion termina...                                  | Lo guardado...                  |
| ----------------------------------------------------- | ------------------------------- |
| porque la persona **cierra sesion** o borra la cuenta | Se **borra** todo, base y clave |
| sola: caduco, se revoco, se cerro en otra pestana     | Se **conserva**, cerrado        |
| porque **entra otra persona** en el mismo equipo      | Se borra lo de la anterior      |

Lo segundo es lo que permite que lo hecho sin conexion sobreviva a una sesion
vencida; lo tercero, que en una sala de computo nadie lea lo de quien estuvo antes.
Con la sesion que no se recuerda en este equipo, o si el navegador no deja usar
IndexedDB, todo vive **solo en memoria**.

Este nucleo todavia no se ve en ninguna pantalla: las siguientes entregas lo
conectan (el indicador de conexion y el boton «Sincronizar ahora», las actividades,
el diario y los pendientes).

---

## Stack

- **React 19** + **TypeScript**
- **Vite** como herramienta de construccion
- **React Router** para la navegacion
- **Framer Motion** para las animaciones
- **Vitest** + **Testing Library** para las pruebas
- **Supabase Auth** para la identidad: correo con contrasena y Google
- **TipTap** como editor del diario y **Excalidraw** para sus diagramas,
  cargado solo cuando se abre
- **PWA** instalable, con un Service Worker que solo recibe los avisos por
  Web Push: no guarda nada en cache
- **IndexedDB** para el funcionamiento sin conexion (pendiente)
- Despliegue en **Vercel**

---

## Requisitos previos

- **Node.js 24** (la version exacta esta fijada en [.nvmrc](.nvmrc))
- **Git**
- Una cuenta con acceso al proyecto en Jira

---

### La imagen de Docker

El frontend tiene su `Dockerfile` (SCRUM-132): compila la PWA y la sirve con
nginx. Sirve para el entorno completo con un solo comando (ver el README de
`vsd-backend`) y para el CI. **En produccion no se usa: la PWA se despliega en
Vercel**, que no ejecuta contenedores
([ADR 0018](https://github.com/diegoandresvillarrealcastillo-maker/vsd-backend/blob/desarrollo/docs/adr/0018-el-backend-se-despliega-como-una-imagen-de-docker.md)).

```bash
docker build \
  --build-arg VITE_API_BASE_URL=http://localhost:3000 \
  --build-arg VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=la-clave-anonima \
  -t vsd-web .
docker run --rm -p 8080:8080 vsd-web
```

- **Una imagen por ambiente.** Vite incorpora las `VITE_*` al paquete al
  compilar, no al ejecutar: para cambiar la direccion de la API hay que volver a
  construirla. Son valores publicos; nunca pasar un secreto como `--build-arg`.
- `.env.local` no entra a la imagen (`.dockerignore` es una lista blanca).
- Se sirve en el **8080**, sin privilegios. Las pantallas de la aplicacion y los
  archivos que existen se sirven, como hace Vercel; **cualquier otra direccion es
  un 404 de verdad** (ver «Los buscadores»). `index.html` y `sw.js` se validan en
  cada visita y los archivos con hash se guardan un ano.
- Que lo anterior sea cierto lo comprueba el CI (trabajo «Imagen de Docker»).

## Variables de entorno

Copiar [.env.example](.env.example) como `.env.local` y completar los valores.

**Todo lo que empieza por `VITE_` queda visible en el navegador.** En
este repositorio solo pueden existir valores publicos. Las credenciales
de base de datos y la clave de rol de servicio de Supabase viven
exclusivamente en `vsd-backend`.

Dos de ellas deciden mas que un valor: `VITE_APP_ENV` define si los buscadores
pueden indexar el sitio (solo con `production`), y `VITE_URL_PUBLICA` es el
dominio publico, obligatorio con `production` para escribir el sitemap.

El valor que toma cada variable en desarrollo, preproduccion y produccion
esta documentado en
[vsd-backend/docs/ambientes.md](https://github.com/diegoandresvillarrealcastillo-maker/vsd-backend/blob/desarrollo/docs/ambientes.md).

---

## Como se trabaja

El flujo de ramas, la convencion de commits y las reglas de seguridad
estan en [CONTRIBUTING.md](CONTRIBUTING.md). Resumen:

```
feature/SCRUM-42-...  ->  desarrollo  ->  preproduccion  ->  produccion
```

- Nunca se trabaja directamente sobre `produccion`.
- Todo commit sigue Conventional Commits y cita su ticket `SCRUM-N`.
- Todo cambio entra por Pull Request con al menos una aprobacion.

---

## Licencia

Proyecto academico. Uso restringido al ambito del curso.
