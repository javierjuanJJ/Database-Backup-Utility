# Database Backup Utility

CLI universal de **backup y restauración** de bases de datos multiplataforma (Windows, Linux, macOS)
para **MySQL, PostgreSQL, MongoDB y SQLite**, con almacenamiento **local** y en la **nube**
(AWS S3, Google Cloud Storage, Azure Blob Storage) y notificaciones **Slack**.

Desarrollado bajo la metodología **Spec-Driven Development (SDD)** / *Loop Engineering*:
cada característica se especifica previamente en `spec/features/`, se documenta en `docs/`
(incluyendo cómo revertirla) y se entrega con un commit propio.

## Características

| # | Feature | Descripción |
|---|---------|-------------|
| 001 | [Database Connectivity](spec/features/001-database-connectivity/spec.md) | Conexión y testeo de credenciales a MySQL, PostgreSQL, MongoDB y SQLite. |
| 002 | [Backup Operations](spec/features/002-backup-operations/spec.md) | Backup full/incremental/diferencial con compresión gzip/tar. |
| 003 | [Storage Options](spec/features/003-storage-options/spec.md) | Almacenamiento local + AWS S3, Google Cloud Storage, Azure Blob. |
| 004 | [Logging & Notifications](spec/features/004-logging-and-notifications/spec.md) | Logs detallados (timestamps, duración, estado) y Slack opcional. |
| 005 | [Restore Operations](spec/features/005-restore-operations/spec.md) | Restauración completa y selectiva desde local y nube. |

Requisitos previos: Node.js >= 22.5, y los binarios de volcado de cada motor
(`mysqldump`, `pg_dump`, `mongodump`/`mongorestore`). SQLite no requiere binarios externos.

## Instalación

```bash
npm install
npm run build        # valida sintaxis y genera el cliente Prisma
```

Instale los clientes de base de datos según los motores que use:

```bash
# Debian/Ubuntu
sudo apt install mysql-client postgresql-client mongodb-database-tools
# macOS (Homebrew)
brew install mysql-client postgresql mongodb-database-tools
# Windows (Chocolatey/Scoop)
choco install mysql-cli postgresql mongodb-database-tools
```

## Uso

```bash
node app.js --help
node app.js backup --help
```

### Probar conexión (Feature 001)

```bash
node app.js test-connection mysql -H 127.0.0.1 -P 3306 -u root -p secret --dbname mydb
node app.js test-connection mongodb --uri "mongodb://localhost:27017"
node app.js test-connection sqlite --dbname ./data/app.db
```

### Backup (Features 002 y 003)

```bash
# Backup full local (comprimido por defecto)
node app.js backup postgres -H localhost -u app -p secret --dbname app --storage local --out-dir ./backups

# Backup subido a AWS S3
node app.js backup mysql -u root -p secret --dbname shop --storage s3 --bucket my-bucket

# Backup subido a Google Cloud Storage
node app.js backup mongodb --uri "mongodb://localhost:27017" --dbname mydb --storage gcs --bucket my-bucket

# Backup subido a Azure Blob Storage
node app.js backup sqlite --dbname ./data/app.db --storage azure --container my-container
```

### Listar backups (Feature 003)

```bash
node app.js list-backups --storage s3 --bucket my-bucket
```

### Restaurar (Feature 005)

```bash
# Restauración completa desde un archivo local
node app.js restore postgres ./backups/file.sql -H localhost -u app -p secret --dbname app

# Restauración selectiva de tablas (PostgreSQL)
node app.js restore postgres ./backups/file.sql --table mytable -H localhost -u app -p secret --dbname app

# Restauración desde almacenamiento en la nube
node app.js restore mongodb s3://my-bucket/archive.gz --uri "mongodb://localhost:27017" --dbname mydb
```

## Variables de entorno

Copie `.env.example` a `.env` y complete las credenciales de bases de datos y de los
proveedores de nube y webhook de Slack. Los flags CLI tienen prioridad sobre `.env`.

## Arquitectura

Ver [spec/constitution/tech-stack.md](spec/constitution/tech-stack.md) para la arquitectura completa.

- **`app.js`** — único entrypoint orquestador. No tiene funciones `async` ni métodos
  `run`/`main`; arranca en el *top-level* mediante cadenas de promesas y es el único encargado
  de presentar errores con sugerencias (`try/catch` síncrono + `.catch` asíncrono).
- **`src/consts/`** — constantes y catálogo de errores.
- **`src/lib/`** — infraestructura: `db/`, `backup/`, `storage/`, `logger/`.
- **`src/services/`** — funciones de negocio que **solo app.js** invoca.
- **`src/utils/`** — helpers puros.
- **`spec/`** — especificaciones (constitution + features).
- **`docs/`** — documentación operativa por feature (incluye cómo revertir cada una).

## Comandos de desarrollo

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Ejecuta la CLI en modo watch. |
| `npm test` | Ejecuta la suite de pruebas (Vitest). |
| `npm run lint` | Lint de todo el código (ESLint). |
| `npm run build` | Valida sintaxis de todos los archivos JS. |
| `npm run generate` | Genera el cliente Prisma desde el schema. |
| `npm run package` | Genera `database-backup-utility-spec.zip`. |

## Hoja de ruta

Ver [spec/constitution/roadmap.md](spec/constitution/roadmap.md).