# Feature 004 — Logging & Notifications

- **Estado:** 🟢 Completada
- **Prioridad:** Media
- **Dependencias:** [Feature 001](../001-database-connectivity/spec.md) y [Feature 002](../002-backup-operations/spec.md)
- **Documentación operativa:** [docs/004-logging-and-notifications.md](../../docs/004-logging-and-notifications.md)

## Objetivo

Registrar cada operación de forma **estructurada** (inicio/fin, estado, duración, errores) y
enviar **notificaciones opcionales a Slack** al finalizar el proceso.

## Alcance

### Logs

- Consola: texto plano legible para el operador.
- Archivo: **JSON Lines** (`logs/app-YYYY-MM-DD.jsonl`) con `level`, `event`, `ts`, `message` y contexto.
- Eventos: `START`, `END`, `ERROR` con `startedAt`, `finishedAt` y `durationMs`.
- Nevera de credenciales: **ningún log registra contraseñas** (se sanitiza).

### Notificaciones Slack

- Opcional y desactivada por defecto.
- Se activa con la variable de entorno `SLACK_WEBHOOK_URL` o el flag `--slack-webhook`.
- Mensaje con resumen (base de datos, tipo de backup, estado, tamaño, duración y clave).
- Envío con el `fetch` global de Node (no requiere dependencias).

## Requisitos funcionales

1. `dbu backup <database> --log-dir ./logs` escribe el log JSONL.
2. `--slack-webhook <url>` (o `SLACK_WEBHOOK_URL`) envía notificación al terminar.
3. Todo log de operación incluye inicio, fin, duración y estado.
4. Si el envío a Slack falla, se registra `NOTIFY_FAILED` pero no se aborta el backup.

## Criterios de aceptación

- [ ] Tras un backup se crea `logs/app-<fecha>.jsonl` con una línea `START` y una `END`.
- [ ] Un backup fallido registra `ERROR` con el código del catálogo.
- [ ] `setSlack`/`notify` falla con webhook inválido → `NOTIFY_FAILED`.
- [ ] Los logs no contienen la cadena de la contraseña.