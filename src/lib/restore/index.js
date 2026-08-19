'use strict';

/**
 * Núcleo de restauración: descompresión y ejecución de los comandos de restore.
 */

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const helpers = require('../../utils/helpers');
const { AppError } = require('../errors');
const { buildRestoreCommand } = require('./commands');

/** Descomprime un archivo gzip a destFile usando node:zlib. */
function gunzipFile(srcFile, destFile) {
  return new Promise((resolve, reject) => {
    const rs = fs.createReadStream(srcFile);
    const ws = fs.createWriteStream(destFile);
    const gunzip = zlib.createGunzip();
    rs.on('error', reject);
    ws.on('error', reject);
    gunzip.on('error', (err) => {
      ws.destroy();
      reject(
        new AppError('CORRUPT_ARTIFACT', `No se pudo descomprimir el artefacto ${srcFile}.`, {
          detail: err.message,
          cause: err,
        })
      );
    });
    ws.on('finish', () => resolve(destFile));
    rs.pipe(gunzip).pipe(ws);
  });
}

/** Si el archivo es gzip, lo descomprime a dir y devuelve la ruta plana. */
async function decompressIfNeeded(srcFile, dir) {
  if (!helpers.isGzipFile(srcFile)) return srcFile;
  const out = path.join(dir, path.basename(srcFile).replace(/\.gz$/i, '') || 'restore.bin');
  if (fs.existsSync(out)) fs.rmSync(out, { force: true });
  return gunzipFile(srcFile, out);
}

/** Copia a destino de forma atómica (SQLite). */
async function atomicCopy(source, target) {
  const dir = path.dirname(target);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.restore-${process.pid}-${Date.now()}.tmp`);
  try {
    await helpers.copyFile(source, tmp);
    fs.renameSync(tmp, target);
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    throw new AppError('RESTORE_FAILED', `No se pudo restaurar el archivo en ${target}.`, {
      detail: err.message,
      cause: err,
    });
  }
  return target;
}

/**
 * Ejecuta la restauración para el motor dado.
 * Devuelve un resumen { bin, mode, target? }.
 */
async function runRestore(config, options, inputFile) {
  const crypto = require('node:crypto');
  const staging = helpers.ensureDir(
    path.join(require('node:os').tmpdir(), 'dbu-restore', crypto.randomUUID())
  );
  if (config.type === 'mongodb') {
    // mongorestore consume el archivo .gz con --gzip y devuelve el propio staging.
    const command = buildRestoreCommand(config, options, inputFile);
    await helpers.runProcess(command.bin, command.args, {
      env: { ...process.env, ...command.env },
      errorCode: 'RESTORE_FAILED',
    });
    return { bin: command.bin, mode: command.mode };
  }

  const processed = await decompressIfNeeded(inputFile, staging);
  const command = buildRestoreCommand(config, options, processed);

  if (command.mode === 'copy') {
    const target = await atomicCopy(command.source, command.target);
    return { bin: 'copy', mode: 'copy', target };
  }

  await helpers.runProcess(command.bin, command.args, {
    env: { ...process.env, ...command.env },
    inputFile: command.mode === 'stdin' ? processed : undefined,
    errorCode: 'RESTORE_FAILED',
  });
  return { bin: command.bin, mode: command.mode };
}

module.exports = Object.freeze({
  gunzipFile,
  decompressIfNeeded,
  atomicCopy,
  runRestore,
});