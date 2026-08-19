'use strict';

/**
 * Builders de comandos de restauración por motor.
 * Descriptor: { bin, args, env, mode, inputFile?, source?, target? }
 *   - mode 'cli'  : se ejecuta un binario externo.
 *   - mode 'stdin': binario que consume el dump por entrada estándar (mysql).
 *   - mode 'copy' : se copia el archivo restaurado al destino (SQLite).
 */

function buildMysqlRestore(config, inputFile, _options) {
  const args = [];
  if (config.host) args.push(`--host=${config.host}`);
  if (config.port) args.push(`--port=${config.port}`);
  if (config.user) args.push(`--user=${config.user}`);
  if (config.password) args.push(`--password=${config.password}`);
  if (config.database) args.push(config.database);
  return { bin: 'mysql', args, env: {}, mode: 'stdin', inputFile };
}

function buildPostgresRestore(config, inputFile, _options) {
  const args = ['--set', 'ON_ERROR_STOP=on'];
  if (config.host) args.push(`--host=${config.host}`);
  if (config.port) args.push(`--port=${config.port}`);
  if (config.user) args.push(`--username=${config.user}`);
  if (config.database) args.push(`--dbname=${config.database}`);
  args.push(`--file=${inputFile}`);
  const env = {};
  if (config.password) env.PGPASSWORD = String(config.password);
  return { bin: 'psql', args, env, mode: 'cli', inputFile };
}

function buildMongoRestore(config, inputFile, options) {
  const args = [];
  if (config.uri) args.push(`--uri=${config.uri}`);
  if (config.database) args.push(`--db=${config.database}`);
  if (options.collection) args.push(`--nsInclude=${config.database}.${options.collection}`);
  args.push('--gzip', '--drop');
  if (options.archive) {
    args.push(`--archive=${inputFile}`);
  } else {
    args.push(inputFile);
  }
  return { bin: 'mongorestore', args, env: {}, mode: 'cli', inputFile };
}

function buildSqliteRestore(config, inputFile, _options) {
  if (!config.database) throw new Error('buildSqliteRestore: falta el archivo de destino (--dbname).');
  return { bin: 'cp', args: [], env: {}, mode: 'copy', source: inputFile, target: config.database };
}

function buildRestoreCommand(config, options, inputFile) {
  switch (config.type) {
    case 'mysql':
      return buildMysqlRestore(config, inputFile, options);
    case 'postgres':
      return buildPostgresRestore(config, inputFile, options);
    case 'mongodb':
      return buildMongoRestore(config, inputFile, options);
    case 'sqlite':
      return buildSqliteRestore(config, inputFile, options);
    default:
      throw new Error(`buildRestoreCommand: motor no soportado "${config.type}"`);
  }
}

module.exports = Object.freeze({
  buildRestoreCommand,
  buildMysqlRestore,
  buildPostgresRestore,
  buildMongoRestore,
  buildSqliteRestore,
});