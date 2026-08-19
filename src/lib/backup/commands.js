'use strict';

/**
 * Builders de comandos de volcado por motor. Funciones puras que devuelven un
 * descriptor { bin, args, env, mode } listo para ejecutarse con helpers.runProcess.
 *
 * mode:
 *   - 'cli':     se ejecuta un binario externo.
 *   - 'copy':    no hay binario; se copia un archivo del sistema (SQLite).
 */

function escapeArgEnvPair(value) {
  return value == null ? '' : String(value);
}

/** Ruta del binario, respetando variables de entorno globales del sistema. */
function resolveBin(base) {
  if (process.env[`${base.toUpperCase()}_BIN`]) return process.env[`${base.toUpperCase()}_BIN`];
  return base;
}

function buildMysqlDump(config, options) {
  const args = [];
  if (config.host) args.push(`--host=${config.host}`);
  if (config.port) args.push(`--port=${config.port}`);
  if (config.user) args.push(`--user=${config.user}`);
  if (config.password) args.push(`--password=${config.password}`);
  args.push('--single-transaction', '--routines', '--triggers');

  const isDelta = options.type === 'incremental' || options.type === 'differential';
  if (isDelta) {
    // Volcado filtrado sobre la/s tabla/s que cambian, por columna de sello temporal.
    if (options.table) args.push(config.database, '--tables', options.table);
    else args.push(config.database);
    if (options.since) args.push(`--where=${escapeArgEnvPair(options.table ? `${options.sinceField || 'updated_at'} > '${options.since}'` : `1=1`)}`);
  } else {
    args.push('--databases', config.database);
  }

  const outFile = options.outFile;
  if (outFile) args.push(`--result-file=${outFile}`);
  return { bin: resolveBin('mysqldump'), args, env: {}, mode: 'cli' };
}

function buildPostgresDump(config, options) {
  const args = [];
  if (config.host) args.push(`--host=${config.host}`);
  if (config.port) args.push(`--port=${config.port}`);
  if (config.user) args.push(`--username=${config.user}`);
  if (config.database) args.push(`--dbname=${config.database}`);
  if (options.table) {
    args.push(`--table=${escapeArgEnvPair(options.table)}`);
  }
  if (config.schema) args.push(`--schema=${escapeArgEnvPair(config.schema)}`);
  if (options.clean) args.push('--clean', '--if-exists');
  if (options.outFile) args.push(`--file=${options.outFile}`);
  const env = {};
  if (config.password) env.PGPASSWORD = String(config.password);
  return { bin: resolveBin('pg_dump'), args, env, mode: 'cli' };
}

function buildMongodump(config, options) {
  const args = [];
  if (config.uri) args.push(`--uri=${config.uri}`);
  else if (config.host) {
    args.push(`--host=${config.host}`);
    if (config.port) args.push(`--port=${config.port}`);
    if (config.user) args.push(`--username=${config.user}`);
    if (config.password) args.push(`--password=${config.password}`);
  }
  if (config.database) args.push(`--db=${config.database}`);
  if (options.collection) args.push(`--collection=${escapeArgEnvPair(options.collection)}`);
  const isDelta = options.type === 'incremental' || options.type === 'differential';
  if (isDelta && options.since) {
    const field = options.sinceField || 'updatedAt';
    args.push(`--query=${JSON.stringify({ [field]: { $gt: new Date(options.since).toISOString() } })}`);
  }
  args.push('--gzip');
  const outFile = options.outFile;
  if (options.useArchive) args.push(`--archive=${outFile || '-'}`);
  else if (options.outDir) args.push(`--out=${options.outDir}`);
  return { bin: resolveBin('mongodump'), args, env: {}, mode: 'cli' };
}

function buildSqliteCopy(config, options) {
  return { bin: 'cp', args: [], env: {}, mode: 'copy', source: config.database, dest: options.outFile };
}

/** Despacha el builder correcto según el motor. */
function buildDumpCommand(config, options = {}) {
  switch (config.type) {
    case 'mysql':
      return buildMysqlDump(config, options);
    case 'postgres':
      return buildPostgresDump(config, options);
    case 'mongodb':
      return buildMongodump(config, options);
    case 'sqlite':
      return buildSqliteCopy(config, options);
    default:
      throw new Error(`buildDumpCommand: motor no soportado "${config.type}"`);
  }
}

const SQLITE_SOURCE_EXT = '.db';

const ARTIFACT_EXT = Object.freeze({
  mysql: '.sql',
  postgres: '.sql',
  mongodb: '.bin',
  sqlite: '.db',
});

function artifactRawName(config, options) {
  const ts = options.stamp || new Date().toISOString().replace(/[:.]/g, '-');
  const dbLabel = String(options.dbName || config.database || 'db').replace(/[^a-zA-Z0-9._-]/g, '_');
  const ext = ARTIFACT_EXT[config.type] || '';
  return `${config.type}__${dbLabel}__${ts}${ext}`;
}

module.exports = Object.freeze({
  buildDumpCommand,
  buildMysqlDump,
  buildPostgresDump,
  buildMongodump,
  buildSqliteCopy,
  artifactRawName,
  SQLITE_SOURCE_EXT,
});