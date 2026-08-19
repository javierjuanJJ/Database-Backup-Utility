'use strict';

/**
 * Conector PostgreSQL.
 * Usa pg para el testeo de conexión y pg_dump para los volcados (Feature 002).
 */

const { Client } = require('pg');
const { AppError } = require('../errors');

const CONNECTION_TIMEOUT_MS = 10000;

async function testConnection(config) {
  const client = new Client({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
  });
  try {
    await client.connect();
    if (config.schema) {
      await client.query(`SET search_path TO "${config.schema}"`);
    }
    await client.query('SELECT 1 AS ok');
  } catch (err) {
    throw new AppError('CONNECTION_FAILED', `No se pudo conectar a PostgreSQL en ${config.host}:${config.port}.`, {
      detail: err.message,
      cause: err,
    });
  } finally {
    try {
      await client.end();
    } catch {
      /* cerrar de forma segura */
    }
  }
  return { ok: true };
}

module.exports = Object.freeze({ testConnection, CONNECTION_TIMEOUT_MS });