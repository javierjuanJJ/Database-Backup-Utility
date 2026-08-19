# 002 — Backup Operations

> Guía operativa de la **Feature 002**: cómo se implementó, cómo funciona, cómo
> usarla y cómo **volver atrás** (rollback).

## 1. Resumen

La CLI genera backups usando los **binarios nativos** de cada motor (`mysqldump`, `pg_dump`,
`mongodump`) y, para SQLite, copia el archivo con checkpoint de WAL (no requiere binarios).
Los artefactos se **comprimen automáticamente** (gzip/tar.gz) y quedan en un directorio de salida.

## 2. Archivos implicados

| Archivo | Responsabilidad |
|---------|-----------------|
| `src/lib/backup/commands.js` | Builders puros de comandos (`buildMysqlDump`, `buildPostgresDump`, `buildMongodump`, `buildSqliteCopy`). |
| `src/lib/backup/compress.js` | `gzipFile` (zlib), `gzipDirToTar` (tar) y `compressArtifact`. |
| `src/lib/backup/index.js` | Fachada: `validateBackupType`, `produceArtifact` (volcado → compresión → staging). |
| `src/services/backup.js` | `backupDatabase(options)` — orquestación de negocio **invocada solo por app.js**. |
| `app.js` | Comando `backup <database>`. |
| `tests/backup.test.mjs` | Tests de builders, validación de tipos y `produceArtifact` (SQLite real). |

## 3. Cómo funciona

1. `dbu backup <motor>` normaliza la conexión (Feature 001) y valida el tipo de backup.
2. `buildDumpCommand` genera los argumentos:

   - **MySQL full:** `mysqldump --host --port --user --password --single-transaction
     --routines --triggers --databases <db> --result-file=<archivo>`.
   - **MySQL diferencial:** añade `--tables <tabla> --where="updated_at > '<since>'"`.
   - **PostgreSQL:** `pg_dump --host --port --username --dbname --file=<archivo>`
     (la contraseña viaja por `PGPASSWORD`). Soporta `--table` y `--schema`.
   - **MongoDB:** `mongodump --uri --db --archive=<archivo> --gzip` (con `--collection`
     y `--query` para selección específica).
   - **SQLite:** copia del archivo (`mode: 'copy'`).
3. El volcado se escribe en un *staging* temporal y luego `compressArtifact` lo comprime
   (`.gz` para archivos, `.tar.gz` para directorios).
4. El artefacto definitivo se mueve a `--out-dir` con el nombre
   `motor__bd__timestamp.sql|.bin|.db (.gz)`.
5. La respuesta del servicio incluye `status`, `file`, `sizeBytes`, `checksum` (`sha256`)
   y duración (el registro persistente llega con la Feature 004).

## 4. Uso

```bash
# Backup full MySQL (comprimido por defecto)
node app.js backup mysql -H 127.0.0.1 -u root -p secret --dbname shop --out-dir ./backups

# Backup full PostgreSQL con tabla específica
node app.js backup postgres -H localhost -u app -p secret --dbname app --table users

# Backup diferencial de una tabla (fila por columna updated_at)
node app.js backup mysql -u root -p secret --dbname shop --type differential \
  --table orders --since 2026-01-01T00:00:00Z

# Backup MongoDB (colección concreta)
node app.js backup mongodb --uri "mongodb://localhost:27017" --dbname app --collection invoices

# Backup SQLite (sin binarios externos) sin comprimir
node app.js backup sqlite --dbname ./data/app.db --no-compress
```

## 5. Rendimiento e impacto en el servidor

- **Streaming**: los volcados se escriben a disco por el propio binario (sin cargar la BD en memoria).
- **`--single-transaction`** (MySQL) evita locks prolongados usando MVCC; para instancias grandes
  con muchos datos se recomienda ejecutar fuera de horas punta.
- **Compresión**: reduce el tamaño en disco y la transferencia posterior (relevante para la Feature 003).
- **Paralelismo del motor**: se respetan los flags nativos del binario (p. ej. `--jobs` de
  pg_dump/mongodump quedan disponibles para evolución futura).

## 6. Pruebas

```bash
npm test        # tests/backup.test.mjs (builders + compresión + SQLite real)
npm run lint
```

## 7. Rollback (cómo volver atrás)

Identifique el commit de esta feature y reviértalo:

```bash
git log --oneline -- src/lib/backup src/services/backup.js app.js
git revert <hash-002>
```

Si solo desea quitar el comando `backup` manteniendo la capa de conectividad:

```bash
git diff <hash-001> <hash-002> -- app.js | git apply -R   # quita la acción y el registro del comando
```

> Advertencia: la Feature 003 (almacenamiento en la nube) y la 005 (restauración) dependen
> de los artefactos producidos aquí. Revertir la 002 rompe ese flujo.