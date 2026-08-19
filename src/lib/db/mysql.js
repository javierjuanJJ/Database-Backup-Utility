'use strict';

/**
 * Conector MySQL/MariaDB.
 * Usa mysql2/promise para el testeo de conexión y mysqldump para los volcados (Feature 002).
 */

const mysql = require('mysql2/promise');
const { AppError } = require('../errors');

const CONNECTION_TIMEOUT_MS = 10000;

async function testConnection(config) {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      connectTimeout: CONNECTION_TIMEOUT_MS,
    });
    await connection.query('SELECT 1 AS ok');
  } catch (err) {
    throw new AppError('CONNECTION_FAILED', `No se pudo conectar a MySQL en ${config.host}:${config.port}.`, {
      detail: err.message,
      cause: err,
    });
  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch {
        /* cerrar de forma segura */
      }
    }
  }
  return { ok: true };
}

module.exports = Object.freeze({ testConnection, CONNECTION_TIMEOUT_MS });