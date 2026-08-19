# Feature 001 — Database Connectivity

- **Estado:** 🟢 Completada
- **Prioridad:** Alta
- **Dependencias:** ninguna (prerrequisito de 002, 004, 005)
- **Documentación operativa:** [docs/001-database-connectivity.md](../../docs/001-database-connectivity.md)

## Objetivo

Permitir que la CLI se conecte y valide credenciales contra cuatro motores de base de datos
**antes de cualquier operación destructiva o de volcado**, con manejo de errores claro y
sugerencias de solución.

## Alcance

| Motor | Método de conexión | Parámetros |
|-------|--------------------|------------|
| MySQL / MariaDB | `mysql2` (TCP) + `mysqldump` | host, port (3306), user, password, dbname |
| PostgreSQL | `pg` (TCP) + `pg_dump` | host, port (5432), user, password, dbname, schema |
| MongoDB | `mongodb` driver (URI) + `mongodump` | uri o host, port (27017), user, password, dbname |
| SQLite | `node:sqlite` (archivo local) | ruta al archivo `.db` |

## Requisitos funcionales

1. **Entrada unificada**: los mismos flags para todos los motores:
   `-H/--host`, `-P/--port`, `-u/--user`, `-p/--password`, `-d/--dbname`, `--uri`.
2. **`dbu test-connection <database>`**: valida credenciales ejecutando un *ping* trivial
   (`SELECT 1` / `ping: 1` / `PRAGMA integrity_check`) y muestra un mensaje de éxito o un error
   con sugerencia de solución.
3. **Normalización de configuración**: `host`, `port`, `dbname` cuentan con valores por defecto
   por motor; `uri` tiene prioridad sobre los parámetros individuales.
4. **Manejo de errores**: cualquier fallo de conexión se traduce a `AppError` con código del
   catálogo (`CONNECTION_FAILED`) preservando el detalle técnico del motor.
5. **Prisma como referencia**: las URLs de conexión siguen el formato oficial de Prisma
   (`postgresql://`, `mysql://`, y URI estándar para MongoDB) y el validador opcional
   `src/lib/db/prisma.js` permite comprobar la conexión mediante Prisma Client cuando se
   dispone de `DATABASE_URL`.

## Criterios de aceptación

- [ ] `dbu test-connection mysql --dbname x --user u --password p` responde OK o error claro.
- [ ] Un host/puerto cerrado devuelve el error `CONNECTION_FAILED` con sugerencia.
- [ ] Un motor no soportado devuelve `UNSUPPORTED_DATABASE`.
- [ ] Las credenciales nunca aparecen en la salida ni en logs.
- [ ] No se requiere ninguna base de datos para ejecutar la suite de tests unitarios.