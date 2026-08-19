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
const storage = require('../lib/storage');
const loggerMod = require('../lib/logger');
const slackMod = require('../lib/logger/slack');
const helpers = require('../utils/helpers');
const CONSTS = require('../consts');
const pathMod = require('node:path');

function buildBackedId() {
  const crypto = require('node:crypto');
  return crypto.randomUUID();
}

/** Sube el artefacto al almacenamiento indicado y devuelve la clave. */
async function storeArtifact(localFile, kind, options) {
  const store = storage.getStore(kind, options);
  const config = storage.buildStorageConfig(kind, options);
  const key = storage.buildKey(config, pathMod.basename(localFile));
  const uploaded = await store.store(localFile, key);
  return uploaded.key;
}

/** Lista los backups disponibles en el almacenamiento. Devuelve una promesa. */
async function listBackups(options = {}) {
  const kind = storage.resolveStorageKind(options.storage || 'local');
  const store = storage.getStore(kind, options);
  return store.list();
}

/** Envía notificación Slack si hay webhook configurado (best-effort). */
async function notifyIfConfigured(result, options, logger) {
  const webhook = options.slackWebhook || process.env.SLACK_WEBHOOK_URL;
  if (!webhook) return undefined;
  try {
    await slackMod.notifySlack(webhook, result);
  } catch (err) {
    if (logger && typeof logger.warn === 'function') logger.warn('NOTIFY', `Notificación Slack no enviada: ${err.message}`);
  }
}

async function backupDatabase(options = {}) {
  const logger = loggerMod.createLogger({ destDir: options.logDir || CONSTS.DEFAULTS.LOG_DIR });
  const startedAt = Date.now();
  logger.start('BACKUP', `Iniciando backup de ${options.database || '?'}.`, { database: options.database });

  try {
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

    const storageKind = storage.resolveStorageKind(options.storage || 'local');
    const storageKey = await storeArtifact(file, storageKind, options);

    const result = {
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
      storage: storageKind,
      storageKey,
      durationMs,
      startedAt: new Date(startedAt).toISOString(),
      finishedAt: new Date().toISOString(),
    };

    logger.ok('BACKUP', `Backup completado: ${result.file}.`, result, startedAt);
    await notifyIfConfigured(result, options, logger);
    return result;
  } catch (err) {
    logger.error('BACKUP', err, { database: options.database }, startedAt);
    await notifyIfConfigured({ status: 'failed', database: options.database, error: err && err.message }, options, logger);
    throw err;
  }
}

module.exports = Object.freeze({
  backupDatabase,
  listBackups,
  storeArtifact,
  buildBackedId,
});