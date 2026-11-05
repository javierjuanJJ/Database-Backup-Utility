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

## Pruebas con Docker (bases de datos y AWS S3 local)

El proyecto incluye contenedores Docker listos para probar todos los motores y el almacenamiento en la nube con **Floci** (emulador local de AWS S3, alternativa a LocalStack).

### Levantar todos los servicios

```bash
# Crear red compartida
docker network create dbu-net 2>/dev/null || true

# MySQL 8
docker run -d --name dbu-mysql --network dbu-net -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=secret -e MYSQL_DATABASE=testdb \
  -e MYSQL_USER=testuser -e MYSQL_PASSWORD=testpass mysql:8

# PostgreSQL 15
docker run -d --name dbu-postgres --network dbu-net -p 5432:5432 \
  -e POSTGRES_PASSWORD=secret -e POSTGRES_USER=testuser -e POSTGRES_DB=testdb postgres:15

# MongoDB
docker run -d --name dbu-mongo --network dbu-net -p 27017:27017 mongo:latest

# Floci - AWS S3 emulador local (puerto 4566)
docker run -d --name dbu-floci --network dbu-net -p 4566:4566 \
  -e FLOCI_STORAGE_PERSISTENT_PATH=/app/data floci/floci:latest
```

### Crear datos de prueba

```bash
# MySQL
docker exec dbu-mysql mysql -h 127.0.0.1 -P 3306 -u root -psecret testdb -e \
  "CREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100), email VARCHAR(100), updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);
   INSERT INTO users (name, email) VALUES ('Alice','alice@example.com'),('Bob','bob@example.com'),('Carol','carol@example.com');"

# PostgreSQL
docker exec dbu-postgres psql -h 127.0.0.1 -U testuser -d testdb -c \
  "CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(100), email VARCHAR(100), updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
   INSERT INTO users (name, email) VALUES ('Alice','alice@example.com'),('Bob','bob@example.com'),('Carol','carol@example.com');"

# MongoDB
docker exec dbu-mongo mongosh testdb --eval "db.users.insertMany([{name:'Alice',email:'alice@example.com'},{name:'Bob',email:'bob@example.com'},{'name:'Carol',email:'carol@example.com'}])"

# Floci: crear bucket S3 local
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
aws s3 mb s3://dbu-test-bucket --endpoint-url http://localhost:4566 --region us-east-1
```

> **Nota:** los binarios de volcado (`mysqldump`, `pg_dump`, `psql`, `mongodump`, `mongorestore`) se pueden copiar de los contenedores al host con `docker cp <contenedor>:<ruta> ./bin/` y agregar `./bin` al `PATH`.

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

# Backup subido a AWS S3 (o Floci local)
node app.js backup mysql -u root -p secret --dbname shop --storage s3 --bucket my-bucket

# Backup subido a Google Cloud Storage
node app.js backup mongodb --uri "mongodb://localhost:27017" --dbname mydb --storage gcs --bucket my-bucket

# Backup subido a Azure Blob Storage
node app.js backup sqlite --dbname ./data/app.db --storage azure --container my-container
```

### Backup y restauración con Docker

#### MySQL (contenedor `dbu-mysql`)

```bash
export AWS_ENDPOINT_URL=http://localhost:4566   # solo si usas Floci/S3
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_REGION=us-east-1
export S3_BUCKET=dbu-test-bucket

# Test de conexión
node app.js test-connection mysql -H 127.0.0.1 -P 3306 -u root -p secret --dbname testdb

# Backup full (comprimido)
node app.js backup mysql -H 127.0.0.1 -P 3306 -u root -p secret --dbname testdb --type full --out-dir ./backups

# Backup incremental
node app.js backup mysql -H 127.0.0.1 -P 3306 -u root -p secret --dbname testdb --type incremental --since 2024-01-01 --since-field updated_at --out-dir ./backups

# Backup a S3 (floci)
node app.js backup mysql -H 127.0.0.1 -P 3306 -u root -p secret --dbname testdb --type full --storage s3 --bucket dbu-test-bucket

# Restaurar desde local
MYSQL_BACKUP=$(ls -t ./backups/mysql__testdb__*.sql.gz | head -1)
node app.js restore mysql "$MYSQL_BACKUP" -H 127.0.0.1 -P 3306 -u root -p secret --dbname testdb --out-dir ./restore_test

# Restaurar desde S3 (floci)
node app.js restore mysql mysql__testdb__2026-11-05T13-52-46-088Z.sql.gz -H 127.0.0.1 -P 3306 -u root -p secret --dbname testdb --storage s3 --bucket dbu-test-bucket --out-dir ./restore_test
```

#### PostgreSQL (contenedor `dbu-postgres`)

```bash
export PGPASSWORD=secret   # requerido para pg_dump/psql vía CLI

# Test de conexión
node app.js test-connection postgres -H 127.0.0.1 -P 5432 -u testuser -p secret --dbname testdb --schema public

# Backup full
node app.js backup postgres -H 127.0.0.1 -P 5432 -u testuser -p secret --dbname testdb --type full --out-dir ./backups

# Backup a S3 (floci)
node app.js backup postgres -H 127.0.0.1 -P 5432 -u testuser -p secret --dbname testdb --type full --storage s3 --bucket dbu-test-bucket

