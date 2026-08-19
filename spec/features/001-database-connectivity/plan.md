# Feature 001 — Database Connectivity: Plan

## Contexto

La conectividad es la base de todo el sistema. Antes de volcar, comprimir, almacenar o restaurar,
la CLI debe poder (1) construir una configuración de conexión normalizada a partir de flags y
variables de entorno, y (2) validarla contra el motor con una operación sin efectos colaterales.

## Estrategia técnica

1. **Módulo fachada** `src/lib/db/index.js`
   - `normalizeDbConfig(type, options)` → configuración normalizada *pura* (testeable).
   - `testConnection(type, options)` → despacha al conector específico por motor.
   - `assertSupported(type)` → valida contra `CONSTS.SUPPORTED_DATABASES`.
   - Reutiliza `ERROR_CATALOG` para traducir excepciones a `AppError`.

2. **Conectores por motor** (un archivo por motor bajo `src/lib/db/`):
   - `mysql.js` → `mysql2/promise` + `SELECT 1`.
   - `postgres.js` → `pg` + `SELECT 1`.
   - `mongodb.js` → `mongodb` + `ping: 1`.
   - `sqlite.js` → `node:sqlite` (`DatabaseSync`) + `PRAGMA integrity_check`.
   - `prisma.js` → validador opcional basado en Prisma Client (`$connect()`), usando el formato
     de URL documentado por Prisma. No es obligatorio para el flujo principal.

3. **Seguridad**: las credenciales se conservan en memoria; los errores se envían al catálogo
   sin exponer contraseñas; el logging (Feature 004) nunca registrará `password`.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| `node:sqlite` no disponible (Node < 22.5) | Requisito Node >= 20 con mensaje claro si falta; SQLite solo usa path local. |
| Contraseñas con caracteres especiales | Se usa `encodeURIComponent` al construir URIs y los drivers aceptan credenciales como parámetro. |
| Timeouts largos al conectar a hosts muertos | Timeout de selección/escucha de 10 s en todos los conectores. |
| Confundir URI con parámetros sueltos | `uri` tiene prioridad documentada y verificada en tests. |

## Plan de tareas (resumen)

1. Definir `normalizeDbConfig` y `assertSupported` (tests incluidos).
2. Implementar conectores mysql, postgres, mongodb, sqlite y prisma (referencia).
3. Registrar el comando `test-connection` en `app.js` (sin funciones `async`, arranque top-level).
4. Escribir documentación operativa con rollback en `docs/001-database-connectivity.md`.
5. Validar con `npm run lint` y `npm test` (sin necesidad de BD reales).