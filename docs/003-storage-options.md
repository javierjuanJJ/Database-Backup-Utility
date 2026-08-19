# 003 — Storage Options

> Guía operativa de la **Feature 003**: cómo se implementó, cómo funciona, cómo
> usarla y cómo **volver atrás** (rollback).

## 1. Resumen

El pipeline de backup (Feature 002) ahora puede dejar el artefacto en **almacenamiento local**
o en la **nube** (AWS S3, Google Cloud Storage, Azure Blob Storage). Se usa un **patrón
estrategia** con un contrato común `{ store, fetch, list }`, de modo que backup y restore sean
independientes del destino.

## 2. Archivos implicados

| Archivo | Responsabilidad |
|---------|-----------------|
| `src/lib/storage/index.js` | Fábrica: `resolveStorageKind`, `buildStorageConfig`, `buildKey`, `assertCredentials`, `getStore`. |
| `src/lib/storage/local.js` | Almacenamiento local (`node:fs`). |
| `src/lib/storage/s3.js` | AWS S3 (`@aws-sdk/client-s3`). |
| `src/lib/storage/gcs.js` | Google Cloud Storage (`@google-cloud/storage`). |
| `src/lib/storage/azure.js` | Azure Blob (`@azure/storage-blob`). |
| `src/services/backup.js` | `storeArtifact` y `listBackups` (orquestación). |
| `app.js` | Opciones `--storage/--bucket/--container/--prefix/--key-file/--conn-string` y comando `list-backups`. |

## 3. Cómo funciona

1. `resolveStorageKind` valida el tipo (`STORAGE_UNSUPPORTED` si no).
2. `buildStorageConfig` normaliza flags CLI + variables de entorno por provider.
3. `assertCredentials` verifica que existan credenciales obligatorias
   (`MISSING_STORAGE_CREDENTIALS` si faltan).
4. `getStore(type, options)` devuelve el adaptador con `store/fetch/list`.
5. `backup --storage <type>` generan el artefacto (002) y lo suben; el resultado incluye
   `storage` y `storageKey`.
6. `list-backups --storage <type>` lista los artefactos del destino.

### Autenticación por provider

- **S3**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET`, `S3_PREFIX`.
- **GCS**: `GCS_BUCKET`, `GCS_KEY_FILE` (o `GOOGLE_APPLICATION_CREDENTIALS`), `GCS_PREFIX`.
- **Azure**: `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_CONTAINER`, `AZURE_PREFIX`
  (alternativa cuenta + `@azure/identity`).

## 4. Uso

```bash
# Local
node app.js backup sqlite --dbname ./data/app.db --storage local --out-dir ./backups
node app.js list-backups --storage local --out-dir ./backups

# AWS S3
node app.js backup postgres -u app -p secret --dbname app --storage s3 --bucket my-bucket
node app.js list-backups --storage s3 --bucket my-bucket

# Google Cloud Storage
node app.js backup mongodb --uri "mongodb://localhost:27017" --dbname app --storage gcs --bucket my-bucket

# Azure Blob Storage
node app.js backup sqlite --dbname ./data/app.db --storage azure --container my-container
```

## 5. Pruebas

```bash
npm test        # tests/storage.test.mjs (config, keys, assertCredentials y adaptador local real)
npm run lint
```

> Los adaptadores de nube **no** se prueban contra proveedores reales (sin credenciales);
> los tests cubren configuración y el contrato local real.

## 6. Seguridad

- Las credenciales solo viajan por entorno/CLI; nunca se registran.
- Los adaptadores devuelven `key` y metadatos, nunca secretos ni connection strings.
- `storage/local` protege contra *path traversal* (la clave debe estar bajo el directorio).

## 7. Rollback (cómo volver atrás)

Identifique y revierta el commit de esta feature:

```bash
git log --oneline -- src/lib/storage src/services/backup.js app.js
git revert <hash-003>
```

> Si solo quiere quitar la subida a la nube pero conservar `list-backups` local, puede mantener
> `--storage local` (valor por defecto). La Feature 005 (restauración) depende del contrato
> `fetch`/`list` que se crea aquí, así que revertir la 003 recomienda también revisar la 005.