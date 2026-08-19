'use strict';

/**
 * Adaptador Google Cloud Storage. Usa el SDK oficial @google-cloud/storage.
 */

const { Storage } = require('@google-cloud/storage');
const { AppError } = require('../errors');

function gcsStore(config) {
  const storage = new Storage({ keyFilename: config.keyFile || undefined });
  const bucket = storage.bucket(config.bucket);

  return Object.freeze({
    kind: 'gcs',
    bucket: config.bucket,
    async store(localPath, key) {
      try {
        await bucket.upload(localPath, { destination: key });
      } catch (err) {
        throw new AppError('STORAGE_UPLOAD_FAILED', `No se pudo subir "${key}" a GCS (${config.bucket}).`, {
          detail: err.message,
          cause: err,
        });
      }
      return { key, bucket: config.bucket };
    },
    async fetch(key, destPath) {
      try {
        await bucket.file(key).download({ destination: destPath });
      } catch (err) {
        throw new AppError('STORAGE_DOWNLOAD_FAILED', `No se pudo descargar "${key}" desde GCS.`, {
          detail: err.message,
          cause: err,
        });
      }
      return { key, path: destPath };
    },
    async list() {
      try {
        const [files] = await bucket.getFiles({ prefix: config.prefix || undefined });
        return files
          .map((f) => ({
            key: f.name,
            size: Number(f.metadata.size || 0),
            modifiedAt: f.metadata.updated ? new Date(f.metadata.updated) : undefined,
            storage: 'gcs',
          }))
          .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
      } catch (err) {
        throw new AppError('STORAGE_LIST_FAILED', `No se pudo listar GCS (${config.bucket}).`, {
          detail: err.message,
          cause: err,
        });
      }
    },
  });
}

module.exports = Object.freeze({ gcsStore });