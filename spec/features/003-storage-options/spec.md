# Feature 003 — Storage Options

- **Estado:** 🟢 Completada
- **Prioridad:** Alta
- **Dependencias:** [Feature 002](../002-backup-operations/spec.md) (artefactos de backup)
- **Documentación operativa:** [docs/003-storage-options.md](../../docs/003-storage-options.md)

## Objetivo

Almacenar los artefactos de backup en **almacenamiento local** o en la **nube**
(AWS S3, Google Cloud Storage, Azure Blob Storage) mediante un **contrato de almacenamiento
único** (`store` / `fetch` / `list`), de modo que el pipeline de backup/restore sea
independiente de la plataforma de destino.

## Alcance

| Almacenamiento | SDK | Operaciones |
|----------------|-----|-------------|
| Local | `node:fs` | copiar a directorio de salida; listar archivos |
| AWS S3 | `@aws-sdk/client-s3` | `PutObjectCommand`, `GetObjectCommand`, `ListObjectsV2Command` |
| Google Cloud Storage | `@google-cloud/storage` | `bucket.upload`, `file.download`, `getFiles` |
| Azure Blob Storage | `@azure/storage-blob` | `BlockBlobClient.uploadFile`, `download`, `listBlobsFlat` |

## Requisitos funcionales

1. **Estrategia por tipo** (`src/lib/storage/index.js`): `getStore(kind, config)`
   devuelve un adaptador con las operaciones `store(localPath, key)` / `fetch(key, destPath)` / `list()`.
2. **Configuración normalizada** desde flags CLI y variables de entorno (`.env`.
   ver `.env.example`): `S3_BUCKET`, `GCS_BUCKET`, `AZURE_CONTAINER`, prefixes, etc.
3. **Integración en backup**: `dbu backup ... --storage <local|s3|gcs|azure>` sube el artefacto
   tras generarlo (Feature 002) y devuelve la clave (key) de almacenamiento.
4. **Listado**: `dbu list-backups --storage <kind>` muestra los artefactos disponibles.
5. **Restauración**: la Feature 005 consumirá `fetch` para descargar artefactos desde la nube.

## Criterios de aceptación

- [ ] `dbu backup sqlite --dbname ./x.db --storage local --out-dir ./backups` deja el `.gz` en la carpeta.
- [ ] `dbu list-backups --storage local --out-dir ./backups` lista los archivos.
- [ ] Un provider sin credenciales devuelve `MISSING_STORAGE_CREDENTIALS` con sugerencia.
- [ ] Un tipo de almacenamiento inválido devuelve `STORAGE_UNSUPPORTED`.
- [ ] Los adaptadores de nube nunca registran credenciales ni connection strings.