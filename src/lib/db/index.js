'use strict';

/**
 * Fachada de conectividad. NORMALIZA la configuración de conexión y DESPACHA
 * al conector del motor correspondiente. Es usada por app.js (único orchestrator)
 * y por los servicios de backup/restore para validar credenciales antes de operar.
 *
 * Convenciones de URL basadas en la documentación oficial consultada:
 *   - Prisma (prisma/schema.prisma): postgresql://user:pass@host:port/db ; mysql://...
 *   - MongoDB: mongodb://user:pass@host:port/db  (driver oficial + mongo-tools)
 */

const CONSTS = require('../../consts');
const { AppError } = require('../errors');
const mysqlConn = require('./mysql');
const postgresConn = require('./postgres');
const mongodbConn = require('./mongodb');
const sqliteConn = require('./sqlite');

const PORT_DEFAULTS = Object.freeze({
  mysql: CONSTS.DEFAULTS.MYSQL_PORT,
  postgres: CONSTS.DEFAULTS.POSTGRES_PORT,
  mongodb: CONSTS.DEFAULTS.MONGODB_PORT,
  sqlite: null,
});

function assertSupported(type) {
  if (!CONSTS.SUPPORTED_DATABASES.includes(type)) {
    throw new AppError('UNSUPPORTED_DATABASE', `Motor "${type}" no soportado.`, {
      detail: `Motores soportados: ${CONSTS.SUPPORTED_DATABASES.join(', ')}`,
    });
  }
}

function encodeCred(t) {
  return t == null ? '' : encodeURIComponent(String(t));
}

/** Construye la URI en el formato estándar/Prisma a partir de parámetros sueltos. */
function buildUri(type, config) {
  const db = encodeURIComponent(config.database || '');
  if (type === 'mongodb') {
    const auth = config.user ? `${encodeCred(config.user)}:${encodeCred(config.password)}@` : '';
    return `mongodb://${auth}${config.host}:${config.port}/${db}`;
  }
  if (type === 'postgres') {
    const auth = config.user ? `${encodeCred(config.user)}:${encodeCred(config.password)}@` : '';
    const schema = config.schema ? `?schema=${encodeURIComponent(config.schema)}` : '';
    return `postgresql://${auth}${config.host}:${config.port}/${db}${schema}`;
  }
  if (type === 'mysql') {
    const auth = config.user ? `${encodeCred(config.user)}:${encodeCred(config.password)}@` : '';
    return `mysql://${auth}${config.host}:${config.port}/${db}`;
  }
  return '';
}

/**
 * Normaliza flags/opciones de CLI a una configuración de conexión canónica.
 * Regla de precedencia: `uri` > (host/port/user/password/dbname) > entorno.
 */
function normalizeDbConfig(type, options = {}, env = process.env) {
  assertSupported(type);
  const database = options.dbname || options.database || options.uriDbName || env.DB_NAME || null;
  return {
    type,
    host: options.host || env.DB_HOST || CONSTS.DEFAULTS.HOST,
    port: Number(options.port || env.DB_PORT || PORT_DEFAULTS[type] || 0) || PORT_DEFAULTS[type] || null,
    user: options.user || env.DB_USER || null,
    password: options.password || env.DB_PASS || null,
    database,
    schema: options.schema || null,
    uri: options.uri || options.connectionUri || null,
  };
}

/** Testea la conexión contra el motor correspondiente. Devuelve una promesa. */
function testConnection(type, options = {}) {
  assertSupported(type);
  const config = normalizeDbConfig(type, options);

  if (config.uri) {
    if (type === 'mongodb') return mongodbConn.testConnection({ ...config, uri: config.uri });
    return prismaConn.testConnection(config.uri, type);
  }

  if (type === 'mysql') return mysqlConn.testConnection(config);
  if (type === 'postgres') return postgresConn.testConnection(config);
  if (type === 'mongodb') {
    const uri = buildUri(type, config);
    return mongodbConn.testConnection({ ...config, uri });
  }
  if (type === 'sqlite') return sqliteConn.testConnection(config);

  throw new AppError('UNSUPPORTED_DATABASE', `Motor "${type}" no soportado.`);
}

/** Descripción segura de la conexión (nunca expone contraseñas). */
function describeConnection(config) {
  const base = { mysql: 'MySQL', postgres: 'PostgreSQL', mongodb: 'MongoDB', sqlite: 'SQLite' };
  const label = base[config.type] || config.type;
  if (config.type === 'sqlite') return `${label} en ${config.database}`;
  if (config.uri) return `${label} vía ${config.uri.replace(/\/\/[^@]*@/, '//***:***@')}`;
  return `${label} en ${config.host}:${config.port}/${config.database || ''}`.replace(/\/$/, '');
}

const prismaConn = require('./prisma');

module.exports = Object.freeze({
  assertSupported,
  buildUri,
  normalizeDbConfig,
  testConnection,
  describeConnection,
});