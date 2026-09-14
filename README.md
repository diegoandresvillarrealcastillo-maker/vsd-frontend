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

| | |
|---|---|
| **Institucion** | Universidad de Cundinamarca |
| **Programa** | Ingenieria de Software |
| **Grupo** | 501M |
| **Docente** | Luiferney Ortiz Parra |
| **Equipo** | Diego Andres Villarreal Castillo · Samuel Villa Perez |

---

## Los dos repositorios

VSD Health se desarrolla en dos repositorios separados:

| Repositorio | Contenido |
|---|---|
| **vsd-frontend** (este) | PWA en React + TypeScript. Lo que ve y usa la persona. |
| [vsd-backend](https://github.com/diegoandresvillarrealcastillo-maker/vsd-backend) | API en NestJS, base de datos y **toda la documentacion tecnica**. |

La documentacion de arquitectura, convenciones, seguridad y las
decisiones de diseno (ADR) viven en
[vsd-backend/docs](https://github.com/diegoandresvillarrealcastillo-maker/vsd-backend/tree/desarrollo/docs).

---

## Estado actual

Este repositorio contiene, por ahora, **solo la base de gestion del
proyecto**: estructura de ramas, configuracion, integracion continua y
documentacion de proceso.

La aplicacion todavia no existe. Se incorpora por ciclos:

| Ciclo | Que se incorpora | Estado |
|---|---|---|
| 1 | Repositorio, ramas, CI inicial, documentacion | En curso |
| 2 | Landing page | Pendiente |
| 3 | Base React + TypeScript + Vite, PWA instalable | Pendiente |
| 4 | Arquitectura hexagonal y contratos de API | Pendiente |

No se documentan aqui comandos de instalacion o ejecucion porque
todavia no hay nada que instalar ni ejecutar. Esta seccion se completa
en el Ciclo 3.

---

## Stack previsto

- **React** + **TypeScript**
- **Vite** como herramienta de construccion
- **PWA**: manifiesto e instalable, con Service Worker
- **IndexedDB** (mediante Dexie) para el funcionamiento sin conexion
- **Supabase Auth** para la identidad, sin contrasenas
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
