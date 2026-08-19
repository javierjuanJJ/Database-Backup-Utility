# Tech Stack

Documento de referencia tecnológica del proyecto. Especifica las tecnologías, la arquitectura de
módulos, los comandos disponibles y las convenciones que todo contribuyente debe respetar.

## 1. Tecnologías

| Capa | Tecnología | Versión | Justificación |
|------|-----------|---------|---------------|
| Runtime | Node.js | **>= 20 (LTS recomendado: 22)** | Streams nativos, `fetch` global, `node:sqlite` (22+), `--watch`. |
| CLI | Commander.js | 12.x | Definición declarativa de comandos, opciones y ayuda con salida estándar. |
| Testing | Vitest | 3.x | Runner moderno con ESM/CJS, mocking sencillo y *watch mode*. |
| Lint | ESLint | 9.x (flat config) | Reglas de estilo y detección de errores en código común. |
| Conexión MySQL | `mysql2` | 3.x | Driver maduro con API de promesas. |
| Conexión PostgreSQL | `pg` | 8.x | Driver oficial de PostgreSQL. |
| Conexión MongoDB | `mongodb` | 6.x | Driver oficial; usa las convenciones de URI y API documentadas por MongoDB. |
| SQLite | `node:sqlite` (built-in) | 22+ | Sin dependencias nativas; multiplataforma por construcción. |
| Prisma | `prisma` / `@prisma/client` | 6.x | Modelado del dominio de metadatos (schema) y formato oficial de conexión (convención de URLs). Ver `prisma/schema.prisma`. |
| Almacenamiento AWS | `@aws-sdk/client-s3` | 3.x | SDK oficial v3 (modular). `GetObjectCommand`, `PutObjectCommand`, `HeadObjectCommand`. |
| Almacenamiento GCS | `@google-cloud/storage` | 7.x | SDK oficial; upload/download con streams. |
| Almacenamiento Azure | `@azure/storage-blob` | 12.x | SDK oficial; `BlockBlobClient.uploadFile/download`. |
| Empaquetado del ZIP | `archiver` | 7.x | Genera `.zip` multiplataforma desde Node. |

> **Nota sobre Prisma:** el proyecto usa **las convenciones de conexión documentadas por Prisma**
> (formato de URL y datasources de `prisma/schema.prisma`) como referencia única para construir
> los parámetros de conexión de motores relacionales, y opcionalmente como validador de conexión
> cuando se dispone de una `DATABASE_URL`. El pipeline de backup/restore real usa los binarios
> nativos (`mysqldump`, `pg_dump`, `mongodump`, `mongorestore`) y drivers ligeros, que es el
> estándar de facto para volcados consistentes.

## 2. Archivos y módulos clave

```
.
├── app.js                        # ÚNICO entrypoint orquestador (sin lógica de negocio)
├── package.json                  # Scripts, dependencias, binario `dbu`
├── prisma/
│   └── schema.prisma             # Modelo de dominio (Backup, BackupLog) y datasources
├── docs/                         # Documentación operativa por feature (incluye rollback)
├── scripts/
│   ├── check-all.js              # Validación de sintaxis de todo el código (npm run build)
│   └── package-zip.js            # Genera database-backup-utility-spec.zip
├── spec/
│   ├── constitution/             # Misión, stack y hoja de ruta
│   └── features/                 # 001..005: spec.md, plan.md, tasks.md
└── src/
    ├── consts/index.js           # Constantes, códigos de error y catálogo de sugerencias
    ├── lib/
    │   ├── db/                   # Conexión y testeo (mysql, postgres, mongodb, sqlite, prisma)
    │   ├── backup/               # Construcción de comandos de volcado + compresión
    │   ├── storage/              # Estrategias de almacenamiento (local, s3, gcs, azure)
    │   └── logger/               # Logging detallado + notificaciones (slack)
    ├── services/                 # Orquestación de negocio (backup.js, restore.js)
    └── utils/helpers.js          # Utilidades puras (formatos, paths, ejecución de procesos)
```

### Responsabilidades

- **`app.js`** — Define el árbol de comandos Commander, enlaza las opciones CLI y **es la única
  unidad que captura excepciones principales** (`try/catch` para errores síncronos y `.catch`
  para asíncronos), mostrando mensajes con sugerencia de solución.
- **`src/consts/index.js`** — Catálogo central de constantes: motores soportados, tipos de backup,
  tipos de almacenamiento, códigos de salida y catálogo de errores `ERROR_CATALOG`.
