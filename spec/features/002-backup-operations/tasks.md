# Feature 002 — Backup Operations: Tasks

## 1. Builders de comandos

- [x] `src/lib/backup/commands.js`:
  - [x] `buildMysqlDump` (full + incremental/diferencial con `--where` y `--tables`).
  - [x] `buildPostgresDump` (full + `--table`/`--schema`; password por `PGPASSWORD`).
  - [x] `buildMongodump` (archive + gzip; `--collection`/`--query`).
  - [x] `buildSqliteCopy` (marca `mode: 'copy'`).
  - [x] `buildDumpCommand(config, options)` que despacha por motor.
- [x] Tests de builders (args, envs y orden de flags).

## 2. Compresión

- [x] `gzipFile(src, dest)` con `node:zlib`.
- [x] `gzipDirToTar(dir, dest)` con `tar -czf`.
- [x] `compressArtifact(source)` → detecta archivo/directorio y devuelve destino.
- [x] Test de `compressArtifact` sobre un archivo temporal (comprime y detecta gzip).

## 3. Fachada de backup

- [x] `validateBackupType(type, dbType)`.
- [x] `runDump(command)` usando `helpers.runProcess`.
- [x] `produceArtifact(config, options)` → `{ file, sizeBytes, checksum }`.

## 4. Servicio y CLI

- [x] `src/services/backup.js` `backupDatabase(options)` invocada solo por app.js.
- [x] Comando `dbu backup <database>` en app.js (sin async, sin run/main).
- [x] Resumen de resultado (status, file, tamaño, duración) en la salida.

## 5. Calidad

- [x] `docs/002-backup-operations.md` con rollback.
- [x] `npm run lint` sin errores.
- [x] `npm test` todo en verde.