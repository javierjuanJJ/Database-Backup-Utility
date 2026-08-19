# 001 — Database Connectivity

> Guía operativa de la **Feature 001**: cómo se implementó, cómo funciona, cómo
> usarla y cómo **volver atrás** (rollback) si fuera necesario.

## 1. Resumen

La CLI puede conectarse y validar credenciales contra **MySQL, PostgreSQL, MongoDB y SQLite**
antes de ejecutar operaciones de backup/restore. Proxy la fachada `src/lib/db/index.js`,
que normaliza la configuración (convenciones de URL documentadas por Prisma y MongoDB) y
despacha a un conector específico por motor.

Arquitectura respetada: **`app.js` es el único orquestador** de la excepción principal
(`try/catch` síncrono + `.catch` de promesas); los módulos solo lanzan `AppError`.

## 2. Archivos implicados

| Archivo | Responsabilidad |
|---------|-----------------|
| `src/lib/db/index.js` | Fachada: `assertSupported`, `normalizeDbConfig`, `buildUri`, `testConnection`, `describeConnection`. |
| `src/lib/db/mysql.js` | Ping `mysql2/promise` (`SELECT 1`), timeout 10 s. |
| `src/lib/db/postgres.js` | Ping `pg` (`SELECT 1`), timeout 10 s. |
| `src/lib/db/mongodb.js` | Ping driver oficial `{ ping: 1 }`, `serverSelectionTimeoutMS` 10 s. |
| `src/lib/db/sqlite.js` | Apertura `node:sqlite` + `PRAGMA integrity_check`. |
| `src/lib/db/prisma.js` | Validador **opcional** con Prisma Client (`$connect()`). |
| `app.js` | Comando `test-connection <database>`. |
| `tests/db.test.mjs` | Tests de normalización, URIs y dispatcher. |

## 3. Cómo funciona

1. `dbu test-connection <motor>` construye la configuración con `normalizeDbConfig`.
2. Precedencia de datos: **`--uri` > flags sueltos (`-H/-P/-u/-p/-d`) > variables de entorno**.
3. `testConnection` valida el motor y despacha:
   - `mysql` → `mysql2` `SELECT 1`.
   - `postgres` → `pg` `SELECT 1`.
   - `mongodb` → `mongodb` `{ ping: 1 }`.
   - `sqlite` → `node:sqlite` + `PRAGMA integrity_check`.
4. Si algo falla, se lanza `AppError('CONNECTION_FAILED', ...)` que `app.js` formatea con
   el catálogo de sugerencias (`ERROR_CATALOG` en `src/consts/index.js`).
5. `describeConnection` muestra un resumen seguro **sin contraseñas**.

## 4. Uso

```bash
# MySQL
node app.js test-connection mysql -H 127.0.0.1 -P 3306 -u root -p secret --dbname mydb

# PostgreSQL (con esquema)
node app.js test-connection postgres -H 127.0.0.1 -u app -p secret --dbname app --schema public

# MongoDB (URI)
node app.js test-connection mongodb --uri "mongodb://localhost:27017"

# SQLite (ruta de archivo)
node app.js test-connection sqlite --dbname ./data/app.db

# Usando solo variables de entorno (.env)
node app.js test-connection postgres
```

## 5. Pruebas

```bash
npm test            # incluye tests/db.test.mjs
npm run lint
npm run build
```

> No se requieren bases de datos reales: los tests validan normalización, URIs y dispatch.

## 6. Rollback (cómo volver atrás)

Esta feature es la **Feature 001** y tiene su propio commit. Para revertirla por completo:

```bash
# (1) Ver el commit que introdujo la feature
git log --oneline -- src/lib/db app.js tests/db.test.mjs

# (2) Revertir solo esta feature (sin tocar el resto)
git revert <hash-del-commit-001>
```

Si en lugar de revertir prefieres recuperar el estado **previo** a la feature:

```bash
git checkout b9cbd59 -- app.js           # estado anterior del entrypoint
# o revertir la carpeta completa:
git revert --no-commit <hash-001>
git checkout HEAD -- spec/features/001-database-connectivity docs/001-database-connectivity.md
git commit -m "revert: feature 001 database connectivity"
```

> Nota: la Feature 002 depende de la conectividad de la 001. Si revierte la 001,
> los volcados (002) y restauraciones (005) perderán la validación previa.