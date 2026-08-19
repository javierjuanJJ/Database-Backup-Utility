# Feature 002 — Backup Operations

- **Estado:** 🟢 Completada
- **Prioridad:** Alta
- **Dependencias:** [Feature 001](../001-database-connectivity/spec.md) (conectividad)
- **Documentación operativa:** [docs/002-backup-operations.md](../../docs/002-backup-operations.md)

## Objetivo

Generar backups de bases de datos mediante los **binarios nativos** de cada motor
(`mysqldump`, `pg_dump`, `mongodump`), con tipos de backup (full/incremental/diferencial),
**compresión automática** (gzip/tar.gz) y consideraciones de rendimiento en bases de datos grandes.

## Alcance

### Tipos de backup por motor

| Motor | Full | Incremental / Diferencial automático | Detalle |
|-------|------|---------------------------------------|---------|
| MySQL/MariaDB | ✅ | ⚠️ Parcial | `--where="fecha > since"` sobre tablas concretas; incremental nativo real requiere binlog. |
| PostgreSQL | ✅ | ⚠️ Parcial | Volcado `--table` selectivo; incremental nativo real requiere WAL archiving externo. |
| MongoDB | ✅ | ⚠️ Parcial | `--collection` + `--query` filtrado; incremental nativo requiere Oplog. |
| SQLite | ✅ | ❌ | Se copia el archivo con checkpoint WAL; sin incremental. |

### Compresión

- **gzip** para archivos únicos (`.sql.gz`) mediante `node:zlib`.
- **tar.gz** para directorios (`.tar.gz`) mediante `tar` (binario estándar del SO).
- Por defecto el backup queda **comprimido** (`--no-compress` para desactivarlo).

## Requisitos funcionales

1. **`dbu backup <database>`** genera el artefacto en un directorio de salida.
2. Flags: `--type <full|incremental|differential>`, `--table <nombre>`, `--since <ISO>`,
   `--out-dir <dir>`, `--no-compress`.
3. El artefacto resultante sigue la convención `motor__db__timestamp.sql[.gz]`.
4. Se registran **start/end, duración, tamaño y estado** en la respuesta del servicio
   (el registro persistente corresponderá a la Feature 004).
5. **Rendimiento**: volcados en streaming (sin cargar todo en memoria) y compresión opcional.

## Criterios de aceptación

- [ ] `dbu backup mysql --dbname x --user u --password p` produce `x__mysql__<ts>.sql.gz`.
- [ ] `--type differential --since <ISO> --table t` filtra filas según la columna de fecha.
- [ ] Un binario ausente (`mysqldump` no instalado) devuelve `DB_CMD_NOT_FOUND` con sugerencia.
- [ ] `--no-compress` deja el archivo sin comprimir.
- [ ] Los builders de comandos están cubiertos por tests unitarios (sin BD reales).