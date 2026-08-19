# Feature 003 — Storage Options: Tasks

## 1. Núcleo de almacenamiento

- [x] `src/lib/storage/index.js`:
  - [x] `resolveStorageKind(kind)` con `STORAGE_UNSUPPORTED`.
  - [x] `buildStorageConfig(kind, options, env)` por provider.
  - [x] `buildKey(config, fileName)` con prefijo.
  - [x] `getStore(kind, config)` factory de adaptadores.

## 2. Adaptadores

- [x] `local.js` — `store`/`fetch`/`list` con `node:fs`.
- [x] `s3.js` — `@aws-sdk/client-s3` (`PutObject` stream, `GetObject` pipe, `ListObjectsV2`).
- [x] `gcs.js` — `@google-cloud/storage` (`bucket.upload`, `file.download`, `getFiles`).
- [x] `azure.js` — `@azure/storage-blob` (`uploadFile`, `download` stream, `listBlobsFlat`).

## 3. Integración con backup

- [x] `services/backup.js` sube el artefacto con `--storage <kind>` y devuelve `storageKey`.
- [x] `app.js`: opción `--storage`, flags de bucket/container/prefix y comando `list-backups`.
- [x] `services/backup.js`: función `listBackups(options)`.

## 4. Calidad

- [x] Tests de `buildStorageConfig`/`buildKey` y de adaptador `local` (carpeta temporal real).
- [x] `docs/003-storage-options.md` con rollback.
- [x] `npm run lint` sin errores y `npm test` en verde.