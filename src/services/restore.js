'use strict';

/**
 * Servicio de negocio de restauración. Invocada ÚNICAMENTE por app.js.
 * Orquesta: resolver el origen (path/URI/clave) → descomprimir → restaurar →
 * registrar (START/END/ERROR) y notificar a Slack.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const db = require('../lib/db');
const storage = require('../lib/storage');
const restore = require('../lib/restore');
const loggerMod = require('../lib/logger');
const slackMod = require('../lib/logger/slack');
const helpers = require('../utils/helpers');
const CONSTS = require('../consts');
const { AppError } = require('../lib/errors');

const STORAGE_SCHEME_RE = /^(s3|gcs|azure|loca[l]?):\/\/(.+)$/;

function stagingDir() {
  return helpers.ensureDir(path.join(os.tmpdir(), 'dbu-restore', crypto.randomUUID()));
}

/** Resuelve el origen del artefacto: path local, URI scheme, o clave con --storage. */
async function resolveSource(source, options) {
  if (!source) {
    throw new AppError('FILE_NOT_FOUND', 'Debe indicar el origen del backup a restaurar.', {
      detail: 'Puede ser una ruta local, una URI scheme://, o una clave con --storage.',
    });
  }

  const scheme = STORAGE_SCHEME_RE.exec(source);
  if (scheme) {
    const kind = scheme[1];
    const locator = scheme[2];
    if (kind === 'local') {
      const p = helpers.resolvePath(locator);
      if (!fs.existsSync(p)) throw new AppError('FILE_NOT_FOUND', `No se encontró el archivo local: ${p}`);
      return { kind: 'local', file: p };
    }
    const staging = stagingDir();
    const dest = path.join(staging, path.basename(locator) || 'artifact.bin');
    const store = storage.getStore(kind, options);
    await store.fetch(locator, dest);
    return { kind, file: dest };
  }

  const p = helpers.resolvePath(source);
  if (fs.existsSync(p)) return { kind: 'local', file: p };

  const kind = storage.resolveStorageKind(options.storage || 'local');
  if (kind !== 'local') {
    const staging = stagingDir();
    const dest = path.join(staging, path.basename(source) || 'artifact.bin');
    const store = storage.getStore(kind, options);
    await store.fetch(source, dest);
    return { kind, file: dest };
  }

  throw new AppError('FILE_NOT_FOUND', `No se encontró el origen del backup: ${source}`, {
    detail: 'Verifique la ruta o la clave en el almacenamiento configurado.',
  });
}

async function notifyIfConfigured(result, options, logger) {
  const webhook = options.slackWebhook || process.env.SLACK_WEBHOOK_URL;
  if (!webhook) return undefined;
  try {
    await slackMod.notifySlack(webhook, result);
  } catch (err) {
    if (logger && typeof logger.warn === 'function') logger.warn('NOTIFY', `Notificación Slack no enviada: ${err.message}`);
  }
}

async function restoreDatabase(database, source, options = {}) {
  const logger = loggerMod.createLogger({ destDir: options.logDir || CONSTS.DEFAULTS.LOG_DIR });
  const startedAt = Date.now();
  logger.start('RESTORE', `Iniciando restauración de ${database || '?'}.`, { database });

  try {
    const config = db.normalizeDbConfig(database, options);
    const resolved = await resolveSource(source, options);
    const result = await restore.runRestore(config, options, resolved.file);

    const summary = {
      id: crypto.randomUUID(),
      status: 'success',
      database: config.type,
      dbName: config.database,
      operation: 'restore',
      file: path.basename(resolved.file),
      target: result.target || config.database,
      sourceStorage: resolved.kind,
      durationMs: Date.now() - startedAt,
      startedAt: new Date(startedAt).toISOString(),
      finishedAt: new Date().toISOString(),
    };

    logger.ok('RESTORE', `Restauración completada${result.target ? ` en ${result.target}` : ''}.`, summary, startedAt);
    await notifyIfConfigured(summary, options, logger);
    return summary;
  } catch (err) {
    logger.error('RESTORE', err, { database }, startedAt);
    await notifyIfConfigured(
      { status: 'failed', database, operation: 'restore', error: err && err.message },
      options,
      logger
    );
    throw err;
  }
}

module.exports = Object.freeze({
  restoreDatabase,
  resolveSource,
  stagingDir,
});