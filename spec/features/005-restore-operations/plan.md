# Feature 005 — Restore Operations: Plan

## Contexto

El ciclo de vida del backup se cierra con la restauración. El artefacto (local o nube) debe
poder devolverse a la base de datos, con soporte selectivo y registro consistente.

## Estrategia técnica

1. **Resolución de origen** en `services/restore.js`:
   - Ruta local existente → usar de forma directa.
   - URI `s3://|gcs://|azure://|local://` → parsear y descargar a un *staging* temporal.
   - Si se indica `--storage` (no local) y el origen no es local → tratar el origen como clave/key.
   - Si no se encuentra → `FILE_NOT_FOUND`.

2. **Preparación del artefacto** (`src/lib/restore/index.js`):
   - `decompressIfNeeded(src, dir)` descomprime gzip solo para motores SQL (mysqldump/psql
     consumen texto plano). Para MongoDB se pasa el `.gz` directamente a `mongorestore --gzip`.

3. **Comandos de restauración** (`src/lib/restore/commands.js`):
   - MySQL: `mysql -h --port --user --password --dbname` leyendo del **stdin**
     (se extiende `runProcess` con `inputFile`).
   - PostgreSQL: `psql --host --port --username --dbname --file <dump>` (password por `PGPASSWORD`).
   - MongoDB: `mongorestore --uri --gzip --drop --archive <file>` (+ `--nsInclude` selectivo).
   - SQLite: copia del archivo descomprimido al path de destino con `rename` atómico.

4. **Orquestación** en `services/restore.js`: START/END/ERROR con logger y Slack (Feature 004),
   re-lanzando la excepción para que `app.js` la presente.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Restauración a «medias» en SQLite | Copia a archivo temporal + `fs.renameSync` atómico. |
| Volcado enorme por stdin | Pipe de stream (`inputFile`) sin buffering. |
| Artefacto corrupto | El `--drop` y el error de `mongorestore`/`psql` se capturan como `RESTORE_FAILED`. |
| Origen ambiguo | Habilitar el parseo de URIs `s3://` etc. documentado. |

## Plan de tareas

1. Extender `runProcess` con soporte de `inputFile` (stdin).
2. Implementar `restore/commands.js` (builders por motor).
3. Implementar `restore/index.js` (descompresión y ejecución).
4. Implementar `services/restore.js` (resolución de origen + orquestación con logger/Slack).
5. Registrar `dbu restore` en `app.js`.
6. Documentación operativa con rollback en `docs/005-restore-operations.md`.