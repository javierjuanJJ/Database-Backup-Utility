'use strict';

/**
 * Conector MongoDB.
 * Usa el driver oficial `mongodb` para el testeo de conexión y mongodump/mongorestore
 * (mongo-tools) para los volcados y restauraciones (Features 002 y 005).
 */

const { MongoClient } = require('mongodb');
const { AppError } = require('../errors');

const SERVER_SELECTION_TIMEOUT_MS = 10000;

async function testConnection(config) {
  const uri = config.uri;
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
  });
  try {
    await client.connect();
    const db = config.database ? client.db(config.database) : client.db();
    await db.command({ ping: 1 });
  } catch (err) {
    throw new AppError('CONNECTION_FAILED', `No se pudo conectar a MongoDB en ${config.uri || config.host}.`, {
      detail: err.message,
      cause: err,
    });
  } finally {
    try {
      await client.close();
    } catch {
      /* cerrar de forma segura */
    }
  }
  return { ok: true };
}

module.exports = Object.freeze({ testConnection, SERVER_SELECTION_TIMEOUT_MS });