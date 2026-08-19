'use strict';

/**
 * Adaptador Azure Blob Storage. Usa el SDK oficial @azure/storage-blob.
 * La autenticación principal es la connection string; se admite cuenta + DefaultAzureCredential
 * si la app dispone de @azure/identity.
 */

const fs = require('node:fs');
const { BlobServiceClient } = require('@azure/storage-blob');
const { AppError } = require('../errors');

function buildService(config) {
  if (config.connectionString) return BlobServiceClient.fromConnectionString(config.connectionString);
  if (config.account) {
    let DefaultAzureCredential = null;
    try {
      ({ DefaultAzureCredential } = require('@azure/identity'));
    } catch {
      /* no instalado */
    }
    if (DefaultAzureCredential) {
      return new BlobServiceClient(
        `https://${config.account}.blob.core.windows.net`,
        new DefaultAzureCredential()
      );
    }
    throw new AppError('MISSING_STORAGE_CREDENTIALS', 'Para Azure se requiere AZURE_STORAGE_CONNECTION_STRING (o instalar @azure/identity para usar cuenta+DefaultAzureCredential).', {
      detail: 'Configure AZURE_STORAGE_CONNECTION_STRING en el entorno o .env',
    });
  }
  throw new AppError('MISSING_STORAGE_CREDENTIALS', 'Faltan credenciales de Azure Blob Storage.', {
    detail: 'Defina AZURE_STORAGE_CONNECTION_STRING (o AZURE_STORAGE_ACCOUNT).',
  });
}

function azureStore(config) {
  const service = buildService(config);
  const containerClient = service.getContainerClient(config.container);

  function downloadToFile(readable, destPath) {
    return new Promise((resolve, reject) => {
      const ws = fs.createWriteStream(destPath);
      readable.on('error', reject);
      ws.on('error', reject);
      ws.on('finish', resolve);
      readable.pipe(ws);
    });
  }

  return Object.freeze({
    kind: 'azure',
    container: config.container,
    async store(localPath, key) {
      const blockBlobClient = containerClient.getBlockBlobClient(key);
      try {
        await blockBlobClient.uploadFile(localPath);
      } catch (err) {
        throw new AppError('STORAGE_UPLOAD_FAILED', `No se pudo subir "${key}" a Azure (${config.container}).`, {
          detail: err.message,
          cause: err,
        });
      }
      return { key, container: config.container };
    },
    async fetch(key, destPath) {
      const blockBlobClient = containerClient.getBlockBlobClient(key);
      try {
        const response = await blockBlobClient.download();
        if (response.errorCode) throw new Error(response.errorCode);
        await downloadToFile(response.readableStreamBody, destPath);
      } catch (err) {
        throw new AppError('STORAGE_DOWNLOAD_FAILED', `No se pudo descargar "${key}" desde Azure.`, {
          detail: err.message,
          cause: err,
        });
      }
      return { key, path: destPath };
    },
    async list() {
      const out = [];
      try {
        const iter = containerClient.listBlobsFlat({ prefix: config.prefix || undefined });
        for await (const blob of iter) {
          out.push({
            key: blob.name,
            size: blob.properties.contentLength || 0,
            modifiedAt: blob.properties.lastModified,
            storage: 'azure',
          });
        }
        return out.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
      } catch (err) {
        throw new AppError('STORAGE_LIST_FAILED', `No se pudo listar Azure (${config.container}).`, {
          detail: err.message,
          cause: err,
        });
      }
    },
  });
}

module.exports = Object.freeze({ azureStore });