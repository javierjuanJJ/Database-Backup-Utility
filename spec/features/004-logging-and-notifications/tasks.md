# Feature 004 — Logging & Notifications: Tasks

## 1. Logger

- [x] `src/lib/logger/index.js`:
  - [x] `createLogger({ destDir, verbose })` con `start`/`ok`/`error`/`warn`.
  - [x] Salida a consola legible + `logs/app-YYYY-MM-DD.jsonl`.
  - [x] `redactSecrets(value)` que oculta `password`/`secret`/`token`.
  - [x] Tests de sanitización y de emisión de eventos (archivo JSONL en carpeta temporal).

## 2. Notificaciones Slack

- [x] `src/lib/logger/slack.js`:
  - [x] `buildSlackMessage(summary)` → texto plano con resumen.
  - [x] `notifySlack(webhookUrl, summary)` con `fetch` y mapeo a `NOTIFY_FAILED`.
  - [x] Tests de construcción de mensaje (sin llamadas de red).

## 3. Integración

- [x] `services/backup.js` registra START/END/ERROR y envía Slack si hay webhook (best-effort).
- [x] `app.js`: opciones `--log-dir` y `--slack-webhook` en `backup`.
- [x] El fallo de notificación no aborta la operación.

## 4. Calidad

- [x] `docs/004-logging-and-notifications.md` con rollback.
- [x] `npm run lint` sin errores y `npm test` en verde.