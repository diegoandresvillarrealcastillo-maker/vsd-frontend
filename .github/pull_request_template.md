## Ticket

<!-- Obligatorio. Ejemplo: SCRUM-31 -->
SCRUM-

## Que cambia y por que

<!-- Breve. El "por que" importa mas que el "que": el diff ya muestra el que. -->

## Tipo de cambio

- [ ] Nueva funcionalidad (`feat`)
- [ ] Correccion de defecto (`fix`)
- [ ] Documentacion (`docs`)
- [ ] Infraestructura o CI (`chore` / `ci` / `build`)
- [ ] Refactorizacion sin cambio de comportamiento (`refactor`)

## Como se probo

<!-- Comandos ejecutados y resultado. No basta con "funciona en mi computador". -->

## Revision de seguridad

- [ ] No se anadio ningun secreto, token, contrasena ni clave al repositorio.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` no aparece en el frontend ni en ningun paquete que llegue al navegador.
- [ ] No se guardo informacion personal o sensible en `localStorage`.
- [ ] La autorizacion no depende unicamente del frontend: el backend valida quien pide cada dato.
- [ ] Un usuario no puede leer, editar ni eliminar datos de otro, aunque conozca su identificador.
- [ ] Los mensajes de error no revelan informacion interna del sistema.

## Alcance clinico

- [ ] El cambio no diagnostica, no formula medicamentos y no sustituye la atencion profesional.
- [ ] Los textos visibles al usuario usan lenguaje orientativo, no clinico.

<!-- Marcar "No aplica" si el cambio no toca contenido visible al usuario. -->

## Definition of Done

- [ ] El CI esta en verde.
- [ ] Los mensajes de commit siguen Conventional Commits y citan el ticket.
- [ ] La documentacion afectada quedo actualizada.
- [ ] El ticket de Jira refleja el estado real del trabajo.