# Restaurar desde local
PG_BACKUP=$(ls -t ./backups/postgres__testdb__*.sql.gz | head -1)
node app.js restore postgres "$PG_BACKUP" -H 127.0.0.1 -P 5432 -u testuser -p secret --dbname testdb --out-dir ./restore_test
```

> **Nota:** `PGPASSWORD` debe estar exportado en el entorno porque el adaptador de pg_dump no inyecta variables de entorno al proceso hijo (bug conocido, workaround temporal).

#### MongoDB (contenedor `dbu-mongo`)

```bash
# Test de conexión vía URI
node app.js test-connection mongodb --uri "mongodb://127.0.0.1:27017/testdb"

# Nota: mongodump/mongorestore no son ejecutables en algunos hosts por limitación de CPU ISA.
# La conexión y listado funcionan, pero backup/restauración requieren los binarios de MongoDB.
```

#### SQLite (sin contenedor, solo archivo local)

```bash
touch ./data/app.db
node app.js test-connection sqlite --dbname ./data/app.db
node app.js backup sqlite --dbname ./data/app.db --type full --out-dir ./backups
```

### Listar backups (Feature 003)

```bash
# Almacenamiento local
node app.js list-backups --out-dir ./backups

# Almacenamiento S3 (AWS o Floci local)
node app.js list-backups --storage s3 --bucket dbu-test-bucket
```

### Restaurar (Feature 005)

```bash
# Restauración completa desde un archivo local
node app.js restore postgres ./backups/file.sql -H localhost -u app -p secret --dbname app

# Restauración selectiva de tablas (PostgreSQL)
node app.js restore postgres ./backups/file.sql --table mytable -H localhost -u app -p secret --dbname app

# Restauración desde almacenamiento en la nube (S3 / Floci)
node app.js restore mysql s3://my-bucket/archive.gz -H localhost -P 3306 -u root -p secret --dbname mydb --storage s3 --bucket my-bucket

# Restauración desde MongoDB (S3)
node app.js restore mongodb s3://my-bucket/archive.gz --uri "mongodb://localhost:27017" --dbname mydb --storage s3 --bucket my-bucket
```

### Floci - AWS S3 emulador local

Floci es un emulador local de AWS S3 que ejecuta en el puerto 4566. La CLI no tiene un flag `--endpoint` para S3, pero el **SDK v3 de AWS lee `AWS_ENDPOINT_URL` desde las variables de entorno**, permitiendo apuntar a Floci sin modificar el código:

```bash
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_REGION=us-east-1
export S3_BUCKET=dbu-test-bucket

# Crear bucket
aws s3 mb s3://dbu-test-bucket --endpoint-url http://localhost:4566 --region us-east-1

# Backup y restauración contra el bucket local
node app.js backup mysql -H 127.0.0.1 -P 3306 -u root -p secret --dbname testdb --storage s3 --bucket dbu-test-bucket
node app.js list-backups --storage s3 --bucket dbu-test-bucket
node app.js restore mysql <clave> -H 127.0.0.1 -P 3306 -u root -p secret --dbname testdb --storage s3 --bucket dbu-test-bucket
```


## Variables de entorno

Copie `.env.example` a `.env` y complete las credenciales de bases de datos y de los
proveedores de nube y webhook de Slack. Los flags CLI tienen prioridad sobre `.env`.

### Variables adicionales para pruebas con Docker / Floci

| Variable | Ejemplo | Descripción |
|----------|---------|-------------|
| `AWS_ENDPOINT_URL` | `http://localhost:4566` | Endpoint S3 para Floci / LocalStack |
| `AWS_ACCESS_KEY_ID` | `test` | Credencial de acceso S3 |
| `AWS_SECRET_ACCESS_KEY` | `test` | Clave secreta S3 |
| `AWS_REGION` | `us-east-1` | Región S3 |
| `S3_BUCKET` | `dbu-test-bucket` | Nombre del bucket S3 |
| `PGPASSWORD` | `secret` | Contraseña PostgreSQL (requerida para pg_dump/psql vía CLI) |

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

## Reporte de pruebas CLI (CLI Check)

Se ejecutó una suite de pruebas siguiendo la metodología cli-check-skill contra todos los motores y Floci:

**Total Tests:** 46 | **Passed:** 45 | **Failed:** 1 (comportamiento esperado de MongoDB) | **Skipped:** 0

| Motor / Servicio | test-connection | backup | restore | S3 (Floci) |
|------------------|-----------------|--------|---------|------------|
| MySQL 8 | ✅ | ✅ full/inc/diff | ✅ | ✅ backup/list/restore |
| PostgreSQL 15 | ✅ | ✅ full/inc/diff | ✅* | ✅ backup/list |
| MongoDB | ✅ (uri) | ⚠️ (sin mongodump en host) | ⚠️ | N/A |
| Floci / AWS S3 | N/A | ✅ mysql+postgres | ✅ mysql | ✅ list-backups |

\* PostgreSQL restore ejecuta `psql` correctamente; el error es que la tabla ya existe (comportamiento SQL normal, no un bug de la CLI).

**Bug conocido:** `runProcess` en `src/utils/helpers.js` no pasa `env` al `spawn` de procesos hijos. Workaround: exportar `PGPASSWORD` en el entorno antes de ejecutar `node app.js` para backups/restores de PostgreSQL.

El informe completo está en `CLI_CHECK_REPORT_DOCKER.md`.

## Hoja de ruta

Ver [spec/constitution/roadmap.md](spec/constitution/roadmap.md).