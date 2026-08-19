'use strict';

/**
 * Almacenamiento local. El "bucket" es un directorio del sistema de archivos.
 */

const fs = require('node:fs');
const path = require('node:path');
const helpers = require('../../utils/helpers');
const { AppError } = require('../errors');

function localStore(config) {
  const directory = helpers.ensureDir(config.directory);
  return Object.freeze({
    kind: 'local',
    directory,
    async store(localPath, key) {
      const dest = path.join(directory, path.basename(key));
      const src = path.resolve(localPath);
      if (src !== dest) await helpers.copyFile(localPath, dest);
      return { key: path.relative(config.directory, dest), path: dest };
    },
    async fetch(key, destPath) {
      const src = path.resolve(directory, key);
      if (!src.startsWith(directory)) {
        throw new AppError('STORAGE_DOWNLOAD_FAILED', `Clave de almacenamiento inválida: ${key}`, {
          detail: 'La clave debe pertenecer al directorio configurado.',
        });
      }
      if (!fs.existsSync(src)) {
        throw new AppError('STORAGE_DOWNLOAD_FAILED', `El artefacto no existe en el almacenamiento local: ${key}`, {
          detail: `Directorio: ${directory}`,
        });
      }
      await helpers.copyFile(src, destPath);
      return { key, path: destPath };
    },
    async list() {
      return fs
        .readdirSync(directory, { withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => {
          const st = fs.statSync(path.join(directory, e.name));
          return {
            key: e.name,
            size: st.size,
            modifiedAt: st.mtime,
            storage: 'local',
          };
        })
        .sort((a, b) => b.modifiedAt - a.modifiedAt);
    },
  });
}

module.exports = Object.freeze({ localStore });