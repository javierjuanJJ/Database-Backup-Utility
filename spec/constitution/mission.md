# Misión

> **Database Backup Utility** — CLI universal de respaldo y restauración de bases de datos.

## Propósito

Proporcionar una utilidad de línea de comandos (CLI) multiplataforma que permita a equipos de
infraestructura y desarrollo **respaldar y restaurar bases de datos relacionales y documentales**
de forma uniforme, repetible y segura, sin depender de la herramienta propietaria de cada motor.

La herramienta unifica el flujo completo de **conexión → backup → compresión → almacenamiento →
notificación → restauración** bajo un único punto de entrada (`app.js`), de modo que un operador
pueda expresar la misma intención con la misma sintaxis para distintas bases de datos.

## Alcance funcional

| Motor | Backup | Restore | Tipo de conexión |
|-------|--------|---------|------------------|
| MySQL / MariaDB | `mysqldump` | `mysql` / `mysql < file` | TCP (host:port) |
| PostgreSQL | `pg_dump` / `pg_dumpall` | `psql` / `pg_restore` | TCP (host:port) |
| MongoDB | `mongodump` (archivo/colecciones) | `mongorestore` | URI (`mongodb://` / `mongodb+srv://`) |
| SQLite | copia de archivo con checkpoint WAL | reemplazo de archivo | Path a archivo `.db` |

## Principios rectores

1. **Seguridad primero.** Las credenciales nunca se registran en logs ni en metadatos. Se aceptan
   por flags CLI, variables de entorno o `.env`, nunca en el código fuente.
2. **Rendimiento en BDs grandes.** Los backups se generan con streaming de datos
   (`spawn` + pipes); la compresión es opcional y por defecto activa (gzip). No se cargan
   volcados completos en memoria.
3. **Usabilidad.** Una CLI predecible: el mismo conjunto de flags para todos los motores.
   Mensajes de error descriptivos con sugerencia de solución.
4. **Multiplataforma.** Windows, Linux y macOS. Solo se requieren binarios estándar
   (`mysqldump`, `pg_dump`, `mongodump`, `tar`/`gzip`) presentes en el sistema operativo
   o instalables por el gestor de paquetes de la plataforma.

## No-metas (explícitamente fuera de alcance)

- No es un sistema de *scheduling* ni orquestador de cron jobs (se integra con cron/CI/CD externos).
- No reemplaza la estrategia de *binary log shipping* / *WAL archiving* de los motores para
  recuperación de punto exacto en el tiempo (PITR); se delega a la configuración nativa del motor.
- No es un clúster ni una solución de replicación.
- No gestiona permisos a nivel de sistema operativo.

## Criterio de éxito

- Un operador puede lanzar `dbu backup postgres --dbname mydb` y obtener un artefacto comprimido
  y almacenado (local o nube) en menos de 5 minutos de configuración.
- La restauración completa o selectiva se documenta y se puede repetir de forma determinista.
- El conjunto completo de características se describe en `spec/` y cada una tiene su
  documentación operativa en `docs/` con instrucciones de cómo revertirla (rollback).