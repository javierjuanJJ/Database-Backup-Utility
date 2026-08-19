# 004 — Logging & Notifications

> Guía operativa de la **Feature 004**: cómo se implementó, cómo funciona, cómo
> usarla y cómo **volver atrás** (rollback).

## 1. Resumen

Cada operación (backup/restore) queda registrada de forma **estructurada** (inicio, fin,
duración, estado y errores) en consola y en un archivo **JSON Lines** (`logs/app-AAAA-MM-DD.jsonl`),
y puede enviar **notificación a Slack** al finalizar (opcional y *best-effort*).

## 2. Archivos implicados

| Archivo | Responsabilidad |
|---------|-----------------|
| `src/lib/logger/index.js` | `createLogger` (consola + JSONL) y `redactSecrets` (sanitización). |
| `src/lib/logger/slack.js` | `buildSlackMessage` y `notifySlack` (webhook con `fetch`). |
| `src/services/backup.js` | Registra `START`/`END`/`ERROR` y notifica al final (si hay webhook). |
| `app.js` | Opciones `--log-dir` y `--slack-webhook`. |

## 3. Cómo funciona

1. Al iniciar `backup`, se crea el logger apuntando a `--log-dir` (por defecto `logs`).
2. `logger.start('BACKUP', ...)` emite el evento `START` (consola + JSONL).
3. Al terminar, `logger.ok` emite `END` con `durationMs`, estado y resumen; si hay webhook
   (`--slack-webhook` o `SLACK_WEBHOOK_URL`) se llama a `notifySlack`.
4. En error, `logger.error` emite `ERROR` con el código del catálogo y se re-lanza la excepción
   para que `app.js` la presente al usuario.
5. `redactSecrets` sustituye `password`/`secret`/`token`/`key`/`connstring` antes de escribir.

### Best-effort de Slack

- Si el webhook no está configurado, no se notifica (sin error).
- Si el envío falla, se registra un `WARN NOTIFY` **pero no se aborta** la operación.

## 4. Uso

```bash
# Logs en ./logs (por defecto)
node app.js backup sqlite --dbname ./data/app.db

# Logs en carpeta propia
node app.js backup postgres -u app -p secret --dbname app --log-dir ./mylogs

# Con notificación a Slack (webhook como flag)
node app.js backup mongodb --uri "mongodb://localhost:27017" --dbname app --slack-webhook "https://hooks.slack.com/services/XXX/YYY/ZZZ"

# Con webhook vía entorno
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/XXX/YYY/ZZZ" node app.js backup sqlite --dbname ./data/app.db
```

Formato de una línea del JSONL:

```json
{"ts":"2026-08-19T11:17:16.939Z","level":"info","event":"END","message":"Backup completado: ...","durationMs":141,"context":{"status":"success","database":"sqlite","checksum":"...","storage":"local","storageKey":"..."}}
```

## 5. Pruebas

```bash
npm test        # tests/logging.test.mjs (redactSecrets, eventos JSONL, buildSlackMessage)
npm run lint
```

> Los tests de Slack validan la construcción del mensaje, no llamadas de red reales.

## 6. Rollback (cómo volver atrás)

Revertir el commit de esta feature:

```bash
git log --oneline -- src/lib/logger src/services/backup.js app.js
git revert <hash-004>
```

> Si solo desea silenciar la salida de consola del logger, pase `{ verbose: false }` al crear
> el logger (sin revertir la feature). Revertir la 004 deja las notificaciones y los logs
> estructurados sin efecto, pero las features 001–003 siguen operativas.