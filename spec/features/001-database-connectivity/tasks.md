# Feature 001 — Database Connectivity: Tasks

Lista de tareas verificables. Marque `[x]` al completar cada una.

## 1. Normalización y validación

- [x] Crear `src/lib/db/index.js` con:
  - [x] `assertSupported(type)` contra `CONSTS.SUPPORTED_DATABASES`.
  - [x] `normalizeDbConfig(type, options)` con defaults por motor y prioridad de `uri`.
  - [x] `testConnection(type, options)` que despacha al conector correspondiente.
  - [x] `testedConnectionSummary(config)` para mensajes de éxito sin exponer credenciales.
- [x] Crear tests unitarios de `normalizeDbConfig` (defaults de puertos, prioridad de uri).

## 2. Conectores por motor

- [x] `src/lib/db/mysql.js` — ping con `mysql2/promise` (`SELECT 1`), timeout 10 s.
- [x] `src/lib/db/postgres.js` — ping con `pg` (`SELECT 1`), timeout 10 s.
- [x] `src/lib/db/mongodb.js` — ping con `mongodb` (`{ ping: 1 }`), serverSelectionTimeoutMS 10 s.
- [x] `src/lib/db/sqlite.js` — apertura de `node:sqlite` + `PRAGMA integrity_check`.
- [x] `src/lib/db/prisma.js` — validador opcional con Prisma Client (`$connect()`).

## 3. CLI

- [x] Registrar el comando `test-connection <database>` en `app.js` con mensajes de éxito/error.
- [x] Comando implementado sin funciones `async`, sin `run`/`main` y con arranque top-level.

## 4. Documentación y calidad

- [x] Escribir `docs/001-database-connectivity.md` (implementación, uso y rollback).
- [x] `npm run lint` sin errores.
- [x] `npm test` todo en verde.