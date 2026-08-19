# Feature 005 — Restore Operations

- **Estado:** 🟢 Completada
- **Prioridad:** Alta
- **Dependencias:** [001](../001-database-connectivity/spec.md), [002](../002-backup-operations/spec.md), [003](../003-storage-options/spec.md), [004](../004-logging-and-notifications/spec.md)
- **Documentación operativa:** [docs/005-restore-operations.md](../../docs/005-restore-operations.md)

## Objetivo

Restaurar una base de datos desde un artefacto de backup (generado por la Feature 002 y,
opcionalmente, almacenado en la nube por la Feature 003), de forma **completa o selectiva**
cuando el DBMS lo permita.

## Alcance

| Motor | Restauración completa | Restauración selectiva |
|-------|-----------------------|------------------------|
| MySQL | `mysql < dump.sql` | ⚠️ mediante volcado selectivo previo (dump por tablas) |
| PostgreSQL | `psql -f dump.sql` | ✅ `--table` (si el dump lo trae) / `pg_restore` |
| MongoDB | `mongorestore --archive --gzip --drop` | ✅ `--nsInclude db.collection` |
| SQLite | copia del archivo restaurado al path de destino | — |

## Requisitos funcionales

1. **`dbu restore <database> <source>`** donde `<source>` es:
   - una ruta de archivo local, o
   - una clave/key del almacenamiento configurado (`--storage`), o
   - una URI `s3://bucket/key`, `gcs://bucket/key`, `azure://container/key`, `local://ruta`.
2. Descompresión automática si el artefacto está en gzip.
3. `--table`/`--collection` para restauración selectiva cuando el motor lo permita.
4. Logging (`--log-dir`) y notificación Slack (`--slack-webhook`) igual que en backup.
5. Restauración SQLite nunca debe dejar a medias la copia (se usa archivo temporal y `rename` atómico).

## Criterios de aceptación

- [ ] `dbu restore sqlite ./backups/app.db.gz --dbname ./restored/app.db` restaura el archivo.
- [ ] `dbu restore mysql /bak/x.sql.gz -u root -p secret --dbname app` ejecuta el volcado vía stdin.
- [ ] `dbu restore mongodb --uri ... --dbname app --collection orders` añade `--nsInclude`.
- [ ] Una clave inexistente en el almacenamiento devuelve `STORAGE_DOWNLOAD_FAILED`/`FILE_NOT_FOUND`.
- [ ] El restore registra `START`/`END` e informa del resultado.