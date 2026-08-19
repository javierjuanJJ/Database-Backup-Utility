'use strict';

/**
 * Catálogo central de constantes del proyecto.
 * Fuente única de verdad para motores soportados, tipos de backup/storage,
 * códigos de salida y catálogo de errores con sugerencias de solución.
 */

const SUPPORTED_DATABASES = Object.freeze(['mysql', 'postgres', 'mongodb', 'sqlite']);
const STORAGE_TYPES = Object.freeze(['local', 's3', 'gcs', 'azure']);
const BACKUP_TYPES = Object.freeze(['full', 'incremental', 'differential']);

const DEFAULTS = Object.freeze({
  HOST: '127.0.0.1',
  OUT_DIR: './backups',
  LOG_DIR: './logs',
  COMPRESS: true,
  COMPRESSION: 'gzip',
  MYSQL_PORT: 3306,
  POSTGRES_PORT: 5432,
  MONGODB_PORT: 27017,
  MAX_LOG_BYTES: 50 * 1024 * 1024,
});

const EXIT_CODES = Object.freeze({
  OK: 0,
  FAILURE: 1,
});

/**
 * Catálogo de errores. Cada entrada:
 * - message:   mensaje genérico mostrado si la excepción no trae mensaje propio.
 * - solution:  sugerencia concreta de solución para el usuario.
 * Un error lanzado como AppError (ver src/lib/errors.js) transporta su propio
 * `code` para localizar la entrada correcta del catálogo.
 */
const ERROR_CATALOG = Object.freeze({
  UNKNOWN: {
    message: 'Error inesperado.',
    solution: 'Revise la traza completa del error y consulte la documentación en docs/.',
  },
  INVALID_ARGUMENTS: {
    message: 'Argumentos de invocación inválidos o incompletos.',
    solution: 'Ejecute "dbu --help" o "dbu <comando> --help" para ver las opciones requeridas.',
  },
  UNSUPPORTED_DATABASE: {
    message: 'Motor de base de datos no soportado.',
    solution: 'Use uno de: mysql, postgres, mongodb, sqlite.',
  },
  CONNECTION_FAILED: {
    message: 'No fue posible establecer la conexión con la base de datos.',
    solution:
      'Verifique host, puerto, usuario, contraseña y que el servicio esté activo y accesible desde este equipo. ' +
      'Para SQLite confirme que la ruta del archivo sea correcta y tenga permiso de lectura/escritura.',
  },
  DB_CMD_NOT_FOUND: {
    message: 'No se encontró el binario de volcado requerido para este motor.',
    solution:
      'Instale el cliente correspondiente: mysqldump (mysql-client), pg_dump (postgresql-client) o ' +
      'mongodump/mongorestore (mongodb-database-tools). Si ya está instalado, asegúrese de que esté en el PATH.',
  },
  DUMP_FAILED: {
    message: 'La generación del volcado falló durante la ejecución.',
    solution:
      'Revise los permisos del usuario de base de datos (necesita LOCK TABLES o el privilegio adecuado) y el ' +
      'espacio en disco. El error específico del motor se muestra como detalle.',
  },
  RESTORE_FAILED: {
    message: 'La restauración falló durante la ejecución.',
    solution:
      'Verifique que el artefacto de backup sea válido y que el usuario tenga permisos de escritura sobre la ' +
      'base de datos de destino. El error específico del motor se muestra como detalle.',
  },
  STORAGE_UPLOAD_FAILED: {
    message: 'No fue posible subir el artefacto al almacenamiento configurado.',
    solution:
      'Revise credenciales, región/bucket/contenedor y los permisos del cliente de nube (WriteObject / PutObject / BlobWriter).',
  },
  STORAGE_DOWNLOAD_FAILED: {
    message: 'No fue posible descargar el artefacto desde el almacenamiento configurado.',
    solution:
      'Revise credenciales y que el objeto/bucket/container exista en la ubicación indicada. Use dbu list-backups para confirmar.',
  },
  STORAGE_LIST_FAILED: {
    message: 'No fue posible listar los artefactos del almacenamiento.',
    solution: 'Revise las credenciales y la ubicación del bucket/container/prefix.',
  },
  STORAGE_UNSUPPORTED: {
    message: 'Tipo de almacenamiento no soportado.',
    solution: 'Use uno de: local, s3, gcs, azure.',
  },
  FILE_NOT_FOUND: {
    message: 'El archivo o artefacto de backup no existe.',
    solution: 'Indique una ruta o clave (key) válida. Use dbu list-backups para ver los disponibles.',
  },
  NOTIFY_FAILED: {
    message: 'No fue posible enviar la notificación.',
    solution: 'Verifique la URL del webhook de Slack y la conectividad de salida de este equipo.',
  },
  CORRUPT_ARTIFACT: {
    message: 'El artefacto de backup está corrupto o el checksum no coincide.',
    solution: 'Vuelva a generar el backup. El checksum se registra en la metadata backup.json.',
  },
  MISSING_STORAGE_CREDENTIALS: {
    message: 'Faltan credenciales de almacenamiento en la nube.',
    solution:
      'Defina las variables de entorno requeridas (ver .env.example): AWS_*, GCS_*, AZURE_*.',
  },
  UNSUPPORTED_BACKUP_TYPE: {
    message: 'Tipo de backup no soportado por este motor en modo automático.',
    solution:
      'Los motores SQL requieren --since/--table para backup incremental/diferencial automático. ' +
      'Para recuperación de punto exacto use el archivo WAL/binlog del propio motor.',
  },
});

const MESSAGES = Object.freeze({
  BANNER: 'Database Backup Utility',
  WELCOME: 'Utilidad de respaldo y restauración multiplataforma para MySQL, PostgreSQL, MongoDB y SQLite.',
  CMD_TEST_DESC: 'Valida las credenciales y la conectividad contra una base de datos.',
  CMD_BACKUP_DESC: 'Genera un backup (full/incremental/diferencial) y opcionalmente lo almacena.',
  CMD_RESTORE_DESC: 'Restaura total o selectivamente un artefacto de backup.',
  CMD_LIST_DESC: 'Lista los artefactos de backup disponibles en el almacenamiento.',
  CONNECTION_OK: (db) => `Conexión correcta con ${db}.`,
});

module.exports = Object.freeze({
  APP_NAME: 'Database Backup Utility',
  VERSION: '1.0.0',
  SUPPORTED_DATABASES,
  STORAGE_TYPES,
  BACKUP_TYPES,
  DEFAULTS,
  EXIT_CODES,
  ERROR_CATALOG,
  MESSAGES,
});