# Feature 003 — Storage Options: Plan

## Contexto

El pipeline de backup genera artefactos locales (Feature 002). Esta feature abstrae el destino:
el mismo artefacto debe poder quedar en disco, en S3, en GCS o en Azure sin cambiar la lógica
de backup. Se adopta un **patrón estrategia** con un contrato común.

## Estrategia técnica

1. **Contrato de almacenamiento** (todos los adaptadores devuelven escalares simples):
   ```js
   store(localPath, key)   // sube el archivo local bajo la clave key
   fetch(key, destPath)    // descarga el objeto con clave key a destPath
   list()                  // devuelve [{ key, size, modifiedAt }]
   ```

2. **`src/lib/storage/index.js`**
   - `resolveStorageKind(kind)` → valida contra `CONSTS.STORAGE_TYPES` (`STORAGE_UNSUPPORTED`).
   - `buildStorageConfig(kind, options, env)` → normaliza flags + entorno por provider.
   - `buildKey(config, fileName)` → aplica el `prefix` configurado a un nombre de archivo.
   - `getStore(kind, config)` → devuelve el adaptador correspondiente.

3. **Adaptadores**
   - `local.js` → copia el archivo a `config.directory`.
   - `s3.js` → `@aws-sdk/client-s3` (`PutObjectCommand` con `Body` un stream, `GetObjectCommand`
     con pipe a disco, `ListObjectsV2Command`).
   - `gcs.js` → `@google-cloud/storage` (`bucket.upload`, `file.download({ destination })`,
     `bucket.getFiles({ prefix })`).
   - `azure.js` → `@azure/storage-blob` (`BlockBlobClient.uploadFile`, `download().readableStreamBody`
     a disco, `listBlobsFlat`).

4. **Seguridad**: las credenciales solo llegan por entorno/CLI; los adaptadores devuelven keys y
   metadatos, nunca secretos.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Faltan credenciales de nube | Se detecta antes de construir el cliente → `MISSING_STORAGE_CREDENTIALS`. |
| Streams de descarga que no se consumen (S3/Azure) | Siempre se hace pipe a un writable o se consume el stream. |
| Nombres duplicados entre backups | El `prefix` + timestamp de la Feature 002 garantiza unicidad de keys. |
| Volcados grandes | Upload/descarga por streaming (nunca buffering completo en memoria). |

## Plan de tareas

1. Implementar `storage/index.js` (validación, configuración, keys, factory).
2. Implementar adaptador `local.js` con tests reales sobre carpetas temporales.
3. Implementar `s3.js`, `gcs.js`, `azure.js` (clientes perezosos) con tests de configuración.
4. Integrar la subida en `services/backup.js` (`--storage`) y añadir `list-backups` en `app.js`.
5. Documentación operativa con rollback en `docs/003-storage-options.md`.
6. Validar con `npm run lint` y `npm test` (sin tocar la nube).