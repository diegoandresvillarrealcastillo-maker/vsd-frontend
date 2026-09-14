# Guia de contribucion — VSD Health

Estas reglas aplican por igual a `vsd-frontend` y `vsd-backend`.

---

## 1. Flujo de ramas

VSD Health no usa `main`. Hay tres ramas de larga vida:

| Rama | Que contiene | Quien escribe en ella |
|---|---|---|
| `produccion` | Lo que usan las personas reales | Nadie directamente. Solo entra por Pull Request desde `preproduccion` |
| `preproduccion` | Version candidata, en validacion | Nadie directamente. Solo entra por Pull Request desde `desarrollo` |
| `desarrollo` | Integracion del trabajo del equipo | Nadie directamente. Solo entra por Pull Request desde ramas de trabajo |

El flujo completo es siempre el mismo:

```
feature/SCRUM-31-...  ->  desarrollo  ->  preproduccion  ->  produccion
```

### Prohibiciones

Estas reglas no son preferencias de estilo. Rompen el historial del
proyecto y la trazabilidad academica del entregable:

- **No** se desarrolla directamente sobre `produccion`.
- **No** se hacen commits manuales sobre `produccion` ni `preproduccion`.
- **No** se usa `git push --force` sobre ninguna rama compartida.
- **No** se reescribe ni se elimina historial ya publicado.
- **No** se eliminan las ramas de larga vida.

> **Estado actual:** estas reglas estan documentadas pero **todavia no
> estan impuestas por GitHub**. La proteccion de ramas no esta disponible
> en repositorios privados con plan Free. Ver el ticket `SCRUM-35`.
> Mientras tanto dependen de la disciplina del equipo, lo que es una
> debilidad conocida y no una situacion aceptable a largo plazo.

---

## 2. Nombre de las ramas de trabajo

```
<tipo>/SCRUM-<numero>-<descripcion-corta-en-kebab-case>
```

Tipos: `feature`, `fix`, `chore`, `docs`, `refactor`, `test`.

Ejemplos:

```
feature/SCRUM-42-registro-de-estado-de-animo
fix/SCRUM-57-sincronizacion-duplica-resultados
chore/SCRUM-28-base-del-repositorio
```

Una rama por ticket. Si el trabajo crece, se parte en varios tickets.

---

## 3. Mensajes de commit

Se usa [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/).

```
<tipo>(<ambito opcional>): <asunto en minuscula, sin punto final>

<cuerpo opcional, explicando el porque>

Refs: SCRUM-<numero>
```

Tipos admitidos: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`,
`test`, `build`, `ci`, `chore`, `revert`.

Ejemplo:

```
feat(resultados): registrar el identificador de operacion del cliente

Sin este identificador, un reintento de sincronizacion tras una caida de
red crea un segundo resultado identico. El campo es UNIQUE en base de
datos, de modo que el segundo intento se rechaza en lugar de duplicar.

Refs: SCRUM-42
```

**Todo commit debe citar su ticket.** El CI lo verifica con commitlint y
rechaza el Pull Request si falta. Esa referencia es lo que permite
reconstruir, meses despues, por que existe una linea de codigo.

---

## 4. Trazabilidad

Cada cambio debe poder seguirse de principio a fin:

```
Jira SCRUM-42
      |
      v
rama  feature/SCRUM-42-registro-de-estado-de-animo
      |
      v
commits  feat(...): ...   Refs: SCRUM-42
      |
      v
Pull Request  [SCRUM-42] Registrar el estado de animo
      |
      v
desarrollo -> preproduccion -> produccion
```

---

## 5. Pull Requests

- La plantilla se carga sola. Hay que completarla, no borrarla.
- Titulo: `[SCRUM-42] Descripcion corta`.
- El CI debe estar en verde antes de pedir revision.
- Se requiere al menos una aprobacion del otro integrante del equipo.
- Quien revisa comprueba tambien la checklist de seguridad, no solo el codigo.

---

## 6. Secretos

Regla sin excepciones: **ningun secreto entra al repositorio.**

No se versionan: archivos `.env`, tokens, contrasenas, claves de API,
credenciales, claves de rol de servicio, ni datos reales de usuarios.

Lo unico que se versiona es `.env.example`, con los nombres de las
variables y valores de ejemplo.

`SUPABASE_SERVICE_ROLE_KEY` **jamas** puede aparecer en `vsd-frontend`,
ni en una variable de entorno, ni en el codigo, ni en un comentario.
Esa clave salta todas las politicas de seguridad de la base de datos.

Si un secreto se filtra por error:

1. Rotar la credencial en el proveedor **primero**. Quitarla del codigo
   no la invalida: ya esta publicada.
2. Avisar al equipo.
3. Solo despues limpiar el repositorio.

---

## 7. Definition of Done

Un ticket no esta terminado porque "funciona en mi computador". Esta
terminado cuando:

- el codigo esta implementado y TypeScript compila sin errores;
- las pruebas correspondientes existen y pasan;
- el CI esta en verde;
- la revision de seguridad del Pull Request esta completa;
- la documentacion afectada quedo actualizada;
- el Pull Request fue aprobado y fusionado;
- el ticket de Jira refleja el estado real.

---

## 8. Limite clinico del producto

VSD Health **no diagnostica**, **no formula medicamentos** y **no
reemplaza** la atencion de psicologos, medicos ni psiquiatras.

Todo texto visible al usuario debe usar lenguaje orientativo. Ninguna
funcionalidad puede presentar un resultado como un diagnostico. Quien
revise un Pull Request que toque contenido visible debe verificarlo.
