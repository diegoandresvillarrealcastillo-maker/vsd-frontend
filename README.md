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
| 7     | Funcionamiento sin conexion                                         | Pendiente |

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

| Comando                 | Que hace                             |
| ----------------------- | ------------------------------------ |
| `npm run dev`           | Arranca y recarga al guardar         |
| `npm run build`         | Revisa los tipos y compila a `dist/` |
| `npm run preview`       | Sirve lo compilado, para comprobarlo |
| `npm test`              | Ejecuta las pruebas                  |
| `npm run test:watch`    | Pruebas en modo continuo             |
| `npm run test:coverage` | Pruebas con informe de cobertura     |
| `npm run lint`          | Estilo y reglas de seguridad         |
| `npm run typecheck`     | Revisa los tipos sin compilar        |
| `npm run format`        | Da formato a todo el repositorio     |

### Dos reglas que impone el lint

No son de estilo. Las dos existen para que un descuido no acabe en el paquete
que se descarga cualquiera:

- **La URL de Supabase no se escribe en el codigo.** Sale de
  `import.meta.env.VITE_SUPABASE_URL`, que cambia con el ambiente.
- **La clave de servicio de Supabase no puede aparecer.** Da acceso total a la
  base y salta el aislamiento por RLS. En el frontend no existe.

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

## Variables de entorno

Copiar [.env.example](.env.example) como `.env.local` y completar los valores.

**Todo lo que empieza por `VITE_` queda visible en el navegador.** En
este repositorio solo pueden existir valores publicos. Las credenciales
de base de datos y la clave de rol de servicio de Supabase viven
exclusivamente en `vsd-backend`.

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
