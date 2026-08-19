#!/usr/bin/env node
'use strict';

/**
 * app.js — ÚNICO entrypoint orquestador del proyecto.
 *
 * Reglas inviolables (ver spec/constitution/tech-stack.md):
 *  1. Es el único archivo que orquesta el flujo y captura excepciones principales.
 *  2. NO contiene funciones `async`.
 *  3. NO usa métodos `run` ni `main` para arrancar: la app arranca en el TOP-LEVEL
 *     mediante cadenas de promesas (parseAsync(...).then(...).catch(...)).
 *  4. NO contiene lógica de negocio ni de base de datos: delega en src/services.
 */

const { Command } = require('commander');
const pkg = require('./package.json');
const CONSTS = require('./src/consts');
const db = require('./src/lib/db');
const { backupDatabase, listBackups } = require('./src/services/backup');
const { formatError, formatBytes } = require('./src/utils/helpers');

const program = new Command();

program
  .name('dbu')
  .description(`${CONSTS.MESSAGES.BANNER}. ${CONSTS.MESSAGES.WELCOME}`)
  .version(pkg.version, '-v, --version', 'muestra la versión');

function onSuccess() {
  process.exit(CONSTS.EXIT_CODES.OK);
}

/**
 * Manejador de errores compartido. Es la única unidad que presenta excepciones
 * del flujo principal al usuario final (formato ERROR_CATALOG + sugerencia).
 */
function onError(err) {
  const code = err && err.code;
  if (code === 'commander.helpDisplayed' || code === 'commander.version') {
    process.exit(CONSTS.EXIT_CODES.OK);
  }
  process.stderr.write(formatError(err) + '\n');
  process.exit(CONSTS.EXIT_CODES.FAILURE);
}

/**
 * Define las opciones comunes de conexión que comparten todos los comandos.
 */
function attachConnectionOptions(command) {
  return command
    .option('-H, --host <host>', 'host de la base de datos', CONSTS.DEFAULTS.HOST)
    .option('-P, --port <port>', 'puerto de la base de datos')
    .option('-u, --user <user>', 'usuario de la base de datos')
    .option('-p, --password <password>', 'contraseña del usuario')
    .option('-d, --dbname <dbname>', 'nombre de la base de datos (o ruta del archivo en SQLite)')
    .option('--schema <schema>', 'esquema (solo PostgreSQL)')
    .option('--uri <uri>', 'URI de conexión completa (prioridad sobre host/port/user/pass)');
}

/**
 * Acción del comando test-connection. No usa funciones async ni run/main:
 * devuelve la cadena de promesas que Commander resuelve en el top-level.
 */
function testConnectionAction(database, options) {
  let promise;
  try {
    promise = db.testConnection(database, options).then(function onOk(result) {
      if (result && result.ok) {
        const config = db.normalizeDbConfig(database, options);
        process.stdout.write(`Conexión correcta con ${db.describeConnection(config)}.\n`);
      }
    });
  } catch (err) {
    onError(err);
    return undefined;
  }
  return promise;
}

const cmdTestConnection = program
  .command('test-connection <database>')
  .description(CONSTS.MESSAGES.CMD_TEST_DESC);

attachConnectionOptions(cmdTestConnection).action(testConnectionAction);

/**
 * Añade las opciones de almacenamiento a un comando.
 */
function attachStorageOptions(command) {
  return command
    .option('--storage <kind>', 'almacenamiento: local | s3 | gcs | azure', 'local')
    .option('--bucket <bucket>', 'bucket en la nube (S3/GCS)')
    .option('--container <container>', 'contenedor Azure Blob')
    .option('--prefix <prefix>', 'prefijo de las claves en la nube')
    .option('--key-file <keyFile>', 'ruta al JSON de service account de GCS')
    .option('--conn-string <connString>', 'connection string de Azure Blob Storage');
}

/**
 * Acción del comando backup. No usa funciones async ni run/main: devuelve la
 * cadena de promesas que Commander resuelve en el top-level.
 */
function backupAction(database, options) {
  let promise;
  try {
    promise = backupDatabase({ ...options, database }).then(function onOk(result) {
      process.stdout.write(
        `Backup completado -> ${result.file} (${formatBytes(result.sizeBytes)}` +
          `${result.compressed ? ', comprimido' : ''}).\n`
      );
      process.stdout.write(`  checksum sha256: ${result.checksum}\n`);
      process.stdout.write(`  almacenado en ${result.storage}: ${result.storageKey}\n`);
    });
  } catch (err) {
    onError(err);
    return undefined;
  }
  return promise;
}

const cmdBackup = program
  .command('backup <database>')
  .description(CONSTS.MESSAGES.CMD_BACKUP_DESC)
  .option('--type <type>', 'tipo de backup: full | incremental | differential', 'full')
  .option('--table <table>', 'tabla/colección objetivo (backup selectivo/diferencial)')
  .option('--collection <collection>', 'colección MongoDB (backup selectivo)')
  .option('--since <since>', 'fecha ISO para incremental/diferencial (corte temporal)')
  .option('--since-field <field>', 'columna/campo de sello temporal (def.: updated_at|updatedAt)')
  .option('--out-dir <dir>', 'directorio de salida', CONSTS.DEFAULTS.OUT_DIR)
  .option('--no-compress', 'no comprimir el artefacto')
  .option('--log-dir <dir>', 'directorio de logs', CONSTS.DEFAULTS.LOG_DIR)
  .option('--slack-webhook <url>', 'webhook de Slack para notificación al finalizar');

attachStorageOptions(cmdBackup);

attachConnectionOptions(cmdBackup).action(backupAction);

/**
 * Acción del comando list-backups.
 */
function listBackupsAction(options) {
  let promise;
  try {
    promise = listBackups(options).then(function onOk(items) {
      if (!items || !items.length) {
        process.stdout.write('No hay backups almacenados.\n');
        return;
      }
      for (const item of items) {
        process.stdout.write(
          `  ${item.key}\t${formatBytes(item.size)}` +
            `${item.modifiedAt ? `\t${item.modifiedAt.toISOString()}` : ''}\n`
        );
      }
      process.stdout.write(`\n${items.length} backup(s) en ${options.storage || 'local'}.\n`);
    });
  } catch (err) {
    onError(err);
    return undefined;
  }
  return promise;
}

const cmdListBackups = program
  .command('list-backups')
  .description(CONSTS.MESSAGES.CMD_LIST_DESC)
  .option('--out-dir <dir>', 'directorio de salida (almacenamiento local)', CONSTS.DEFAULTS.OUT_DIR);

attachConnectionOptions(cmdListBackups);
attachStorageOptions(cmdListBackups).action(listBackupsAction);

program.exitOverride();

program.parseAsync(process.argv).then(onSuccess, onError).catch(onError);