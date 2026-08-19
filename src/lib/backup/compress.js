'use strict';

/**
 * Compresión de artefactos de backup.
 * - gzip para archivos únicos (node:zlib, multiplataforma).
 * - tar.gz para directorios (tar, binario estándar del SO).
 */

const fs = require('node:fs');
const zlib = require('node:zlib');
const { runProcess } = require('../../utils/helpers');

function gzipFile(srcFile, destFile) {
  return new Promise((resolve, reject) => {
    let src;
    let dest;
    try {
      src = fs.createReadStream(srcFile);
      dest = fs.createWriteStream(destFile);
    } catch (err) {
      reject(err);
      return;
    }
    const gz = zlib.createGzip();
    const onError = (err) => {
      src.destroy();
      dest.destroy();
      gz.end();
      reject(err);
    };
    src.on('error', onError);
    dest.on('error', onError);
    gz.on('error', onError);
    dest.on('finish', () => {
      src.destroy();
      dest.destroy();
      resolve(destFile);
    });
    src.pipe(gz).pipe(dest);
  });
}

function gzipDirToTar(srcDir, destTarGz) {
  return runProcess('tar', ['-czf', destTarGz, '-C', srcDir, '.'], {
    errorCode: 'DUMP_FAILED',
  }).then(() => destTarGz);
}

/**
 * Comprime la fuente detectando si es archivo o directorio.
 * Devuelve la ruta del artefacto comprimido.
 */
async function compressArtifact(source) {
  const stat = fs.statSync(source);
  const dest = stat.isDirectory() ? `${source}.tar.gz` : `${source}.gz`;
  if (stat.isDirectory()) return gzipDirToTar(source, dest);
  return gzipFile(source, dest);
}

module.exports = Object.freeze({ gzipFile, gzipDirToTar, compressArtifact });