- **`src/lib/db/*`** — Todo lo relacionado con conectarse y validar credenciales de cada motor.
- **`src/lib/backup/*`** — Genera los argumentos de `mysqldump`/`pg_dump`/`mongodump`/SQLite y
  aplica compresión (gzip/tar.gz).
- **`src/lib/storage/*`** — Implementa el contrato `store/fetch/list` para local, S3, GCS y Azure.
- **`src/lib/logger/*`** — Registro estructurado (inicio/fin/duración/estado) y Slack.
- **`src/services/*`** — Funciones de negocio que **solo `app.js` invoca**. Combinan los módulos.
- **`src/utils/helpers.js`** — Funciones puras y reutilizables sin efecto de red.

## 3. Comandos

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Ejecuta `app.js` en modo watch (recarga al guardar cambios). |
| `npm test` | Ejecuta la suite de pruebas con Vitest (una sola pasada). |
| `npm run lint` | Ejecuta ESLint sobre todo el repositorio. |
| `npm run build` | Valida la sintaxis de todos los archivos JS (`node --check`) y genera el cliente Prisma. |
| `npm run generate` | Regenera el cliente Prisma desde `prisma/schema.prisma`. |
| `npm run package` | Empaqueta el proyecto en `database-backup-utility-spec.zip`. |

## 4. Modelo de datos / dominio

### 4.1 Config de conexión (`DBConnectionConfig`)

```js
{
  type: 'mysql' | 'postgres' | 'mongodb' | 'sqlite',
  host: string,        // 127.0.0.1
  port: number|null,   // 3306, 5432, 27017
  user: string|null,
  password: string|null,
  database: string,    // dbname o path al archivo en SQLite
  uri: string|null,    // sobrescribe host/port/user/pass (MongoDB o cadena estándar)
  options: { schema?: string } // p. ej. schema PostgreSQL
}
```

### 4.2 Metadata de backup (`backup.json`)

```js
{
  id: string,            // uuid v4
  database: string,
  type: 'mysql' | 'postgres' | 'mongodb' | 'sqlite',
  backupType: 'full' | 'incremental' | 'differential',
  startedAt: ISO8601,
  finishedAt: ISO8601,
  durationMs: number,
  status: 'success' | 'failed',
  sizeBytes: number,
  compressed: boolean,
  file: string,           // nombre del artefacto
  storage: 'local' | 's3' | 'gcs' | 'azure',
  checksum: string        // sha256 del artefacto
}
```

### 4.3 Logs

- Log de consola: texto plano humano legible.
- Log de archivo: **JSON Lines** (`logs/app-YYYYMMDD.jsonl`) con nivel, timestamp, evento y contexto.
- Eventos: `START`, `END`, `ERROR`, `NOTIFY` con `startedAt`, `finishedAt` y `durationMs`.

### 4.4 Tipos de almacenamiento

```js
{ kind: 'local', options: { directory: './backups' } }
{ kind: 's3',    options: { bucket: string, prefix: string, region: string } }
{ kind: 'gcs',   options: { bucket: string, prefix: string, keyFile: string } }
{ kind: 'azure', options: { container: string, prefix: string, connectionString: string } }
```

## 5. Convenciones

- **Funciones puras y pequeñas**: cada función hace una sola cosa; las que tocan I/O reciben sus
  dependencias por parámetro cuando sea razonable (inyección simple).
- **Modularidad por carpetas**: `consts/` (datos), `lib/` (infraestructura), `services/` (negocio),
  `utils/` (helpers puros).
- **Manejo modular de errores**: toda excepción se codifica (`AppError`) y se traduce a un mensaje
  con sugerencia de solución vía `ERROR_CATALOG`.
- **Idioma**: código/comentarios en **inglés**; documentación (`README`, `docs/`, `spec/`)
  en **español** salvo identificadores técnicos.

## 6. Límites duros (reglas arquitectónicas inviolables)

1. `app.js` es el **único** archivo ejecutable padre y el **único** orquestador de errores
   principales (bloques `try/catch` y `.catch` de primer nivel).
2. `app.js` **no puede contener funciones `async`** ni métodos `run`/`main` para arrancar:
   la aplicación arranca en el *top-level* del módulo mediante cadenas de promesas.
3. Separación estricta por carpetas: `src/consts/` (datos), `src/lib/` (infraestructura),
   `src/services/` (negocio). **No** hay lógica de base de datos en el entrypoint.
4. Ningún credencial se escribe en logs, metadatos ni en el código fuente.
5. Ningún módulo distinto de `app.js` captura excepciones de orquestación: los módulos lanzan,
   `app.js` decide cómo presentarlas.