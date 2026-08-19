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
const { formatError } = require('./src/utils/helpers');

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
 * Arranque en TOP-LEVEL (regla 3). exitOverride hace que Commander lance un
 * CommanderError en lugar de cerrar el proceso, permitiendo el manejo central.
 * La cadena .then/.catch sustituye a async/await y a un método run/main.
 */
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

program.exitOverride();

program.parseAsync(process.argv).then(onSuccess, onError).catch(onError);