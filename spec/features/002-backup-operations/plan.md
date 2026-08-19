# Feature 002 — Backup Operations: Plan

## Contexto

La Feature 001 garantiza conectividad. Esta feature añade el volcado. Se usan los binarios
nativos del motor porque son la única forma de obtener volcados **consistentes** y con el
rendimiento que dictan las bases de datos grandes (streaming, sin cargar todo en memoria).

## Estrategia técnica

1. **`src/lib/backup/commands.js`** — Funciones **puras** que, dado un `config` y `options`,
   devuelven `{ bin, args, env, mode }` para lanzar el volcado:
   - mysql: `mysqldump --host --port --user --password --single-transaction --routines --triggers --databases db --result-file=file`
   - postgres: `pg_dump --host --port --username --dbname --file=file` (password vía `PGPASSWORD`).
   - mongodb: `mongodump --uri --db --archive=file --gzip`.
   - sqlite: no hay binario → marca especial de copia (`mode: 'copy'`).

2. **`src/lib/backup/compress.js`** — `gzipFile` (zlib) y `gzipDirToTar` (tar), con
   `compressArtifact(source) → archivo comprimido`.

3. **`src/lib/backup/index.js`** — Fachada que combina `commands` + `compress`:
   - `validateBackupType(type, dbType)` → asegura full/incremental/differential aceptado.
   - `buildDumpCommand(config, options)` → delega al builder.
   - `runDump(command)` → ejecuta el volcado vía helpers.runProcess y devuelve el archivo.
   - `produceArtifact(config, options)` → genera, comprime y devuelve `{ file, sizeBytes, checksum }`.

4. **`src/services/backup.js`** — Función de negocio **solo invocada por app.js**:
   valida, lanza el volcado, produce el artefacto y devuelve un resumen `{ status, file, size, durationMs }`.
   (La integración con almacenamiento será la Feature 003; el logging, la Feature 004.)

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Binario de volcado no instalado | `runProcess` detecta `ENOENT` y mapea a `DB_CMD_NOT_FOUND`. |
| Passwords con caracteres especiales | MySQL: `--password=` como argumento; Postgres: `PGPASSWORD` en `env`. |
| Incremental no soportado nativamente | `validateBackupType` permite filtrado por `--since/--table`, el resto se documenta. |
| Volcados enormes | Streaming (spawn + pipes); compresión por defecto activa. |

## Plan de tareas

1. Implementar `commands.js` (builders) con tests unitarios.
2. Implementar `compress.js` (gzip/tar) y probar `compressArtifact` sobre archivos temporales.
3. Implementar `backup/index.js` (fachada).
4. Implementar `services/backup.js` (orquestación de negocio).
5. Registrar `dbu backup` en `app.js`.
6. Documentación operativa con rollback en `docs/002-backup-operations.md`.