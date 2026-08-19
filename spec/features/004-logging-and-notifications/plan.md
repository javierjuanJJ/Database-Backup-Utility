# Feature 004 — Logging & Notifications: Plan

## Contexto

Las features 001–003 producen resultados (conexión, artefactos, almacenamiento) pero sin un
registro consistente ni avisos automáticos. Esta feature añade observabilidad: un logger
estructurado con doble salida (consola + JSONL) y notificaciones Slack opcionales.

## Estrategia técnica

1. **`src/lib/logger/index.js`** — `createLogger({ destDir, verbose })` devuelve un logger
   con:
   - `start(event, context)` → emite `START`.
   - `ok(event, context)` → emite `END` (estado success).
   - `error(event, err)` → emite `ERROR` con el código del catálogo.
   - Salida: `console` (legible) + `fs.appendFileSync` en JSONL (`logs/app-<fecha>.jsonl`).
   - **Sanitización**: `redactSecrets` elimina valores de `password`/`secret` de los mensajes.

2. **`src/lib/logger/slack.js`** — `notifySlack(webhookUrl)` envía un mensaje con `fetch`.
   - `buildSlackMessage(summary)` → texto con resumen del backup/restore.
   - Error → `AppError('NOTIFY_FAILED', ...)`.

3. **Integración en `src/services/backup.js`**:
   - Al inicio: `logger.start('BACKUP', opciones)`.
   - Al terminar: `logger.ok('BACKUP', resumen)` y, si hay webhook, `notifySlack`.
   - En excepción: `logger.error` y re-lanza la excepción (app.js la presenta).
   - El fallo de notificación **no** aborta la operación (se loguea `NOTIFY_FAILED`).

4. **`app.js`**: opciones `--log-dir` y `--slack-webhook` en los comandos.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Logs con contraseñas | `redactSecrets` sanitiza el mensaje antes de escribir. |
| Archivo de log infinito | Rotación diaria (`app-YYYY-MM-DD.jsonl`). |
| Slack caído durante backup | La notificación es best-effort: se captura y registra `NOTIFY_FAILED`. |
| Ruido en consola | El logger en modo silencioso puede suprimir la salida de consola. |

## Plan de tareas

1. Implementar `logger/index.js` con tests de sanitización y rotación.
2. Implementar `logger/slack.js` con tests de construcción de mensaje (sin red).
3. Integrar logger + Slack en `services/backup.js`.
4. Añadir `--log-dir` y `--slack-webhook` en `app.js`.
5. Documentación operativa con rollback en `docs/004-logging-and-notifications.md`.