'use strict';

/**
 * Fachada de almacenamiento. Implementa el patrón estrategia:
 * dado un tipo (local|s3|gcs|azure) y una configuración, devuelve un adaptador
 * con el contrato común { store, fetch, list }.
 */

const CONSTS = require('../../consts');
const { AppError } = require('../errors');
const { localStore } = require('./local');
const { s3Store } = require('./s3');
const { gcsStore } = require('./gcs');
const { azureStore } = require('./azure');

function resolveStorageKind(kind) {
  const k = String(kind || 'local').toLowerCase();
  if (!CONSTS.STORAGE_TYPES.includes(k)) {
    throw new AppError('STORAGE_UNSUPPORTED', `Tipo de almacenamiento "${kind}" no soportado.`, {
      detail: `Tipos: ${CONSTS.STORAGE_TYPES.join(', ')}`,
    });
  }
  return k;
}

/** Normaliza flags CLI + variables de entorno en una configuración por provider. */
function buildStorageConfig(kind, options = {}, env = process.env) {
  const k = resolveStorageKind(kind);
  switch (k) {
    case 'local':
      return {
        kind: k,
        directory: options.outDir || options.directory || env.BACKUP_OUT_DIR || CONSTS.DEFAULTS.OUT_DIR,
      };
    case 's3':
      return {
        kind: k,
        bucket: options.bucket || env.S3_BUCKET,
        prefix: options.prefix || env.S3_PREFIX || '',
        region: options.region || env.AWS_REGION || 'us-east-1',
        accessKeyId: options.accessKeyId || env.AWS_ACCESS_KEY_ID,
        secretAccessKey: options.secretAccessKey || env.AWS_SECRET_ACCESS_KEY,
        sessionToken: options.sessionToken || env.AWS_SESSION_TOKEN || undefined,
      };
    case 'gcs':
      return {
        kind: k,
        bucket: options.bucket || env.GCS_BUCKET,
        prefix: options.prefix || env.GCS_PREFIX || '',
        keyFile: options.keyFile || env.GCS_KEY_FILE || env.GOOGLE_APPLICATION_CREDENTIALS || undefined,
        projectId: options.projectId || env.GCS_PROJECT_ID || undefined,
      };
    case 'azure':
      return {
        kind: k,
        container: options.container || env.AZURE_CONTAINER,
        prefix: options.prefix || env.AZURE_PREFIX || '',
        connectionString:
          options.connString || options.connectionString || env.AZURE_STORAGE_CONNECTION_STRING,
        account: options.account || env.AZURE_STORAGE_ACCOUNT,
      };
    default:
      throw new AppError('STORAGE_UNSUPPORTED', `Tipo de almacenamiento "${kind}" no soportado.`);
  }
}

/** Aplica el prefijo configurado a un nombre de archivo para obtener la clave. */
function buildKey(config, fileName) {
  const prefix = config.prefix || '';
  return `${prefix}${String(fileName).replace(/^\/+/, '')}`;
}

function assertCredentials(config) {
  const missing = [];
  if (config.kind === 's3') {
    if (!config.accessKeyId || !config.secretAccessKey) missing.push('AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY');
    if (!config.bucket) missing.push('S3_BUCKET');
  }
  if (config.kind === 'gcs') {
    if (!config.keyFile) missing.push('GCS_KEY_FILE/GOOGLE_APPLICATION_CREDENTIALS');
    if (!config.bucket) missing.push('GCS_BUCKET');
  }
  if (config.kind === 'azure') {
    if (!config.connectionString && !config.account) missing.push('AZURE_STORAGE_CONNECTION_STRING/AZURE_STORAGE_ACCOUNT');
    if (!config.container) missing.push('AZURE_CONTAINER');
  }
  if (missing.length) {
    throw new AppError(
      'MISSING_STORAGE_CREDENTIALS',
      `Faltan credenciales de almacenamiento para "${config.kind}".`,
      { detail: missing.join(', ') }
    );
  }
  return config;
}

/** Devuelve el adaptador correspondiente al tipo y opciones indicadas. */
function getStore(kind, options = {}) {
  const config = buildStorageConfig(kind, options);
  if (config.kind === 'local') return localStore(config);
  assertCredentials(config);
  if (config.kind === 's3') return s3Store(config);
  if (config.kind === 'gcs') return gcsStore(config);
  return azureStore(config);
}

module.exports = Object.freeze({
  resolveStorageKind,
  buildStorageConfig,
  buildKey,
  assertCredentials,
  getStore,
});