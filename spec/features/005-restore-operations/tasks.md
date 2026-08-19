# Feature 005 — Restore Operations: Tasks

## 1. Infraestructura

- [x] `runProcess` soporta `options.inputFile` (stdin desde un archivo).
- [x] Test de `runProcess` con `inputFile` (usando un comando del SO, p. ej. `cat`).

## 2. Comandos de restauración

- [x] `src/lib/restore/commands.js`:
  - [x] `buildMysqlRestore` (stdin).
  - [x] `buildPostgresRestore` (`psql -f`, `PGPASSWORD`).
  - [x] `buildMongoRestore` (`--archive --gzip --drop`, `--nsInclude`).
  - [x] `buildSqliteRestore` (modo copy + rename atómico).
- [x] Tests de builders.

## 3. Restore lib y servicio

- [x] `src/lib/restore/index.js`: `decompressIfNeeded` y `runRestore`.
- [x] `src/services/restore.js`:
  - [x] `resolveSource` (local path | `scheme://` | key con `--storage`).
  - [x] `restoreDatabase(database, source, options)` con logger START/END/ERROR y Slack.

## 4. CLI y calidad

- [x] Comando `dbu restore <database> <source>` en `app.js`.
- [x] `docs/005-restore-operations.md` con rollback.
- [x] `npm run lint` sin errores y `npm test` en verde.