'use strict';

/**
 * Adaptador AWS S3. Usa el SDK v3 modular (@aws-sdk/client-s3).
 * Upload/descarga por streaming para manejar volcados grandes sin buffering.
 */

const fs = require('node:fs');
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} = require('@aws-sdk/client-s3');
const { AppError } = require('../errors');

function s3Store(config) {
  const client = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  function streamToFile(readable, destPath) {
    return new Promise((resolve, reject) => {
      const ws = fs.createWriteStream(destPath);
      readable.on('error', reject);
      ws.on('error', reject);
      ws.on('finish', resolve);
      readable.pipe(ws);
    });
  }

  return Object.freeze({
    kind: 's3',
    bucket: config.bucket,
    async store(localPath, key) {
      const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: fs.createReadStream(localPath),
      });
      try {
        await client.send(command);
      } catch (err) {
        throw new AppError('STORAGE_UPLOAD_FAILED', `No se pudo subir "${key}" a S3 (${config.bucket}).`, {
          detail: err.message,
          cause: err,
        });
      }
      return { key, bucket: config.bucket };
    },
    async fetch(key, destPath) {
      const command = new GetObjectCommand({ Bucket: config.bucket, Key: key });
      try {
        const response = await client.send(command);
        await streamToFile(response.Body, destPath);
      } catch (err) {
        throw new AppError('STORAGE_DOWNLOAD_FAILED', `No se pudo descargar "${key}" desde S3.`, {
          detail: err.message,
          cause: err,
        });
      }
      return { key, path: destPath };
    },
    async list() {
      const command = new ListObjectsV2Command({ Bucket: config.bucket, Prefix: config.prefix });
      try {
        const res = await client.send(command);
        return (res.Contents || [])
          .map((o) => ({
            key: o.Key,
            size: o.Size || 0,
            modifiedAt: o.LastModified,
            storage: 's3',
          }))
          .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
      } catch (err) {
        throw new AppError('STORAGE_LIST_FAILED', `No se pudo listar S3 (${config.bucket}).`, {
          detail: err.message,
          cause: err,
        });
      }
    },
  });
}

module.exports = Object.freeze({ s3Store });