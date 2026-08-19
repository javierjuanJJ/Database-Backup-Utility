'use strict';

/**
 * Servicio de negocio de backup. Es invocada ÚNICAMENTE por app.js.
 * Orquesta: validar motores → normalizar config → validar tipo → producir
 * artefacto (volcado + compresión) → devolver resumen.
 *
 * La integración con almacenamiento externo corresponde a la Feature 003 y el
 * logging persistente a la Feature 004; aquí la salida es local por defecto.
 */

const db = require('../lib/db');
const backup = require('../lib/backup');
const helpers = require('../utils/helpers');
const CONSTS = require('../consts');
const pathMod = require('node:path');

function buildBackedId() {
  const crypto = require('node:crypto');
  return crypto.randomUUID();
}

async function backupDatabase(options = {}) {
  const startedAt = Date.now();
  const config = db.normalizeDbConfig(options.database, options);
  const type = backup.validateBackupType(options.type || 'full', config.type);

  const id = buildBackedId();
  const outDir = options.outDir || CONSTS.DEFAULTS.OUT_DIR;
  const dbName =
    config.type === 'sqlite'
      ? pathMod.basename(config.database, pathMod.extname(config.database))
      : config.database;

  const artifact = await backup.produceArtifact(config, {
    outDir,
    dbName,
    type,
    table: options.table,
    collection: options.collection,
    since: options.since,
    sinceField: options.sinceField,
    schema: options.schema,
    compress: options.compress !== false,
  });

  const file = artifact.file;
  const checksum = await helpers.sha256File(file);
  const durationMs = Date.now() - startedAt;

  return {
    id,
    status: 'success',
    database: config.type,
    dbName: config.database,
    backupType: type,
    file: pathMod.basename(file),
    path: file,
    sizeBytes: artifact.sizeBytes,
    compressed: artifact.compressed,
    checksum,
    durationMs,
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date().toISOString(),
  };
}

module.exports = Object.freeze({
  backupDatabase,
  buildBackedId,
});