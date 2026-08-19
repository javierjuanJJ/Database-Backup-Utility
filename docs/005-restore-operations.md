# 005 — Restore Operations

> Guía operativa de la **Feature 005**: cómo se implementó, cómo funciona, cómo
> usarla y cómo **volver atrás** (rollback).

## 1. Resumen

La CLI restaura una base de datos desde un artefacto de backup, bien **completo** o bien
**selectivo** (tabla/colección) cuando el motor lo permite. El origen puede ser una **ruta local**,
una **URI `scheme://`** o una **clave/key** del almacenamiento configurado (Feature 003).

## 2. Archivos implicados

| Archivo | Responsabilidad |
|---------|-----------------|
| `src/lib/restore/commands.js` | Builders de comandos (`buildMysqlRestore`, `buildPostgresRestore`, `buildMongoRestore`, `buildSqliteRestore`). |
| `src/lib/restore/index.js` | `decompressIfNeeded`, `atomicCopy`, `runRestore`. |
| `src/services/restore.js` | `restoreDatabase` y `resolveSource` (orquestación con logger/Slack). |
| `src/utils/helpers.js` | `runProcess` ampliado con `inputFile` (alimenta stdin). |
| `app.js` | Comando `restore <database> <source>`. |

## 3. Cómo funciona

1. `resolveSource` determina el origen:
   - Ruta local existente → se usa directamente.
   - URI `s3://bucket/key`, `gcs://bucket/key`, `azure://container/key`, `local://ruta`.
   - Si no es local y hay `--storage` configurado → el origen se trata como **clave/key**.
2. Se descarga (si procede) a un *staging* temporal y se **descomprime** el gzip (solo para los
   motores SQL; MongoDB pasa el `.gz` directamente a `mongorestore --gzip`).
3. Se ejecuta el comando de restauración:
   - **MySQL**: `mysql -h --port --user --password --dbname` **por stdin**.
   - **PostgreSQL**: `psql --set ON_ERROR_STOP=on ... --file <dump>` (password por `PGPASSWORD`).
   - **MongoDB**: `mongorestore --uri --gzip --drop --archive <file>` (+ `--nsInclude` selectivo).
   - **SQLite**: copia del archivo descomprimido al destino con **`rename` atómico**.
4. Se registra `START`/`END`/`ERROR` (Feature 004) y se notifica a Slack si procede.

## 4. Uso

```bash
# Desde una ruta local (SQLite)
node app.js restore sqlite ./backups/app.db.gz --dbname ./restored/app.db

# Desde el almacenamiento por URI (S3)
node app.js restore postgres s3://my-bucket/db-backups/app.sql.gz -u app -p secret --dbname app

# Desde una clave mediante --storage (GCS/Azure)
node app.js restore mysql db-backups/app.sql.gz --storage gcs --bucket my-bucket -u root -p secret --dbname app

# Restauración selectiva de una colección MongoDB
node app.js restore mongodb ./backups/app.bin.gz --collection orders --uri "mongodb://localhost:27017" --dbname app
```

## 5. Pruebas

```bash
npm test        # tests/restore.test.mjs (builders, stdin, restore SQLite real, resolveSource)
npm run lint
```

> La restauración real de MySQL/PostgreSQL/MongoDB requiere sus binarios y una BD de destino;
> los tests cubren los builders y el flujo SQLite completo sin servidores.

## 6. Rollback (cómo volver atrás)

Revertir el commit de esta feature:

```bash
git log --oneline -- src/lib/restore src/services/restore.js app.js
git revert <hash-005>
```

> Revertir la 005 deja las features 001–004 operativas pero sin capacidad de restaurar
> (solo quedaría el backup y el almacenamiento).