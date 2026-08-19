'use strict';

/**
 * Conector SQLite.
 * Usa el módulo nativo `node:sqlite` (Node >= 22). Para backups se hace copia con
 * checkpoint de WAL (Feature 002) y para restore se reemplaza el archivo (Feature 005).
 */

const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const { AppError } = require('../errors');

function assertNodeSqlite() {
  try {
    require('node:sqlite');
  } catch (err) {
    throw new AppError('CONNECTION_FAILED', 'El módulo node:sqlite no está disponible en esta versión de Node.js.', {
      detail: err.message,
      cause: err,
    });
  }
}

function testConnection(config) {
  assertNodeSqlite();
  const dbPath = config.database;
  if (!dbPath) {
    throw new AppError('INVALID_ARGUMENTS', 'Para SQLite debe indicar la ruta del archivo con --dbname.', {
      detail: 'dbname/database requerido para sqlite',
    });
  }
  if (!fs.existsSync(dbPath)) {
    throw new AppError('CONNECTION_FAILED', `El archivo SQLite no existe: ${dbPath}`, {
      detail: 'Verifique la ruta indicada y que el archivo exista.',
    });
  }
  let db;
  try {
    db = new DatabaseSync(dbPath, { readOnly: false });
    db.exec('PRAGMA integrity_check;');
    db.exec('PRAGMA schema_version;');
  } catch (err) {
    throw new AppError('CONNECTION_FAILED', `No se pudo abrir el archivo SQLite ${dbPath}.`, {
      detail: err.message,
      cause: err,
    });
  } finally {
    if (db) db.close();
  }
  return { ok: true };
}

module.exports = Object.freeze({
  testConnection,
  assertNodeSqlite,
});